import { v4 as uuidv4 } from "uuid";
import { notifications } from "../config/mongoCollections.js";
import {
	checkChannel,
	checkDate,
	checkId,
	checkNotificationStatus,
	checkString,
} from "../helpers.js";

// Makes sure notificationDetails has the text we need.
const cleanNotificationDetails = (val) => {
	if (val === undefined || val === null || typeof val !== "object") {
		throw `notificationDetails must be a validobject`;
	}
	const text = checkString(val.text, "notificationDetails.text");
	return { text };
};

// Error checking before creating or updating a notification.
const cleanNotificationPayload = (payload, { isPatch = false } = {}) => {
	if (
		payload === undefined ||
		payload === null ||
		typeof payload !== "object"
	) {
		throw `notification payload must be a valid object`;
	}

	const out = {};
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "userId")) {
		out.userId = checkId(payload.userId, "userId");
	}
	if (
		!isPatch ||
		Object.prototype.hasOwnProperty.call(payload, "violationId")
	) {
		out.violationId = checkId(payload.violationId, "violationId");
	}
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "channel")) {
		out.channel = checkChannel(payload.channel);
	}
	if (
		!isPatch ||
		Object.prototype.hasOwnProperty.call(payload, "notificationDetails")
	) {
		out.notificationDetails = cleanNotificationDetails(
			payload.notificationDetails,
		);
	}
	if (!isPatch || Object.prototype.hasOwnProperty.call(payload, "status")) {
		out.status = checkNotificationStatus(payload.status);
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

// Creates a new notification .
export const createNotification = async (notificationData) => {
	const clean = cleanNotificationPayload(notificationData);
	const collection = await notifications();

	const newNotification = {
		_id: `notif-${uuidv4()}`,
		...clean,
	};

	const insertResult = await collection.insertOne(newNotification);
	if (!insertResult.acknowledged || !insertResult.insertedId) {
		throw `Could not create notification`;
	}

	return newNotification;
};

// Gets the notification list.
export const getAllNotifications = async () => {
	const collection = await notifications();
	return collection.find({}).toArray();
};

const NOTIFICATIONS_PAGE_LIMIT = 100;

/** Notifications for in-app UI (scoped per user). Newest first. */
export const getNotificationsForUser = async (userId) => {
	const uid = checkId(userId, "userId");
	const collection = await notifications();
	return collection
		.find({ userId: uid })
		.sort({ createdAt: -1 })
		.limit(NOTIFICATIONS_PAGE_LIMIT)
		.toArray();
};

/** Queued-only feed for badge/toasts (not capped by mixed-status page window). */
export const getQueuedNotificationsForUser = async (userId) => {
	const uid = checkId(userId, "userId");
	const collection = await notifications();
	return collection
		.find({ userId: uid, status: "queued" })
		.sort({ createdAt: -1 })
		.limit(NOTIFICATIONS_PAGE_LIMIT)
		.toArray();
};

/** Mark queued notifications delivered for this user; skips unknown/other-user ids (silent). */
export const markQueuedDeliveredForUser = async (
	userId,
	notificationIdStrings,
) => {
	const uid = checkId(userId, "userId");
	if (!Array.isArray(notificationIdStrings)) {
		throw `notificationIds must be an array`;
	}
	const objectIds = [];
	for (const raw of notificationIdStrings) {
		if (typeof raw !== "string") continue;
		const trimmed = raw.trim();
		if (!trimmed) continue;
		try {
			objectIds.push(checkId(trimmed, "notificationId"));
		} catch {
			/* malformed id — skip */
		}
	}
	const collection = await notifications();
	if (objectIds.length === 0) {
		return { modifiedCount: 0 };
	}
	const result = await collection.updateMany(
		{ userId: uid, status: "queued", _id: { $in: objectIds } },
		{ $set: { status: "delivered" } },
	);
	return { modifiedCount: result.modifiedCount };
};

// Gets the notification by the id #.
export const getNotificationById = async (id) => {
	const cleanId = checkId(id, "id");
	const collection = await notifications();
	const notification = await collection.findOne({ _id: cleanId });
	if (!notification) {
		throw `No notification found with that id "${cleanId}"`;
	}
	return notification;
};

// Updates only the notification fields that were sent in.
export const updateNotification = async (id, updates) => {
	const cleanId = checkId(id, "id");
	const cleanUpdates = cleanNotificationPayload(updates, { isPatch: true });
	const collection = await notifications();

	const updateResult = await collection.updateOne(
		{ _id: cleanId },
		{ $set: cleanUpdates },
	);
	if (!updateResult.matchedCount) {
		throw `No notification found with that id "${cleanId}"`;
	}

	return getNotificationById(cleanId);
};

// Marks a notification as read for its recipient (separate from status enum).
export const markNotificationAsRead = async (id, userId) => {
	const cleanId = checkId(id, "id");
	const cleanUserId = checkId(userId, "userId");
	const collection = await notifications();

	const existing = await collection.findOne({ _id: cleanId });
	if (!existing) {
		throw `No notification found with that id "${cleanId}"`;
	}
	if (existing.userId !== cleanUserId) {
		throw `You may only mark your own notifications as read`;
	}
	if (existing.readAt) {
		return existing;
	}

	const updateResult = await collection.updateOne(
		{ _id: cleanId },
		{ $set: { readAt: new Date() } },
	);
	if (!updateResult.acknowledged) {
		throw `Could not mark notification as read`;
	}

	return getNotificationById(cleanId);
};

// Deletes a notification after making sure it exists.
export const removeNotification = async (id) => {
	const cleanId = checkId(id, "id");
	const collection = await notifications();
	const existing = await collection.findOne({ _id: cleanId });
	if (!existing) {
		throw `No notification found with that id "${cleanId}"`;
	}

	const deleteResult = await collection.deleteOne({ _id: cleanId });
	if (!deleteResult.acknowledged || deleteResult.deletedCount !== 1) {
		throw `Could not delete notification with that id "${cleanId}"`;
	}
	return { deleted: true, _id: cleanId };
};
