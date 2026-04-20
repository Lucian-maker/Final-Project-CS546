import authRoutes from "./auth_routes.js";
import dashboardRoutes from "./dashboard_routes.js";
import propertiesRoutes from "./properties_routes.js";
import violationsRoutes from "./violations_routes.js";
import evidenceRoutes from "./evidence_routes.js";
import reviewsRoutes from "./reviews_routes.js";
import commentsRoutes from "./comments_routes.js";
import notificationsRoutes from "./notifications_routes.js";
import disputesRoutes from "./disputes_routes.js";
import attorneysRoutes from "./attorneys_routes.js";
import adminRoutes from "./admin_routes.js";

const constructorMethod = (app) => {
	app.use("/", authRoutes);
	app.use("/dashboard", dashboardRoutes);
	app.use("/properties", propertiesRoutes);
	app.use("/violations", violationsRoutes);
	app.use("/evidence", evidenceRoutes);
	app.use("/reviews", reviewsRoutes);
	app.use("/comments", commentsRoutes);
	app.use("/notifications", notificationsRoutes);
	app.use("/disputes", disputesRoutes);
	app.use("/attorneys", attorneysRoutes);
	app.use("/admin", adminRoutes);

	app.use((req, res) => {
		return res.status(404).render("error", {
			title: "Not Found",
			error: "Page not found",
		});
	});
};

export default constructorMethod;
