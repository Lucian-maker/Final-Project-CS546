import { v4 as uuidv4 } from "uuid";
import { properties, users, violations } from "../config/mongoCollections.js";
import { checkId, checkString } from "../helpers.js";

export const VIOLATION_STATUSES = Object.freeze([
	"Open",
	"Repair Scheduled",
	"Resolved",
	"Closed",
	"Disputed",
]);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const computeDeadlineFields = (originalCertifyByDate) => {
	if (originalCertifyByDate == null || originalCertifyByDate === "") {
		return { daysRemaining: null, isActionable: false };
	}
	const deadline = new Date(originalCertifyByDate);
	if (Number.isNaN(deadline.getTime())) {
		return { daysRemaining: null, isActionable: false };
	}
	const now = new Date();
	const startToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	const startDeadline = new Date(
		deadline.getFullYear(),
		deadline.getMonth(),
		deadline.getDate(),
	);
	const diffMs = startDeadline.getTime() - startToday.getTime();
	const daysRemaining = Math.ceil(diffMs / 86400000);
	const isActionable = now.getTime() >= deadline.getTime();
	return {
		daysRemaining: Math.max(0, daysRemaining),
		isActionable,
	};
};

export const getAllViolations = async () => {
	const col = await violations();
	const rows = await col.find({}).sort({ updatedAt: -1 }).toArray();
	return rows.map((v) => ({
		...v,
		...computeDeadlineFields(v.originalCertifyByDate),
	}));
};

/**
 * @param {object} filters
 * @param {string} [filters.borough]
 * @param {string} [filters.violationType]
 * @param {string} [filters.violationStatus]
 * @param {string} [filters.propertyId]
 * @param {string} [filters.q] - search buildingAddress / violationDescription
 * @param {string} [filters.sort] - updatedAt | originalCertifyByDate | buildingAddress
 * @param {string} [filters.order] - asc | desc
 */
export const getViolations = async (filters = {}) => {
	const col = await violations();
	const propertyCollection = await properties();

	const query = {};

	if (filters.propertyId) {
		query.propertyId = checkId(filters.propertyId, "propertyId");
	}

	if (
		filters._restrictedPropertyIds &&
		filters._restrictedPropertyIds.length > 0
	) {
		const normalizedRestricted = filters._restrictedPropertyIds.map(String);

		if (query.propertyId) {
			if (!normalizedRestricted.includes(String(query.propertyId))) {
				return [];
			}
		} else {
			query.propertyId = {
				$in: normalizedRestricted,
			};
		}
	}

	if (filters.borough) {
		query.borough = checkString(filters.borough, "borough");
	}

	if (filters.violationStatus) {
		const st = checkString(filters.violationStatus, "violationStatus");

		if (!VIOLATION_STATUSES.includes(st)) {
			throw `violationStatus must be one of: ${VIOLATION_STATUSES.join(", ")}`;
		}

		query.violationStatus = st;
	}

	if (filters.violationType) {
		const t = checkString(filters.violationType, "violationType");

		query.violationType = {
			$regex: escapeRegex(t),
			$options: "i",
		};
	}

	let sortField = "updatedAt";

	if (filters.sort) {
		const s = checkString(filters.sort, "sort");

		const allowed = [
			"updatedAt",
			"originalCertifyByDate",
			"buildingAddress",
		];

		if (!allowed.includes(s)) {
			throw `sort must be one of: ${allowed.join(", ")}`;
		}

		sortField = s;
	}

	const order = filters.order === "asc" ? 1 : -1;
	const sort = { [sortField]: order };

	const rows = await col.find(query).sort(sort).toArray();

	const enriched = await Promise.all(
		rows.map(async (v) => {
			const property = await propertyCollection.findOne({
				_id: v.propertyId,
			});

			let buildingAddress = "Unknown Address";

			if (property?.address) {
				const addr = property.address;

				buildingAddress =
					`${addr.number} ${addr.street}, ` +
					`${addr.city}, ${addr.state} ${addr.zipCode}`;
			}

			return {
				...v,
				buildingAddress,
				normalizedAddress: buildingAddress.toLowerCase(),
				...computeDeadlineFields(v.originalCertifyByDate),
			};
		}),
	);

	if (filters.q) {
		const q = checkString(filters.q, "search").toLowerCase();

		return enriched.filter(
			(v) =>
				v.buildingAddress.toLowerCase().includes(q) ||
				v.normalizedAddress.includes(q) ||
				v.violationDescription.toLowerCase().includes(q),
		);
	}

	return enriched;
};

/**
 * List violations scoped to the user's role (admin: all; landlord: owned;
 * tenant: saved properties).
 */
export const getViolationsForSessionUser = async (
	sessionUser,
	queryFilters = {},
) => {
	if (!sessionUser?._id) {
		throw "You must be signed in to view violations";
	}

	const dbUser = await loadUserForAuth(sessionUser._id);
	const filters = { ...queryFilters };
	delete filters._restrictedPropertyIds;

	if (dbUser.userRole === "admin") {
		return getViolations(filters);
	}

	const props =
		dbUser.userRole === "landlord"
			? dbUser.ownedProperties || []
			: dbUser.savedProperties || [];

	if (props.length === 0) {
		return [];
	}

	if (filters.propertyId) {
		const pid = checkId(filters.propertyId, "propertyId");
		if (!props.includes(pid)) {
			return [];
		}
	} else {
		filters._restrictedPropertyIds = props;
	}

	return getViolations(filters);
};

export const getViolationById = async (id) => {
	const cleanId = checkId(id, "violationId");

	const col = await violations();
	const propertyCollection = await properties();

	const v = await col.findOne({ _id: cleanId });

	if (!v) {
		throw "Violation not found";
	}

	const property = await propertyCollection.findOne({
		_id: v.propertyId,
	});

	let buildingAddress = "Unknown Address";

	if (property?.address) {
		const addr = property.address;

		buildingAddress =
			`${addr.number} ${addr.street}, ` +
			`${addr.city}, ${addr.state} ${addr.zipCode}`;
	}

	return {
		...v,
		buildingAddress,
		normalizedAddress: buildingAddress.toLowerCase(),
		...computeDeadlineFields(v.originalCertifyByDate),
	};
};

export const getViolationsByPropertyId = async (propertyId) => {
	const pid = checkId(propertyId, "propertyId");
	const col = await violations();
	const results = await col.find({ propertyId: pid }).toArray();
	return results.map((v) => ({
		...v,
		...computeDeadlineFields(v.originalCertifyByDate),
	}));
};

export const createViolation = async (data) => {
	if (!data) throw "No data provided";

	const collection = await violations();
	const propertyCollection = await properties();

	const propertyId = checkId(data.propertyId, "propertyId");
	const property = await propertyCollection.findOne({ _id: propertyId });

	if (!property) throw "Invalid propertyId";
	const addr = property.address;
	const buildingAddress = `${addr.number} ${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}`;

	const violationType = checkString(data.violationType, "type");
	const violationDescription = checkString(
		data.violationDescription,
		"description",
	);

	const newViolation = {
		_id: `viol-${uuidv4()}`,
		propertyId,

		buildingAddress,
		normalizedAddress: buildingAddress.toLowerCase(),

		violationType,
		violationDescription,

		violationStatus: "Open",

		borough: data.borough || "Unspecified",
		zipCode: property.address.zipCode || "",

		originalCertifyByDate: data.originalCertifyByDate || null,

		repairScheduledAt: null,
		resolvedAt: null,

		daysRemaining: null,
		isActionable: false,

		remediationStatus: {
			currentState: "Open",
			updatedByUserId: null,
			updatedAt: new Date(),
		},

		statusHistory: [
			{
				state: "Open",
				changedAt: new Date(),
				changedBy: "system",
			},
		],

		createdAt: new Date(),
		updatedAt: new Date(),
	};

	await collection.insertOne(newViolation);

	await propertyCollection.updateOne(
		{ _id: propertyId },
		{ $push: { violations: newViolation._id } },
	);

	return getViolationById(newViolation._id);
};

export const searchViolations = async (query) => {
	const q = checkString(query, "search query");
	const col = await violations();
	const rx = escapeRegex(q);
	const results = await col
		.find({
			$or: [
				{ buildingAddress: { $regex: rx, $options: "i" } },
				{ violationType: { $regex: rx, $options: "i" } },
				{ violationStatus: { $regex: rx, $options: "i" } },
				{ borough: { $regex: rx, $options: "i" } },
				{ zipCode: { $regex: rx, $options: "i" } },
			],
		})
		.toArray();

	return results.map((v) => ({
		...v,
		...computeDeadlineFields(v.originalCertifyByDate),
	}));
};

async function loadUserForAuth(userId) {
	const cleanId = checkId(userId, "userId");
	const col = await users();
	const user = await col.findOne({ _id: cleanId });
	if (!user) {
		throw `User not found`;
	}
	return user;
}

function assertCanActOnViolation(dbUser, violation) {
	if (!dbUser) {
		throw `You must be signed in to access this violation`;
	}

	if (!violation) {
		throw `Violation not found`;
	}

	return;
}

/**
 * Ensures the logged-in user may view or update this violation (same rule as remediation).
 */
export const assertUserCanAccessViolation = async (
	sessionUser,
	violationId,
) => {

	if (!sessionUser?._id) {
		throw "You must be signed in to access this violation";
	}
	const cleanId = checkId(violationId, "violationId");
	const dbUser = await loadUserForAuth(sessionUser._id);
	const col = await violations();
	const violation = await col.findOne({ _id: cleanId });
	if (!violation) {
		throw `Violation not found`;
	}
	assertCanActOnViolation(dbUser, violation);
	return { dbUser, violation };
};

function assertTransitionAllowed(role, currentStatus, newStatus) {
	if (!VIOLATION_STATUSES.includes(newStatus)) {
		throw `Invalid violation status`;
	}

	return;
}

/**
 * @param {string} violationId
 * @param {{ _id: string, userRole: string }} sessionUser
 * @param {{ newStatus: string, notes?: string }} payload
 */
export const updateViolationRemediation = async (
	violationId,
	sessionUser,
	payload,
) => {
	const cleanVid = checkId(violationId, "violationId");
	const newStatus = checkString(payload.newStatus, "newStatus");
	const notesRaw =
		payload.notes !== undefined && payload.notes !== null
			? String(payload.notes).trim()
			: "";
	const notes =
		notesRaw.length > 0 ? notesRaw.slice(0, 2000) : "Status updated.";

	const { dbUser, violation } = await assertUserCanAccessViolation(
		sessionUser,
		cleanVid,
	);
	const col = await violations();

	if (violation.violationStatus === newStatus) {
		throw `Violation is already marked as "${newStatus}"`;
	}
	assertTransitionAllowed(
		dbUser.userRole,
		violation.violationStatus,
		newStatus,
	);

	const now = new Date();
	const changedBy = dbUser.userRole === "admin" ? dbUser._id : dbUser._id;

	const { daysRemaining, isActionable } = computeDeadlineFields(
		violation.originalCertifyByDate,
	);

	const statusEntry = {
		state: newStatus,
		changedAt: now,
		changedBy,
	};

	const updateDoc = {
		$set: {
			violationStatus: newStatus,
			lastUpdatedByUserId: dbUser._id,
			updatedAt: now,
			daysRemaining,
			isActionable,
			remediationStatus: {
				currentState: newStatus,
				updatedByUserId: dbUser._id,
				updatedAt: now,
				notes,
			},
		},
		$push: { statusHistory: statusEntry },
	};

	const result = await col.updateOne({ _id: cleanVid }, updateDoc);
	if (!result.matchedCount) {
		throw `Could not update violation`;
	}

	return getViolationById(cleanVid);
};
