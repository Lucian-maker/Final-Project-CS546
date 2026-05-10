import { logs } from "../config/mongoCollections.js";
import { v4 as uuidv4 } from "uuid";

export const createLog = async (
	req,
	res,
	user = null,
	description = null,
	category = "general",
) => {
	const logCollection = await logs();

	const newLog = {
		_id: `log-${uuidv4()}`,

		category,

		status: res.statusCode,

		description,

		user: user
			? {
					userId: user._id,
					role: user.userRole,
					name: `${user.firstName} ${user.lastName}`,
				}
			: {
					userId: null,
					role: "guest",
					name: "Guest",
				},

		timestamp: new Date(),
	};

	await logCollection.insertOne(newLog);
	return newLog;
};

export const getAllLogs = async () => {
	const logCollection = await logs();

	return await logCollection.find({}).sort({ timestamp: -1 }).toArray();
};

export const searchLogs = async (filters) => {
	const logsCollection = await logs();

	const query = {};

	if (filters.search) {
		query.$or = [
			{
				description: {
					$regex: filters.search,
					$options: "i",
				},
			},
			{
				"user.name": {
					$regex: filters.search,
					$options: "i",
				},
			},
			{
				category: {
					$regex: filters.search,
					$options: "i",
				},
			},
		];
	}

	if (filters.role) {
		query["user.role"] = filters.role;
	}

	if (filters.category) {
		query.category = filters.category;
	}

	if (filters.status) {
		query.status = filters.status;
	}

	if (filters.fromDate || filters.toDate) {
		query.timestamp = {};

		if (filters.fromDate) {
			query.timestamp.$gte = new Date(filters.fromDate);
		}

		if (filters.toDate) {
			const end = new Date(filters.toDate);
			end.setHours(23, 59, 59, 999);
			query.timestamp.$lte = end;
		}
	}

	const sortOrder = filters.sort === "oldest" ? 1 : -1;

	return await logsCollection
		.find(query)
		.sort({ timestamp: sortOrder })
		.toArray();
};
