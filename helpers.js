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
		zipCode
	};
};
