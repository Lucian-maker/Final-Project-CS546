import { v4 as uuidv4 } from "uuid";
import { comments, properties, users } from "../config/mongoCollections.js";
import {
	checkId,
	checkShortText,
	checkUserRole,
	PUBLIC_USER_ROLES,
} from "../helpers.js";

export const createComment = async (
	propertyId,
	authorId,
	authorRole,
	commentText,
) => {
	const cleanPropertyId = checkId(propertyId, "propertyId");
	const cleanAuthorId = checkId(authorId, "authorId");
	const cleanRole = checkUserRole(authorRole, PUBLIC_USER_ROLES);
	const cleanText = checkShortText(commentText, "commentText", 1000);

	const collection = await comments();
	const now = new Date();
	const newComment = {
		_id: `comment-${uuidv4()}`,
		propertyId: cleanPropertyId,
		authorId: cleanAuthorId,
		authorRole: cleanRole,
		commentText: cleanText,
		isDeleted: false,
		createdAt: now,
		updatedAt: now,
	};

	const insertResult = await collection.insertOne(newComment);
	if (!insertResult.acknowledged || !insertResult.insertedId) {
		throw "Could not create comment";
	}
	return newComment;
};

export const getCommentsByProperty = async (propertyId) => {
	const cleanPropertyId = checkId(propertyId, "propertyId");
	const collection = await comments();
	return collection
		.find({ propertyId: cleanPropertyId, isDeleted: false })
		.sort({ createdAt: 1 })
		.toArray();
};

export const getCommentById = async (commentId) => {
	const cleanId = checkId(commentId, "commentId");
	const collection = await comments();
	const comment = await collection.findOne({
		_id: cleanId,
		isDeleted: false,
	});
	if (!comment) {
		throw `No comment found with id "${cleanId}"`;
	}
	return comment;
};

export const updateComment = async (commentId, userId, commentText) => {
	const cleanCommentId = checkId(commentId, "commentId");
	const cleanUserId = checkId(userId, "userId");
	const cleanText = checkShortText(commentText, "commentText", 1000);

	const collection = await comments();
	const existing = await collection.findOne({
		_id: cleanCommentId,
		isDeleted: false,
	});
	if (!existing) {
		throw `No comment found with id "${cleanCommentId}"`;
	}
	if (existing.authorId !== cleanUserId) {
		throw "You may only edit your own comments";
	}

	const updateResult = await collection.updateOne(
		{ _id: cleanCommentId },
		{ $set: { commentText: cleanText, updatedAt: new Date() } },
	);
	if (!updateResult.acknowledged) {
		throw "Could not update comment";
	}
	return getCommentById(cleanCommentId);
};

export const softDeleteComment = async (commentId, userId) => {
	const cleanCommentId = checkId(commentId, "commentId");
	const cleanUserId = checkId(userId, "userId");

	const collection = await comments();
	const existing = await collection.findOne({
		_id: cleanCommentId,
		isDeleted: false,
	});
	if (!existing) {
		throw `No comment found with id "${cleanCommentId}"`;
	}
	if (existing.authorId !== cleanUserId) {
		throw "You may only delete your own comments";
	}

	const updateResult = await collection.updateOne(
		{ _id: cleanCommentId },
		{ $set: { isDeleted: true, updatedAt: new Date() } },
	);
	if (!updateResult.acknowledged) {
		throw "Could not delete comment";
	}
	return { commentDeleted: true, _id: cleanCommentId };
};

export const getAllCommentsVisibleToUser = async (sessionUser) => {
	if (!sessionUser) {
		return [];
	}
	const usersCol = await users();
	const dbUser = await usersCol.findOne({ _id: sessionUser._id });
	if (!dbUser) {
		return [];
	}

	const collection = await comments();
	const baseQuery = { isDeleted: false };

	if (dbUser.userRole === "admin") {
		return collection.find(baseQuery).sort({ createdAt: -1 }).toArray();
	}

	const propIds =
		dbUser.userRole === "landlord"
			? dbUser.ownedProperties || []
			: dbUser.savedProperties || [];

	const orClauses = [{ authorId: dbUser._id }];
	if (propIds.length > 0) {
		orClauses.push({ propertyId: { $in: propIds } });
	}

	return collection
		.find({ ...baseQuery, $or: orClauses })
		.sort({ createdAt: -1 })
		.toArray();
};
