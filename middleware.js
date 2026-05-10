import { createLog } from "./data/logs.js";

export const logRequest = (req, res, next) => {
	const start = Date.now();

	res.on("finish", () => {
		const timestamp = new Date().toUTCString();

		const who = req.session?.user
			? `${req.session.user.userRole} (${req.session.user.firstName ?? "User"})`
			: "Guest";

		console.log(
			`[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} (${who})`,
		);

		createLog(
			req,
			res,
			req.session?.user || null,
			res.locals.logDescription || null,
			res.locals.logCategory || "general",
		).catch(console.error);
	});

	next();
};

export const roleHome = () => "/dashboard";

export const guestOnly = (req, res, next) => {
	if (req.session?.user) {
		return res.redirect(roleHome(req.session.user.userRole));
	}
	return next();
};

/** JSON fetch must get JSON back — redirect to signin returns HTML and breaks res.json(). */
const wantsJsonErrorBody = (req) =>
	Boolean(
		req.is("application/json") ||
		String(req.get("Accept") || "").includes("application/json"),
	);

export const requireAuth = (req, res, next) => {
	if (!req.session?.user) {
		if (wantsJsonErrorBody(req)) {
			return res.status(401).json({
				ok: false,
				error: "Sign in required",
			});
		}
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
