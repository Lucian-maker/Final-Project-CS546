import { disputes, users, violations } from "../config/mongoCollections.js";
import { createNotification } from "./notifications.js";
import { checkId, checkString } from "../helpers.js";

const CHANNEL = "email";

const toUniqueIds = (ids) => [...new Set(ids.filter(Boolean).map(String))];

const withoutActor = (ids, actorUserId) => {
	if (!actorUserId) return ids;
	const actor = String(actorUserId);
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

export const emitNotifications = async ({
	recipientIds,
	violationId,
	text,
}) => {
	const cleanViolationId = checkId(violationId, "violationId");
	const cleanText = checkString(text, "notificationText");

	const ids = toUniqueIds(recipientIds);
	let createdCount = 0;

	for (const recipientId of ids) {
		const cleanUserId = checkId(recipientId, "userId");
		// eslint-disable-next-line no-await-in-loop
		await createNotification({
			userId: cleanUserId,
			violationId: cleanViolationId,
			channel: CHANNEL,
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
	return withoutActor(
		toUniqueIds([...landlordIds, ...tenantIds, ...adminIds]),
		actorUserId,
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
	});
};

export const notifyDisputeCreated = async ({ disputeId, actorUserId }) => {
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
	});
};

export const notifyDisputeUpdated = async ({
	disputeId,
	actorUserId,
	newStatus,
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
	});
};

export const notifyCommentActivity = async ({
	propertyId,
	actorUserId,
	text,
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
	});
};

export const notifyReviewActivity = async ({
	propertyId,
	actorUserId,
	text,
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
	});
};
