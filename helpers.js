const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
const LETTERS_ONLY_REGEX = /^[A-Za-z]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGITS_REGEX = /^\+?[0-9]{10,15}$/;

export const VALID_USER_ROLES = Object.freeze(["tenant", "landlord", "admin"]);
export const PUBLIC_USER_ROLES = Object.freeze(["tenant", "landlord"]);

export const checkString = (val, name) => {
	if (val === undefined || val === null) {
		throw `${name} must be supplied`;
	}
	if (typeof val !== "string") {
		throw `${name} must be a string`;
	}
	const trimmed = val.trim();
	if (trimmed.length === 0) {
		throw `${name} cannot be empty or only spaces`;
	}
	return trimmed;
};

export const checkName = (val, name) => {
	const trimmed = checkString(val, name);
	if (trimmed.length < 2 || trimmed.length > 25) {
		throw `${name} must be between 2 and 25 characters long`;
	}
	if (!LETTERS_ONLY_REGEX.test(trimmed)) {
		throw `${name} must contain only letters (no numbers, spaces, or special characters)`;
	}
	return trimmed;
};

export const checkEmail = (val) => {
	const trimmed = checkString(val, "email");
	const lowered = trimmed.toLowerCase();
	if (lowered.length > 254) {
		throw `email is too long`;
	}
	if (!EMAIL_REGEX.test(lowered)) {
		throw `email must be a valid email address`;
	}
	return lowered;
};

export const checkPassword = (val) => {
	if (val === undefined || val === null) {
		throw `password must be supplied`;
	}
	if (typeof val !== "string") {
		throw `password must be a string`;
	}
	if (val.trim().length === 0) {
		throw `password cannot be empty or only spaces`;
	}
	if (/\s/.test(val)) {
		throw `password cannot contain any spaces`;
	}
	if (val.length < 8) {
		throw `password must be at least 8 characters long`;
	}
	if (!/[A-Z]/.test(val)) {
		throw `password must contain at least one uppercase letter`;
	}
	if (!/[0-9]/.test(val)) {
		throw `password must contain at least one number`;
	}
	if (!SPECIAL_CHAR_REGEX.test(val)) {
		throw `password must contain at least one special character`;
	}
	return val;
};

export const checkPhone = (val) => {
	const trimmed = checkString(val, "phoneNumber");
	const condensed = trimmed.replace(/[\s().-]/g, "");
	if (!PHONE_DIGITS_REGEX.test(condensed)) {
		throw `phoneNumber must be a valid phone number (10-15 digits, optional leading +)`;
	}
	return condensed;
};

export const checkUserRole = (val, allowed = VALID_USER_ROLES) => {
	const trimmed = checkString(val, "userRole");
	const lowered = trimmed.toLowerCase();
	if (!allowed.includes(lowered)) {
		throw `userRole must be one of: ${allowed.join(", ")}`;
	}
	return lowered;
};

export const checkId = (val, name = "id") => {
	const trimmed = checkString(val, name);
	if (trimmed.length < 1 || trimmed.length > 128) {
		throw `${name} must be a non-empty identifier`;
	}
	return trimmed;
};

export const checkDate = (val, name = "date") => {
	if (val === undefined || val === null) {
		throw `${name} must be supplied`;
	}
	const date = val instanceof Date ? val : new Date(val);
	if (Number.isNaN(date.getTime())) {
		throw `${name} must be a valid date`;
	}
	return date;
};

export const checkChannel = (val) => {
	const cleaned = checkString(val, "channel").toLowerCase();
	const allowed = ["sms", "email", "certified letter"];
	if (!allowed.includes(cleaned)) {
		throw `channel must be one of: ${allowed.join(", ")}`;
	}
	return cleaned;
};

export const checkNotificationStatus = (val) => {
	const cleaned = checkString(val, "status").toLowerCase();
	const allowed = ["queued", "sent", "delivered", "canceled", "failed"];
	if (!allowed.includes(cleaned)) {
		throw `status must be one of: ${allowed.join(", ")}`;
	}
	return cleaned;
};

export const checkDisputeEventType = (val) => {
	const cleaned = checkString(val, "eventType").toLowerCase();
	const allowed = ["status_change"];
	if (!allowed.includes(cleaned)) {
		throw `eventType must be one of: ${allowed.join(", ")}`;
	}
	return cleaned;
};

const pad2 = (n) => String(n).padStart(2, "0");

export const formatDate = (date) => {
	const d = date instanceof Date ? date : new Date(date);
	return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
};

export const formatDateTime = (date) => {
	const d = date instanceof Date ? date : new Date(date);
	const hours24 = d.getHours();
	const suffix = hours24 >= 12 ? "PM" : "AM";
	let hours12 = hours24 % 12;
	if (hours12 === 0) {
		hours12 = 12;
	}
	return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()} ${pad2(hours12)}:${pad2(d.getMinutes())}${suffix}`;
};

export const checkScore = (val, name) => {
	if (val === undefined || val === null || val === "") {
		throw `${name} must be supplied`;
	}
	const num = typeof val === "number" ? val : Number(val);
	if (!Number.isInteger(num)) {
		throw `${name} must be an integer`;
	}
	if (num < 1 || num > 5) {
		throw `${name} must be between 1 and 5`;
	}
	return num;
};

export const checkShortText = (val, name, maxLen = 500) => {
	const trimmed = checkString(val, name);
	if (trimmed.length > maxLen) {
		throw `${name} must be ${maxLen} characters or fewer`;
	}
	return trimmed;
};

/** Validates a public http(s) URL. */
export const checkHttpUrl = (val, name = "url") => {
	const s = checkString(val, name);
	let u;
	try {
		u = new URL(s);
	} catch {
		throw `${name} must be a valid http or https URL`;
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") {
		throw `${name} must use http or https`;
	}
	return u.href;
};

const MAX_EVIDENCE_IMAGE_BYTES = 4 * 1024 * 1024;

function bufferLooksLikeAllowedImage(buf) {
	if (buf.length < 12) {
		return false;
	}
	if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
		return true;
	}
	if (
		buf[0] === 0x89 &&
		buf[1] === 0x50 &&
		buf[2] === 0x4e &&
		buf[3] === 0x47
	) {
		return true;
	}
	if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
		return true;
	}
	if (
		buf.length >= 12 &&
		buf.toString("ascii", 0, 4) === "RIFF" &&
		buf.toString("ascii", 8, 12) === "WEBP"
	) {
		return true;
	}
	return false;
}

/**
 * Validates a browser data URL (FileReader.readAsDataURL) and returns fields for Mongo.
 * Images only: JPEG, PNG, GIF, WebP — verified by magic bytes.
 */
export const parseEvidenceImageDataUri = (input, name = "image") => {
	if (typeof input !== "string" || input.trim() === "") {
		throw `${name} is required`;
	}
	const s = input.trim();
	const m =
		/^data:(image\/(?:jpeg|jpg|png|gif|webp));base64,([\s\S]+)$/i.exec(s);
	if (!m) {
		throw `${name} must be a base64 data URL for JPEG, PNG, GIF, or WebP`;
	}
	let mime = m[1].toLowerCase();
	if (mime === "image/jpg") {
		mime = "image/jpeg";
	}
	const b64 = m[2].replace(/\s/g, "");
	let buf;
	try {
		buf = Buffer.from(b64, "base64");
	} catch {
		throw `${name} has invalid base64 data`;
	}
	if (buf.length === 0 || buf.length > MAX_EVIDENCE_IMAGE_BYTES) {
		throw `${name} must decode to between 1 and ${MAX_EVIDENCE_IMAGE_BYTES} bytes`;
	}
	if (!bufferLooksLikeAllowedImage(buf)) {
		throw `${name} content is not a supported image (JPEG, PNG, GIF, or WebP)`;
	}
	const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
	return {
		dataUri,
		mimeType: mime,
		fileSize: buf.length,
	};
};

/** Used by Handlebars: show <img> for data:image or legacy http(s) image paths. */
export const evidenceVaultShowImage = (fileUrl, mimeType) => {
	if (!fileUrl || typeof fileUrl !== "string") {
		return false;
	}
	if (fileUrl.startsWith("data:image/")) {
		return true;
	}
	if (mimeType === "application/pdf") {
		return false;
	}
	const lower = fileUrl.toLowerCase();
	if (lower.includes(".pdf")) {
		return false;
	}
	try {
		const pathname = new URL(fileUrl).pathname;
		return /\.(jpe?g|png|gif|webp|bmp|svg|avif)$/i.test(pathname);
	} catch {
		return /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(
			lower.split("?")[0],
		);
	}
};

//Properties
export const checkAddress = (addr) => {
	if (!addr || typeof addr !== "object") {
		throw "Address must be an object";
	}

	const number = checkString(addr.number, "address number");
	const street = checkString(addr.street, "street");
	const city = checkString(addr.city, "city");
	const state = checkString(addr.state, "state");
	const zipCode = checkString(addr.zipCode, "zipCode");

	if (!/^\d{5}$/.test(zipCode)) {
		throw "zipCode must be a valid 5-digit code";
	}

	return {
		number,
		street,
		city,
		state,
		zipCode,
	};
};
