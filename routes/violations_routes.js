import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	return res.render("violations", {
		title: "Violations",
		user: req.session && req.session.user,
	});
});

router.route("/:id").get(async (req, res) => {
	return res.render("violation", {
		title: "Violation Detail",
		violationId: req.params.id,
		user: req.session && req.session.user,
	});
});

export default router;
