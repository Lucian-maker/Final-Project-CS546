import {
	getAllViolations,
	getViolationById,
	searchViolations,
	createViolation,
	updateViolationStatus
} from "../data/violations.js";

import { logDescriptions, logCategories, checkId } from "../helpers.js";

import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	try {
		res.locals.logCategory = logCategories.violations;

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

		res.locals.logDescription =
			req.query.search
				? logDescriptions.searchViolations(req.query.search)
				: logDescriptions.viewViolationsList();

		return res.render("violations", {
			title: "Violations",
			violations: violationsList,
			search: req.query.search || "",
			user: req.session?.user
		});
	} catch (e) {
		return res.status(500).render("error", { error: e });
	}
});

router.route("/:id").get(async (req, res) => {
	try {
		const violationId = checkId(req.params.id, "violationId");
		const violation = await getViolationById(violationId);

		const from = req.query.from;

		res.locals.logCategory = logCategories.violations;
		res.locals.logDescription = logDescriptions.viewViolation(violationId);

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
		const violationId = checkId(req.params.id, "violationId");

		res.locals.logCategory = logCategories.violations;
		res.locals.logDescription = logDescriptions.updateViolationStatus(
			violationId, 
			req.body.status
		);

		if (!req.session?.user || req.session.user.userRole !== "admin") {
			return res.status(403).render("error", { error: "Unauthorized" });
		}

		await updateViolationStatus(violationId, req.body.status);
		return res.redirect(`/violations/${violationId}`);
	} catch (e) {
		return res.status(400).render("error", { error: e });
	}
});

router.route("/create").post(async (req, res) => {
	try {
		const newViolation = await createViolation(req.body);

		res.locals.logCategory = logCategories.violations;
		res.locals.logDescription = logDescriptions.createViolation(newViolation._id);

		return res.redirect(`/violations/${newViolation._id}`);
	} catch (e) {
		return res.status(400).render("error", { error: e });
	}
});

export default router;
