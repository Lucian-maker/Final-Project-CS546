import { v4 as uuidv4 } from "uuid";
import { evidence, users, violations } from "../config/mongoCollections.js";
import { parseEvidenceImageDataUri, checkId, checkString } from "../helpers.js";

export const EVIDENCE_TYPES = Object.freeze(["photo", "note"]);

async function loadUser(userId) {
	const col = await users();
	const u = await col.findOne({ _id: checkId(userId, "userId") });
	if (!u) {
		throw `User not found`;
	}
	return u;
}

function assertPropertyAccess(dbUser, propertyId) {
	checkId(propertyId, "propertyId");

	if (!dbUser) {
		throw `You must be signed in to access evidence`;
	}

	if (dbUser.userRole === "admin") return;

	const saved = dbUser.savedProperties || [];
	const owned =
		dbUser.userRole === "landlord" ? dbUser.ownedProperties || [] : [];

	if (!saved.includes(propertyId) && !owned.includes(propertyId)) {
		throw `You do not have access to evidence for this property`;
	}
}

/**
 * @param {object} opts
 * @param {string} opts.violationId
 * @param {string} opts.uploadedByUserId
 * @param {string} opts.evidenceType - photo (base64 data URI from client) | note
 * @param {string} [opts.imageData] - required for photo: data:image/...;base64,... (JPEG, PNG, GIF, WebP)
 * @param {string} [opts.originalFileName] - optional original filename from upload
 * @param {string} [opts.caption]
 * @param {string} [opts.noteText]
 * @param {Date} [opts.capturedAt]
 */
export const createEvidence = async (opts) => {
	const violationId = checkId(opts.violationId, "violationId");
	const uploadedByUserId = checkId(opts.uploadedByUserId, "userId");
	const evidenceType = checkString(
		opts.evidenceType,
		"evidenceType",
	).toLowerCase();

	if (!EVIDENCE_TYPES.includes(evidenceType)) {
		throw `evidenceType must be one of: ${EVIDENCE_TYPES.join(", ")}`;
	}

	const vCol = await violations();
	const violation = await vCol.findOne({ _id: violationId });
	if (!violation) {
		throw `Violation not found`;
	}

	const dbUser = await loadUser(uploadedByUserId);
	assertPropertyAccess(dbUser, violation.propertyId);

	const caption =
		opts.caption !== undefined &&
		opts.caption !== null &&
		String(opts.caption).trim() !== ""
			? checkString(opts.caption, "caption").slice(0, 500)
			: "";

	const noteText =
		opts.noteText !== undefined && opts.noteText !== null
			? String(opts.noteText).trim().slice(0, 2000)
			: "";

	const now = new Date();
	const capturedAt = opts.capturedAt
		? opts.capturedAt instanceof Date
			? opts.capturedAt
			: new Date(opts.capturedAt)
		: now;

	let fileName = "";
	let fileUrl = "";
	let mimeType = "";
	let fileSize = 0;

	if (evidenceType === "photo") {
		const parsed = parseEvidenceImageDataUri(opts.imageData, "image");
		fileUrl = parsed.dataUri;
		mimeType = parsed.mimeType;
		fileSize = parsed.fileSize;

		if (
			opts.originalFileName &&
			String(opts.originalFileName).trim() !== ""
		) {
			const raw = checkString(opts.originalFileName, "fileName").slice(
				0,
				255,
			);
			fileName = raw.replace(/^.*[/\\]/, "").trim() || "image";
		} else {
			fileName = "image";
		}

		if (!noteText && !caption) {
			throw `Provide a caption or note text with the image`;
		}
	} else {
		if (!noteText) {
			throw `noteText is required for a text-only evidence entry`;
		}
	}

	const newDoc = {
		_id: `evid-${uuidv4()}`,
		violationId,
		propertyId: violation.propertyId,
		uploadedByUserId,
		evidenceType,
		fileName,
		fileUrl,
		mimeType,
		fileSize,
		caption,
		noteText,
		capturedAt,
		uploadedAt: now,
		isDeleted: false,
	};

	const eCol = await evidence();
	const ins = await eCol.insertOne(newDoc);
	if (!ins.acknowledged) {
		throw `Could not save evidence`;
	}

	return newDoc;
};

export const getEvidenceById = async (id) => {
	const clean = checkId(id, "evidenceId");
	const eCol = await evidence();
	const doc = await eCol.findOne({ _id: clean, isDeleted: false });

	if (!doc) {
		throw `Evidence not found`;
	}

	return doc;
};

export const getEvidenceByViolation = async (violationId) => {
	const clean = checkId(violationId, "violationId");
	const eCol = await evidence();

	return eCol
		.find({ violationId: clean, isDeleted: false })
		.sort({ uploadedAt: -1 })
		.toArray();
};

export const listEvidenceForSessionUser = async (sessionUser, filters = {}) => {
	const dbUser = await loadUser(sessionUser._id);
	const eCol = await evidence();

	const baseConditions = [{ isDeleted: false }];

	if (dbUser.userRole !== "admin") {
		const saved = dbUser.savedProperties || [];
		const owned =
			dbUser.userRole === "landlord"
				? dbUser.ownedProperties || []
				: [];

		const accessiblePropertyIds = [...new Set([...saved, ...owned])];

		baseConditions.push({
			propertyId: { $in: accessiblePropertyIds },
		});
	}

	if (filters.violationId) {
		const vid = checkId(filters.violationId, "violationId");
		baseConditions.push({ violationId: vid });
	}

	if (filters.propertyId) {
		const pid = checkId(filters.propertyId, "propertyId");
		assertPropertyAccess(dbUser, pid);
		baseConditions.push({ propertyId: pid });
	}

	if (filters.evidenceType) {
		const type = checkString(
			filters.evidenceType,
			"evidenceType",
		).toLowerCase();

		if (!EVIDENCE_TYPES.includes(type)) {
			throw `evidenceType must be one of: ${EVIDENCE_TYPES.join(", ")}`;
		}

		baseConditions.push({ evidenceType: type });
	}

	if (filters.q) {
		const q = checkString(filters.q, "search");

		baseConditions.push({
			$or: [
				{ caption: { $regex: q, $options: "i" } },
				{ noteText: { $regex: q, $options: "i" } },
				{ fileName: { $regex: q, $options: "i" } },
			],
		});
	}

	const query = { $and: baseConditions };

	return eCol.find(query).sort({ uploadedAt: -1 }).toArray();
};

export const softDeleteEvidence = async (evidenceId, sessionUser) => {
	const doc = await getEvidenceById(evidenceId);
	const dbUser = await loadUser(sessionUser._id);

	const owned = dbUser.ownedProperties || [];

	const canDelete =
		dbUser.userRole === "admin" ||
		doc.uploadedByUserId === dbUser._id ||
		(dbUser.userRole === "landlord" && owned.includes(doc.propertyId));

	if (!canDelete) {
		throw `You may only delete evidence you uploaded or evidence for properties you own`;
	}

	const eCol = await evidence();
	const res = await eCol.updateOne(
		{ _id: doc._id },
		{ $set: { isDeleted: true } },
	);

	if (!res.modifiedCount && !res.matchedCount) {
		throw `Could not delete evidence`;
	}

	return { deleted: true, _id: doc._id };
};