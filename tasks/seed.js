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

/** 1×1 PNG — matches evidence vault storage (data URI + base64 in Mongo). */
const SEED_EVIDENCE_PNG_B64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SEED_EVIDENCE_PNG_DATA_URI = `data:image/png;base64,${SEED_EVIDENCE_PNG_B64}`;
const SEED_EVIDENCE_PNG_BYTES = Buffer.from(
	SEED_EVIDENCE_PNG_B64,
	"base64",
).length;

/**
 Sample photos for evidence of violations
 */
const VIOLATION_PHOTO_MAP = [
	// Mold / moisture
	{ keywords: ["mold", "mildew", "fungus", "moisture"], url: "https://images.unsplash.com/photo-1584622781867-1f5e0edcf7e4?w=800&q=80", caption: "Black mold growth on bathroom wall" },
	// Water / plumbing / leak
	{ keywords: ["water", "leak", "plumb", "pipe", "flood", "sewage", "drain"], url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80", caption: "Water leak under sink" },
	// Paint / lead
	{ keywords: ["paint", "lead", "peel", "chip"], url: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&q=80", caption: "Peeling paint on apartment wall" },
	// Door / window / lock
	{ keywords: ["door", "window", "lock", "frame", "entrance", "exit"], url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80", caption: "Damaged door frame" },
	// Structural / ceiling / wall
	{ keywords: ["crack", "ceiling", "structural", "wall", "plaster", "floor"], url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80", caption: "Cracked plaster ceiling" },
	// Heat / HVAC
	{ keywords: ["heat", "hvac", "boiler", "radiator", "steam", "ventil"], url: "https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=800&q=80", caption: "Broken heating unit" },
	// Pest / infestation
	{ keywords: ["pest", "roach", "rat", "mice", "rodent", "insect", "vermin", "infestat"], url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&q=80", caption: "Evidence of pest infestation" },
	// Electrical
	{ keywords: ["electric", "wiring", "outlet", "circuit", "fire"], url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80", caption: "Exposed electrical wiring" },
];

const DEFAULT_VIOLATION_PHOTO = {
	url: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80",
	caption: "General housing code violation",
};

const getViolationPhotoUrl = (description = "") => {
	const lower = description.toLowerCase();
	for (const entry of VIOLATION_PHOTO_MAP) {
		if (entry.keywords.some(kw => lower.includes(kw))) {
			return entry;
		}
	}
	return DEFAULT_VIOLATION_PHOTO;
};

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

// Fetch real data from NYC Open Data
const fetchRealNYCData = async () => {
	console.log("Fetching real violation data from NYC Open Data (SODA)...");
	// Get 100 recent open violations
	const response = await fetch("https://data.cityofnewyork.us/resource/wvxf-dwi5.json?$limit=100&$where=violationstatus='Open'");
	const data = await response.json();
	return data;
};

const mapNYCDataToSeed = (nycData, adminId) => {
	const propertiesMap = {}; // key: address, val: property object
	const violationsToInsert = [];
	const now = new Date();

	// Gets the unqiue properties and violations
	for (const row of nycData) {
		const addressKey = `${row.housenumber} ${row.streetname}`;

		if (!propertiesMap[addressKey]) {
			propertiesMap[addressKey] = {
				_id: idWithPrefix("prop"),
				address: {
					number: row.housenumber || "N/A",
					street: row.streetname || "Unknown",
					city: row.boro || "New York",
					state: "NY",
					zipCode: row.zip || "00000"
				},
				violations: [],
				createdOn: now,
				updatedOn: now,
				reviews: [],
				_tempViolationsData: []
			};
		}
		propertiesMap[addressKey]._tempViolationsData.push(row);
	}

	// pulls the properties and randomizes for a final 25 count
	let uniqueAddresses = Object.keys(propertiesMap);
	for (let i = uniqueAddresses.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[uniqueAddresses[i], uniqueAddresses[j]] = [uniqueAddresses[j], uniqueAddresses[i]];
	}
	const selectedAddresses = uniqueAddresses.slice(0, 25);

	const finalProperties = [];

	for (const addressKey of selectedAddresses) {
		const prop = propertiesMap[addressKey];

		for (const row of prop._tempViolationsData) {
			const randomDays = Math.floor(Math.random() * 46) - 5;
			let daysRemaining = randomDays;
			let certifyDate = new Date();
			certifyDate.setDate(certifyDate.getDate() + randomDays);

			const violId = idWithPrefix("viol");
			let vType = "General Code Violation";
			if (row.novdescription) {
				vType = row.novdescription.length > 40 ? row.novdescription.substring(0, 40) + "..." : row.novdescription;
			}

			const violation = {
				_id: violId,
				datasetViolationId: `HPD-${row.violationid}`,
				propertyId: prop._id,
				buildingAddress: addressKey,
				normalizedAddress: `${addressKey} ${row.boro} ny ${row.zip}`.toLowerCase(),
				borough: row.boro || "Unknown",
				zipCode: row.zip || "00000",
				violationType: vType,
				violationDescription: row.novdescription || "No description provided.",
				violationClass: row.class || "B",
				violationStatus: "Open",
				originalCertifyByDate: certifyDate,
				inspectionDate: row.inspectiondate ? new Date(row.inspectiondate) : now,
				repairScheduledAt: null,
				resolvedAt: null,
				daysRemaining: daysRemaining,
				isActionable: daysRemaining < 0,
				source: "NYC Open Data",
				lastDatasetSyncAt: now,
				lastUpdatedByUserId: adminId,
				remediationStatus: {
					currentState: "Open",
					updatedByUserId: adminId,
					updatedAt: now,
					notes: "Imported dynamically from NYC Open Data API."
				},
				statusHistory: [
					{
						state: "Open",
						changedAt: now,
						changedBy: "system"
					}
				],
				createdAt: row.inspectiondate ? new Date(row.inspectiondate) : now,
				updatedAt: now
			};

			violationsToInsert.push(violation);
			prop.violations.push(violId);
		}

		delete prop._tempViolationsData; // clean up
		finalProperties.push(prop);
	}

	return { properties: finalProperties, violations: violationsToInsert };
};

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

	// Gets the NYC data 
	const nycData = await fetchRealNYCData();
	const mappedData = mapNYCDataToSeed(nycData, adminId);
	const properties = mappedData.properties;
	const violations = mappedData.violations;

	console.log(`Successfully mapped ${properties.length} properties and ${violations.length} violations.`);

	// Insert into the database
	await (await propertiesCol()).insertMany(properties);
	await (await violationsCol()).insertMany(violations);

	// Assign 15 properties to a landlord for test
	await (
		await usersCol()
	).updateOne(
		{ _id: landlordId },
		{ $set: { ownedProperties: properties.slice(0, 15).map(p => p._id) } },
	);

	// Assign first property to tenant saved list
	const property1Id = properties[0]._id;
	const violation1Id = violations[0]._id;
	const violation2Id = violations.length > 1 ? violations[1]._id : violations[0]._id;

	// Assign 5 properties to tenant saved list
	await (
		await usersCol()
	).updateOne(
		{ _id: tenantId },
		{ $set: { savedProperties: properties.slice(15, 20).map(p => p._id) } },
	);

	const evidenceToInsert = [];
	for (const v of violations) {
		const photo = getViolationPhotoUrl(v.violationDescription);
		evidenceToInsert.push({
			_id: idWithPrefix("evid"),
			violationId: v._id,
			propertyId: v.propertyId,
			uploadedByUserId: tenantId,
			evidenceType: "photo",
			fileName: `evidence-${v._id}.jpg`,
			fileUrl: photo.url,
			mimeType: "image/jpeg",
			fileSize: 120000,
			caption: photo.caption,
			noteText: `Example visual evidence for: ${v.violationType}`,
			capturedAt: now,
			uploadedAt: now,
			isDeleted: false,
		});
	}
	if (evidenceToInsert.length > 0) {
		await (await evidenceCol()).insertMany(evidenceToInsert);
	}

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
			reviewText: "Slow to respond to issues in this building.",
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
			userId: tenantId,
			userName: "Tina Tenant",
			text: "This building needs a lot of work but the location is great.",
			rating: 4,
			parentCommentId: null,
			likes: [],
			isDeleted: false,
			createdAt: now,
			updatedAt: now,
		},
		{
			_id: idWithPrefix("com"),
			propertyId: property1Id,
			userId: landlordId,
			userName: "Larry Landlord",
			text: "We are working on scheduling repairs.",
			rating: null,
			parentCommentId: null,
			likes: [],
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
				text: "Reminder: Violation at your property is past its deadline and actionable.",
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
			result: "Repair scheduled.",
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
	console.log(`  ${properties.length} real NYC properties`);
	console.log(`  ${violations.length} real NYC violations`);
	console.log("  2 evidence records (note + photo with embedded PNG)");
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
