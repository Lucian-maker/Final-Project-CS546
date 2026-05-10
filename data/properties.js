import { properties, users } from "../config/mongoCollections.js";
import { v4 as uuidv4 } from "uuid";
import { checkString, checkId, checkAddress } from "../helpers.js";

const escapeRegex = (s) =>
	s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

	let results = await propCollection
		.find(query)
		.sort(sort)
		.toArray();

	if (filters.minViolations !== undefined && filters.minViolations !== "" && filters.minViolations !== null) {
		results = results.filter(
			(p) => p.violations.length >= Number(filters.minViolations)
		);
	}

	if (filters.minReviews !== undefined && filters.minReviews !== "" && filters.minReviews !== null) {
		results = results.filter(
			(p) => p.reviews.length >= Number(filters.minReviews)
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
		}
	);

	await userCol.updateOne(
		{ _id: userId },
		{
			$addToSet: {
				ownedProperties: propertyId,
			},
		}
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
		}
	);

	await userCol.updateOne(
		{ _id: userId },
		{
			$pull: {
				ownedProperties: propertyId,
			},
		}
	);

	return true;
};
