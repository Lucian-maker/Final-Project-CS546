import { Router } from "express";
import {
	getProperties,
	getPropertyById,
	createProperty,
} from "../data/properties.js";
import { getCommentsByProperty } from "../data/comments.js";

import { logDescriptions, logCategories } from "../helpers.js";

const router = Router();

router.get("/", async (req, res) => {
	try {
		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription =
			logDescriptions.viewPropertiesList();

		const filters = {
			search: req.query.search || "",
			city: req.query.city || "",
			state: req.query.state || "",
			zipCode: req.query.zipCode || "",
			minViolations:
				req.query.minViolations !== undefined &&
				req.query.minViolations !== ""
					? Number(req.query.minViolations)
					: null,
			minReviews:
				req.query.minReviews !== undefined &&
				req.query.minReviews !== ""
					? Number(req.query.minReviews)
					: null,
			sort: req.query.sort || "createdOn",
			order: req.query.order || "desc",
		};

		let properties = await getProperties(filters);

		return res.render("properties", {
			title: "Properties",
			properties,
			filters,
			user: req.session?.user,
		});
	} catch (e) {
		return res.status(500).render("error", {
			error: String(e),
		});
	}
});

router.get("/:id", async (req, res) => {
	try {
		const property = await getPropertyById(req.params.id);
		const comments = await getCommentsByProperty(req.params.id);

		let averageRating = "No Ratings";
		let totalRating = 0;
		let ratingCount = 0;

		const user = req.session?.user;

		const processComments = (cList) => {
			cList.forEach(c => {
				if (user) {
					c.hasLiked = c.likes && c.likes.includes(user._id);
					c.hasDisliked = c.dislikes && c.dislikes.includes(user._id);
					c.isAuthor = c.userId === user._id;
				}
				
				if (c.rating !== null && c.rating !== undefined) {
					totalRating += c.rating;
					ratingCount++;
				}

				if (c.replies) processComments(c.replies);
			});
		};
		processComments(comments);

		if (ratingCount > 0) {
			averageRating = (totalRating / ratingCount).toFixed(1) + " / 5.0 ⭐";
		}

		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription =
			logDescriptions.viewProperty(req.params.id);

		return res.render("property", {
			title: "Property Detail",
			property,
			comments,
			averageRating,
			user,
		});
	} catch (e) {
		return res.status(404).render("error", {
			error: "Property not found",
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
			zipCode,
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
