import { v4 as uuidv4 } from "uuid";
import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import {
	users as usersCol,
	properties as propertiesCol,
	violations as violationsCol,
	evidence as evidenceCol,
	reviews as reviewsCol,
	comments as commentsCol,
	notifications as notificationsCol,
	disputes as disputesCol,
	attorneys as attorneysCol,
} from "../config/mongoCollections.js";
import { createUser } from "../data/users.js";

const idWithPrefix = (prefix) => `${prefix}-${uuidv4()}`;

const seedCredentials = [
	{
		label: "admin",
		firstName: "Alex",
		lastName: "Admin",
		email: "admin@nychcom.test",
		password: "AdminPass1!",
		phoneNumber: "+12125550100",
		userRole: "admin",
	},
	{
		label: "landlord",
		firstName: "Larry",
		lastName: "Landlord",
		email: "landlord@nychcom.test",
		password: "LandlordPass1!",
		phoneNumber: "+12125550200",
		userRole: "landlord",
	},
	{
		label: "tenant",
		firstName: "Tina",
		lastName: "Tenant",
		email: "tenant@nychcom.test",
		password: "TenantPass1!",
		phoneNumber: "+12125550300",
		userRole: "tenant",
	},
];

const main = async () => {
	const db = await dbConnection();
	await db.dropDatabase();

	const createdUsers = {};
	for (const u of seedCredentials) {
		const result = await createUser(
			u.firstName,
			u.lastName,
			u.email,
			u.password,
			u.phoneNumber,
			u.userRole,
			{ allowAdmin: u.userRole === "admin" },
		);
		createdUsers[u.label] = result._id;
	}

	const adminId = createdUsers.admin;
	const landlordId = createdUsers.landlord;
	const tenantId = createdUsers.tenant;

	const now = new Date();

	const property1Id = idWithPrefix("prop");
	const property2Id = idWithPrefix("prop");
	const violation1Id = idWithPrefix("viol");
	const violation2Id = idWithPrefix("viol");

	const properties = [
		{
			_id: property1Id,
			address: {
				number: "123",
				street: "Maple Road",
				city: "New York City",
				state: "New York",
				zipCode: "10001",
			},
			violations: [violation1Id],
			createdOn: now,
			updatedOn: now,
			reviews: [],
		},
		{
			_id: property2Id,
			address: {
				number: "742",
				street: "Evergreen Terrace",
				city: "Brooklyn",
				state: "New York",
				zipCode: "11201",
			},
			violations: [violation2Id],
			createdOn: now,
			updatedOn: now,
			reviews: [],
		},
	];
	await (await propertiesCol()).insertMany(properties);

	await (
		await usersCol()
	).updateOne(
		{ _id: landlordId },
		{ $set: { ownedProperties: [property1Id, property2Id] } },
	);
	await (
		await usersCol()
	).updateOne(
		{ _id: tenantId },
		{ $set: { savedProperties: [property1Id] } },
	);

	const violations = [
		{
			_id: violation1Id,
			datasetViolationId: "HPD-2026-004219",
			propertyId: property1Id,
			buildingAddress: "123 Maple Road",
			normalizedAddress: "123 maple road manhattan ny 10001",
			borough: "Manhattan",
			zipCode: "10001",
			violationType: "Mold",
			violationDescription:
				"Black mold detected in bathroom ceiling ventilation area",
			violationClass: "B",
			violationStatus: "Open",
			originalCertifyByDate: new Date("2026-04-15T00:00:00.000Z"),
			inspectionDate: new Date("2026-03-20T00:00:00.000Z"),
			repairScheduledAt: null,
			resolvedAt: null,
			daysRemaining: 0,
			isActionable: true,
			source: "NYC Open Data",
			lastDatasetSyncAt: now,
			lastUpdatedByUserId: adminId,
			remediationStatus: {
				currentState: "Open",
				updatedByUserId: adminId,
				updatedAt: new Date("2026-03-20T00:00:00.000Z"),
				notes: "Initial inspection logged.",
			},
			statusHistory: [
				{
					state: "Open",
					changedAt: new Date("2026-03-20T00:00:00.000Z"),
					changedBy: "system",
				},
			],
			createdAt: new Date("2026-03-20T00:00:00.000Z"),
			updatedAt: now,
		},
		{
			_id: violation2Id,
			datasetViolationId: "HPD-2026-004312",
			propertyId: property2Id,
			buildingAddress: "742 Evergreen Terrace",
			normalizedAddress: "742 evergreen terrace brooklyn ny 11201",
			borough: "Brooklyn",
			zipCode: "11201",
			violationType: "Heat",
			violationDescription:
				"No hot water in unit 3B reported multiple times in January.",
			violationClass: "C",
			violationStatus: "Repair Scheduled",
			originalCertifyByDate: new Date("2026-05-01T00:00:00.000Z"),
			inspectionDate: new Date("2026-04-02T00:00:00.000Z"),
			repairScheduledAt: new Date("2026-04-10T15:00:00.000Z"),
			resolvedAt: null,
			daysRemaining: 13,
			isActionable: false,
			source: "NYC Open Data",
			lastDatasetSyncAt: now,
			lastUpdatedByUserId: landlordId,
			remediationStatus: {
				currentState: "Repair Scheduled",
				updatedByUserId: landlordId,
				updatedAt: new Date("2026-04-10T15:00:00.000Z"),
				notes: "Landlord scheduled contractor visit for April 15.",
			},
			statusHistory: [
				{
					state: "Open",
					changedAt: new Date("2026-04-02T00:00:00.000Z"),
					changedBy: "system",
				},
				{
					state: "Repair Scheduled",
					changedAt: new Date("2026-04-10T15:00:00.000Z"),
					changedBy: landlordId,
				},
			],
			createdAt: new Date("2026-04-02T00:00:00.000Z"),
			updatedAt: now,
		},
	];
	await (await violationsCol()).insertMany(violations);

	const evidence1Id = idWithPrefix("evid");
	await (
		await evidenceCol()
	).insertMany([
		{
			_id: evidence1Id,
			violationId: violation1Id,
			propertyId: property1Id,
			uploadedByUserId: tenantId,
			evidenceType: "photo",
			fileName: "bathroom_mold_03272026.jpg",
			fileUrl: "/uploads/evidence/bathroom_mold_03272026.jpg",
			mimeType: "image/jpeg",
			fileSize: 2451821,
			caption: "Mold still visible above shower vent",
			noteText: "Photo taken after landlord said the issue was fixed.",
			capturedAt: new Date("2026-03-27T18:10:00.000Z"),
			uploadedAt: new Date("2026-03-27T18:15:00.000Z"),
			isDeleted: false,
		},
	]);

	const review1Id = idWithPrefix("rev");
	const responsiveness = 2;
	const value = 3;
	const resolution = 2;
	const overallScore =
		Math.round(((responsiveness + value + resolution) / 3) * 10) / 10;
	await (
		await reviewsCol()
	).insertMany([
		{
			_id: review1Id,
			propertyId: property1Id,
			reviewerId: tenantId,
			landlordId: landlordId,
			responsiveness,
			value,
			resolution,
			overallScore,
			reviewText: "Slow to respond to calls about the mold issue.",
			isDeleted: false,
			createdAt: now,
			updatedAt: now,
		},
	]);
	await (
		await propertiesCol()
	).updateOne({ _id: property1Id }, { $set: { reviews: [review1Id] } });

	await (
		await commentsCol()
	).insertMany([
		{
			_id: idWithPrefix("com"),
			propertyId: property1Id,
			authorId: tenantId,
			authorRole: "tenant",
			commentText: "The mold in the bathroom has been getting worse.",
			isDeleted: false,
			createdAt: now,
			updatedAt: now,
		},
		{
			_id: idWithPrefix("com"),
			propertyId: property1Id,
			authorId: landlordId,
			authorRole: "landlord",
			commentText:
				"Contractor is booked for next week, sorry for the delay.",
			isDeleted: false,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await (
		await notificationsCol()
	).insertMany([
		{
			_id: idWithPrefix("notif"),
			userId: tenantId,
			violationId: violation1Id,
			channel: "sms",
			notificationDetails: {
				text: "Reminder: Mold violation at 123 Maple Road is past its deadline and actionable.",
			},
			status: "queued",
			createdAt: now,
		},
	]);

	await (
		await disputesCol()
	).insertMany([
		{
			_id: idWithPrefix("dsp"),
			violationId: violation2Id,
			createdBy: landlordId,
			eventType: "status_change",
			status: "In-Progress",
			result: "Repair scheduled for 04-15-2026",
			createdAt: now,
		},
	]);

	await (
		await attorneysCol()
	).insertMany([
		{
			_id: idWithPrefix("atty"),
			name: "NYC Legal Aid Society",
			email: "intake@legalaidnyc.test",
			phone: "+12125551000",
			website: "https://legalaidnyc.test",
			createdAt: now,
		},
		{
			_id: idWithPrefix("atty"),
			name: "John Smith Legal",
			email: "johnsmith@nyc.legal.test",
			phone: "+12125550000",
			website: "https://johnsmithnyclegal.test",
			createdAt: now,
		},
	]);

	console.log("Seeded NYCHCom:");
	console.log("  3 users (admin, landlord, tenant)");
	console.log("  2 properties");
	console.log("  2 violations");
	console.log("  1 evidence record");
	console.log("  1 review");
	console.log("  2 comments");
	console.log("  1 notification");
	console.log("  1 dispute");
	console.log("  2 attorneys");
	console.log("");
	console.log("Sign-in credentials:");
	for (const u of seedCredentials) {
		console.log(`  ${u.label.padEnd(8)} ${u.email} / ${u.password}`);
	}

	await closeConnection();
};

main().catch((err) => {
	console.error("Seed failed:", err);
	closeConnection().finally(() => process.exit(1));
});
