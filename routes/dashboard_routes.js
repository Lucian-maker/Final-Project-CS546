import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	const user = req.session.user;
	return res.render("dashboard", {
		title: "Dashboard",
		user,
		isAdmin: user.userRole === "admin",
	});
});

export default router;
