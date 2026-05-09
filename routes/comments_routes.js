import { Router } from "express";
import { logDescriptions, logCategories } from "../helpers.js";

const router = Router();

router.route("/").get(async (req, res) => {

	res.locals.logCategory = logCategories.comments;
	res.locals.logDescription = logDescriptions.viewComments();

	return res.render("comments", {
		title: "Comments",
		user: req.session && req.session.user,
	});
});

export default router;
