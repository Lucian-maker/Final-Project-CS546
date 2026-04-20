import express from "express";
import exphbs from "express-handlebars";
import session from "express-session";
import configRoutes from "./routes/index.js";
import {
	logRequest,
	guestOnly,
	requireAuth,
	adminGuard,
} from "./middleware.js";

const app = express();

app.use("/public", express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
	session({
		name: "NYCHComAuthState",
		secret: "change-me",
		resave: false,
		saveUninitialized: false,
	}),
);

app.use(logRequest);

app.engine(
	"handlebars",
	exphbs.engine({
		defaultLayout: "main",
		helpers: {
			eq: (a, b) => a === b,
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

configRoutes(app);

app.listen(3000, () => {
	console.log("NYCHCom server running on http://localhost:3000");
});
