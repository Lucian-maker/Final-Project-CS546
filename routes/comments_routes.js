import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	return res.render("comments", {
		title: "Comments",
		user: req.session && req.session.user,
	});
});

export default router;
