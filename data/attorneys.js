import { v4 as uuidv4 } from "uuid";
import { attorneys } from "../config/mongoCollections.js";
import {
	checkDate,
	checkEmail,
	checkId,
	checkPhone,
	checkString,
} from "../helpers.js";

// Error checking before creating or updating an attorney.
const cleanAttorneyPayload = (payload, { isPatch = false } = {}) => {
	if (
		payload === undefined ||
		payload === null ||
		typeof payload !== "object"
	) {
		throw `attorney payload must be a valid object`;
	}

	const out = {};
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "name")) {
		out.name = checkString(payload.name, "name");
	}
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "email")) {
		out.email = checkEmail(payload.email);
	}
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "phone")) {
		out.phone = checkPhone(payload.phone);
	}
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "website")) {
		out.website = checkString(payload.website, "website");
	}
	if (
		!isPatch ||
		Object.prototype.hasOwnProperty.call(payload, "createdAt")
	) {
		out.createdAt = checkDate(payload.createdAt ?? new Date(), "createdAt");
	}

	if (isPatch && Object.keys(out).length === 0) {
		throw `At least one field must be supplied for update`;
	}

	return out;
};

// Creates a new attorney record with a unique id.
export const createAttorney = async (attorneyData) => {
	const clean = cleanAttorneyPayload(attorneyData);
	const collection = await attorneys();

	const newAttorney = {
		_id: `refferal-${uuidv4()}`,
		...clean,
	};

	const insertResult = await collection.insertOne(newAttorney);
	if (!insertResult.acknowledged || !insertResult.insertedId) {
		throw `Could not create attorney`;
	}

	return newAttorney;
};

// Gets the attorney list.
export const getAllAttorneys = async () => {
	const collection = await attorneys();
	return collection.find({}).toArray();
};

// Gets the attorney by the id #.
export const getAttorneyById = async (id) => {
	const cleanId = checkId(id, "id");
	const collection = await attorneys();
	const attorney = await collection.findOne({ _id: cleanId });
	if (!attorney) {
		throw `No attorney found with that id "${cleanId}"`;
	}
	return attorney;
};

// Updates the attorney by the id #.
export const updateAttorney = async (id, updates) => {
	const cleanId = checkId(id, "id");
	const cleanUpdates = cleanAttorneyPayload(updates, { isPatch: true });
	const collection = await attorneys();

	const updateResult = await collection.updateOne(
		{ _id: cleanId },
		{ $set: cleanUpdates },
	);
	if (!updateResult.matchedCount) {
		throw `No attorney found with that id "${cleanId}"`;
	}

	return getAttorneyById(cleanId);
};

// Deletes the attorney by the id #.
export const removeAttorney = async (id) => {
	const cleanId = checkId(id, "id");
	const collection = await attorneys();
	const existing = await collection.findOne({ _id: cleanId });
	if (!existing) {
		throw `No attorney found with that id "${cleanId}"`;
	}

	const deleteResult = await collection.deleteOne({ _id: cleanId });
	if (!deleteResult.acknowledged || deleteResult.deletedCount !== 1) {
		throw `Could not delete attorney with that id "${cleanId}"`;
	}
	return { deleted: true, _id: cleanId };
};
