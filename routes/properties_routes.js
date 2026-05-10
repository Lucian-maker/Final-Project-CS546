import { Router } from "express";
import {
	getProperties,
	getPropertyById,
	createProperty,
	claimProperty,
	unclaimProperty,
} from "../data/properties.js";
import { getCommentsByProperty } from "../data/comments.js";

import { saveProperty, unsaveProperty, getUserById } from "../data/users.js";

import { logDescriptions, logCategories } from "../helpers.js";

const router = Router();

router.get("/", async (req, res) => {
	try {
		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription = logDescriptions.viewPropertiesList();

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
			minTrustScore:
				req.query.minTrustScore !== undefined &&
				req.query.minTrustScore !== ""
					? Number(req.query.minTrustScore)
					: null,
			maxAvgResolution:
				req.query.maxAvgResolution !== undefined &&
				req.query.maxAvgResolution !== ""
					? Number(req.query.maxAvgResolution)
					: null,
			sort: req.query.sort || "createdOn",
			order: req.query.order || "desc",
		};

		const properties = await getProperties(filters);

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
		const freshUser = await getUserById(req.session.user._id);
		const property = await getPropertyById(req.params.id);
		const comments = await getCommentsByProperty(req.params.id);

		let averageRating = "No Ratings";
		let totalRating = 0;
		let ratingCount = 0;

		const user = freshUser;

		const processComments = (cList) => {
			cList.forEach((c) => {
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
			averageRating =
				(totalRating / ratingCount).toFixed(1) + " / 5.0 ⭐";
		}

		const from = req.query.from || null;

		const isSaved = freshUser.savedProperties?.some(
			(id) => String(id) === String(property._id),
		);

		const isOwner =
			property.claimedBy &&
			String(property.claimedBy) === String(freshUser._id);

		const claimedByOther =
			property.claimedBy &&
			String(property.claimedBy) !== String(freshUser._id);

		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription = logDescriptions.viewProperty(req.params.id);

		return res.render("property", {
			title: "Property Detail",
			property,
			user,
			isSaved,
			isOwner,
			claimedByOther,
			from,
			comments,
			averageRating,
			commentError: req.query.commentError || null,
			commentSuccess: req.query.commentSuccess ? true : null,
		});
	} catch (e) {
		return res.status(404).render("error", {
			error: "Property not found",
		});
	}
});

router.post("/:id/save", async (req, res) => {
	try {
		await saveProperty(req.session.user._id, req.params.id);

		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription = logDescriptions.saveProperty(req.params.id);

		req.session.user.savedProperties =
			req.session.user.savedProperties || [];

		req.session.user.savedProperties.push(req.params.id);

		const from = req.query.from || req.body.from || "properties";

		return res.redirect(`/properties/${req.params.id}?from=${from}`);
	} catch (e) {
		return res.status(500).render("error", { error: e });
	}
});

router.post("/:id/unsave", async (req, res) => {
	try {
		await unsaveProperty(req.session.user._id, req.params.id);

		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription = logDescriptions.unsaveProperty(
			req.params.id,
		);

		req.session.user.savedProperties = (
			req.session.user.savedProperties || []
		).filter((id) => String(id) !== String(req.params.id));

		const from = req.query.from || req.body.from || "properties";

		return res.redirect(`/properties/${req.params.id}?from=${from}`);
	} catch (e) {
		return res.status(500).render("error", { error: e });
	}
});

router.post("/:id/claim", async (req, res) => {
	try {
		await claimProperty(req.params.id, req.session.user._id);

		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription = logDescriptions.claimProperty(
			req.params.id,
		);

		const from = req.query.from || req.body.from || "properties";

		return res.redirect(`/properties/${req.params.id}?from=${from}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

router.post("/:id/unclaim", async (req, res) => {
	try {
		await unclaimProperty(req.params.id, req.session.user._id);

		res.locals.logCategory = logCategories.properties;
		res.locals.logDescription = logDescriptions.unclaimProperty(
			req.params.id,
		);

		const from = req.query.from || req.body.from || "properties";

		return res.redirect(`/properties/${req.params.id}?from=${from}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
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
		res.locals.logDescription = logDescriptions.createProperty(
			newProperty._id,
		);

		return res.redirect(`/properties/${newProperty._id}`);
	} catch (e) {
		return res.status(400).render("error", { error: e });
	}
});

export default router;
