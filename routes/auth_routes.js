import { Router } from "express";
import { createUser, authenticateUser } from "../data/users.js";
import {
	checkName,
	checkEmail,
	checkPassword,
	checkPhone,
	checkUserRole,
	PUBLIC_USER_ROLES,
} from "../helpers.js";
import { roleHome } from "../middleware.js";

const router = Router();

const renderRegisterError = (res, status, errorMessage, body = {}) => {
	return res.status(status).render("register", {
		title: "Register",
		error: errorMessage,
		firstName: body.firstName || "",
		lastName: body.lastName || "",
		email: body.email || "",
		phoneNumber: body.phoneNumber || "",
		userRole: body.userRole || "tenant",
	});
};

const renderSigninError = (res, status, errorMessage, body = {}) => {
	return res.status(status).render("signin", {
		title: "Sign In",
		error: errorMessage,
		email: body.email || "",
	});
};

router.route("/").get(async (req, res) => {
	const role = req.session?.user?.userRole;
	return res.render("home", {
		title: "NYCHCom - NYC Housing Compliance",
		loggedIn: Boolean(role),
		isAdmin: role === "admin",
	});
});

router
	.route("/register")
	.get(async (req, res) => {
		return res.render("register", {
			title: "Register",
			userRole: "tenant",
		});
	})
	.post(async (req, res) => {
		const body = req.body || {};

		let cleanFirstName,
			cleanLastName,
			cleanEmail,
			cleanPassword,
			cleanPhone,
			cleanUserRole;
		try {
			cleanFirstName = checkName(body.firstName, "firstName");
			cleanLastName = checkName(body.lastName, "lastName");
			cleanEmail = checkEmail(body.email);
			cleanPassword = checkPassword(body.password);
			if (body.password !== body.confirmPassword) {
				throw `password and confirmPassword do not match`;
			}
			cleanPhone = checkPhone(body.phoneNumber);
			cleanUserRole = checkUserRole(body.userRole, PUBLIC_USER_ROLES);
		} catch (e) {
			return renderRegisterError(res, 400, String(e), body);
		}

		try {
			await createUser(
				cleanFirstName,
				cleanLastName,
				cleanEmail,
				cleanPassword,
				cleanPhone,
				cleanUserRole,
			);
			return res.redirect("/signin");
		} catch (e) {
			return renderRegisterError(res, 400, String(e), body);
		}
	});

router
	.route("/signin")
	.get(async (req, res) => {
		return res.render("signin", { title: "Sign In" });
	})
	.post(async (req, res) => {
		const body = req.body || {};

		try {
			checkEmail(body.email);
			checkPassword(body.password);
		} catch (e) {
			return renderSigninError(res, 400, String(e), body);
		}

		try {
			const user = await authenticateUser(body.email, body.password);
			req.session.user = {
				_id: user._id,
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email,
				phoneNumber: user.phoneNumber,
				userRole: user.userRole,
			};
			return res.redirect(roleHome(user.userRole));
		} catch {
			return renderSigninError(
				res,
				400,
				"Either the email or password is invalid",
				body,
			);
		}
	});

router.route("/signout").get(async (req, res) => {
	req.session.destroy(() => {
		res.clearCookie("NYCHComAuthState");
		return res.render("signout", { title: "Signed Out" });
	});
});

export default router;
