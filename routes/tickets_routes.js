import { Router } from "express";
import {
	allowedNextTicketStatuses,
	assertUserCanViewTicket,
	createTicket,
	editTicket,
	deleteTicket,
	getAllTicketsForUser,
	TICKET_CATEGORIES,
	TICKET_PRIORITIES,
	updateTicketStatus,
	updateTicketPriority,
} from "../data/tickets.js";
import { properties as propertiesCollection, users } from "../config/mongoCollections.js";
import { checkId, formatDateTime, logCategories, logDescriptions } from "../helpers.js";

const router = Router();

const decorateTicket = (t) => ({
	...t,
	createdAtFormatted: t.createdAt ? formatDateTime(t.createdAt) : "—",
	updatedAtFormatted: t.updatedAt ? formatDateTime(t.updatedAt) : "—",
	statusHistory: Array.isArray(t.statusHistory)
		? t.statusHistory.map((h) => ({
				...h,
				changedAtFormatted: h.changedAt
					? formatDateTime(h.changedAt)
					: "—",
			}))
		: [],
});

const priorityBadgeClass = (priority) => {
	if (priority === "urgent") return "badge-danger";
	if (priority === "high") return "badge-warning";
	if (priority === "medium") return "badge-info";
	return "badge-success";
};

router.route("/").get(async (req, res) => {
	try {
		const sessionUser = req.session && req.session.user;
		const list = await getAllTicketsForUser(sessionUser);
		const decorated = list.map((t) => ({
			...decorateTicket(t),
			priorityBadgeClass: priorityBadgeClass(t.priority),
		}));

		res.locals.logCategory = logCategories.tickets;
		res.locals.logDescription = logDescriptions.viewTickets();

		const isAdmin = sessionUser.userRole === "admin";

		const myTickets = decorated.filter(
			(t) => t.submittedById === sessionUser._id,
		);

		return res.render("tickets", {
			title: "Tickets",
			user: sessionUser,
			myTickets,
			allTickets: isAdmin ? decorated : [],
			isAdmin,
			canCreate: !!sessionUser,
			categories: TICKET_CATEGORIES,
			priorities: TICKET_PRIORITIES,
		});

	} catch (e) {
		const sessionUser = req.session && req.session.user;

		const list = await getAllTicketsForUser(sessionUser);

		const decorated = list.map((t) => ({
			...decorateTicket(t),
			priorityBadgeClass: priorityBadgeClass(t.priority),
		}));
		
		const isAdmin = sessionUser.userRole === "admin";

		const myTickets = decorated.filter(
			(t) => t.submittedById === sessionUser._id,
		);

		return res.status(400).render("tickets", {
			title: "Tickets",
			user: sessionUser,

			error: String(e),

			myTickets,
			allTickets: isAdmin ? decorated : [],
			isAdmin,

			canCreate: !!sessionUser,

			categories: TICKET_CATEGORIES,
			priorities: TICKET_PRIORITIES,

			formData: req.body,
		});
	}
});

router.route("/create").post(async (req, res) => {
	const sessionUser = req.session && req.session.user;

	if (!sessionUser) {
		return res.redirect("/signin");
	}

	try {
		const created = await createTicket(req.body, sessionUser);

		res.locals.logCategory = logCategories.tickets;
		res.locals.logDescription = logDescriptions.createTicket(created._id);

		return res.redirect(`/tickets/${created._id}`);
	} catch (e) {
		const list = await getAllTicketsForUser(sessionUser);
		const decorated = list.map((t) => ({
			...decorateTicket(t),
			priorityBadgeClass: priorityBadgeClass(t.priority),
		}));

		const isAdmin = sessionUser.userRole === "admin";

		const myTickets = decorated.filter(
			(t) => t.submittedById === sessionUser._id,
		);

		return res.status(400).render("tickets", {
			title: "Tickets",
			user: sessionUser,
			error: String(e),
			formData: req.body,
			myTickets,
			allTickets: isAdmin ? decorated : [],
			isAdmin,
			canCreate: true,
			categories: TICKET_CATEGORIES,
			priorities: TICKET_PRIORITIES,
		});
	}
});

router.route("/:id/priority").post(async (req, res) => {
	try {
		const sessionUser = req.session && req.session.user;
		if (!sessionUser) {
			return res.redirect("/signin");
		}

		const cleanId = checkId(req.params.id, "ticketId");

		await updateTicketPriority(cleanId, sessionUser, {
			priority: req.body?.priority,
		});

		res.locals.logCategory = logCategories.tickets;
		res.locals.logDescription = logDescriptions.updateTicketPriority(cleanId);

		return res.redirect(`/tickets/${cleanId}?updated=1`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Error",
			error: String(e),
		});
	}
});

router
	.route("/:id")
	.get(async (req, res) => {
		try {
			const sessionUser = req.session && req.session.user;
			const cleanId = checkId(req.params.id, "ticketId");
			const { dbUser, ticket } = await assertUserCanViewTicket(
				sessionUser,
				cleanId,
			);

			const usersCol = await users();
			const submitter = await usersCol.findOne({
				_id: ticket.submittedById,
			});
			const assignee = ticket.assignedToId
				? await usersCol.findOne({ _id: ticket.assignedToId })
				: null;

			const propsCol = await propertiesCollection();
			const property = await propsCol.findOne({ _id: ticket.propertyId });
			let buildingAddress = ticket.propertyId;
			if (property?.address) {
				const a = property.address;
				buildingAddress = `${a.number} ${a.street}, ${a.city}, ${a.state} ${a.zipCode}`;
			}

			const allowed = allowedNextTicketStatuses(
				dbUser.userRole,
				ticket.status,
			);

			res.locals.logCategory = logCategories.tickets;
			res.locals.logDescription = logDescriptions.viewTicket(cleanId);

			const isSubmitter = ticket.submittedById === dbUser._id;
			const isAdmin = dbUser.userRole === "admin";
			const canEdit = (isSubmitter || isAdmin) && ticket.status === "open";

			return res.render("ticket", {
				title: `Ticket — ${ticket.category}`,
				user: sessionUser,
				ticket: {
					...decorateTicket(ticket),
					priorityBadgeClass: priorityBadgeClass(ticket.priority),
				},
				submitter,
				assignee,
				buildingAddress,
				allowedNextStatuses: allowed,
				priorities: TICKET_PRIORITIES,
				statusMessage: req.query.updated ? "Ticket updated." : null,
				error: null,
				canEdit,
				editCategories: TICKET_CATEGORIES,
				editPriorities: TICKET_PRIORITIES,
			});
		} catch (e) {
			const msg = String(e);
			if (msg.includes("No ticket found")) {
				return res.status(404).render("error", {
					title: "Not Found",
					error: msg,
				});
			}
			if (msg.includes("permission")) {
				return res.status(403).render("error", {
					title: "Forbidden",
					error: msg,
				});
			}
			return res.status(400).render("error", {
				title: "Error",
				error: msg,
			});
		}
	})
	.post(async (req, res) => {
		try {
			const sessionUser = req.session && req.session.user;
			if (!sessionUser) {
				return res.redirect("/signin");
			}
			const cleanId = checkId(req.params.id, "ticketId");
			await updateTicketStatus(cleanId, sessionUser, {
				newStatus: req.body?.newStatus,
				notes: req.body?.notes,
			});

			res.locals.logCategory = logCategories.tickets;
			res.locals.logDescription = `Updated ticket ${cleanId}`;

			return res.redirect(`/tickets/${cleanId}?updated=1`);
		} catch (e) {
			return res.status(400).render("error", {
				title: "Error",
				error: String(e),
			});
		}
	});

// Edit ticket description/priority/category (submitter or admin only)
router.post("/:id/edit", async (req, res) => {
	try {
		const sessionUser = req.session && req.session.user;
		if (!sessionUser) return res.redirect("/signin");

		const cleanId = req.params.id;
		await editTicket(cleanId, sessionUser, {
			description: req.body?.description,
			priority: req.body?.priority,
			category: req.body?.category,
		});

		res.locals.logCategory = logCategories.dashboard;
		res.locals.logDescription = `Edited ticket ${cleanId}`;

		return res.redirect(`/tickets/${cleanId}?updated=1`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Error",
			error: String(e),
		});
	}
});

// Delete ticket (submitter or admin only)
router.post("/:id/delete", async (req, res) => {
	try {
		const sessionUser = req.session && req.session.user;
		if (!sessionUser) return res.redirect("/signin");

		await deleteTicket(req.params.id, sessionUser);

		res.locals.logCategory = logCategories.dashboard;
		res.locals.logDescription = `Deleted ticket ${req.params.id}`;

		return res.redirect("/tickets");
	} catch (e) {
		return res.status(400).render("error", {
			title: "Error",
			error: String(e),
		});
	}
});

export default router;
