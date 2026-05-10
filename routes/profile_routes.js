import { Router } from "express";
import { getUserById, updateProfileById } from "../data/users.js";
import { logCategories, logDescriptions } from "../helpers.js";

const router = Router();

const backPath = (from) => {
	if (from === "tenant") return "/tenant";
	if (from === "landlord") return "/landlord";
	if (from === "admin") return "/admin";
	return "/dashboard";
};

router
	.route("/")
	.get(async (req, res) => {
		try {
			const from = req.query.from || req.session.user.userRole;
			const user = await getUserById(req.session.user._id);

			res.locals.logCategory = logCategories.auth;
			res.locals.logDescription = logDescriptions.viewProfile(user._id);

			return res.render("profile", {
				title: "Manage Profile",
				user,
				from,
				backTo: backPath(from),
				success: req.query.updated ? "Profile updated." : null,
				error: null,
			});
		} catch (e) {
			return res.status(500).render("error", {
				title: "Profile Error",
				error: String(e),
			});
		}
	})
	.post(async (req, res) => {
		const from =
			req.body.from || req.query.from || req.session.user.userRole;

		try {
			const updatedUser = await updateProfileById(
				req.session.user._id,
				req.body,
			);

			// Carry savedProperties/ownedProperties forward so role-scoped lookups
			req.session.user = {
				_id: updatedUser._id,
				firstName: updatedUser.firstName,
				lastName: updatedUser.lastName,
				email: updatedUser.email,
				phoneNumber: updatedUser.phoneNumber,
				userRole: updatedUser.userRole,
				savedProperties: updatedUser.savedProperties || [],
				ownedProperties: updatedUser.ownedProperties || [],
				secondaryContact: updatedUser.secondaryContact || {
					name: "",
					email: "",
					phoneNumber: "",
				},
			};

			res.locals.logCategory = logCategories.auth;
			res.locals.logDescription = logDescriptions.updateProfile(
				updatedUser._id,
			);

			return res.redirect(`/profile?from=${from}&updated=1`);
		} catch (e) {
			const user = {
				...req.session.user,
				...req.body,
				secondaryContact: {
					name: req.body.secondaryContactName || "",
					email: req.body.secondaryContactEmail || "",
					phoneNumber: req.body.secondaryContactPhone || "",
				},
			};

			return res.status(400).render("profile", {
				title: "Manage Profile",
				user,
				from,
				backTo: backPath(from),
				success: null,
				error: String(e),
			});
		}
	});

export default router;
