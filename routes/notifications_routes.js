import { Router } from "express";
import {
	createNotification,
	getAllNotifications,
	getNotificationById,
	getNotificationsForUser,
	getQueuedNotificationsForUser,
	markQueuedDeliveredForUser,
	removeNotification,
	updateNotification,
} from "../data/notifications.js";

import { logDescriptions, logCategories } from "../helpers.js";
import { adminGuard } from "../middleware.js";

const router = Router();

// In-app feed for header badge + toasts (must be before /api/:id).
router.route("/api/in-app").get(async (req, res) => {
	try {
		const userId = req.session.user._id;
		const queued = await getQueuedNotificationsForUser(userId);
		const unreadCount = queued.length;
		const queuedIds = queued.map((n) => String(n._id).trim());
		res.set("Cache-Control", "no-store");
		const recentQueued = queued.slice(0, 5).map((n) => ({
			_id: n._id,
			channel: n.channel,
			text: n.notificationDetails?.text ?? "",
			violationId: n.violationId,
		}));

		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.viewNotifications();

		return res.json({ unreadCount, recentQueued, queuedIds });
	} catch (e) {
		return res.status(500).json({ error: e.toString() });
	}
});

router.route("/sync-read").post(async (req, res) => {
	const rawIds = req.body && req.body.notificationIds;
	const ids = Array.isArray(rawIds)
		? rawIds
		: typeof rawIds === "string"
			? [rawIds]
			: [];
	if (!ids.length) {
		return res.status(400).json({
			ok: false,
			error: "notificationIds must include at least one id",
		});
	}
	const strings = ids
		.filter((x) => typeof x === "string")
		.map((s) => s.trim())
		.filter(Boolean);
	if (strings.length === 0) {
		return res.status(400).json({
			ok: false,
			error: "notificationIds must include at least one id",
		});
	}
	try {
		const { modifiedCount } = await markQueuedDeliveredForUser(
			req.session.user._id,
			strings,
		);
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription =
			logDescriptions.syncNotificationsRead(modifiedCount);
		return res.json({ ok: true, modifiedCount });
	} catch (e) {
		return res.status(500).json({ ok: false, error: String(e) });
	}
});

// Returns the notification list.
router.route("/api").get(async (req, res) => {
	try {
		const notifications = await getAllNotifications();
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.viewNotifications();

		return res.json(notifications);
	} catch (e) {
		return res.status(500).json({ error: e.toString() });
	}
});

// Creates a new notification .
router.route("/api").post(adminGuard, async (req, res) => {
	try {
		const created = await createNotification(req.body);
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.createNotification(
			created._id,
		);
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
		res.locals.logDescription = logDescriptions.viewNotification(
			req.params.id,
		);
		return res.json(item);
	} catch (e) {
		if (e.toString().includes("No notification found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Updates the notification by the id #.
router.route("/api/:id").patch(adminGuard, async (req, res) => {
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
router.route("/api/:id").delete(adminGuard, async (req, res) => {
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

// Routes to the notifications
router.route("/").get(async (req, res) => {
	try {
		const notificationsList = await getNotificationsForUser(
			req.session.user._id,
		);
		const notificationsView = notificationsList.map((notification) => ({
			...notification,
			stringId:
				notification && notification._id != null
					? String(notification._id).trim()
					: "",
		}));

		const unreadNotifications = notificationsView.filter(
			(n) => n.status === "queued",
		);

		const readNotifications = notificationsView.filter(
			(n) => n.status !== "queued",
		);

		const hasUnread = unreadNotifications.length > 0;
		const hasRead = readNotifications.length > 0;

		const hasQueued = notificationsView.some((n) => n.status === "queued");
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.viewNotifications();
		return res.render("notifications", {
			title: "Notifications",
			notifications: notificationsView,
			unreadNotifications,
			readNotifications,
			hasUnread, 
			hasRead,
			hasQueued,
			user: req.session && req.session.user,
		});
	} catch (e) {
		return res.status(500).render("error", { error: e.toString() });
	}
});

export default router;
