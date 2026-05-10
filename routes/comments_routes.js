import { Router } from "express";
import { logDescriptions, logCategories } from "../helpers.js";
import {
	createComment,
	likeComment,
	dislikeComment,
	editComment,
	deleteComment,
} from "../data/comments.js";
import { requireAuth } from "../middleware.js";
import { notifyCommentActivity } from "../data/notification_events.js";

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

		await createComment(
			req.params.propertyId,
			userId,
			userName,
			text,
			rating,
		);
		void notifyCommentActivity({
			propertyId: req.params.propertyId,
			actorUserId: userId,
			text: "A new property comment was posted.",
		}).catch(() => {});

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = logDescriptions.createComment(
			req.params.propertyId,
		);

		return res.redirect(`/properties/${req.params.propertyId}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

router
	.route("/:propertyId/reply/:commentId")
	.post(requireAuth, async (req, res) => {
		try {
			const { text } = req.body;
			const userId = req.session.user._id;
			const userName = `${req.session.user.firstName} ${req.session.user.lastName}`;

			// Rating is passed as null for replies
			await createComment(
				req.params.propertyId,
				userId,
				userName,
				text,
				null,
				req.params.commentId,
			);
			void notifyCommentActivity({
				propertyId: req.params.propertyId,
				actorUserId: userId,
				text: "A reply was added to a property comment.",
			}).catch(() => {});

			res.locals.logCategory = logCategories.comments;
			res.locals.logDescription = logDescriptions.replyComment(
				req.params.propertyId,
				req.params.commentId,
			);

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
		void notifyCommentActivity({
			propertyId,
			actorUserId: userId,
			text: "A comment received a like.",
		}).catch(() => {});

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = logDescriptions.likeComment(
			req.params.commentId,
		);

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
		void notifyCommentActivity({
			propertyId,
			actorUserId: userId,
			text: "A comment received a dislike.",
		}).catch(() => {});

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = logDescriptions.dislikeComment(
			req.params.commentId,
		);

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
		void notifyCommentActivity({
			propertyId,
			actorUserId: userId,
			text: "A property comment rating was updated.",
		}).catch(() => {});

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = logDescriptions.editComment(
			req.params.commentId,
		);

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
		void notifyCommentActivity({
			propertyId,
			actorUserId: userId,
			text: "A property comment was deleted.",
		}).catch(() => {});

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = logDescriptions.deleteComment(
			req.params.commentId,
		);

		return res.redirect(`/properties/${propertyId}`);
	} catch (e) {
		return res.status(400).render("error", { error: String(e) });
	}
});

export default router;
