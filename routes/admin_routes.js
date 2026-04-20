import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	return res.render("admin", {
		title: "Admin Console",
		user: req.session.user,
	});
});

export default router;
