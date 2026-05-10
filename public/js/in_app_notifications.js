(function () {
	var w = typeof window !== "undefined" ? window : globalThis;
	const TOAST_MS = 9000;
	const MAX_TOASTS = 5;

	function run() {
		var stack = document.getElementById("toast-stack");
		if (!stack) return;

		fetch("/notifications/api/in-app", {
			credentials: "same-origin",
			cache: "no-store",
			headers: { Accept: "application/json" },
		})
			.then(function (res) {
				if (!res.ok) throw new Error("notifications feed failed");
				return res.json();
			})
			.then(function (data) {
				if (
					w.NychcomNotifSync &&
					typeof w.NychcomNotifSync.applyInAppPayloadToHeaderBadge ===
						"function"
				) {
					w.NychcomNotifSync.applyInAppPayloadToHeaderBadge(data);
				}

				var dismissed =
					w.NychcomNotifDismissed &&
					typeof w.NychcomNotifDismissed.getSet === "function"
						? w.NychcomNotifDismissed.getSet()
						: new Set();
				var recentQueued = Array.isArray(data.recentQueued)
					? data.recentQueued
					: [];
				var items = recentQueued
					.slice(0, MAX_TOASTS)
					.filter(function (item) {
						var sid =
							item && item._id != null
								? String(item._id).trim()
								: "";
						return !(sid && dismissed.has(sid));
					});
				items.forEach(function (item) {
					var el = document.createElement("div");
					el.className = "toast";
					el.setAttribute("role", "status");

					var body = document.createElement("div");
					body.className = "toast-body";
					var ch = item.channel ? String(item.channel) : "";
					var txt = item.text ? String(item.text) : "";
					body.innerHTML =
						'<strong class="toast-channel">' +
						escapeHtml(ch) +
						"</strong>" +
						'<p class="toast-text">' +
						escapeHtml(txt) +
						"</p>";

					var dismissBtn = document.createElement("button");
					dismissBtn.type = "button";
					dismissBtn.className = "toast-dismiss-btn";
					dismissBtn.setAttribute(
						"aria-label",
						"Dismiss notification",
					);
					dismissBtn.innerHTML = "&times;";
					dismissBtn.addEventListener("click", function () {
						var id =
							item._id != null ? String(item._id).trim() : "";
						var added = true;
						if (
							id &&
							w.NychcomNotifDismissed &&
							typeof w.NychcomNotifDismissed.add === "function"
						) {
							added = w.NychcomNotifDismissed.add(id) !== false;
						}
						if (
							id &&
							added &&
							w.NychcomNotifSync &&
							typeof w.NychcomNotifSync.bumpHeaderBadgeByDelta ===
								"function"
						) {
							w.NychcomNotifSync.bumpHeaderBadgeByDelta(-1);
						}
						if (
							id &&
							w.NychcomNotifSync &&
							typeof w.NychcomNotifSync.syncRead === "function"
						) {
							w.NychcomNotifSync.syncRead([id]);
						}
						el.remove();
						if (
							w.NychcomNotifSync &&
							typeof w.NychcomNotifSync.refreshHeaderBadge ===
								"function"
						) {
							w.NychcomNotifSync.refreshHeaderBadge();
						}
					});

					el.appendChild(body);
					el.appendChild(dismissBtn);
					stack.appendChild(el);
					window.setTimeout(function () {
						el.remove();
					}, TOAST_MS);
				});
			})
			.catch(function () {
				/* ignore — non-blocking */
			});
	}

	function escapeHtml(s) {
		var div = document.createElement("div");
		div.textContent = s;
		return div.innerHTML;
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", run);
	} else {
		run();
	}
})();
