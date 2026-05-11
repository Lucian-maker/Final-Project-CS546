import { Router } from "express";
import {
	VIOLATION_STATUSES,
	assertUserCanAccessViolation,
	createViolation,
	getViolationById,
	getViolations,
	getViolationsForSessionUser,
	updateViolationRemediation,
} from "../data/violations.js";
import { getEvidenceByViolation } from "../data/evidence.js";
import { logDescriptions, logCategories } from "../helpers.js";
import { formatDateTime } from "../helpers.js";
import {
	notifyDisputeCreated,
	notifyViolationStatusUpdated,
} from "../data/notification_events.js";
import { createDispute } from "../data/disputes.js";
import { adminGuard } from "../middleware.js";
import PDFDocument from "pdfkit";


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
	// All roles (admin, landlord, tenant) get the same status options
	return VIOLATION_STATUSES.filter((s) => s !== current);
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

		let violationsList = await getViolationsForSessionUser(
			req.session.user,
			filters,
		);

		if (req.query.days) {
			const days = parseInt(req.query.days, 10);
			const minDays = req.query.minDays
				? parseInt(req.query.minDays, 10)
				: null;

			if (!isNaN(days)) {
				violationsList = violationsList.filter(
					(v) =>
						v.violationStatus !== "Closed" &&
						v.violationStatus !== "Resolved" &&
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

router.post("/create", adminGuard, async (req, res) => {
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
			await assertUserCanAccessViolation(req.session.user, req.params.id);
			const violation = await getViolationById(req.params.id);

			const allowed = allowedNextStatuses(
				req.session.user.userRole,
				violation.violationStatus,
			);

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
			const existing = await getViolationById(req.params.id);

			await updateViolationRemediation(req.params.id, req.session.user, {
				newStatus: body.newStatus,
				notes: body.notes,
			});

			void notifyViolationStatusUpdated({
				violationId: req.params.id,
				actorUserId: req.session.user._id,
				oldStatus: existing.violationStatus,
				newStatus: body.newStatus,
			}).catch(() => { });

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
// PDF export 
router.get("/:id/export", async (req, res) => {
	try {
		await assertUserCanAccessViolation(req.session.user, req.params.id);
		const violation = await getViolationById(req.params.id);

		let evidenceRecords = [];
		try {
			evidenceRecords = await getEvidenceByViolation(req.params.id);
		} catch {

		}

		const doc = new PDFDocument({ margin: 50 });

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename=violation-report-${req.params.id}.pdf`,
		);
		doc.pipe(res);

		// Header
		doc.fontSize(20).text("NYCHCom — Verifiable Violation Status Report", {
			underline: true,
		});
		doc.moveDown();
		doc.fontSize(10).fillColor("#666").text(
			`Generated: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`,
		);
		doc.moveDown();

		// Violation Details
		doc.fontSize(14).fillColor("#000").text("Violation Details", {
			underline: true,
		});
		doc.moveDown(0.5);
		doc.fontSize(10);
		const details = [
			["Violation ID", violation._id],
			["Property ID", violation.propertyId],
			["Building Address", violation.buildingAddress],
			["Borough", violation.borough || "—"],
			["Zip Code", violation.zipCode || "—"],
			["Type", violation.violationType],
			["Class", violation.violationClass || "—"],
			["Description", violation.violationDescription],
			["Current Status", violation.violationStatus],
			[
				"Certify-By Date",
				violation.originalCertifyByDate
					? formatDateTime(violation.originalCertifyByDate)
					: "—",
			],
			[
				"Inspection Date",
				violation.inspectionDate
					? formatDateTime(violation.inspectionDate)
					: "—",
			],
			["Days Remaining", violation.daysRemaining ?? "—"],
			["Actionable", violation.isActionable ? "Yes" : "No"],
		];

		for (const [label, value] of details) {
			doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
			doc.font("Helvetica").text(String(value));
		}

		// Remediation Status
		doc.moveDown();
		doc.fontSize(14).font("Helvetica-Bold").text("Remediation Status", {
			underline: true,
		});
		doc.moveDown(0.5);
		doc.fontSize(10);
		if (violation.remediationStatus) {
			doc.font("Helvetica-Bold").text("Current State: ", {
				continued: true,
			});
			doc.font("Helvetica").text(
				violation.remediationStatus.currentState || "—",
			);
			doc.font("Helvetica-Bold").text("Notes: ", { continued: true });
			doc.font("Helvetica").text(
				violation.remediationStatus.notes || "—",
			);
			doc.font("Helvetica-Bold").text("Last Updated: ", {
				continued: true,
			});
			doc.font("Helvetica").text(
				violation.remediationStatus.updatedAt
					? formatDateTime(violation.remediationStatus.updatedAt)
					: "—",
			);
		}

		// Status History
		doc.moveDown();
		doc.fontSize(14)
			.font("Helvetica-Bold")
			.text("Status History", { underline: true });
		doc.moveDown(0.5);
		doc.fontSize(10);
		if (
			Array.isArray(violation.statusHistory) &&
			violation.statusHistory.length > 0
		) {
			for (const entry of violation.statusHistory) {
				doc.font("Helvetica-Bold").text(
					`${entry.state} — ${entry.changedAt ? formatDateTime(entry.changedAt) : "—"} (by ${entry.changedBy || "system"})`,
				);
			}
		} else {
			doc.font("Helvetica").text("No status history recorded.");
		}

		// Evidence Records
		doc.moveDown();
		doc.fontSize(14)
			.font("Helvetica-Bold")
			.text("Evidence Records", { underline: true });
		doc.moveDown(0.5);
		doc.fontSize(10);
		if (evidenceRecords.length > 0) {
			for (const ev of evidenceRecords) {
				doc.font("Helvetica-Bold").text(
					`[${ev.evidenceType?.toUpperCase() || "ITEM"}] ${ev.caption || ev.noteText || "Untitled"}`,
				);
				doc.font("Helvetica").text(
					`  Uploaded: ${ev.createdAt ? formatDateTime(ev.createdAt) : "—"} | ID: ${ev._id}`,
				);
				if (ev.noteText) {
					doc.text(`  Note: ${ev.noteText}`);
				}
				doc.moveDown(0.3);
			}
		} else {
			doc.font("Helvetica").text("No evidence records on file.");
		}


		doc.moveDown(2);
		doc.fontSize(8)
			.fillColor("#999")
			.text(
				"This report was generated by the NYCHCom platform. It is intended as a verifiable record for housing court proceedings.",
				{ align: "center" },
			);

		doc.end();
	} catch (e) {
		return res.status(400).render("error", {
			title: "Export Error",
			error: String(e),
		});
	}
});

// Tenant/landlord-facing entrypoint
// admins resolve disputes from /disputes/:id instead.
router.post("/:id/dispute", async (req, res) => {
	try {
		const sessionUser = req.session.user;
		if (sessionUser.userRole === "admin") {
			throw "Admins should update disputes from the disputes page";
		}

		await assertUserCanAccessViolation(sessionUser, req.params.id);

		const notesRaw = req.body?.notes ? String(req.body.notes).trim() : "";
		const result =
			notesRaw.length > 0 ? notesRaw.slice(0, 2000) : "Dispute filed.";

		const created = await createDispute({
			violationId: req.params.id,
			createdBy: sessionUser._id,
			eventType: "status_change",
			status: "Pending",
			result,
		});

		void notifyDisputeCreated({
			disputeId: created._id,
			actorUserId: sessionUser._id,
		}).catch(() => {});

		res.locals.logCategory = logCategories.disputes;
		res.locals.logDescription = `Filed dispute ${created._id} for violation ${req.params.id}`;

		return res.redirect(`/disputes/${created._id}`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Dispute",
			error: String(e),
		});
	}
});

export default router;
