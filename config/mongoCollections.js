import { dbConnection } from "./mongoConnection.js";

const getCollectionFn = (collection) => {
	let _col = undefined;

	return async () => {
		if (!_col) {
			const db = await dbConnection();
			_col = await db.collection(collection);
		}

		return _col;
	};
};

export const users = getCollectionFn("users");
export const properties = getCollectionFn("properties");
export const violations = getCollectionFn("violations");
export const evidence = getCollectionFn("evidence");
export const reviews = getCollectionFn("reviews");
export const comments = getCollectionFn("comments");
export const notifications = getCollectionFn("notifications");
export const disputes = getCollectionFn("disputes");
export const attorneys = getCollectionFn("attorneys");
