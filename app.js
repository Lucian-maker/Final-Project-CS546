import express from "express";
import exphbs from "express-handlebars";
import session from "express-session";
import cookieParser from "cookie-parser";
import configRoutes from "./routes/index.js";
import { evidenceVaultShowImage } from "./helpers.js";
import {
	logRequest,
	guestOnly,
	requireAuth,
	adminGuard,
	tenantGuard,
	landlordGuard,
} from "./middleware.js";

const app = express();

app.use("/public", express.static("public"));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(cookieParser("change-me"));

app.use(
	session({
		name: "NYCHComAuthState",
		secret: "change-me",
		resave: false,
		saveUninitialized: false,
	}),
);

app.use((req, res, next) => {
	if (req.session?.user) return next();
	const raw = req.signedCookies?.NYCHComUser;
	if (!raw || typeof raw !== "string") return next();
	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || !parsed._id) return next();
		req.session.user = parsed;
		return next();
	} catch {
		res.clearCookie("NYCHComUser");
		return next();
	}
});

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
			displayValue: (v, placeholder = "--") =>
				v === null || v === undefined || v === ""
					? placeholder
					: String(v),
			displayPercent: (v, placeholder = "--") => {
				const n = Number(v);
				return Number.isFinite(n) ? `${n}%` : placeholder;
			},
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
app.use("/tickets", requireAuth);
app.use("/admin", adminGuard);
app.use("/tenant", tenantGuard);
app.use("/landlord", landlordGuard);
app.use("/signout", requireAuth);

app.use(logRequest);

configRoutes(app);

app.listen(3000, () => {
	console.log("NYCHCom server running on http://localhost:3000");
});
