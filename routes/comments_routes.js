import { Router } from "express";
import { logDescriptions, logCategories, formatDateTime } from "../helpers.js";
import {
	createComment,
	likeComment,
	dislikeComment,
	editComment,
	deleteComment,
} from "../data/comments.js";
import { comments as commentsCollection, properties, users } from "../config/mongoCollections.js";
import { requireAuth } from "../middleware.js";
import { notifyCommentActivity } from "../data/notification_events.js";

const router = Router();

router.route("/").get(async (req, res) => {
	try {
		const sessionUser = req.session && req.session.user;
		const col = await commentsCollection();
		const propsCol = await properties();
		const usersCol = await users();

		// Fetch all comments, newest first
		const allComments = await col.find({}).sort({ createdAt: -1 }).toArray();

		// fills comment with property address and author info
		const enriched = await Promise.all(
			allComments.map(async (c) => {
				const prop = await propsCol.findOne({ _id: c.propertyId });
				let buildingAddress = c.propertyId;
				if (prop?.address) {
					const a = prop.address;
					buildingAddress = `${a.number} ${a.street}, ${a.city}, ${a.state} ${a.zipCode}`;
				}

				const author = await usersCol.findOne({ _id: c.userId });
				const authorName = author
					? `${author.firstName} ${author.lastName}`
					: c.userName || "Unknown";
				const authorRole = author ? author.userRole : "unknown";

				return {
					...c,
					buildingAddress,
					authorName,
					authorRole,
					commentText: c.text,
					createdAtFormatted: c.createdAt
						? formatDateTime(c.createdAt)
						: "—",
					updatedAtFormatted: c.updatedAt
						? formatDateTime(c.updatedAt)
						: "—",
					wasEdited:
						c.updatedAt &&
						c.createdAt &&
						c.updatedAt.getTime() !== c.createdAt.getTime(),
					isOwn: sessionUser && c.userId === sessionUser._id,
				};
			}),
		);

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = logDescriptions.viewComments();

		return res.render("comments_index", {
			title: "All Comments",
			user: sessionUser,
			comments: enriched,
		});
	} catch (e) {
		return res.status(500).render("error", { error: String(e) });
	}
});

router.route("/:propertyId").post(requireAuth, async (req, res) => {
	try {
		const { rating, text } = req.body;
		const userId = req.session.user._id;
		const userName = `${req.session.user.firstName} ${req.session.user.lastName}`;

		// Validate rating on the server side
		const parsedRating = Number(rating);
		if (!rating || isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
			return res.redirect(
				`/properties/${req.params.propertyId}?commentError=Rating+must+be+between+1+and+5`,
			);
		}

		if (!text || String(text).trim().length === 0) {
			return res.redirect(
				`/properties/${req.params.propertyId}?commentError=Comment+text+cannot+be+empty`,
			);
		}

		await createComment(
			req.params.propertyId,
			userId,
			userName,
			text,
			parsedRating,
		);
		void notifyCommentActivity({
			propertyId: req.params.propertyId,
			actorUserId: userId,
			text: "A new property comment was posted.",
		}).catch(() => { });

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = logDescriptions.createComment(
			req.params.propertyId,
		);

		return res.redirect(`/properties/${req.params.propertyId}?commentSuccess=1`);
	} catch (e) {
		return res.redirect(
			`/properties/${req.params.propertyId}?commentError=${encodeURIComponent(String(e))}`,
		);
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
			}).catch(() => { });

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
		}).catch(() => { });

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
		}).catch(() => { });

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
		}).catch(() => { });

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
		}).catch(() => { });

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
