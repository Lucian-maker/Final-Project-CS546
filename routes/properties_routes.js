import { Router } from "express";

const router = Router();

router.route("/").get(async (req, res) => {
	return res.render("properties", {
		title: "Properties",
		user: req.session && req.session.user,
	});
});

router.route("/:id").get(async (req, res) => {
	return res.render("property", {
		title: "Property Detail",
		propertyId: req.params.id,
		user: req.session && req.session.user,
	});
});

export default router;
