export const logRequest = (req, res, next) => {
	const timestamp = new Date().toUTCString();
	const who = req.session?.user
		? `Authenticated ${req.session.user.userRole}`
		: "Non-Authenticated";
	console.log(`[${timestamp}]: ${req.method} ${req.path} (${who})`);
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
