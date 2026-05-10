import { createLog } from "./data/logs.js";

export const logRequest = (req, res, next) => {
	const start = Date.now();

	res.on("finish", () => {
		const timestamp = new Date().toUTCString();

		const who = req.session?.user
			? `${req.session.user.userRole} (${req.session.user.firstName ?? "User"})`
			: "Guest";

		console.log(
			`[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} (${who})`
		);
		
		createLog(
			req,
			res,
			req.session?.user || null,
			res.locals.logDescription ||
				`${req.method} ${req.originalUrl}`,
			res.locals.logCategory || "general"
		).catch(console.error);
	});

	next();
};

export const roleHome = (role) => (role === "admin" ? "/admin" : "/dashboard");

export const guestOnly = (req, res, next) => {
	if (req.session?.user) {
		return res.redirect(roleHome(req.session.user.userRole));
	}
	return next();
};

export const requireAuth = (req, res, next) => {
	if (!req.session?.user) {
		return res.redirect("/signin");
	}
	return next();
};

export const requireRole = (...roles) => {
	return (req, res, next) => {
		if (!req.session?.user) {
			return res.redirect("/signin");
		}
		if (!roles.includes(req.session.user.userRole)) {
			return res.status(403).render("error", {
				title: "Forbidden",
				error: "You do not have permission to view this page.",
			});
		}
		return next();
	};
};

export const adminGuard = requireRole("admin");
export const tenantGuard = requireRole("tenant");
export const landlordGuard = requireRole("landlord");
