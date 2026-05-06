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

/** Calendar-day difference from today to deadline (0 once deadline day has passed). */
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
	const query = {};

	if (
		filters._restrictedPropertyIds &&
		filters._restrictedPropertyIds.length > 0
	) {
		query.propertyId = { $in: filters._restrictedPropertyIds };
	} else if (filters.propertyId) {
		query.propertyId = checkId(filters.propertyId, "propertyId");
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
		query.violationType = { $regex: escapeRegex(t), $options: "i" };
	}
	if (filters.q) {
		const q = checkString(filters.q, "search");
		query.$or = [
			{ buildingAddress: { $regex: escapeRegex(q), $options: "i" } },
			{ violationDescription: { $regex: escapeRegex(q), $options: "i" } },
			{
				normalizedAddress: {
					$regex: escapeRegex(q.toLowerCase()),
					$options: "i",
				},
			},
		];
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
	return rows.map((v) => ({
		...v,
		...computeDeadlineFields(v.originalCertifyByDate),
	}));
};

/**
 * List violations scoped to the user's role (admin: all; landlord: owned;
 * tenant: saved properties).
 */
export const getViolationsForSessionUser = async (
	sessionUser,
	queryFilters = {},
) => {
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
	const v = await col.findOne({ _id: cleanId });
	if (!v) {
		throw `Violation not found`;
	}
	return {
		...v,
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

	const propertyId = checkId(data.propertyId, "propertyId");
	const buildingAddress = checkString(data.buildingAddress, "address");
	const violationType = checkString(data.violationType, "type");
	const violationDescription = checkString(
		data.violationDescription,
		"description",
	);

	const originalCertifyByDate = data.originalCertifyByDate || null;
	const deadlineFields = originalCertifyByDate
		? computeDeadlineFields(originalCertifyByDate)
		: { daysRemaining: null, isActionable: false };

	const newViolation = {
		_id: `viol-${uuidv4()}`,
		propertyId,
		buildingAddress,
		normalizedAddress: buildingAddress.toLowerCase(),

		violationType,
		violationDescription,
		violationStatus: "Open",

		violationClass: data.violationClass || "B",
		borough: data.borough || "",
		zipCode: data.zipCode || "",

		originalCertifyByDate,
		inspectionDate: data.inspectionDate || null,

		repairScheduledAt: null,
		resolvedAt: null,

		daysRemaining: deadlineFields.daysRemaining,
		isActionable: deadlineFields.isActionable,

		remediationStatus: {
			currentState: "Open",
			updatedByUserId: null,
			updatedAt: new Date(),
			notes: "",
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

	const result = await collection.insertOne(newViolation);
	if (!result.acknowledged) throw "Could not create violation";

	const propCollection = await properties();
	await propCollection.updateOne(
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

export const updateViolationStatus = async (
	id,
	newStatus,
	userId = "admin",
) => {
	const vid = checkId(id, "violationId");
	newStatus = checkString(newStatus, "status");
	if (!VIOLATION_STATUSES.includes(newStatus)) {
		throw `status must be one of: ${VIOLATION_STATUSES.join(", ")}`;
	}

	const collection = await violations();

	const updateInfo = await collection.updateOne(
		{ _id: vid },
		{
			$set: {
				violationStatus: newStatus,
				"remediationStatus.currentState": newStatus,
				"remediationStatus.updatedByUserId": userId,
				"remediationStatus.updatedAt": new Date(),
				updatedAt: new Date(),
			},
			$push: {
				statusHistory: {
					state: newStatus,
					changedAt: new Date(),
					changedBy: userId,
				},
			},
		},
	);

	if (updateInfo.modifiedCount === 0) throw "Could not update violation";

	return getViolationById(vid);
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
	const propId = violation.propertyId;
	if (dbUser.userRole === "admin") {
		return;
	}
	if (dbUser.userRole === "landlord") {
		const owned = dbUser.ownedProperties || [];
		if (owned.includes(propId)) {
			return;
		}
	}
	if (dbUser.userRole === "tenant") {
		const saved = dbUser.savedProperties || [];
		if (saved.includes(propId)) {
			return;
		}
	}
	throw `You do not have permission to access this violation`;
}

/**
 * Ensures the logged-in user may view or update this violation (same rule as remediation).
 */
export const assertUserCanAccessViolation = async (
	sessionUser,
	violationId,
) => {
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
	if (role === "admin") {
		return;
	}
	if (role === "landlord") {
		const ok =
			(currentStatus === "Open" && newStatus === "Repair Scheduled") ||
			(currentStatus === "Repair Scheduled" &&
				newStatus === "Resolved") ||
			(currentStatus === "Open" && newStatus === "Resolved") ||
			newStatus === currentStatus;
		if (!ok) {
			throw `Landlords may move Open → Repair Scheduled → Resolved (or Open → Resolved)`;
		}
		return;
	}
	if (role === "tenant") {
		const ok =
			(newStatus === "Disputed" &&
				(currentStatus === "Open" ||
					currentStatus === "Repair Scheduled")) ||
			newStatus === currentStatus;
		if (!ok) {
			throw `Tenants may mark a violation as Disputed when it is Open or Repair Scheduled`;
		}
		return;
	}
	throw `Your role cannot update violation status`;
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
