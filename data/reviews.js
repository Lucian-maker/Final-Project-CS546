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
