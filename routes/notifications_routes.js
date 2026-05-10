import { Router } from "express";
import {
	createNotification,
	getAllNotifications,
	getNotificationById,
	markNotificationAsRead,
	removeNotification,
	updateNotification,
} from "../data/notifications.js";
import { users } from "../config/mongoCollections.js";
import {
	checkId,
	formatDateTime,
	logCategories,
	logDescriptions,
} from "../helpers.js";

const router = Router();

const decorateNotification = (n) => ({
	...n,
	createdAtFormatted: n.createdAt ? formatDateTime(n.createdAt) : "—",
	readAtFormatted: n.readAt ? formatDateTime(n.readAt) : null,
});

// Returns the notification list.
router.route("/api").get(async (req, res) => {
	try {
		const notificationsList = await getAllNotifications();
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.viewNotifications();

		return res.json(notificationsList);
	} catch (e) {
		return res.status(500).json({ error: e.toString() });
	}
});

// Creates a new notification .
router.route("/api").post(async (req, res) => {
	try {
		const created = await createNotification(req.body);
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.createNotification(created._id);
		return res.status(201).json(created);
	} catch (e) {
		return res.status(400).json({ error: e.toString() });
	}
});

// Returns the notification by the id #.
router.route("/api/:id").get(async (req, res) => {
	try {
		const item = await getNotificationById(req.params.id);
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.viewNotification(req.params.id);
		return res.json(item);
	} catch (e) {
		if (e.toString().includes("No notification found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Updates the notification by the id #.
router.route("/api/:id").patch(async (req, res) => {
	try {
		const updated = await updateNotification(req.params.id, req.body);
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.updateNotification(
			req.params.id,
		);
		return res.json(updated);
	} catch (e) {
		if (e.toString().includes("No notification found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Deletes the notification by the id #.
router.route("/api/:id").delete(async (req, res) => {
	try {
		const deleted = await removeNotification(req.params.id);
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.deleteNotification(
			req.params.id,
		);
		return res.json(deleted);
	} catch (e) {
		if (e.toString().includes("No notification found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Routes to the notifications list page.
router.route("/").get(async (req, res) => {
	try {
		const notificationsList = await getAllNotifications();
		const decorated = notificationsList.map(decorateNotification);
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.viewNotifications();
		return res.render("notifications", {
			title: "Notifications",
			notifications: decorated,
			user: req.session && req.session.user,
		});
	} catch (e) {
		return res.status(500).render("error", { error: e.toString() });
	}
});

// Renders a single notification detail page.
router.route("/:id").get(async (req, res) => {
	try {
		const cleanId = checkId(req.params.id, "id");
		const notification = await getNotificationById(cleanId);

		const sessionUser = req.session && req.session.user;
		const isRecipient = Boolean(
			sessionUser && notification.userId === sessionUser._id,
		);
		const isAdmin = Boolean(
			sessionUser && sessionUser.userRole === "admin",
		);
		if (!isRecipient && !isAdmin) {
			return res.status(403).render("error", {
				title: "Forbidden",
				error: "You do not have permission to view this notification.",
			});
		}

		let recipient = null;
		try {
			const usersCol = await users();
			recipient = await usersCol.findOne({ _id: notification.userId });
		} catch {
			recipient = null;
		}

		const canMarkRead = isRecipient && !notification.readAt;

		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.viewNotification(cleanId);

		return res.render("notification", {
			title: `Notification — ${notification.channel}`,
			user: sessionUser,
			notification: decorateNotification(notification),
			recipient,
			canMarkRead,
			statusMessage: req.query.read ? "Notification marked as read." : null,
			error: null,
		});
	} catch (e) {
		const msg = e.toString();
		if (msg.includes("No notification found")) {
			return res.status(404).render("error", {
				title: "Not Found",
				error: msg,
			});
		}
		return res.status(400).render("error", {
			title: "Error",
			error: msg,
		});
	}
});

// Recipient-only "mark as read" action from the detail page.
router.route("/:id/read").post(async (req, res) => {
	try {
		const sessionUser = req.session && req.session.user;
		if (!sessionUser) {
			return res.redirect("/signin");
		}
		const cleanId = checkId(req.params.id, "id");
		await markNotificationAsRead(cleanId, sessionUser._id);

		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = `Marked notification ${cleanId} as read`;

		return res.redirect(`/notifications/${cleanId}?read=1`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Error",
			error: e.toString(),
		});
	}
});

export default router;
