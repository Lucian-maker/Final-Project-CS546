import { Router } from "express";
import { logCategories, logDescriptions } from "../helpers.js";
import {
	createEvidence,
	listEvidenceForSessionUser,
	softDeleteEvidence,
} from "../data/evidence.js";
import { formatDateTime } from "../helpers.js";

const router = Router();

function decorateEvidenceRow(row) {
	return {
		...row,
		uploadedAtFormatted: formatDateTime(row.uploadedAt),
		capturedAtFormatted: formatDateTime(row.capturedAt),
	};
}

router
	.route("/")
	.get(async (req, res) => {
		try {

			res.locals.logCategory = logCategories.evidence;
			res.locals.logDescription = logDescriptions.viewEvidence();

			const filters = {};
			if (req.query.violationId) {
				filters.violationId = req.query.violationId;
			}
			if (req.query.propertyId) {
				filters.propertyId = req.query.propertyId;
			}
			const rows = await listEvidenceForSessionUser(
				req.session.user,
				filters,
			);
			return res.render("evidence", {
				title: "Evidence Vault",
				user: req.session.user,
				evidenceRows: rows.map(decorateEvidenceRow),
				violationId: req.query.violationId || "",
				propertyId: req.query.propertyId || "",
				message: req.query.added ? "Evidence saved." : null,
				error: null,
			});
		} catch (e) {
			return res.status(400).render("error", {
				title: "Evidence",
				error: String(e),
			});
		}
	})
	.post(async (req, res) => {
		try {
			const body = req.body || {};
			const imageRaw =
				typeof body.imageData === "string" ? body.imageData.trim() : "";
			const evidenceType = imageRaw.length > 0 ? "photo" : "note";

			await createEvidence({
				violationId: body.violationId,
				uploadedByUserId: req.session.user._id,
				evidenceType,
				imageData: imageRaw,
				originalFileName: body.originalFileName,
				caption: body.caption,
				noteText: body.noteText,
			});

			res.locals.logCategory = logCategories.evidence;
			res.locals.logDescription = logDescriptions.uploadEvidence();

			const q = new URLSearchParams();
			if (body.violationId) {
				q.set("violationId", body.violationId);
			}
			q.set("added", "1");
			return res.redirect(`/evidence?${q.toString()}`);
		} catch (e) {
			try {
				const filters = {};
				if (req.body?.violationId) {
					filters.violationId = req.body.violationId;
				}
				const rows = await listEvidenceForSessionUser(
					req.session.user,
					filters,
				);
				return res.status(400).render("evidence", {
					title: "Evidence Vault",
					user: req.session.user,
					evidenceRows: rows.map(decorateEvidenceRow),
					violationId: req.body?.violationId || "",
					propertyId: req.body?.propertyId || "",
					message: null,
					error: String(e),
				});
			} catch {
				return res.status(400).render("error", {
					title: "Evidence",
					error: String(e),
				});
			}
		}
	});

router.route("/:id/delete").post(async (req, res) => {
	try {
		await softDeleteEvidence(req.params.id, req.session.user);

		res.locals.logCategory = logCategories.evidence;
		res.locals.logDescription = logDescriptions.deleteEvidence(req.params.id);

		const vid = req.body?.violationId || req.query?.violationId;
		if (vid) {
			return res.redirect(
				`/evidence?violationId=${encodeURIComponent(vid)}`,
			);
		}
		return res.redirect("/evidence");
	} catch (e) {
		return res.status(400).render("error", {
			title: "Evidence",
			error: String(e),
		});
	}
});

export default router;
