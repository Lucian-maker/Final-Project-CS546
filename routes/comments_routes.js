import { Router } from "express";
import { logDescriptions, logCategories } from "../helpers.js";
import { createComment, likeComment, dislikeComment, editComment, deleteComment } from "../data/comments.js";
import { requireAuth } from "../middleware.js";

const router = Router();

router.route("/").get(async (req, res) => {
	res.locals.logCategory = logCategories.comments;
	res.locals.logDescription = logDescriptions.viewComments();

	return res.render("comments", {
		title: "Comments",
		user: req.session && req.session.user,
	});
});

router.route("/:propertyId").post(requireAuth, async (req, res) => {
	try {
		const { rating, text } = req.body;
		const userId = req.session.user._id;
		const userName = `${req.session.user.firstName} ${req.session.user.lastName}`;

		await createComment(req.params.propertyId, userId, userName, text, rating);
		return res.redirect(`/properties/${req.params.propertyId}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

router.route("/:propertyId/reply/:commentId").post(requireAuth, async (req, res) => {
	try {
		const { text } = req.body;
		const userId = req.session.user._id;
		const userName = `${req.session.user.firstName} ${req.session.user.lastName}`;

		// Rating is passed as null for replies
		await createComment(req.params.propertyId, userId, userName, text, null, req.params.commentId);
		return res.redirect(`/properties/${req.params.propertyId}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

router.route("/like/:commentId").post(requireAuth, async (req, res) => {
	try {
		const { propertyId } = req.body;
		const userId = req.session.user._id;

		await likeComment(req.params.commentId, userId);
		return res.redirect(`/properties/${propertyId}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

router.route("/dislike/:commentId").post(requireAuth, async (req, res) => {
	try {
		const { propertyId } = req.body;
		const userId = req.session.user._id;

		await dislikeComment(req.params.commentId, userId);
		return res.redirect(`/properties/${propertyId}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

router.route("/edit/:commentId").post(requireAuth, async (req, res) => {
	try {
		const { propertyId, rating } = req.body;
		const userId = req.session.user._id;

		await editComment(req.params.commentId, userId, rating);
		return res.redirect(`/properties/${propertyId}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

router.route("/delete/:commentId").post(requireAuth, async (req, res) => {
	try {
		const { propertyId } = req.body;
		const userId = req.session.user._id;

		await deleteComment(req.params.commentId, userId);
		return res.redirect(`/properties/${propertyId}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

export default router;
