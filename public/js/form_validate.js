(function () {
	const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
	const LETTERS_ONLY_REGEX = /^[A-Za-z]+$/;
	const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const PHONE_DIGITS_REGEX = /^\+?[0-9]{10,15}$/;
	const PUBLIC_USER_ROLES = ["tenant", "landlord"];

	const showErrors = (target, errors) => {
		const el = document.getElementById("clientError");
		if (!el) {
			return;
		}
		el.textContent = "";
		if (errors.length === 0) {
			el.hidden = true;
			return;
		}
		const list = document.createElement("ul");
		for (let i = 0; i < errors.length; i++) {
			const item = document.createElement("li");
			item.textContent = errors[i];
			list.appendChild(item);
		}
		el.appendChild(list);
		el.hidden = false;
	};

	const pushName = (errors, rawVal, label) => {
		if (typeof rawVal !== "string" || rawVal.trim().length === 0) {
			errors.push(`${label} must be supplied`);
			return;
		}
		const trimmed = rawVal.trim();
		if (trimmed.length < 2 || trimmed.length > 25) {
			errors.push(`${label} must be between 2 and 25 characters long`);
		}
		if (!LETTERS_ONLY_REGEX.test(trimmed)) {
			errors.push(
				`${label} must contain only letters (no numbers, spaces, or special characters)`,
			);
		}
	};

	const pushEmail = (errors, rawVal) => {
		if (typeof rawVal !== "string" || rawVal.trim().length === 0) {
			errors.push("email must be supplied");
			return;
		}
		const lowered = rawVal.trim().toLowerCase();
		if (lowered.length > 254) {
			errors.push("email is too long");
		}
		if (!EMAIL_REGEX.test(lowered)) {
			errors.push("email must be a valid email address");
		}
	};

	const pushPassword = (errors, rawVal) => {
		if (typeof rawVal !== "string" || rawVal.length === 0) {
			errors.push("password must be supplied");
			return;
		}
		if (rawVal.trim().length === 0) {
			errors.push("password cannot be empty or only spaces");
			return;
		}
		if (/\s/.test(rawVal)) {
			errors.push("password cannot contain any spaces");
		}
		if (rawVal.length < 8) {
			errors.push("password must be at least 8 characters long");
		}
		if (!/[A-Z]/.test(rawVal)) {
			errors.push("password must contain at least one uppercase letter");
		}
		if (!/[0-9]/.test(rawVal)) {
			errors.push("password must contain at least one number");
		}
		if (!SPECIAL_CHAR_REGEX.test(rawVal)) {
			errors.push("password must contain at least one special character");
		}
	};

	const pushPhone = (errors, rawVal) => {
		if (typeof rawVal !== "string" || rawVal.trim().length === 0) {
			errors.push("phoneNumber must be supplied");
			return;
		}
		const condensed = rawVal.trim().replace(/[\s().-]/g, "");
		if (!PHONE_DIGITS_REGEX.test(condensed)) {
			errors.push(
				"phoneNumber must be a valid phone number (10-15 digits, optional leading +)",
			);
		}
	};

	const pushRole = (errors, rawVal) => {
		if (typeof rawVal !== "string" || rawVal.trim().length === 0) {
			errors.push("userRole must be supplied");
			return;
		}
		if (!PUBLIC_USER_ROLES.includes(rawVal.trim().toLowerCase())) {
			errors.push(
				`userRole must be one of: ${PUBLIC_USER_ROLES.join(", ")}`,
			);
		}
	};

	const pushScore = (errors, rawVal, label) => {
		if (rawVal === undefined || rawVal === null || rawVal === "") {
			errors.push(`${label} must be supplied`);
			return;
		}
		const num = Number(rawVal);
		if (!Number.isInteger(num)) {
			errors.push(`${label} must be an integer`);
			return;
		}
		if (num < 1 || num > 5) {
			errors.push(`${label} must be between 1 and 5`);
		}
	};

	const pushShortText = (errors, rawVal, label, maxLen) => {
		if (typeof rawVal !== "string" || rawVal.trim().length === 0) {
			errors.push(`${label} must be supplied`);
			return;
		}
		if (rawVal.trim().length > maxLen) {
			errors.push(`${label} must be ${maxLen} characters or fewer`);
		}
	};

	window.NYCHComValidators = { pushScore, pushShortText, showErrors };

	const signup = document.getElementById("signup-form");
	if (signup) {
		signup.addEventListener("submit", (event) => {
			const errors = [];
			const firstName = document.getElementById("firstName").value;
			const lastName = document.getElementById("lastName").value;
			const email = document.getElementById("email").value;
			const phoneNumber = document.getElementById("phoneNumber").value;
			const password = document.getElementById("password").value;
			const confirmPassword =
				document.getElementById("confirmPassword").value;
			const userRole = document.getElementById("userRole").value;

			pushName(errors, firstName, "firstName");
			pushName(errors, lastName, "lastName");
			pushEmail(errors, email);
			pushPhone(errors, phoneNumber);
			pushPassword(errors, password);
			if (password !== confirmPassword) {
				errors.push("password and confirmPassword do not match");
			}
			pushRole(errors, userRole);

			if (errors.length > 0) {
				event.preventDefault();
				showErrors(signup, errors);
			} else {
				showErrors(signup, []);
			}
		});
	}

	const signin = document.getElementById("signin-form");
	if (signin) {
		signin.addEventListener("submit", (event) => {
			const errors = [];
			const email = document.getElementById("email").value;
			const password = document.getElementById("password").value;

			pushEmail(errors, email);
			pushPassword(errors, password);

			if (errors.length > 0) {
				event.preventDefault();
				showErrors(signin, errors);
			} else {
				showErrors(signin, []);
			}
		});
	}

	const reviewForm = document.getElementById("review-form");
	if (reviewForm) {
		reviewForm.addEventListener("submit", (event) => {
			const errors = [];
			const responsiveness =
				document.getElementById("responsiveness").value;
			const value = document.getElementById("value").value;
			const resolution = document.getElementById("resolution").value;
			const reviewText = document.getElementById("reviewText").value;

			pushScore(errors, responsiveness, "responsiveness");
			pushScore(errors, value, "value");
			pushScore(errors, resolution, "resolution");
			pushShortText(errors, reviewText, "reviewText", 500);

			if (errors.length > 0) {
				event.preventDefault();
				showErrors(reviewForm, errors);
			} else {
				showErrors(reviewForm, []);
			}
		});
	}

	const editForms = document.querySelectorAll(".review-edit-form");
	editForms.forEach((form) => {
		form.addEventListener("submit", (event) => {
			const errors = [];
			const fields = form.elements;
			pushScore(errors, fields.responsiveness.value, "responsiveness");
			pushScore(errors, fields.value.value, "value");
			pushScore(errors, fields.resolution.value, "resolution");
			pushShortText(errors, fields.reviewText.value, "reviewText", 500);

			if (errors.length > 0) {
				event.preventDefault();
				showErrors(form, errors);
			} else {
				showErrors(form, []);
			}
		});
	});
})();
