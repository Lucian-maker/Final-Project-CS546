import { Router } from "express";
import {
	createDispute,
	getAllDisputes,
	getDisputeById,
	removeDispute,
	updateDispute,
} from "../data/disputes.js";
import { users } from "../config/mongoCollections.js";
import {
	notifyDisputeCreated,
	notifyDisputeUpdated,
} from "../data/notification_events.js";

import {
	checkId,
	formatDateTime,
	logCategories,
	logDescriptions,
} from "../helpers.js";
import { adminGuard } from "../middleware.js";

const router = Router();

const DISPUTE_STATUSES = Object.freeze([
	"Pending",
	"Under Review",
	"Resolved",
	"Denied",
]);

const decorateDispute = (d) => ({
	...d,
	createdAtFormatted: d.createdAt ? formatDateTime(d.createdAt) : "—",
});

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
router.route("/api").post(adminGuard, async (req, res) => {
	try {
		const created = await createDispute(req.body);
		void notifyDisputeCreated({
			disputeId: created._id,
			actorUserId: req.session?.user?._id ?? null,
		}).catch(() => {});
		res.locals.logCategory = logCategories.disputes;
		res.locals.logDescription = `Created dispute ${created._id}`;
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
router.route("/api/:id").patch(adminGuard, async (req, res) => {
	try {
		const updated = await updateDispute(req.params.id, req.body);
		void notifyDisputeUpdated({
			disputeId: req.params.id,
			actorUserId: req.session?.user?._id ?? null,
			newStatus: updated.status,
		}).catch(() => {});
		res.locals.logCategory = logCategories.disputes;
		res.locals.logDescription = `Updated dispute ${req.params.id}`;
		return res.json(updated);
	} catch (e) {
		if (e.toString().includes("No dispute found")) {
			return res.status(404).json({ error: e.toString() });
		}
		return res.status(400).json({ error: e.toString() });
	}
});

// Deletes the dispute by the id #.
router.route("/api/:id").delete(adminGuard, async (req, res) => {
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
	try {
		const disputesList = await getAllDisputes();
		const decorated = disputesList.map(decorateDispute);
		res.locals.logCategory = logCategories.dashboard;
		res.locals.logDescription = logDescriptions.viewDisputes();
		return res.render("disputes", {
			title: "Disputes",
			disputes: decorated,
			user: req.session && req.session.user,
		});
	} catch (e) {
		return res.status(500).render("error", { error: e.toString() });
	}
});

// Renders a single dispute detail page.
router.route("/:id").get(async (req, res) => {
	try {
		const cleanId = checkId(req.params.id, "id");
		const dispute = await getDisputeById(cleanId);

		let creator = null;
		if (dispute.createdBy) {
			try {
				const usersCol = await users();
				creator = await usersCol.findOne({ _id: dispute.createdBy });
			} catch {
				creator = null;
			}
		}

		const sessionUser = req.session && req.session.user;
		const canManage = Boolean(
			sessionUser && sessionUser.userRole === "admin",
		);

		res.locals.logCategory = logCategories.disputes;
		res.locals.logDescription = `Viewed dispute ${cleanId}`;

		return res.render("dispute", {
			title: `Dispute — ${dispute.eventType}`,
			user: sessionUser,
			dispute: decorateDispute(dispute),
			creator,
			canManage,
			allowedStatuses: DISPUTE_STATUSES,
			statusMessage: req.query.updated ? "Dispute updated." : null,
			error: null,
		});
	} catch (e) {
		const msg = e.toString();
		if (msg.includes("No dispute found")) {
			return res.status(404).render("error", {
				title: "Not Found",
				error: msg,
			});
		}
		return res.status(400).render("error", {
			title: "Error",
			error: msg,
		});
	}
});

// Admin-only status update from the detail page.
router.route("/:id/status").post(adminGuard, async (req, res) => {
	try {
		const cleanId = checkId(req.params.id, "id");
		const body = req.body || {};
		const newStatus = String(body.newStatus || "").trim();
		const result =
			body.result !== undefined && body.result !== null
				? String(body.result).trim().slice(0, 2000)
				: "";

		if (!DISPUTE_STATUSES.includes(newStatus)) {
			throw `Status must be one of: ${DISPUTE_STATUSES.join(", ")}`;
		}

		await updateDispute(cleanId, { status: newStatus, result });

		res.locals.logCategory = logCategories.disputes;
		res.locals.logDescription = logDescriptions.updateDispute(cleanId);

		return res.redirect(`/disputes/${cleanId}?updated=1`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Error",
			error: e.toString(),
		});
	}
});

export default router;
