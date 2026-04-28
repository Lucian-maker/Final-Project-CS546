import { Router } from "express";
import {
	createNotification,
	getAllNotifications,
	getNotificationById,
	removeNotification,
	updateNotification,
} from "../data/notifications.js";

const router = Router();

// Returns the notification list.
router.route("/api").get(async (req, res) => {
	try {
		const notifications = await getAllNotifications();
		return res.json(notifications);
	} catch (e) {
		return res.status(500).json({ error: e.toString() });
	}
});

// Creates a new notification .
router.route("/api").post(async (req, res) => {
	try {
		const created = await createNotification(req.body);
		return res.status(201).json(created);
	} catch (e) {
		return res.status(400).json({ error: e.toString() });
	}
});

// Returns the notification by the id #.
router.route("/api/:id").get(async (req, res) => {
	try {
		const item = await getNotificationById(req.params.id);
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
		return res.json(deleted);
	} catch (e) {
		if (e.toString().includes("No notification found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Routes to the notification website page.
router.route("/").get(async (req, res) => {
	return res.render("notifications", {
		title: "Notifications",
		user: req.session && req.session.user,
	});
});

export default router;
