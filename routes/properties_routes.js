import { Router } from "express";
import {
	getAllProperties,
	searchProperties,
	getPropertyById
} from "../data/properties.js";

const router = Router();

router.route("/").get(async (req, res) => {
	try {
		let properties;

		if (req.query.search) {
			properties = await searchProperties(req.query.search);
		} else {
			properties = await getAllProperties();
		}

		return res.render("properties", {
			title: "Properties",
			properties,
			search: req.query.search || "",
			user: req.session?.user
		});
	} catch (e) {
		return res.status(500).render("error", {
			error: e
		});
	}
});

router.route("/:id").get(async (req, res) => {
	try {
		const property = await getPropertyById(req.params.id);

		return res.render("property", {
			title: "Property Detail",
			property,
			user: req.session?.user
		});
	} catch (e) {
		return res.status(404).render("error", {
			error: "Property not found"
		});
	}
});

export default router;
