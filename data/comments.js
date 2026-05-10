import { comments } from "../config/mongoCollections.js";
import { v4 as uuidv4 } from "uuid";
import { checkId, checkString } from "../helpers.js";

// Validation helper for score
const checkScore = (score, varName) => {
	if (score === undefined || score === null)
		throw `You must provide a ${varName}`;
	const parsed = Number(score);
	if (typeof parsed !== "number" || isNaN(parsed))
		throw `${varName} must be a number`;
	if (parsed < 1 || parsed > 5) throw `${varName} must be between 1 and 5`;
	return parsed;
};

export const createComment = async (
	propertyId,
	userId,
	userName,
	text,
	rating,
	parentCommentId = null,
) => {
	propertyId = checkId(propertyId, "propertyId");
	userId = checkId(userId, "userId");
	userName = checkString(userName, "userName");
	text = checkString(text, "comment text");

	let parsedRating = null;
	if (parentCommentId === null) {
		parsedRating = checkScore(rating, "rating");
	}

	if (parentCommentId !== null) {
		parentCommentId = checkId(parentCommentId, "parentCommentId");
	}

	const newComment = {
		_id: `comment-${uuidv4()}`,
		propertyId,
		userId,
		userName,
		text,
		rating: parsedRating, // only top level comments get ratings
		parentCommentId,
		likes: [], // array of userIds who liked it
		dislikes: [], // array of userIds who disliked it
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const commentsCollection = await comments();
	const insertInfo = await commentsCollection.insertOne(newComment);
	if (!insertInfo.acknowledged || !insertInfo.insertedId) {
		throw "Could not add comment";
	}

	return newComment;
};

export const getCommentsByProperty = async (propertyId) => {
	propertyId = checkId(propertyId, "propertyId");
	const commentsCollection = await comments();
	const propertyComments = await commentsCollection
		.find({ propertyId })
		.sort({ createdAt: 1 })
		.toArray();

	// Format as a nested thread
	const commentMap = {};
	const topLevelComments = [];

	propertyComments.forEach((c) => {
		c.replies = [];
		c.likes = c.likes || [];
		c.dislikes = c.dislikes || [];
		c.likeCount = c.likes.length;
		c.dislikeCount = c.dislikes.length;
		commentMap[c._id] = c;
	});

	propertyComments.forEach((c) => {
		if (c.parentCommentId) {
			if (commentMap[c.parentCommentId]) {
				commentMap[c.parentCommentId].replies.push(c);
			}
		} else {
			topLevelComments.push(c);
		}
	});

	// Sort top level by newest first, replies by oldest first
	topLevelComments.sort((a, b) => b.createdAt - a.createdAt);

	return topLevelComments;
};

export const likeComment = async (commentId, userId) => {
	commentId = checkId(commentId, "commentId");
	userId = checkId(userId, "userId");

	const commentsCollection = await comments();
	const comment = await commentsCollection.findOne({ _id: commentId });
	if (!comment) throw "Comment not found";

	let updateObj = {};
	if (comment.likes && comment.likes.includes(userId)) {
		// Unlike
		updateObj = { $pull: { likes: userId } };
	} else {
		// Like (and remove from dislikes)
		updateObj = {
			$addToSet: { likes: userId },
			$pull: { dislikes: userId },
		};
	}

	const updateInfo = await commentsCollection.updateOne(
		{ _id: commentId },
		updateObj,
	);

	if (!updateInfo.acknowledged) throw "Failed to toggle like on comment";

	return await commentsCollection.findOne({ _id: commentId });
};

export const dislikeComment = async (commentId, userId) => {
	commentId = checkId(commentId, "commentId");
	userId = checkId(userId, "userId");

	const commentsCollection = await comments();
	const comment = await commentsCollection.findOne({ _id: commentId });
	if (!comment) throw "Comment not found";

	let updateObj = {};
	if (comment.dislikes && comment.dislikes.includes(userId)) {
		// Undislike
		updateObj = { $pull: { dislikes: userId } };
	} else {
		// Dislike (and remove from likes)
		updateObj = {
			$addToSet: { dislikes: userId },
			$pull: { likes: userId },
		};
	}

	const updateInfo = await commentsCollection.updateOne(
		{ _id: commentId },
		updateObj,
	);

	if (!updateInfo.acknowledged) throw "Failed to toggle dislike on comment";

	return await commentsCollection.findOne({ _id: commentId });
};

export const editComment = async (commentId, userId, newRating) => {
	commentId = checkId(commentId, "commentId");
	userId = checkId(userId, "userId");
	newRating = checkScore(newRating, "rating");

	const commentsCollection = await comments();
	const comment = await commentsCollection.findOne({ _id: commentId });
	if (!comment) throw "Comment not found";
	if (comment.userId !== userId) throw "You can only edit your own comments";
	if (comment.parentCommentId !== null)
		throw "Cannot edit rating on a nested reply";

	const updateInfo = await commentsCollection.updateOne(
		{ _id: commentId },
		{ $set: { rating: newRating, updatedAt: new Date() } },
	);

	if (!updateInfo.acknowledged) throw "Failed to edit comment rating";

	return await commentsCollection.findOne({ _id: commentId });
};

export const deleteComment = async (commentId, userId) => {
	commentId = checkId(commentId, "commentId");
	userId = checkId(userId, "userId");

	const commentsCollection = await comments();
	const comment = await commentsCollection.findOne({ _id: commentId });
	if (!comment) throw "Comment not found";
	if (comment.userId !== userId)
		throw "You can only delete your own comments";

	// Delete the comment itself
	const deleteInfo = await commentsCollection.deleteOne({ _id: commentId });
	if (!deleteInfo.acknowledged) throw "Failed to delete comment";

	// If it's a top-level comment, also delete its replies
	if (comment.parentCommentId === null) {
		await commentsCollection.deleteMany({ parentCommentId: commentId });
	}

	return { deleted: true };
};
