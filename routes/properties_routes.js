import { Router } from "express";
import {
	getAllProperties,
	searchProperties,
	getPropertyById,
	createProperty
} from "../data/properties.js";

import { logDescriptions, logCategories } from "../helpers.js";

const router = Router();

router.get("/", async (req, res) => {
	try {
		let properties;

		const search = (req.query.search || "").trim();

		if (search) {
			res.locals.logCategory = logCategories.properties;
			res.locals.logDescription =
				logDescriptions.searchProperties(search);

			properties = await searchProperties(search);
		} else {
			res.locals.logCategory = logCategories.properties;
			res.locals.logDescription =
				logDescriptions.viewPropertiesList();

			properties = await getAllProperties();
		}

		return res.render("properties", {
			title: "Properties",
			properties,
			search,
			user: req.session?.user
		});

	} catch (e) {
		return res.status(500).render("error", { error: e });
	}
});

router.get("/:id", async (req, res) => {
	try {
		const property = await getPropertyById(req.params.id);

		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription =
			logDescriptions.viewProperty(req.params.id);

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


router.post("/create", async (req, res) => {
	try {
		const { streetAddress, city, state, zipCode } = req.body;

		if (!streetAddress || !city || !state || !zipCode) {
			throw "All fields are required";
		}

		const streetParts = streetAddress.trim().split(" ");

		if (streetParts.length < 2) {
			throw "Street address must include number and name";
		}

		const number = streetParts.shift();
		const street = streetParts.join(" ");

		const newProperty = await createProperty({
			number,
			street,
			city,
			state,
			zipCode
		});

		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription =
			logDescriptions.createProperty(newProperty._id);

		return res.redirect(`/properties/${newProperty._id}`);
	} catch (e) {
		return res.status(400).render("error", { error: e });
	}
});


export default router;
