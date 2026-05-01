import { Router } from "express";
import {
	createDispute,
	getAllDisputes,
	getDisputeById,
	removeDispute,
	updateDispute,
} from "../data/disputes.js";

const router = Router();

// Returns the dispute list.
router.route("/api").get(async (req, res) => {
	try {
		const disputes = await getAllDisputes();
		return res.json(disputes);
	} catch (e) {
		return res.status(500).json({ error: e.toString() });
	}
});

// Creates a new dispute .
router.route("/api").post(async (req, res) => {
	try {
		const created = await createDispute(req.body);
		return res.status(201).json(created);
	} catch (e) {
		return res.status(400).json({ error: e.toString() });
	}
});

// Returns the dispute by the id #.
router.route("/api/:id").get(async (req, res) => {
	try {
		const item = await getDisputeById(req.params.id);
		return res.json(item);
	} catch (e) {
		if (e.toString().includes("No dispute found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Updates the dispute by the id #.
router.route("/api/:id").patch(async (req, res) => {
	try {
		const updated = await updateDispute(req.params.id, req.body);
		return res.json(updated);
	} catch (e) {
		if (e.toString().includes("No dispute found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Deletes the dispute by the id #.
router.route("/api/:id").delete(async (req, res) => {
	try {
		const deleted = await removeDispute(req.params.id);
		return res.json(deleted);
	} catch (e) {
		if (e.toString().includes("No dispute found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Routes to the dispute website page.
router.route("/").get(async (req, res) => {
	return res.render("disputes", {
		title: "Disputes",
		user: req.session && req.session.user,
	});
});

export default router;
