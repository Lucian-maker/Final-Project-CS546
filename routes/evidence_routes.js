import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	return res.render("evidence", {
		title: "Evidence Vault",
		user: req.session && req.session.user,
	});
});

export default router;
