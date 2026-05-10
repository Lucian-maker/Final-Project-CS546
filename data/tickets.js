import { v4 as uuidv4 } from "uuid";
import { properties, tickets, users } from "../config/mongoCollections.js";
import { checkId, checkShortText, checkString } from "../helpers.js";

export const TICKET_CATEGORIES = Object.freeze([
	"plumbing",
	"electrical",
	"heat",
	"pest",
	"mold",
	"other",
]);

export const TICKET_PRIORITIES = Object.freeze([
	"low",
	"medium",
	"high",
	"urgent",
]);

export const TICKET_STATUSES = Object.freeze([
	"open",
	"in_progress",
	"resolved",
	"closed",
]);

const checkEnum = (val, name, allowed) => {
	const cleaned = checkString(val, name).toLowerCase();
	if (!allowed.includes(cleaned)) {
		throw `${name} must be one of: ${allowed.join(", ")}`;
	}
	return cleaned;
};

const loadUser = async (userId) => {
	const usersCol = await users();
	return usersCol.findOne({ _id: userId });
};

const userCanSee = (dbUser, ticket) => {
	if (!dbUser) {
		return false;
	}
	if (dbUser.userRole === "admin") {
		return true;
	}
	if (ticket.submittedById === dbUser._id) {
		return true;
	}
	if (ticket.assignedToId && ticket.assignedToId === dbUser._id) {
		return true;
	}
	if (dbUser.userRole === "landlord") {
		const owned = dbUser.ownedProperties || [];
		if (owned.includes(ticket.propertyId)) {
			return true;
		}
	}
	if (dbUser.userRole === "tenant") {
		const saved = dbUser.savedProperties || [];
		if (saved.includes(ticket.propertyId)) {
			return true;
		}
	}
	return false;
};

const userCanUpdate = (dbUser, ticket) => {
	if (!dbUser) {
		return false;
	}
	if (dbUser.userRole === "admin") {
		return true;
	}
	if (dbUser.userRole === "landlord") {
		if (ticket.assignedToId && ticket.assignedToId === dbUser._id) {
			return true;
		}
		const owned = dbUser.ownedProperties || [];
		if (owned.includes(ticket.propertyId)) {
			return true;
		}
	}
	return false;
};

const allowedTransitions = (current) => {
	if (current === "open") {
		return ["in_progress", "resolved", "closed"];
	}
	if (current === "in_progress") {
		return ["resolved", "closed"];
	}
	if (current === "resolved") {
		return ["closed", "in_progress"];
	}
	return [];
};

export const createTicket = async (data, sessionUser) => {
	if (!sessionUser) {
		throw "You must be signed in to create a ticket";
	}
	if (!data) {
		throw "No data provided";
	}

	const propertyId = checkId(data.propertyId, "propertyId");
	const category = checkEnum(data.category, "category", TICKET_CATEGORIES);
	const priority = checkEnum(data.priority, "priority", TICKET_PRIORITIES);
	const description = checkShortText(data.description, "description", 1000);

	const propertyCol = await properties();
	const property = await propertyCol.findOne({ _id: propertyId });
	if (!property) {
		throw "Invalid propertyId";
	}

	const dbUser = await loadUser(sessionUser._id);
	if (!dbUser) {
		throw "User not found";
	}

	if (dbUser.userRole === "tenant") {
		const saved = dbUser.savedProperties || [];
		if (!saved.includes(propertyId)) {
			throw "Tenants can only open tickets on saved properties";
		}
	}

	let assignedToId = null;
	if (data.assignedToId !== undefined && data.assignedToId !== null && data.assignedToId !== "") {
		assignedToId = checkId(data.assignedToId, "assignedToId");
	} else {
		const usersCol = await users();
		const owner = await usersCol.findOne({
			userRole: "landlord",
			ownedProperties: propertyId,
		});
		assignedToId = owner ? owner._id : null;
	}

	const now = new Date();
	const newTicket = {
		_id: `ticket-${uuidv4()}`,
		propertyId,
		submittedById: dbUser._id,
		assignedToId,
		category,
		priority,
		status: "open",
		description,
		statusHistory: [
			{
				state: "open",
				changedAt: now,
				changedBy: dbUser._id,
			},
		],
		createdAt: now,
		updatedAt: now,
	};

	const collection = await tickets();
	const insertResult = await collection.insertOne(newTicket);
	if (!insertResult.acknowledged || !insertResult.insertedId) {
		throw "Could not create ticket";
	}
	return newTicket;
};

export const getAllTicketsForUser = async (sessionUser) => {
	if (!sessionUser) {
		return [];
	}
	const dbUser = await loadUser(sessionUser._id);
	if (!dbUser) {
		return [];
	}

	const collection = await tickets();

	if (dbUser.userRole === "admin") {
		return collection.find({}).sort({ updatedAt: -1 }).toArray();
	}

	const orClauses = [{ submittedById: dbUser._id }];
	if (dbUser.userRole === "landlord") {
		const owned = dbUser.ownedProperties || [];
		orClauses.push({ assignedToId: dbUser._id });
		if (owned.length > 0) {
			orClauses.push({ propertyId: { $in: owned } });
		}
	} else if (dbUser.userRole === "tenant") {
		const saved = dbUser.savedProperties || [];
		if (saved.length > 0) {
			orClauses.push({ propertyId: { $in: saved } });
		}
	}

	return collection.find({ $or: orClauses }).sort({ updatedAt: -1 }).toArray();
};

export const getTicketById = async (id) => {
	const cleanId = checkId(id, "ticketId");
	const collection = await tickets();
	const ticket = await collection.findOne({ _id: cleanId });
	if (!ticket) {
		throw `No ticket found with id "${cleanId}"`;
	}
	return ticket;
};

export const assertUserCanViewTicket = async (sessionUser, ticketId) => {
	const cleanId = checkId(ticketId, "ticketId");
	const dbUser = await loadUser(sessionUser?._id);
	const ticket = await getTicketById(cleanId);
	if (!userCanSee(dbUser, ticket)) {
		throw "You do not have permission to view this ticket";
	}
	return { dbUser, ticket };
};

export const updateTicketStatus = async (ticketId, sessionUser, payload) => {
	const cleanId = checkId(ticketId, "ticketId");
	const newStatus = checkEnum(payload?.newStatus, "newStatus", TICKET_STATUSES);
	const notesRaw =
		payload?.notes !== undefined && payload?.notes !== null
			? String(payload.notes).trim()
			: "";
	const notes =
		notesRaw.length > 0 ? notesRaw.slice(0, 2000) : "Status updated.";

	const dbUser = await loadUser(sessionUser?._id);
	const ticket = await getTicketById(cleanId);

	if (!userCanUpdate(dbUser, ticket)) {
		throw "Only the assigned landlord or an admin can update a ticket";
	}

	if (ticket.status === newStatus) {
		throw `Ticket is already marked as "${newStatus}"`;
	}

	if (dbUser.userRole !== "admin") {
		const allowed = allowedTransitions(ticket.status);
		if (!allowed.includes(newStatus)) {
			throw `Cannot move ticket from "${ticket.status}" to "${newStatus}"`;
		}
	}

	const now = new Date();
	const collection = await tickets();
	const result = await collection.updateOne(
		{ _id: cleanId },
		{
			$set: { status: newStatus, updatedAt: now },
			$push: {
				statusHistory: {
					state: newStatus,
					changedAt: now,
					changedBy: dbUser._id,
					notes,
				},
			},
		},
	);

	if (!result.matchedCount) {
		throw "Could not update ticket";
	}

	return getTicketById(cleanId);
};

export const allowedNextTicketStatuses = (role, currentStatus) => {
	if (role === "admin") {
		return TICKET_STATUSES.filter((s) => s !== currentStatus);
	}
	if (role === "landlord") {
		return allowedTransitions(currentStatus);
	}
	return [];
};
