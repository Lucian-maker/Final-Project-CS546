import { Router } from "express";
import {
	VIOLATION_STATUSES,
	assertUserCanAccessViolation,
	createViolation,
	getViolationById,
	getViolationsForSessionUser,
	updateViolationRemediation,
} from "../data/violations.js";

import { logDescriptions, logCategories, checkId } from "../helpers.js";
import { formatDateTime } from "../helpers.js";

const router = Router();

const BOROUGHS = [
	"Manhattan",
	"Brooklyn",
	"Queens",
	"Bronx",
	"Staten Island",
	"Unspecified",
];

function decorateViolationForView(v) {
	const history = Array.isArray(v.statusHistory)
		? v.statusHistory.map((h) => ({
				...h,
				changedAtFormatted: formatDateTime(h.changedAt),
			}))
		: [];

	return {
		...v,
		statusHistory: history,
		originalCertifyByDateFormatted: formatDateTime(v.originalCertifyByDate),
		inspectionDateFormatted: formatDateTime(v.inspectionDate),
		updatedAtFormatted: formatDateTime(v.updatedAt),
		repairScheduledAtFormatted: v.repairScheduledAt
			? formatDateTime(v.repairScheduledAt)
			: "—",
		resolvedAtFormatted: v.resolvedAt ? formatDateTime(v.resolvedAt) : "—",
		remediationUpdatedAtFormatted: v.remediationStatus?.updatedAt
			? formatDateTime(v.remediationStatus.updatedAt)
			: "—",
	};
}

function allowedNextStatuses(role, current) {
	if (role === "admin") return [...VIOLATION_STATUSES];

	if (role === "landlord") {
		if (current === "Open") return ["Repair Scheduled", "Resolved"];
		if (current === "Repair Scheduled") return ["Resolved"];
		return [];
	}

	if (role === "tenant") {
		if (current === "Open" || current === "Repair Scheduled") {
			return ["Disputed"];
		}
		return [];
	}

	return [];
}

router.get("/", async (req, res) => {
	try {
		res.locals.logCategory = logCategories.violations;

		const filters = {
			q: req.query.q || "",
			borough: req.query.borough || "",
			violationType: req.query.violationType || "",
			violationStatus: req.query.violationStatus || "",
			propertyId: req.query.propertyId || "",
			sort: req.query.sort || "updatedAt",
			order: req.query.order || "desc",
		};

		let violationsList = await getViolationsForSessionUser(
			req.session.user,
			filters
		);

		if (req.query.days) {
			const days = parseInt(req.query.days, 10);
			if (!isNaN(days)) {
				violationsList = violationsList.filter(
					(v) =>
						v.violationStatus !== "Closed" &&
						v.daysRemaining != null &&
						v.daysRemaining <= days
				);
			}
		}

		const decorated = violationsList.map(decorateViolationForView);

		return res.render("violations", {
			title: "Violations",
			user: req.session.user,
			violations: decorated,
			filters,
			boroughs: BOROUGHS,
			statuses: VIOLATION_STATUSES,
		});
	} catch (e) {
		return res.status(400).render("error", {
			title: "Violations",
			error: String(e),
		});
	}
});

router.post("/create", async (req, res) => {
	try {
		const newViolation = await createViolation(req.body);

		res.locals.logCategory = logCategories.violations;
		res.locals.logDescription =
			logDescriptions.createViolation(newViolation._id);

		return res.redirect(`/violations/${newViolation._id}`);
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
			await assertUserCanAccessViolation(
				req.session.user,
				req.params.id
			);

			const violation = await getViolationById(req.params.id);

			const allowed = allowedNextStatuses(
				req.session.user.userRole,
				violation.violationStatus
			);

			return res.render("violation", {
				title: `Violation — ${violation.buildingAddress}`,
				user: req.session.user,
				violation: decorateViolationForView(violation),
				allowedNextStatuses: allowed,
				statusMessage: req.query.updated ? "Status updated." : null,
				error: null,
			});
		} catch (e) {
			return res.status(404).render("error", {
				title: "Error",
				error: String(e),
			});
		}
	})
	.post(async (req, res) => {
		try {
			await updateViolationRemediation(
				req.params.id,
				req.session.user,
				{
					newStatus: req.body.newStatus,
					notes: req.body.notes,
				}
			);

			return res.redirect(
				`/violations/${req.params.id}?updated=1`
			);
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
			await assertUserCanAccessViolation(req.session.user, req.params.id);
			const violation = await getViolationById(req.params.id);
			const allowed = allowedNextStatuses(
				req.session.user.userRole,
				violation.violationStatus,
			);
			return res.render("violation", {
				title: `Violation — ${violation.buildingAddress}`,
				user: req.session.user,
				violation: decorateViolationForView(violation),
				allowedNextStatuses: allowed,
				statusMessage: req.query.updated ? "Status updated." : null,
				error: null,
			});
		} catch (e) {
			const msg = String(e);
			if (msg.includes("not found")) {
				return res.status(404).render("error", {
					title: "Not Found",
					error: msg,
				});
			}
			return res.status(403).render("error", {
				title: "Forbidden",
				error: msg,
			});
		}
	})
	.post(async (req, res) => {
		try {
			const body = req.body || {};
			await updateViolationRemediation(req.params.id, req.session.user, {
				newStatus: body.newStatus,
				notes: body.notes,
			});
			return res.redirect(`/violations/${req.params.id}?updated=1`);
		} catch (e) {
			try {
				await assertUserCanAccessViolation(
					req.session.user,
					req.params.id,
				);
				const violation = await getViolationById(req.params.id);
				const allowed = allowedNextStatuses(
					req.session.user.userRole,
					violation.violationStatus,
				);
				return res.status(400).render("violation", {
					title: `Violation — ${violation.buildingAddress}`,
					user: req.session.user,
					violation: decorateViolationForView(violation),
					allowedNextStatuses: allowed,
					statusMessage: null,
					error: String(e),
				});
			} catch {
				return res.status(400).render("error", {
					title: "Error",
					error: String(e),
				});
			}
		}
	});

export default router;
