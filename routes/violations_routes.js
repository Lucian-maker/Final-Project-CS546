import {
	getAllViolations,
	getViolationById,
	searchViolations,
	createViolation,
	updateViolationStatus
} from "../data/violations.js";

import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	try {
		let violationsList;

		if (req.query.search) {
			violationsList = await searchViolations(req.query.search);
		} else {
			violationsList = await getAllViolations();
		}

		if (req.query.days) {
			const days = parseInt(req.query.days, 10);
			if (!isNaN(days)) {
				violationsList = violationsList.filter(v =>
					v.violationStatus !== "Closed" &&
					v.daysRemaining !== null &&
					v.daysRemaining !== undefined &&
					v.daysRemaining <= days
				);
			}
		}

		return res.render("violations", {
			title: "Violations",
			violations: violationsList,
			search: req.query.search || "",
			user: req.session?.user
		});
	} catch (e) {
		return res.status(500).render("error", {
			error: e
		});
	}
});

router.route("/:id").get(async (req, res) => {
	try {
		const violation = await getViolationById(req.params.id);

		return res.render("violation", {
			title: "Violation Detail",
			violation,
			user: req.session?.user
		});
	} catch (e) {
		return res.status(404).render("error", {
			error: "Violation not found"
		});
	}
});

router.route("/:id/status").post(async (req, res) => {
	try {
		if (!req.session?.user || req.session.user.userRole !== "admin") {
			return res.status(403).render("error", { error: "Unauthorized" });
		}

		await updateViolationStatus(req.params.id, req.body.status);
		return res.redirect(`/violations/${req.params.id}`);
	} catch (e) {
		return res.status(400).render("error", { error: e });
	}
});

router.route("/create").post(async (req, res) => {
	try {
		const newViolation = await createViolation(req.body);

		return res.redirect(`/violations/${newViolation._id}`);
	} catch (e) {
		return res.status(400).render("error", { error: e });
	}
});

export default router;
