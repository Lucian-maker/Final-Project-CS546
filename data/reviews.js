import { v4 as uuidv4 } from "uuid";
import { reviews } from "../config/mongoCollections.js";
import { checkId, checkScore, checkShortText } from "../helpers.js";

const roundOne = (n) => Math.round(n * 10) / 10;

export const createReview = async (
	propertyId,
	reviewerId,
	landlordId,
	responsiveness,
	value,
	resolution,
	reviewText,
) => {
	const cleanPropertyId = checkId(propertyId, "propertyId");
	const cleanReviewerId = checkId(reviewerId, "reviewerId");
	const cleanLandlordId = checkId(landlordId, "landlordId");
	const cleanResponsiveness = checkScore(responsiveness, "responsiveness");
	const cleanValue = checkScore(value, "value");
	const cleanResolution = checkScore(resolution, "resolution");
	const cleanText = checkShortText(reviewText, "reviewText", 500);

	const collection = await reviews();

	const existing = await collection.findOne({
		propertyId: cleanPropertyId,
		reviewerId: cleanReviewerId,
		isDeleted: false,
	});
	if (existing) {
		throw `You have already reviewed this property`;
	}

	const overallScore = roundOne(
		(cleanResponsiveness + cleanValue + cleanResolution) / 3,
	);

	const now = new Date();
	const newReview = {
		_id: `review-${uuidv4()}`,
		propertyId: cleanPropertyId,
		reviewerId: cleanReviewerId,
		landlordId: cleanLandlordId,
		responsiveness: cleanResponsiveness,
		value: cleanValue,
		resolution: cleanResolution,
		overallScore,
		reviewText: cleanText,
		isDeleted: false,
		createdAt: now,
		updatedAt: now,
	};

	const insertResult = await collection.insertOne(newReview);
	if (!insertResult.acknowledged || !insertResult.insertedId) {
		throw `Could not create review`;
	}

	return { reviewCreated: true, _id: newReview._id };
};

export const getReviewsByProperty = async (propertyId) => {
	const cleanPropertyId = checkId(propertyId, "propertyId");
	const collection = await reviews();
	return await collection
		.find({ propertyId: cleanPropertyId, isDeleted: false })
		.sort({ createdAt: -1 })
		.toArray();
};

export const getReviewById = async (reviewId) => {
	const cleanId = checkId(reviewId, "reviewId");
	const collection = await reviews();
	const review = await collection.findOne({ _id: cleanId, isDeleted: false });
	if (!review) {
		throw `No review found with id "${cleanId}"`;
	}
	return review;
};

export const getReviewsByLandlord = async (landlordId) => {
	const cleanLandlordId = checkId(landlordId, "landlordId");
	const collection = await reviews();
	return await collection
		.find({ landlordId: cleanLandlordId, isDeleted: false })
		.toArray();
};

export const updateReview = async (
	reviewId,
	userId,
	responsiveness,
	value,
	resolution,
	reviewText,
) => {
	const cleanReviewId = checkId(reviewId, "reviewId");
	const cleanUserId = checkId(userId, "userId");
	const cleanResponsiveness = checkScore(responsiveness, "responsiveness");
	const cleanValue = checkScore(value, "value");
	const cleanResolution = checkScore(resolution, "resolution");
	const cleanText = checkShortText(reviewText, "reviewText", 500);

	const collection = await reviews();
	const existing = await collection.findOne({
		_id: cleanReviewId,
		isDeleted: false,
	});
	if (!existing) {
		throw `No review found with id "${cleanReviewId}"`;
	}
	if (existing.reviewerId !== cleanUserId) {
		throw `You may only edit your own reviews`;
	}

	const overallScore =
		Math.round(
			((cleanResponsiveness + cleanValue + cleanResolution) / 3) * 10,
		) / 10;

	const updateResult = await collection.updateOne(
		{ _id: cleanReviewId },
		{
			$set: {
				responsiveness: cleanResponsiveness,
				value: cleanValue,
				resolution: cleanResolution,
				overallScore,
				reviewText: cleanText,
				updatedAt: new Date(),
			},
		},
	);
	if (!updateResult.acknowledged) {
		throw `Could not update review`;
	}

	return { reviewUpdated: true, _id: cleanReviewId };
};

export const softDeleteReview = async (reviewId, userId) => {
	const cleanReviewId = checkId(reviewId, "reviewId");
	const cleanUserId = checkId(userId, "userId");

	const collection = await reviews();
	const existing = await collection.findOne({
		_id: cleanReviewId,
		isDeleted: false,
	});
	if (!existing) {
		throw `No review found with id "${cleanReviewId}"`;
	}
	if (existing.reviewerId !== cleanUserId) {
		throw `You may only delete your own reviews`;
	}

	const updateResult = await collection.updateOne(
		{ _id: cleanReviewId },
		{ $set: { isDeleted: true, updatedAt: new Date() } },
	);
	if (!updateResult.acknowledged) {
		throw `Could not delete review`;
	}

	return { reviewDeleted: true, _id: cleanReviewId };
};

export const computeLandlordTrustScore = async (landlordId) => {
	const cleanLandlordId = checkId(landlordId, "landlordId");
	const collection = await reviews();
	const live = await collection
		.find({ landlordId: cleanLandlordId, isDeleted: false })
		.toArray();

	if (live.length === 0) {
		return { score: null, count: 0 };
	}

	const sum = live.reduce((acc, r) => acc + r.overallScore, 0);
	const score = Math.round((sum / live.length) * 10) / 10;
	return { score, count: live.length };
};
