import { Router } from "express";
import * as usersData from "../data/users.js";
import * as propertiesData from "../data/properties.js";
import * as violationsData from "../data/violations.js";
import { VIOLATION_STATUSES } from "../data/violations.js";
import { getAllLogs, searchLogs } from "../data/logs.js";
import { logDescriptions, logCategories } from "../helpers.js";
import {
	users,
	properties,
	violations,
	reviews,
} from "../config/mongoCollections.js";
import PDFDocument from "pdfkit";

const router = Router();

router.get("/", async (req, res) => {
	res.locals.logCategory = logCategories.admin;
	res.locals.logDescription = logDescriptions.adminDashboard();
	return res.render("admin", {
		title: "Admin Controls",
		user: req.session.user,
	});
});

router.get("/users", async (req, res) => {
	try {
		const search = (req.query.search || "").trim().toLowerCase();

		let users = await usersData.getAllUsers();

		if (search) {
			users = users.filter((user) => {
				return (
					user.firstName?.toLowerCase().includes(search) ||
					user.lastName?.toLowerCase().includes(search) ||
					user.email?.toLowerCase().includes(search) ||
					user.userRole?.toLowerCase().includes(search)
				);
			});
		}

		res.locals.logCategory = logCategories.admin;
		res.locals.logDescription = logDescriptions.adminViewUsers();

		return res.render("admin/users", {
			title: "User Management",
			users,
			search,
			user: req.session.user,
		});
	} catch (e) {
		return res.status(500).render("error", { error: e });
	}
});

router.get("/users/:id", async (req, res) => {
	try {
		const user = await usersData.getUserById(req.params.id);

		res.locals.logCategory = logCategories.admin;
		res.locals.logDescription = logDescriptions.adminViewUser(
			req.params.id,
		);

		return res.render("admin/user", {
			title: "User Detail",
			viewedUser: user,
			user: req.session.user,
		});
	} catch (e) {
		return res.status(404).render("error", {
			error: "User not found",
		});
	}
});

router.post("/users/:id/update", async (req, res) => {
	try {
		const {
			firstName,
			lastName,
			email,
			phoneNumber,
			userRole,
			secondaryContactName,
			secondaryContactEmail,
			secondaryContactPhone,
		} = req.body;

		await usersData.updateUserById(req.params.id, {
			firstName,
			lastName,
			email,
			phoneNumber,
			userRole,
			secondaryContact: {
				name: secondaryContactName || "",
				email: secondaryContactEmail || "",
				phoneNumber: secondaryContactPhone || "",
			},
		});

		res.locals.logCategory = logCategories.admin;
		res.locals.logDescription = logDescriptions.adminUpdateUser(
			req.params.id,
		);

		return res.redirect(`/admin/users/${req.params.id}`);
	} catch (e) {
		return res.status(500).render("error", { error: e });
	}
});

router.get("/analytics", async (req, res) => {
	try {
		const usersCollection = await users();
		const propertiesCollection = await properties();
		const reviewsCollection = await reviews();
		const violationsCollection = await violations();

		const totalUsers = await usersCollection.countDocuments();
		const totalProperties = await propertiesCollection.countDocuments();
		const totalReviews = await reviewsCollection.countDocuments();
		const totalViolations = await violationsCollection.countDocuments();

		const boroughRows = await violationsCollection
			.aggregate([
				{
					$group: {
						_id: "$borough",
						totalViolations: { $sum: 1 },
					},
				},
				{
					$sort: { totalViolations: -1 },
				},
			])
			.toArray();

		// Avg resolution time across closed violations
		const resolutionRows = await violationsCollection
			.aggregate([
				{
					$match: {
						resolvedAt: { $ne: null },
						createdAt: { $ne: null },
					},
				},
				{
					$group: {
						_id: null,
						avgMs: {
							$avg: { $subtract: ["$resolvedAt", "$createdAt"] },
						},
						count: { $sum: 1 },
					},
				},
			])
			.toArray();

		const avgResolutionRow = resolutionRows[0] || { avgMs: null, count: 0 };
		const avgResolutionDays =
			avgResolutionRow.avgMs && avgResolutionRow.count
				? Math.round((avgResolutionRow.avgMs / 86400000) * 10) / 10
				: null;
		const resolutionStats = {
			avgDays: avgResolutionDays,
			sampleSize: avgResolutionRow.count || 0,
		};

		const statusRows = await violationsCollection
			.aggregate([
				{
					$group: {
						_id: "$violationStatus",
						count: { $sum: 1 },
					},
				},
			])
			.toArray();

		const statusCountMap = {};
		for (const row of statusRows) {
			if (!row || typeof row._id !== "string") continue;
			statusCountMap[row._id] = row.count || 0;
		}

		const statusTone = (status) => {
			if (status === "Closed" || status === "Resolved") return "success";
			if (status === "Disputed") return "danger";
			return "warning";
		};

		const byStatus = VIOLATION_STATUSES.map((status) => {
			const count = statusCountMap[status] || 0;
			const pct =
				totalViolations > 0
					? Math.round((count / totalViolations) * 1000) / 10
					: 0;
			return {
				status,
				count,
				pct,
				remainingCount: Math.max(0, totalViolations - count),
				tone: statusTone(status),
			};
		});

		const statusStats = {
			byStatus,
			kpis: {
				closed: {
					count: statusCountMap.Closed || 0,
					pct:
						totalViolations > 0
							? Math.round(
									((statusCountMap.Closed || 0) /
										totalViolations) *
										1000,
								) / 10
							: 0,
					tone: "success",
				},
				resolved: {
					count: statusCountMap.Resolved || 0,
					pct:
						totalViolations > 0
							? Math.round(
									((statusCountMap.Resolved || 0) /
										totalViolations) *
										1000,
								) / 10
							: 0,
					tone: "success",
				},
				disputed: {
					count: statusCountMap.Disputed || 0,
					pct:
						totalViolations > 0
							? Math.round(
									((statusCountMap.Disputed || 0) /
										totalViolations) *
										1000,
								) / 10
							: 0,
					tone: "danger",
				},
				openLike: {
					count:
						(statusCountMap.Open || 0) +
						(statusCountMap["Repair Scheduled"] || 0),
					pct:
						totalViolations > 0
							? Math.round(
									(((statusCountMap.Open || 0) +
										(statusCountMap["Repair Scheduled"] ||
											0)) /
										totalViolations) *
										1000,
								) / 10
							: 0,
					tone: "warning",
				},
			},
		};

		const boroughStats = boroughRows.map((row) => ({
			...row,
			sharePct:
				totalViolations > 0
					? Math.round(
							(row.totalViolations / totalViolations) * 1000,
						) / 10
					: 0,
		}));

		res.locals.logCategory = logCategories.admin;
		res.locals.logDescription = logDescriptions.adminAnalytics();

		return res.render("admin/analytics", {
			title: "Analytics",
			stats: {
				totalUsers,
				totalProperties,
				totalReviews,
				totalViolations,
			},
			statusStats,
			boroughStats,
			resolutionStats,
			user: req.session.user,
		});
	} catch (e) {
		return res.status(500).render("error", { error: e });
	}
});

router.get("/logs", async (req, res) => {
	try {
		const filters = {
			search: req.query.search || "",
			role: req.query.role || "",
			category: req.query.category || "",
			fromDate: req.query.fromDate || "",
			toDate: req.query.toDate || "",
			sort: req.query.sort || "newest",
		};

		const logs = await searchLogs(filters);

		res.locals.logCategory = logCategories.admin;
		res.locals.logDescription = logDescriptions.adminLogs();

		return res.render("admin/logs", {
			title: "System Logs",
			logs,

			search: filters.search,
			role: filters.role,
			category: filters.category,

			fromDate: filters.fromDate,
			toDate: filters.toDate,
			sort: filters.sort,

			categories: [
				"auth",
				"admin",
				"violations",
				"properties",
				"evidence",
				"reviews",
				"comments",
				"notifications",
				"disputes",
				"dashboard",
			],

			user: req.session.user,
		});
	} catch (e) {
		return res.status(500).render("error", {
			title: "Error",
			error: e,
		});
	}
});

router.get("/logs/export", async (req, res) => {
	try {
		const filters = {
			search: req.query.search || "",
			role: req.query.role || "",
			category: req.query.category || "",
			fromDate: req.query.fromDate || "",
			toDate: req.query.toDate || "",
			sort: req.query.sort || "newest",
		};

		const logs = await searchLogs(filters);

		res.locals.logCategory = logCategories.admin;
		res.locals.logDescription = logDescriptions.adminLogsExport
			? logDescriptions.adminLogsExport()
			: "Exported system logs to PDF";

		const doc = new PDFDocument();

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader(
			"Content-Disposition",
			"attachment; filename=system-logs.pdf",
		);

		doc.pipe(res);

		doc.fontSize(18).text("System Logs Export", { align: "center" });
		doc.moveDown();

		doc.fontSize(10);

		logs.forEach((log) => {
			doc.text(
				`${log.timestamp} | ${log.user.name} | ${log.user.role} | ${log.category} | ${log.status}`,
			);
			doc.text(`Description: ${log.description}`);
			doc.moveDown();
		});

		doc.end();
	} catch (e) {
		return res.status(500).render("error", { error: e });
	}
});

export default router;
