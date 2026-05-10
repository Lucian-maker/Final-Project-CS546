/**
 * Hybrid read sync: UI stays optimistic via localStorage first; this POST catches Mongo up.
 * Failures are ignored (one silent retry for flaky networks).
 */
(function (w) {
	function normalizeIds(ids) {
		if (!Array.isArray(ids)) return [];
		var out = [];
		var seen = {};
		for (var i = 0; i < ids.length; i++) {
			var id = ids[i] == null ? "" : String(ids[i]).trim();
			if (!id || seen[id]) continue;
			seen[id] = true;
			out.push(id);
		}
		return out;
	}

	/**
	 * Single source of truth for header/dashboard unread count from GET /api/in-app JSON.
	 * Falls back to unreadCount when queuedIds is absent (older clients / parse quirks).
	 */
	function unreadCountFromInAppPayload(data) {
		var hasQueuedIdsKey =
			data && Object.prototype.hasOwnProperty.call(data, "queuedIds");
		var queuedIds = Array.isArray(data && data.queuedIds)
			? data.queuedIds
			: [];
		var serverN =
			data && typeof data.unreadCount === "number"
				? data.unreadCount
				: queuedIds.length;
		/* Only when the server omitted queuedIds entirely — not when [] (must honor dismissed). */
		if (serverN > 0 && !hasQueuedIdsKey) {
			return serverN;
		}
		if (
			w.NychcomNotifDismissed &&
			typeof w.NychcomNotifDismissed.adjustUnreadCount === "function"
		) {
			return w.NychcomNotifDismissed.adjustUnreadCount(queuedIds);
		}
		return serverN;
	}

	function setHeaderBadgeVisibility(badge, n) {
		if (!badge) return;
		if (n > 0) {
			badge.textContent = String(n);
			badge.removeAttribute("hidden");
		} else {
			badge.textContent = "0";
			badge.setAttribute("hidden", "");
		}
	}

	function currentBadgeCount(badge) {
		if (!badge || badge.hasAttribute("hidden")) return 0;
		var n = Number.parseInt(badge.textContent || "0", 10);
		return Number.isFinite(n) && n > 0 ? n : 0;
	}

	function bumpBadgeElByDelta(badge, delta) {
		if (!badge) return;
		var d = Number(delta);
		if (!Number.isFinite(d) || d === 0) return;
		setHeaderBadgeVisibility(
			badge,
			Math.max(0, currentBadgeCount(badge) + d),
		);
	}

	function bumpHeaderBadgeByDelta(delta) {
		bumpBadgeElByDelta(document.getElementById("notif-badge"), delta);
		document
			.querySelectorAll(".dashboard-notif-badge")
			.forEach(function (badge) {
				bumpBadgeElByDelta(badge, delta);
			});
	}

	function setBadgeElCount(badge, count) {
		var n = Number(count);
		setHeaderBadgeVisibility(
			badge,
			Number.isFinite(n) ? Math.max(0, n) : 0,
		);
	}

	function setHeaderBadgeCount(count) {
		setBadgeElCount(document.getElementById("notif-badge"), count);
		document
			.querySelectorAll(".dashboard-notif-badge")
			.forEach(function (badge) {
				setBadgeElCount(badge, count);
			});
	}

	function doFetch(notificationIds) {
		return fetch("/notifications/sync-read", {
			method: "POST",
			credentials: "same-origin",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ notificationIds: notificationIds }),
		});
	}

	function applyInAppPayloadToHeaderBadge(data) {
		setHeaderBadgeCount(unreadCountFromInAppPayload(data));
	}

	function fetchAndApplyHeaderBadge() {
		return fetch("/notifications/api/in-app", {
			credentials: "same-origin",
			cache: "no-store",
			headers: { Accept: "application/json" },
		})
			.then(function (res) {
				return res.ok ? res.json() : Promise.reject();
			})
			.then(function (data) {
				applyInAppPayloadToHeaderBadge(data);
			})
			.catch(function () {});
	}

	function syncRead(notificationIds) {
		var ids = normalizeIds(notificationIds);
		if (!ids.length) return Promise.resolve();
		var chain = doFetch(ids)
			.then(function (res) {
				if (res.ok) return res;
				return doFetch(ids);
			})
			.catch(function () {
				return doFetch(ids).catch(function () {});
			});
		return chain.finally(function () {
			fetchAndApplyHeaderBadge();
		});
	}

	w.NychcomNotifSync = {
		unreadCountFromInAppPayload: unreadCountFromInAppPayload,
		applyInAppPayloadToHeaderBadge: applyInAppPayloadToHeaderBadge,
		bumpHeaderBadgeByDelta: bumpHeaderBadgeByDelta,
		setHeaderBadgeCount: setHeaderBadgeCount,
		syncRead: syncRead,
		refreshHeaderBadge: fetchAndApplyHeaderBadge,
	};
})(typeof window !== "undefined" ? window : globalThis);
