import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { users } from "../config/mongoCollections.js";
import {
	checkName,
	checkEmail,
	checkPassword,
	checkPhone,
	checkUserRole,
	checkId,
	PUBLIC_USER_ROLES,
	checkOptionalEmail,
	checkOptionalName,
	checkOptionalPhone,
} from "../helpers.js";

const SALT_ROUNDS = 16;

export const createUser = async (
	firstName,
	lastName,
	email,
	password,
	phoneNumber,
	userRole,
	{ allowAdmin = false } = {},
) => {
	const cleanFirstName = checkName(firstName, "firstName");
	const cleanLastName = checkName(lastName, "lastName");
	const cleanEmail = checkEmail(email);
	const cleanPassword = checkPassword(password);
	const cleanPhone = checkPhone(phoneNumber);
	const cleanUserRole = checkUserRole(
		userRole,
		allowAdmin ? undefined : PUBLIC_USER_ROLES,
	);

	const collection = await users();
	const existing = await collection.findOne({ email: cleanEmail });
	if (existing) {
		throw `There is already a user with email "${cleanEmail}"`;
	}

	const hashedPassword = await bcrypt.hash(cleanPassword, SALT_ROUNDS);

	const newUser = {
		_id: `user-${uuidv4()}`,
		firstName: cleanFirstName,
		lastName: cleanLastName,
		email: cleanEmail,
		hashedPassword,
		phoneNumber: cleanPhone,
		userRole: cleanUserRole,
		ownedProperties: [],
		savedProperties: [],
		createdAt: new Date(),
		secondaryContact: {
			name: "",
			email: "",
			phoneNumber: "",
		},
	};

	const insertResult = await collection.insertOne(newUser);
	if (!insertResult.acknowledged || !insertResult.insertedId) {
		throw `Could not create user`;
	}

	return { userCreated: true, _id: newUser._id };
};

export const authenticateUser = async (email, password) => {
	if (email === undefined || password === undefined) {
		throw `Both email and password must be supplied`;
	}

	const cleanEmail = checkEmail(email);
	checkPassword(password);

	const collection = await users();
	const user = await collection.findOne({ email: cleanEmail });
	if (!user) {
		throw `Either the email or password is invalid`;
	}

	const passwordsMatch = await bcrypt.compare(password, user.hashedPassword);
	if (!passwordsMatch) {
		throw `Either the email or password is invalid`;
	}

	return {
		_id: user._id,
		firstName: user.firstName,
		lastName: user.lastName,
		email: user.email,
		phoneNumber: user.phoneNumber,
		userRole: user.userRole,
	};
};

export const getAllUsers = async () => {
	const collection = await users();
	return await collection.find({}).toArray();
};

export const getUserById = async (id) => {
	const collection = await users();

	const user = await collection.findOne({ _id: id });

	if (!user) throw "User not found";

	return user;
};

export const updateUserById = async (id, updateData) => {
	id = checkId(id, "userId");

	const collection = await users();

	const updateObject = {
		$set: {
			...updateData,
			updatedAt: new Date()
		}
	};

	const result = await collection.updateOne(
		{ _id: id },
		updateObject
	);

	if (result.modifiedCount === 0) {
		throw "User update failed";
	}

	return await collection.findOne({ _id: id });
};

export const updateProfileById = async (id, updateData) => {
	id = checkId(id, "userId");

	const cleanFirstName = checkName(updateData.firstName, "firstName");
	const cleanLastName = checkName(updateData.lastName, "lastName");
	const cleanEmail = checkEmail(updateData.email);
	const cleanPhone = checkPhone(updateData.phoneNumber);

	const secondaryName = checkOptionalName(
		updateData.secondaryContactName,
		"secondaryContactName"
	);
	const secondaryEmail = checkOptionalEmail(
		updateData.secondaryContactEmail,
		"secondaryContactEmail"
	);
	const secondaryPhone = checkOptionalPhone(
		updateData.secondaryContactPhone,
		"secondaryContactPhone"
	);

	const collection = await users();

	const existing = await collection.findOne({
		email: cleanEmail,
		_id: { $ne: id },
	});

	if (existing) {
		throw `There is already a user with email "${cleanEmail}"`;
	}

	const updateObject = {
		$set: {
			firstName: cleanFirstName,
			lastName: cleanLastName,
			email: cleanEmail,
			phoneNumber: cleanPhone,
			secondaryContact: {
				name: secondaryName,
				email: secondaryEmail,
				phoneNumber: secondaryPhone,
			},
			updatedAt: new Date(),
		},
	};

	const result = await collection.updateOne(
		{ _id: id },
		updateObject
	);

	if (result.matchedCount === 0) {
		throw "User update failed";
	}

	return await collection.findOne({ _id: id });
};

export const saveProperty = async (userId, propertyId) => {
	const usersCollection = await users();

	await usersCollection.updateOne(
		{ _id: userId },
		{
			$addToSet: {
				savedProperties: propertyId
			}
		}
	);

	return true;
};

export const unsaveProperty = async (userId, propertyId) => {
	const usersCollection = await users();

	await usersCollection.updateOne(
		{ _id: userId },
		{
			$pull: {
				savedProperties: propertyId
			}
		}
	);

	return true;
};
