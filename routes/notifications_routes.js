import { Router } from "express";
import {
	createNotification,
	getAllNotifications,
	getNotificationById,
	removeNotification,
	updateNotification,
} from "../data/notifications.js";

import { logDescriptions, logCategories } from "../helpers.js";

const router = Router();

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
		res.locals.logDescription = logDescriptions.updateNotification(req.params.id);
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
		res.locals.logDescription = logDescriptions.deleteNotification(req.params.id);
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
		const notificationsList = await getAllNotifications();
		res.locals.logCategory = logCategories.notifications;
		res.locals.logDescription = logDescriptions.viewNotifications();
		return res.render("notifications", {
			title: "Notifications",
			notifications: notificationsList,
			user: req.session && req.session.user,
		});
	} catch (e) {
		return res.status(500).render("error", { error: e.toString() });
	}
});

export default router;
