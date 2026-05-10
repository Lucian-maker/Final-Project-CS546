import { Router } from "express";
import { getUserById } from "../data/users.js";
import { getPropertyById } from "../data/properties.js";
import { logDescriptions, logCategories } from "../helpers.js";

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

		return res.render("tenant", {
			title: "Tenant Dashboard",
			user,
			savedProperties
		});

	} catch (e) {

		return res.status(500).render("error", {
			error: String(e)
		});
	}
});

export default router;