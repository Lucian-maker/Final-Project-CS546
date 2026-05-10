import { Router } from "express";
import {
	createComment,
	getAllCommentsVisibleToUser,
	getCommentById,
	getCommentsByProperty,
	softDeleteComment,
	updateComment,
} from "../data/comments.js";
import {
	properties as propertiesCollection,
	users,
} from "../config/mongoCollections.js";
import {
	checkId,
	formatDateTime,
	logCategories,
	logDescriptions,
} from "../helpers.js";
import { requireAuth, requireRole } from "../middleware.js";

const router = Router();

const decorateComment = (c, sessionUser) => ({
	...c,
	createdAtFormatted: c.createdAt ? formatDateTime(c.createdAt) : "—",
	updatedAtFormatted: c.updatedAt ? formatDateTime(c.updatedAt) : "—",
	wasEdited:
		c.updatedAt &&
		c.createdAt &&
		new Date(c.updatedAt).getTime() > new Date(c.createdAt).getTime(),
	isOwn: Boolean(sessionUser && c.authorId === sessionUser._id),
});

// Top-level comments listing scoped to the signed-in user.
router.route("/").get(async (req, res) => {
	try {
		const sessionUser = req.session && req.session.user;
		const list = await getAllCommentsVisibleToUser(sessionUser);

		const propsCol = await propertiesCollection();
		const usersCol = await users();
		const decorated = await Promise.all(
			list.map(async (c) => {
				const property = await propsCol.findOne({ _id: c.propertyId });
				let buildingAddress = c.propertyId;
				if (property?.address) {
					const a = property.address;
					buildingAddress = `${a.number} ${a.street}, ${a.city}, ${a.state} ${a.zipCode}`;
				}
				const author = await usersCol.findOne({ _id: c.authorId });
				return {
					...decorateComment(c, sessionUser),
					buildingAddress,
					authorName: author
						? `${author.firstName} ${author.lastName}`
						: c.authorId,
				};
			}),
		);

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = logDescriptions.viewComments();

		return res.render("comments_index", {
			title: "Comments",
			user: sessionUser,
			comments: decorated,
		});
	} catch (e) {
		return res.status(400).render("error", {
			title: "Comments",
			error: String(e),
		});
	}
});

// Per-comment detail page (registered before /:propertyId so it isn't shadowed).
router.route("/single/:commentId").get(async (req, res) => {
	try {
		const cleanId = checkId(req.params.commentId, "commentId");
		const comment = await getCommentById(cleanId);

		const usersCol = await users();
		const author = await usersCol.findOne({ _id: comment.authorId });

		const propsCol = await propertiesCollection();
		const property = await propsCol.findOne({ _id: comment.propertyId });
		let buildingAddress = comment.propertyId;
		if (property?.address) {
			const a = property.address;
			buildingAddress = `${a.number} ${a.street}, ${a.city}, ${a.state} ${a.zipCode}`;
		}

		const sessionUser = req.session && req.session.user;
		const decorated = decorateComment(comment, sessionUser);

		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = `Viewed comment ${cleanId}`;

		return res.render("comment", {
			title: `Comment — ${comment._id}`,
			user: sessionUser,
			comment: decorated,
			author,
			buildingAddress,
			isOwn: decorated.isOwn,
			error: null,
		});
	} catch (e) {
		const msg = String(e);
		if (msg.includes("No comment found")) {
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

// Edit and delete (registered before /:propertyId — they have a sub-segment so
// they don't actually collide, but ordering keeps intent obvious).
router.route("/:commentId/edit").post(requireAuth, async (req, res) => {
	const body = req.body || {};
	try {
		const existing = await getCommentById(req.params.commentId);
		await updateComment(
			req.params.commentId,
			req.session.user._id,
			body.commentText,
		);
		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = `Updated comment ${req.params.commentId}`;
		return res.redirect(`/comments/${existing.propertyId}`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Edit Failed",
			error: String(e),
		});
	}
});

router.route("/:commentId/delete").post(requireAuth, async (req, res) => {
	try {
		const existing = await getCommentById(req.params.commentId);
		await softDeleteComment(req.params.commentId, req.session.user._id);
		res.locals.logCategory = logCategories.comments;
		res.locals.logDescription = `Deleted comment ${req.params.commentId}`;
		return res.redirect(`/comments/${existing.propertyId}`);
	} catch (e) {
		return res.status(400).render("error", {
			title: "Delete Failed",
			error: String(e),
		});
	}
});

const renderThread = async (res, propertyId, sessionUser, extras = {}) => {
	const list = await getCommentsByProperty(propertyId);
	const decorated = list.map((c) => decorateComment(c, sessionUser));
	return res.render("comments", {
		title: "Comments",
		user: sessionUser,
		propertyId,
		comments: decorated,
		canComment: Boolean(
			sessionUser &&
				(sessionUser.userRole === "tenant" ||
					sessionUser.userRole === "landlord"),
		),
		...extras,
	});
};

router
	.route("/:propertyId")
	.get(async (req, res) => {
		try {
			const cleanPropertyId = checkId(req.params.propertyId, "propertyId");
			res.locals.logCategory = logCategories.comments;
			res.locals.logDescription = `Viewed comments for property ${cleanPropertyId}`;
			return await renderThread(
				res,
				cleanPropertyId,
				req.session && req.session.user,
			);
		} catch (e) {
			return res.status(400).render("error", {
				title: "Bad Request",
				error: String(e),
			});
		}
	})
	.post(requireRole("tenant", "landlord"), async (req, res) => {
		const body = req.body || {};
		const sessionUser = req.session.user;
		try {
			const cleanPropertyId = checkId(req.params.propertyId, "propertyId");
			await createComment(
				cleanPropertyId,
				sessionUser._id,
				sessionUser.userRole,
				body.commentText,
			);
			res.locals.logCategory = logCategories.comments;
			res.locals.logDescription = `Created comment on property ${cleanPropertyId}`;
			return res.redirect(`/comments/${cleanPropertyId}`);
		} catch (e) {
			return renderThread(res, req.params.propertyId, sessionUser, {
				error: String(e),
				form: body,
			});
		}
	});

export default router;
