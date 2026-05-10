import { Router } from "express";
import {
	createReview,
	getAllReviewsVisibleToUser,
	getReviewsByProperty,
	getReviewById,
	updateReview,
	softDeleteReview,
	getLandlordIdForProperty,
} from "../data/reviews.js";
import {
	properties as propertiesCollection,
	users,
} from "../config/mongoCollections.js";
import {
	checkId,
	checkScore,
	checkShortText,
	formatDateTime,
	logDescriptions,
	logCategories,
} from "../helpers.js";
import { requireAuth, requireRole } from "../middleware.js";
import { notifyReviewActivity } from "../data/notification_events.js";

const router = Router();

// Top-level reviews listing scoped to the signed-in user's role.
router.route("/").get(async (req, res) => {
	try {
		const sessionUser = req.session && req.session.user;
		const list = await getAllReviewsVisibleToUser(sessionUser);

		const propsCol = await propertiesCollection();
		const usersCol = await users();
		const decorated = await Promise.all(
			list.map(async (r) => {
				const property = await propsCol.findOne({ _id: r.propertyId });
				let buildingAddress = r.propertyId;
				if (property?.address) {
					const a = property.address;
					buildingAddress = `${a.number} ${a.street}, ${a.city}, ${a.state} ${a.zipCode}`;
				}
				const reviewer = await usersCol.findOne({ _id: r.reviewerId });
				return {
					...r,
					buildingAddress,
					reviewerName: reviewer
						? `${reviewer.firstName} ${reviewer.lastName}`
						: r.reviewerId,
					createdAtFormatted: r.createdAt
						? formatDateTime(r.createdAt)
						: "—",
					isOwnReview:
						sessionUser && r.reviewerId === sessionUser._id,
				};
			}),
		);

		res.locals.logCategory = logCategories.reviews;
		res.locals.logDescription = "Viewed all reviews";

		return res.render("reviews_index", {
			title: "Reviews",
			user: sessionUser,
			reviews: decorated,
		});
	} catch (e) {
		return res.status(400).render("error", {
			title: "Reviews",
			error: String(e),
		});
	}
});

// Per-review detail page. Mounted under /single/:reviewId so /:propertyId
// (the per-property list route) is not shadowed.
router.route("/single/:reviewId").get(async (req, res) => {
	try {
		const cleanId = checkId(req.params.reviewId, "reviewId");
		const review = await getReviewById(cleanId);

		const usersCol = await users();
		const reviewer = await usersCol.findOne({ _id: review.reviewerId });
		const landlord = await usersCol.findOne({ _id: review.landlordId });

		const sessionUser = req.session && req.session.user;
		const decorated = {
			...review,
			createdAtFormatted: review.createdAt
				? formatDateTime(review.createdAt)
				: "—",
			updatedAtFormatted: review.updatedAt
				? formatDateTime(review.updatedAt)
				: "—",
			wasEdited:
				review.updatedAt &&
				review.createdAt &&
				new Date(review.updatedAt).getTime() >
					new Date(review.createdAt).getTime(),
		};

		res.locals.logCategory = logCategories.reviews;
		res.locals.logDescription = `Viewed review ${cleanId}`;

		return res.render("review", {
			title: `Review — ${review._id}`,
			user: sessionUser,
			review: decorated,
			reviewer,
			landlord,
			isOwnReview: Boolean(
				sessionUser && review.reviewerId === sessionUser._id,
			),
			error: null,
		});
	} catch (e) {
		const msg = String(e);
		if (msg.includes("No review found")) {
			return res.status(404).render("error", {
				title: "Not Found",
				error: msg,
			});
		}
		return res.status(400).render("error", {
			title: "Error",
			error: msg,
		});
	}
});

const renderList = async (res, propertyId, user, from, extras = {}) => {
	const list = await getReviewsByProperty(propertyId);
	const landlordId = await getLandlordIdForProperty(propertyId);
	const decorated = list.map((r) => ({
		...r,
		isOwnReview: user && r.reviewerId === user._id,
	}));
	const alreadyReviewed = Boolean(
		user && decorated.find((r) => r.reviewerId === user._id),
	);
	return res.render("reviews", {
		title: "Reviews",
		user,
		propertyId,
		landlordId,
		from,
		reviews: decorated,
		canReview:
			Boolean(user && user.userRole === "tenant") &&
			!alreadyReviewed &&
			Boolean(landlordId),
		...extras,
	});
};

router
	.route("/:propertyId")
	.get(async (req, res) => {
		try {
			const cleanPropertyId = checkId(
				req.params.propertyId,
				"propertyId",
			);

			const from = req.query.from || null;

			res.locals.logCategory = logCategories.reviews;
			res.locals.logDescription =
				logDescriptions.viewPropertyReviews(cleanPropertyId);

			return await renderList(
				res,
				cleanPropertyId,
				req.session?.user,
				from,
			);
		} catch (e) {
			return res.status(400).render("error", {
				title: "Bad Request",
				error: String(e),
			});
		}
	})
	.post(requireRole("tenant"), async (req, res) => {
		const body = req.body || {};
		let cleanPropertyId;
		try {
			cleanPropertyId = checkId(req.params.propertyId, "propertyId");
			checkId(body.landlordId, "landlordId");
			checkScore(body.responsiveness, "responsiveness");
			checkScore(body.value, "value");
			checkScore(body.resolution, "resolution");
			checkShortText(body.reviewText, "reviewText", 500);
		} catch (e) {
			return renderList(
				res,
				req.params.propertyId,
				req.session.user,
				from,
				{
					error: String(e),
					form: body,
				},
			);
		}

		try {
			res.locals.logCategory = logCategories.reviews;
			res.locals.logDescription =
				logDescriptions.createReview(cleanPropertyId);
			await createReview(
				cleanPropertyId,
				req.session.user._id,
				body.landlordId,
				body.responsiveness,
				body.value,
				body.resolution,
				body.reviewText,
			);
			void notifyReviewActivity({
				propertyId: cleanPropertyId,
				actorUserId: req.session.user._id,
				text: "A new property review was posted.",
			}).catch(() => {});
			const from = req.query.from || req.body.from || "";

			return res.redirect(`/reviews/${cleanPropertyId}?from=${from}`);
		} catch (e) {
			return renderList(res, cleanPropertyId, req.session.user, from, {
				error: String(e),
				form: body,
			});
		}
	});

router.route("/:reviewId/edit").post(requireAuth, async (req, res) => {
	const body = req.body || {};
	try {
		const existing = await getReviewById(req.params.reviewId);
		res.locals.logCategory = logCategories.reviews;
		res.locals.logDescription = logDescriptions.updateReview(
			req.params.reviewId,
		);
		await updateReview(
			req.params.reviewId,
			req.session.user._id,
			body.responsiveness,
			body.value,
			body.resolution,
			body.reviewText,
		);
		void notifyReviewActivity({
			propertyId: existing.propertyId,
			actorUserId: req.session.user._id,
			text: "A property review was updated.",
		}).catch(() => {});
		return res.redirect(`/reviews/${existing.propertyId}`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Edit Failed",
			error: String(e),
		});
	}
});

router.route("/:reviewId/delete").post(requireAuth, async (req, res) => {
	try {
		const existing = await getReviewById(req.params.reviewId);
		res.locals.logCategory = logCategories.reviews;
		res.locals.logDescription = logDescriptions.deleteReview(
			req.params.reviewId,
		);
		await softDeleteReview(req.params.reviewId, req.session.user._id);
		void notifyReviewActivity({
			propertyId: existing.propertyId,
			actorUserId: req.session.user._id,
			text: "A property review was removed.",
		}).catch(() => {});
		return res.redirect(`/reviews/${existing.propertyId}`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Delete Failed",
			error: String(e),
		});
	}
});

export default router;
