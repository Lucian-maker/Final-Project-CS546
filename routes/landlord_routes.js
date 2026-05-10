import { Router } from "express";
import { getUserById } from "../data/users.js";
import { getPropertyById } from "../data/properties.js";

import { logDescriptions, logCategories } from "../helpers.js";
import { computeLandlordTrustScore } from "../data/reviews.js";

const router = Router();

router.get("/", async (req, res) => {
	try {
		const sessionUser = req.session.user;

		const user = await getUserById(sessionUser._id);

		let savedProperties = [];
		let ownedProperties = [];

		if (user.savedProperties?.length) {
			const savedResults = await Promise.allSettled(
				user.savedProperties.map((id) => getPropertyById(id)),
			);

			savedProperties = savedResults
				.filter((r) => r.status === "fulfilled")
				.map((r) => r.value);
		}

		if (user.ownedProperties?.length) {
			const ownedResults = await Promise.allSettled(
				user.ownedProperties.map((id) => getPropertyById(id)),
			);

			ownedProperties = ownedResults
				.filter((r) => r.status === "fulfilled")
				.map((r) => r.value);
		}

		res.locals.logCategory = logCategories.dashboard;
		res.locals.logDescription = logDescriptions.viewLandlordDashboard();

		const userScoreInfo = await computeLandlordTrustScore(user._id);

		return res.render("landlord", {
			title: "Landlord Dashboard",
			user,
			savedProperties,
			ownedProperties,
			userScoreInfo,
		});
	} catch (e) {
		return res.status(500).render("error", {
			error: String(e),
		});
	}
});

export default router;
