import { disputes, users, violations } from "../config/mongoCollections.js";
import { createNotification } from "./notifications.js";
import { checkChannel, checkId, checkString } from "../helpers.js";

const DEFAULT_CHANNEL = "email";

const toUniqueIds = (ids) => [...new Set(ids.filter(Boolean).map(String))];

/** Remove actor from recipients unless they are an admin (admins always get alerts). */
const withoutActor = (ids, actorUserId, adminIdSet) => {
	if (!actorUserId) return ids;
	const actor = String(actorUserId);
	if (adminIdSet.has(actor)) return ids;
	return ids.filter((id) => String(id) !== actor);
};

const getAdminUserIds = async () => {
	const usersCollection = await users();
	const adminRows = await usersCollection
		.find({ userRole: "admin" }, { projection: { _id: 1 } })
		.toArray();
	return adminRows.map((u) => String(u._id));
};

const getUsersByPropertyRole = async (propertyId) => {
	const usersCollection = await users();
	const cleanPropertyId = checkId(propertyId, "propertyId");

	const [landlords, tenants] = await Promise.all([
		usersCollection
			.find(
				{ ownedProperties: cleanPropertyId },
				{ projection: { _id: 1 } },
			)
			.toArray(),
		usersCollection
			.find(
				{ savedProperties: cleanPropertyId },
				{ projection: { _id: 1 } },
			)
			.toArray(),
	]);

	return {
		landlordIds: landlords.map((u) => String(u._id)),
		tenantIds: tenants.map((u) => String(u._id)),
	};
};

const getPrimaryViolationForProperty = async (propertyId) => {
	const violationsCollection = await violations();
	const cleanPropertyId = checkId(propertyId, "propertyId");
	const violation = await violationsCollection.findOne(
		{ propertyId: cleanPropertyId },
		{ sort: { updatedAt: -1 } },
	);
	return violation ? String(violation._id) : null;
};

// Channel is optional; falls back to email to preserve prior behavior when callers omit it.
export const emitNotifications = async ({
	recipientIds,
	violationId,
	text,
	channel,
}) => {
	const cleanViolationId = checkId(violationId, "violationId");
	const cleanText = checkString(text, "notificationText");
	const cleanChannel = channel ? checkChannel(channel) : DEFAULT_CHANNEL;

	const ids = toUniqueIds(recipientIds);
	let createdCount = 0;

	for (const recipientId of ids) {
		const cleanUserId = checkId(recipientId, "userId");
		// eslint-disable-next-line no-await-in-loop
		await createNotification({
			userId: cleanUserId,
			violationId: cleanViolationId,
			channel: cleanChannel,
			notificationDetails: { text: cleanText },
			status: "queued",
			createdAt: new Date(),
		});
		createdCount += 1;
	}

	return createdCount;
};

export const resolveRelevantPartiesForProperty = async (
	propertyId,
	actorUserId = null,
) => {
	const { landlordIds, tenantIds } = await getUsersByPropertyRole(propertyId);
	const adminIds = await getAdminUserIds();
	const adminIdSet = new Set(adminIds);
	return withoutActor(
		toUniqueIds([...landlordIds, ...tenantIds, ...adminIds]),
		actorUserId,
		adminIdSet,
	);
};

export const resolveRelevantPartiesForViolation = async (
	violationId,
	actorUserId = null,
) => {
	const violationsCollection = await violations();
	const cleanViolationId = checkId(violationId, "violationId");
	const violation = await violationsCollection.findOne({
		_id: cleanViolationId,
	});
	if (!violation) throw "Violation not found";
	const parties = await resolveRelevantPartiesForProperty(
		violation.propertyId,
		actorUserId,
	);
	return { parties, violation };
};

export const notifyViolationStatusUpdated = async ({
	violationId,
	actorUserId,
	oldStatus,
	newStatus,
	channel,
}) => {
	const { parties } = await resolveRelevantPartiesForViolation(
		violationId,
		actorUserId,
	);
	if (parties.length === 0) return 0;
	return emitNotifications({
		recipientIds: parties,
		violationId,
		text: `Violation status changed from ${oldStatus} to ${newStatus}.`,
		channel,
	});
};

export const notifyDisputeCreated = async ({
	disputeId,
	actorUserId,
	channel,
}) => {
	const disputesCollection = await disputes();
	const dispute = await disputesCollection.findOne({
		_id: checkId(disputeId),
	});
	if (!dispute) return 0;

	const { parties } = await resolveRelevantPartiesForViolation(
		dispute.violationId,
		actorUserId,
	);
	if (parties.length === 0) return 0;

	return emitNotifications({
		recipientIds: parties,
		violationId: dispute.violationId,
		text: `A dispute was created (${dispute.status}).`,
		channel,
	});
};

export const notifyDisputeUpdated = async ({
	disputeId,
	actorUserId,
	newStatus,
	channel,
}) => {
	const disputesCollection = await disputes();
	const dispute = await disputesCollection.findOne({
		_id: checkId(disputeId),
	});
	if (!dispute) return 0;

	const { parties } = await resolveRelevantPartiesForViolation(
		dispute.violationId,
		actorUserId,
	);
	if (parties.length === 0) return 0;

	return emitNotifications({
		recipientIds: parties,
		violationId: dispute.violationId,
		text: `Dispute status updated to ${newStatus}.`,
		channel,
	});
};

export const notifyCommentActivity = async ({
	propertyId,
	actorUserId,
	text,
	channel,
}) => {
	const cleanPropertyId = checkId(propertyId, "propertyId");
	const relevant = await resolveRelevantPartiesForProperty(
		cleanPropertyId,
		actorUserId,
	);
	if (relevant.length === 0) return 0;
	const fallbackViolationId =
		await getPrimaryViolationForProperty(cleanPropertyId);
	if (!fallbackViolationId) return 0;
	return emitNotifications({
		recipientIds: relevant,
		violationId: fallbackViolationId,
		text,
		channel,
	});
};

export const notifyReviewActivity = async ({
	propertyId,
	actorUserId,
	text,
	channel,
}) => {
	const cleanPropertyId = checkId(propertyId, "propertyId");
	const recipients = await resolveRelevantPartiesForProperty(
		cleanPropertyId,
		actorUserId,
	);
	if (recipients.length === 0) return 0;

	const fallbackViolationId =
		await getPrimaryViolationForProperty(cleanPropertyId);
	if (!fallbackViolationId) return 0;

	return emitNotifications({
		recipientIds: recipients,
		violationId: fallbackViolationId,
		text,
		channel,
	});
};
