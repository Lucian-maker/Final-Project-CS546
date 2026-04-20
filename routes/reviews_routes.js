import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	return res.render("reviews", {
		title: "Reviews",
		user: req.session && req.session.user,
	});
});

export default router;
