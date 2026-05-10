import { Router } from "express";
import { getAllViolations } from "../data/violations.js";
import { computeLandlordTrustScore, computeTenantReviewAverage } from "../data/reviews.js";

import { logDescriptions, logCategories } from "../helpers.js";

const router = Router();

router.route("/").get(async (req, res) => {
	const user = req.session.user;
	
	let violations30Days = 0;
	let violations15Days = 0;
	let violations7Days = 0;

	let userScoreInfo = null;

	try {
		if (user.userRole === "landlord") {
			userScoreInfo = await computeLandlordTrustScore(user._id);
		} else if (user.userRole === "tenant") {
			userScoreInfo = await computeTenantReviewAverage(user._id);
		}

		const allViolations = await getAllViolations();
		allViolations.forEach(v => {
			if (v.violationStatus !== "Closed" && v.daysRemaining !== null && v.daysRemaining !== undefined) {
				if (v.daysRemaining <= 7) violations7Days++;
				if (v.daysRemaining <= 15) violations15Days++;
				if (v.daysRemaining <= 30) violations30Days++;
			}
		});
	} catch (e) {
		console.error("Could not fetch dashboard metrics:", e);
	}

	res.locals.logCategory = logCategories.dashboard;
	res.locals.logDescription = logDescriptions.viewDashboard();
	return res.render("dashboard", {
		title: "Dashboard",
		user,
		isAdmin: user.userRole === "admin",
		violations30Days,
		violations15Days,
		violations7Days,
		userScoreInfo
	});
});

export default router;
