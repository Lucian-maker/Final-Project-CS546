import { Router } from "express";
import { getUserById } from "../data/users.js";
import { getPropertyById } from "../data/properties.js";
import { logDescriptions, logCategories } from "../helpers.js";
import { computeTenantReviewAverage } from "../data/reviews.js";

const router = Router();

router.get("/", async (req, res) => {
	try {
		const sessionUser = req.session.user;

		const user = await getUserById(sessionUser._id);

		let savedProperties = [];

		if (user.savedProperties?.length) {

			const propertyResults = await Promise.allSettled(
				user.savedProperties.map((id) =>
					getPropertyById(id)
				)
			);

			savedProperties = propertyResults
				.filter((r) => r.status === "fulfilled")
				.map((r) => r.value);
		}

		res.locals.logCategory = logCategories.dashboard;

		res.locals.logDescription =
			"Viewed tenant dashboard";

		const userScoreInfo = await computeTenantReviewAverage(user._id);

		return res.render("tenant", {
			title: "Tenant Dashboard",
			user,
			savedProperties,
			userScoreInfo
		});

	} catch (e) {

		return res.status(500).render("error", {
			error: String(e)
		});
	}
});

export default router;