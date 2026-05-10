import {
	properties,
	comments,
	reviews,
	users,
	violations as violationsCol,
} from "../config/mongoCollections.js";
import { v4 as uuidv4 } from "uuid";
import { checkString, checkId, checkAddress } from "../helpers.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const roundOne = (n) => Math.round(n * 10) / 10;

export const getAllProperties = async () => {
	const propCollection = await properties();
	const props = await propCollection.find({}).toArray();

	if (!props) throw "Could not get properties";

	return props;
};

export const getPropertyById = async (id) => {
	id = checkId(id, "propertyId");

	const propCollection = await properties();
	const property = await propCollection.findOne({ _id: id });

	if (!property) throw "Property not found";

	return property;
};

export const createProperty = async (addressObj) => {
	const address = checkAddress(addressObj);

	const newProperty = {
		_id: `prop-${uuidv4()}`,
		address,
		violations: [],
		reviews: [],
		createdOn: new Date(),
		updatedOn: new Date(),
	};

	const propCollection = await properties();
	const insertInfo = await propCollection.insertOne(newProperty);

	if (!insertInfo.acknowledged) throw "Could not add property";

	return newProperty;
};

export const getProperties = async (filters = {}) => {
	const propCollection = await properties();

	const query = {};

	if (filters.search) {
		const q = escapeRegex(checkString(filters.search, "search"));

		query.$or = [
			{ "address.number": { $regex: q, $options: "i" } },
			{ "address.street": { $regex: q, $options: "i" } },
			{ "address.city": { $regex: q, $options: "i" } },
			{ "address.state": { $regex: q, $options: "i" } },
			{ "address.zipCode": { $regex: q, $options: "i" } },
		];
	}

	if (filters.city) {
		query["address.city"] = checkString(filters.city, "city");
	}

	if (filters.state) {
		query["address.state"] = checkString(filters.state, "state");
	}

	if (filters.zipCode) {
		query["address.zipCode"] = checkString(filters.zipCode, "zipCode");
	}

	const allowedSorts = [
		"createdOn",
		"updatedOn",
		"address.street",
		"address.city",
	];

	let sortField = "createdOn";

	if (filters.sort) {
		const s = checkString(filters.sort, "sort");

		if (!allowedSorts.includes(s)) {
			throw `sort must be one of: ${allowedSorts.join(", ")}`;
		}

		sortField = s;
	}

	const order = filters.order === "asc" ? 1 : -1;
	const sort = { [sortField]: order };

	let results = await propCollection.find(query).sort(sort).toArray();

	if (
		filters.minViolations !== undefined &&
		filters.minViolations !== "" &&
		filters.minViolations !== null
	) {
		results = results.filter(
			(p) => p.violations.length >= Number(filters.minViolations),
		);
	}

	if (
		filters.minReviews !== undefined &&
		filters.minReviews !== "" &&
		filters.minReviews !== null
	) {
		results = results.filter(
			(p) => p.reviews.length >= Number(filters.minReviews),
		);
	}

	// Gets Trust Score & Avg Resolution Time
	const reviewsCollection = await reviews();
	const violCollection = await violationsCol();

	// Cache landlord scores
	const landlordScoreCache = {};

	results = await Promise.all(
		results.map(async (p) => {
			// Trust Score from reviews targeting the landlord who claimed this property
			let trustScore = null;
			if (p.claimedBy) {
				if (!(p.claimedBy in landlordScoreCache)) {
					const landlordReviews = await reviewsCollection
						.find({ landlordId: p.claimedBy, isDeleted: false })
						.toArray();
					if (landlordReviews.length > 0) {
						const sum = landlordReviews.reduce(
							(acc, r) => acc + (r.overallScore || 0),
							0,
						);
						landlordScoreCache[p.claimedBy] = roundOne(
							sum / landlordReviews.length,
						);
					} else {
						landlordScoreCache[p.claimedBy] = null;
					}
				}
				trustScore = landlordScoreCache[p.claimedBy];
			}

			// Avg Resolution Time from violations on this property
			let avgResolutionDays = null;
			const propViolations = await violCollection
				.find({
					propertyId: p._id,
					resolvedAt: { $ne: null },
				})
				.toArray();
			if (propViolations.length > 0) {
				let totalDays = 0;
				let count = 0;
				for (const v of propViolations) {
					const start = v.createdAt || v.inspectionDate;
					const end = v.resolvedAt;
					if (start && end) {
						const diffMs =
							new Date(end).getTime() -
							new Date(start).getTime();
						totalDays += Math.max(0, diffMs / 86400000);
						count++;
					}
				}
				if (count > 0) {
					avgResolutionDays = roundOne(totalDays / count);
				}
			}

			return { ...p, trustScore, avgResolutionDays };
		}),
	);

	// Apply trust score filter
	if (
		filters.minTrustScore !== undefined &&
		filters.minTrustScore !== "" &&
		filters.minTrustScore !== null
	) {
		const min = Number(filters.minTrustScore);
		results = results.filter(
			(p) => p.trustScore !== null && p.trustScore >= min,
		);
	}

	// Apply max avg resolution filter
	if (
		filters.maxAvgResolution !== undefined &&
		filters.maxAvgResolution !== "" &&
		filters.maxAvgResolution !== null
	) {
		const max = Number(filters.maxAvgResolution);
		results = results.filter(
			(p) => p.avgResolutionDays !== null && p.avgResolutionDays <= max,
		);
	}

	return results;
};

export const searchProperties = async (query) => {
	query = checkString(query, "search query");

	return getProperties({
		search: query,
	});
};

export const getCommunityInsights = async () => {
	const propCollection = await properties();
	const commentsCollection = await comments();
	const reviewsCollection = await reviews();

	const allProperties = await propCollection.find({}).toArray();
	const insights = [];

	for (const property of allProperties) {
		const propertyComments = await commentsCollection
			.find({ propertyId: property._id })
			.toArray();

		const propertyReviews = await reviewsCollection
			.find({ propertyId: property._id, isDeleted: false })
			.toArray();

		const ratedComments = propertyComments.filter(
			(c) => c.rating !== null && c.rating !== undefined,
		);

		let displayRating = null;
		if (ratedComments.length > 0) {
			const sum = ratedComments.reduce(
				(acc, c) => acc + Number(c.rating),
				0,
			);
			displayRating = Math.round((sum / ratedComments.length) * 10) / 10;
		}

		insights.push({
			_id: property._id,
			address: `${property.address.number} ${property.address.street}`,
			city: property.address.city,
			state: property.address.state,
			zipCode: property.address.zipCode,
			commentCount: propertyComments.length,
			reviewCount: ratedComments.length,
			displayRating,
		});
	}

	const highestRated = insights
		.filter((p) => p.displayRating !== null)
		.sort((a, b) => b.displayRating - a.displayRating)[0];

	const mostReviewed = insights
		.filter((p) => p.reviewCount > 0)
		.sort((a, b) => b.reviewCount - a.reviewCount)[0];

	const mostCommented = insights
		.filter((p) => p.commentCount > 0)
		.sort((a, b) => b.commentCount - a.commentCount)[0];

	return {
		highestRated,
		mostReviewed,
		mostCommented,
	};
};

export const claimProperty = async (propertyId, userId) => {
	propertyId = checkId(propertyId, "propertyId");
	userId = checkId(userId, "userId");

	const propCol = await properties();
	const userCol = await users();

	const property = await propCol.findOne({ _id: propertyId });

	if (!property) {
		throw "Property not found";
	}

	if (property.claimedBy && property.claimedBy !== userId) {
		throw "This property is already claimed.";
	}

	await propCol.updateOne(
		{ _id: propertyId },
		{
			$set: {
				claimedBy: userId,
				updatedOn: new Date(),
			},
		},
	);

	await userCol.updateOne(
		{ _id: userId },
		{
			$addToSet: {
				ownedProperties: propertyId,
			},
		},
	);

	return true;
};

export const unclaimProperty = async (propertyId, userId) => {
	propertyId = checkId(propertyId, "propertyId");
	userId = checkId(userId, "userId");

	const propCol = await properties();
	const userCol = await users();

	const property = await propCol.findOne({ _id: propertyId });

	if (!property) {
		throw "Property not found";
	}

	if (property.claimedBy !== userId) {
		throw "You do not own this property.";
	}

	await propCol.updateOne(
		{ _id: propertyId },
		{
			$set: {
				claimedBy: null,
				updatedOn: new Date(),
			},
		},
	);

	await userCol.updateOne(
		{ _id: userId },
		{
			$pull: {
				ownedProperties: propertyId,
			},
		},
	);

	return true;
};
