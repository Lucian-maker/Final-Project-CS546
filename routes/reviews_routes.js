import { Router } from "express";
import {
	createReview,
	getReviewsByProperty,
	getReviewById,
	updateReview,
	softDeleteReview,
} from "../data/reviews.js";
import { checkId, checkScore, checkShortText } from "../helpers.js";
import { requireAuth, requireRole } from "../middleware.js";

const router = Router();

const renderList = async (res, propertyId, user, extras = {}) => {
	const list = await getReviewsByProperty(propertyId);
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
		reviews: decorated,
		canReview:
			Boolean(user && user.userRole === "tenant") && !alreadyReviewed,
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
			return await renderList(res, cleanPropertyId, req.session?.user);
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
			return renderList(res, req.params.propertyId, req.session.user, {
				error: String(e),
				form: body,
			});
		}

		try {
			await createReview(
				cleanPropertyId,
				req.session.user._id,
				body.landlordId,
				body.responsiveness,
				body.value,
				body.resolution,
				body.reviewText,
			);
			return res.redirect(`/reviews/${cleanPropertyId}`);
		} catch (e) {
			return renderList(res, cleanPropertyId, req.session.user, {
				error: String(e),
				form: body,
			});
		}
	});

router.route("/:reviewId/edit").post(requireAuth, async (req, res) => {
	const body = req.body || {};
	try {
		const existing = await getReviewById(req.params.reviewId);
		await updateReview(
			req.params.reviewId,
			req.session.user._id,
			body.responsiveness,
			body.value,
			body.resolution,
			body.reviewText,
		);
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
		await softDeleteReview(req.params.reviewId, req.session.user._id);
		return res.redirect(`/reviews/${existing.propertyId}`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Delete Failed",
			error: String(e),
		});
	}
});

export default router;
