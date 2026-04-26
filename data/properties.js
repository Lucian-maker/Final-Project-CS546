import { properties } from "../config/mongoCollections.js";
import { v4 as uuidv4 } from "uuid";
import { checkString, checkId, checkAddress } from "../helpers.js";

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
		updatedOn: new Date()
	};

	const propCollection = await properties();
	const insertInfo = await propCollection.insertOne(newProperty);

	if (!insertInfo.acknowledged) throw "Could not add property";

	return newProperty;
};

export const searchProperties = async (query) => {
	query = checkString(query, "search query");

	const propCollection = await properties();

	const results = await propCollection.find({
		$or: [
			{ "address.number": { $regex: query, $options: "i" } },
			{ "address.street": { $regex: query, $options: "i" } },
			{ "address.city": { $regex: query, $options: "i" } },
			{ "address.state": { $regex: query, $options: "i" } },
			{ "address.zipCode": { $regex: query, $options: "i" } }
		]
	}).toArray();

	return results;
};
