import { Router } from "express";
import {
	VIOLATION_STATUSES,
	assertUserCanAccessViolation,
	createViolation,
	getViolationById,
	getViolations,
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

function allowedNextStatuses(current) {
	return VIOLATION_STATUSES.filter((status) => status !== current);
}

router.get("/", async (req, res) => {
	try {
		res.locals.logCategory = logCategories.violations;
		res.locals.logDescription = req.query.q
			? logDescriptions.searchViolations(req.query.q)
			: logDescriptions.viewViolationsList();
		const from = req.query.from || null;

		const filters = {
			q: req.query.q || "",
			borough: req.query.borough || "",
			violationType: req.query.violationType || "",
			violationStatus: req.query.violationStatus || "",
			propertyId: req.query.propertyId || "",
			days: req.query.days || "",
			minDays: req.query.minDays || "",
			sort: req.query.sort || "updatedAt",
			order: req.query.order || "desc",
		};

		let violationsList = await getViolations(filters);

		if (req.query.days) {
			const days = parseInt(req.query.days, 10);
			const minDays = req.query.minDays
				? parseInt(req.query.minDays, 10)
				: null;

			if (!isNaN(days)) {
				violationsList = violationsList.filter(
					(v) =>
						v.violationStatus !== "Closed" &&
						v.daysRemaining != null &&
						v.daysRemaining <= days &&
						(minDays === null || v.daysRemaining >= minDays),
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
			from,
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
		res.locals.logDescription = logDescriptions.createViolation(
			newViolation._id,
		);

		const from = req.body.from || req.query.from || "";
		const propertyId = req.body.propertyId || "";

		return res.redirect(
			`/violations/${newViolation._id}?from=${from}&propertyId=${propertyId}`,
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
			const violation = await getViolationById(req.params.id);

			const allowed = allowedNextStatuses(violation.violationStatus);

			const from = req.query.from || null;
			const propertyId = req.query.propertyId || null;

			res.locals.logCategory = logCategories.violations;
			res.locals.logDescription = logDescriptions.viewViolation(
				req.params.id,
			);

			return res.render("violation", {
				title: `Violation — ${violation.buildingAddress}`,
				user: req.session.user,
				violation: decorateViolationForView(violation),
				allowedNextStatuses: allowed,
				statusMessage: req.query.updated ? "Status updated." : null,
				error: null,
				from,
				propertyId,
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

			res.locals.logCategory = logCategories.violations;
			res.locals.logDescription = logDescriptions.updateViolationStatus(
				req.params.id,
				body.newStatus,
			);

			const from = req.body.from || req.query.from || "";
			const propertyId = req.body.propertyId || "";

			return res.redirect(
				`/violations/${req.params.id}?updated=1&from=${from}&propertyId=${propertyId}`,
			);
		} catch (e) {
			try {
				await assertUserCanAccessViolation(
					req.session.user,
					req.params.id,
				);

				const violation = await getViolationById(req.params.id);

				const allowed = allowedNextStatuses(violation.violationStatus);

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
