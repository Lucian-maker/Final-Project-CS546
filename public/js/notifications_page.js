(function () {
	function applyDismissedFromStorage(listEl, emptyEl, markAllBtn, errorEl) {
		var w = typeof window !== "undefined" ? window : globalThis;
		if (
			!listEl ||
			!w.NychcomNotifDismissed ||
			typeof w.NychcomNotifDismissed.getSet !== "function"
		) {
			return;
		}
		var dismissed = w.NychcomNotifDismissed.getSet();
		listEl.querySelectorAll(".notif-card").forEach(function (li) {
			var raw = li.getAttribute("data-notification-id");
			var id = raw ? raw.trim() : "";
			if (id && dismissed.has(id)) li.remove();
		});
		updateListChrome(listEl, emptyEl, markAllBtn, errorEl);
	}

	function updateListChrome(listEl, emptyEl, markAllBtn, errorEl) {
		var cardCount = listEl.querySelectorAll(".notif-card").length;
		if (emptyEl) emptyEl.hidden = cardCount > 0;
		if (markAllBtn) {
			markAllBtn.hidden = !listEl.querySelector(".js-notif-mark-one");
		}
		if (errorEl) {
			errorEl.hidden = true;
			errorEl.textContent = "";
		}
	}

	function queuedCardCount(listEl) {
		return listEl
			? listEl.querySelectorAll(".js-notif-mark-one").length
			: 0;
	}

	function setBadgeCount(n) {
		var w = typeof window !== "undefined" ? window : globalThis;
		if (
			w.NychcomNotifSync &&
			typeof w.NychcomNotifSync.setHeaderBadgeCount === "function"
		) {
			w.NychcomNotifSync.setHeaderBadgeCount(n);
			return;
		}
		var badge = document.getElementById("notif-badge");
		if (!badge) return;
		var count = Number(n);
		if (!Number.isFinite(count) || count <= 0) {
			badge.textContent = "0";
			badge.setAttribute("hidden", "");
		} else {
			badge.textContent = String(Math.max(0, Math.trunc(count)));
			badge.removeAttribute("hidden");
		}
	}

	function markReadLocal(id) {
		var w = typeof window !== "undefined" ? window : globalThis;
		if (
			w.NychcomNotifDismissed &&
			typeof w.NychcomNotifDismissed.add === "function"
		) {
			w.NychcomNotifDismissed.add(id);
		}
		if (
			w.NychcomNotifSync &&
			typeof w.NychcomNotifSync.syncRead === "function"
		) {
			w.NychcomNotifSync.syncRead([id]);
		}
	}

	function canSyncInBackground() {
		var w = typeof window !== "undefined" ? window : globalThis;
		return Boolean(
			w.NychcomNotifSync &&
			typeof w.NychcomNotifSync.syncRead === "function",
		);
	}

	function syncReadMany(ids) {
		var w = typeof window !== "undefined" ? window : globalThis;
		if (
			w.NychcomNotifSync &&
			typeof w.NychcomNotifSync.syncRead === "function"
		) {
			w.NychcomNotifSync.syncRead(ids);
		}
	}

	function init() {
		var page = document.getElementById("notifications-page");
		if (!page) return;

		var listEl = document.getElementById("notification-card-list");
		var emptyEl = document.getElementById("notifications-empty-msg");
		var errorEl = document.getElementById("notifications-error-msg");
		var markAllBtn = document.getElementById("js-notif-mark-all");

		applyDismissedFromStorage(listEl, emptyEl, markAllBtn, errorEl);
		setBadgeCount(queuedCardCount(listEl));

		Array.prototype.forEach.call(
			listEl.querySelectorAll(".js-notif-mark-one"),
			function (btn) {
				btn.addEventListener("click", function (ev) {
					var li =
						typeof btn.closest === "function"
							? btn.closest(".notif-card")
							: null;
					if (!li) return;
					var rawId =
						btn.getAttribute("data-notification-id") ||
						li.getAttribute("data-notification-id");
					var id = rawId ? rawId.trim() : "";
					if (!id) return;
					ev.preventDefault();
					markReadLocal(id);
					li.remove();
					updateListChrome(listEl, emptyEl, markAllBtn, errorEl);
					setBadgeCount(queuedCardCount(listEl));
				});
			},
		);

		if (markAllBtn) {
			markAllBtn.addEventListener("click", function (ev) {
				ev.preventDefault();
				var w = typeof window !== "undefined" ? window : globalThis;
				var idsToStore = [];
				listEl.querySelectorAll(".notif-card").forEach(function (node) {
					if (node.querySelector(".js-notif-mark-one")) {
						var rawNid = node.getAttribute("data-notification-id");
						var nid = rawNid ? rawNid.trim() : "";
						if (nid) idsToStore.push(nid);
						node.remove();
					}
				});
				if (
					w.NychcomNotifDismissed &&
					typeof w.NychcomNotifDismissed.addMany === "function"
				) {
					w.NychcomNotifDismissed.addMany(idsToStore);
				}
				syncReadMany(idsToStore);
				updateListChrome(listEl, emptyEl, markAllBtn, errorEl);
				setBadgeCount(queuedCardCount(listEl));
			});
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
