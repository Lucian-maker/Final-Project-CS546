import { v4 as uuidv4 } from "uuid";
import { disputes } from "../config/mongoCollections.js";
import {
	checkDate,
	checkDisputeEventType,
	checkId,
	checkString,
} from "../helpers.js";

// Error checking before creating or updating a dispute.
const cleanDisputePayload = (payload, { isPatch = false } = {}) => {
	if (
		payload === undefined ||
		payload === null ||
		typeof payload !== "object"
	) {
		throw `dispute payload must be an object`;
	}

	const out = {};
	if (
		!isPatch ||
		Object.prototype.hasOwnProperty.call(payload, "violationId")
	) {
		out.violationId = checkId(payload.violationId, "violationId");
	}
	if (
		!isPatch ||
		Object.prototype.hasOwnProperty.call(payload, "createdBy")
	) {
		out.createdBy = checkId(payload.createdBy, "createdBy");
	}
	if (
		!isPatch ||
		Object.prototype.hasOwnProperty.call(payload, "eventType")
	) {
		out.eventType = checkDisputeEventType(payload.eventType);
	}
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "status")) {
		out.status = checkString(payload.status, "status");
	}
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "result")) {
		out.result = checkString(payload.result, "result");
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

// Creates a new dispute record with a unique id.
export const createDispute = async (disputeData) => {
	const clean = cleanDisputePayload(disputeData);
	const collection = await disputes();

	const newDispute = {
		_id: `dsp-${uuidv4()}`,
		...clean,
	};

	const insertResult = await collection.insertOne(newDispute);
	if (!insertResult.acknowledged || !insertResult.insertedId) {
		throw `Could not create dispute`;
	}

	return newDispute;
};

// Gets the dispute list.
export const getAllDisputes = async () => {
	const collection = await disputes();
	return collection.find({}).toArray();
};

// Gets the dispute by the id #.
export const getDisputeById = async (id) => {
	const cleanId = checkId(id, "id");
	const collection = await disputes();
	const dispute = await collection.findOne({ _id: cleanId });
	if (!dispute) {
		throw `No dispute found with that id "${cleanId}"`;
	}
	return dispute;
};

// Updates only the dispute fields that were sent in.
export const updateDispute = async (id, updates) => {
	const cleanId = checkId(id, "id");
	const cleanUpdates = cleanDisputePayload(updates, { isPatch: true });
	const collection = await disputes();

	const updateResult = await collection.updateOne(
		{ _id: cleanId },
		{ $set: cleanUpdates },
	);
	if (!updateResult.matchedCount) {
		throw `No dispute found with that id "${cleanId}"`;
	}

	return getDisputeById(cleanId);
};

// Deletes a dispute after making sure it exists.
export const removeDispute = async (id) => {
	const cleanId = checkId(id, "id");
	const collection = await disputes();
	const existing = await collection.findOne({ _id: cleanId });
	if (!existing) {
		throw `No dispute found with that id "${cleanId}"`;
	}

	const deleteResult = await collection.deleteOne({ _id: cleanId });
	if (!deleteResult.acknowledged || deleteResult.deletedCount !== 1) {
		throw `Could not delete dispute with that id "${cleanId}"`;
	}
	return { deleted: true, _id: cleanId };
};
