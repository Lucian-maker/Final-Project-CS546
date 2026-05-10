(function () {
	function setTileBadgeVisibility(badge, n) {
		if (!badge) return;
		if (n > 0) {
			badge.textContent = String(n);
			badge.removeAttribute("hidden");
		} else {
			badge.textContent = "0";
			badge.setAttribute("hidden", "");
		}
	}

	function init() {
		var tile = document.getElementById("dashboard-notif-tile");
		if (!tile) return;
		var w = typeof window !== "undefined" ? window : globalThis;

		fetch("/notifications/api/in-app", {
			credentials: "same-origin",
			cache: "no-store",
			headers: { Accept: "application/json" },
		})
			.then(function (res) {
				return res.ok ? res.json() : Promise.reject();
			})
			.then(function (data) {
				var n =
					w.NychcomNotifSync &&
					typeof w.NychcomNotifSync.unreadCountFromInAppPayload ===
						"function"
						? w.NychcomNotifSync.unreadCountFromInAppPayload(data)
						: (Array.isArray(data.queuedIds) ? data.queuedIds : [])
								.length;
				var badge = tile.querySelector(".dashboard-notif-badge");
				setTileBadgeVisibility(badge, n);
			})
			.catch(function () {});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
