import { Router } from "express";
import {
	createAttorney,
	getAllAttorneys,
	getAttorneyById,
	removeAttorney,
	updateAttorney,
} from "../data/attorneys.js";

import { logDescriptions, logCategories } from "../helpers.js";

const router = Router();

// Returns the attorney list.
router.route("/api").get(async (req, res) => {
	try {
		res.locals.logCategory = logCategories.attorneys;
		res.locals.logDescription = logDescriptions.viewAttorneys();
		const attorneys = await getAllAttorneys();
		return res.json(attorneys);
	} catch (e) {
		return res.status(500).json({ error: e.toString() });
	}
});

// Creates a new attorney .
router.route("/api").post(async (req, res) => {
	try {
		const created = await createAttorney(req.body);
		res.locals.logCategory = logCategories.attorneys;
		res.locals.logDescription = logDescriptions.createAttorney(created._id);
		return res.status(201).json(created);
	} catch (e) {
		return res.status(400).json({ error: e.toString() });
	}
});

// Returns the attorney by the id #.
router.route("/api/:id").get(async (req, res) => {
	try {
		const item = await getAttorneyById(req.params.id);

		res.locals.logCategory = logCategories.attorneys;
		res.locals.logDescription = logDescriptions.viewAttorney(req.params.id);

		return res.json(item);
	} catch (e) {
		if (e.toString().includes("No attorney found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Updates the attorney by the id #.
router.route("/api/:id").patch(async (req, res) => {
	try {
		const updated = await updateAttorney(req.params.id, req.body);

		res.locals.logCategory = logCategories.attorneys;
		res.locals.logDescription = logDescriptions.updateAttorney(req.params.id);
		return res.json(updated);
	} catch (e) {
		if (e.toString().includes("No attorney found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Deletes the attorney by the id #.
router.route("/api/:id").delete(async (req, res) => {
	try {
		const deleted = await removeAttorney(req.params.id);
		res.locals.logCategory = logCategories.attorneys;
		res.locals.logDescription = logDescriptions.deleteAttorney(req.params.id);
		return res.json(deleted);
	} catch (e) {
		if (e.toString().includes("No attorney found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Routes to the attorney website page.
router.route("/").get(async (req, res) => {
	try {
		const attorneysList = await getAllAttorneys();
		res.locals.logCategory = logCategories.attorneys;
		res.locals.logDescription = logDescriptions.viewAttorneys();
		return res.render("attorneys", {
			title: "Attorneys",
			attorneys: attorneysList,
			user: req.session && req.session.user,
		});
	} catch (e) {
		return res.status(500).render("error", { error: e.toString() });
	}
});

export default router;
