import { Router } from "express";
import { logCategories, logDescriptions } from "../helpers.js";

const router = Router();

router.route("/").get(async (req, res) => {
	res.locals.logCategory = logCategories.evidence;
	res.locals.logDescription = logDescriptions.viewEvidence();
	return res.render("evidence", {
		title: "Evidence Vault",
		user: req.session && req.session.user,
	});
});

export default router;
