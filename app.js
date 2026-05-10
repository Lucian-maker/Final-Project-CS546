import express from "express";
import exphbs from "express-handlebars";
import session from "express-session";
import configRoutes from "./routes/index.js";
import { evidenceVaultShowImage } from "./helpers.js";
import {
	logRequest,
	guestOnly,
	requireAuth,
	adminGuard,
} from "./middleware.js";

const app = express();

app.use("/public", express.static("public"));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

app.use(
	session({
		name: "NYCHComAuthState",
		secret: "change-me",
		resave: false,
		saveUninitialized: false,
	}),
);

// Current user for templates (`{{#if user}}`), or null if signed out.
app.use((req, res, next) => {
	res.locals.user = req.session?.user ?? null;
	next();
});

app.engine(
	"handlebars",
	exphbs.engine({
		defaultLayout: "main",
		helpers: {
			eq: (a, b) => a === b,
			evidenceShowImage: evidenceVaultShowImage,
		},
	}),
);
app.set("view engine", "handlebars");

app.use("/signin", guestOnly);
app.use("/register", guestOnly);
app.use("/dashboard", requireAuth);
app.use("/properties", requireAuth);
app.use("/violations", requireAuth);
app.use("/evidence", requireAuth);
app.use("/reviews", requireAuth);
app.use("/comments", requireAuth);
app.use("/notifications", requireAuth);
app.use("/disputes", requireAuth);
app.use("/attorneys", requireAuth);
app.use("/admin", adminGuard);
app.use("/signout", requireAuth);

app.use(logRequest);

configRoutes(app);

app.listen(3000, () => {
	console.log("NYCHCom server running on http://localhost:3000");
});
