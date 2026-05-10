/**
 * Prototype: remember dismissed notification ids so list/toasts survive reload.
 * Key: nychcom.notifications.dismissedIds (JSON string array, capped, deduped).
 */
(function (w) {
	var KEY = "nychcom.notifications.dismissedIds";
	var MAX_IDS = 300;

	function readArr() {
		try {
			var raw = localStorage.getItem(KEY);
			var arr = raw ? JSON.parse(raw) : [];
			if (!Array.isArray(arr)) return [];
			var out = [];
			var seen = {};
			for (var i = 0; i < arr.length; i++) {
				var id = arr[i];
				if (typeof id !== "string") continue;
				var t = id.trim();
				if (!t || seen[t]) continue;
				seen[t] = true;
				out.push(t);
			}
			return out;
		} catch (e) {
			return [];
		}
	}

	function writeArr(arr) {
		var merged = [];
		var seen = {};
		for (var i = 0; i < arr.length; i++) {
			var id = arr[i];
			if (typeof id !== "string" || !id) continue;
			if (seen[id]) continue;
			seen[id] = true;
			merged.push(id);
		}
		if (merged.length > MAX_IDS) {
			merged = merged.slice(merged.length - MAX_IDS);
		}
		try {
			localStorage.setItem(KEY, JSON.stringify(merged));
		} catch (e) {
			/* quota / private mode */
		}
		return merged;
	}

	function normalizeId(id) {
		if (id == null) return "";
		return String(id).trim();
	}

	w.NychcomNotifDismissed = {
		getSet: function () {
			return new Set(readArr());
		},
		add: function (id) {
			var t = normalizeId(id);
			if (!t) return false;
			var a = readArr();
			if (new Set(a).has(t)) return false;
			a.push(t);
			writeArr(a);
			return true;
		},
		addMany: function (ids) {
			var a = readArr();
			var existing = new Set(a);
			var added = [];
			if (Array.isArray(ids)) {
				for (var i = 0; i < ids.length; i++) {
					var ti = normalizeId(ids[i]);
					if (!ti || existing.has(ti)) continue;
					existing.add(ti);
					added.push(ti);
					a.push(ti);
				}
			}
			writeArr(a);
			return added;
		},
		/**
		 * Badge count: queued notification ids from the server minus dismissed/read (localStorage).
		 * Pass queuedIds from GET /notifications/api/in-app (full queued set in fetch window).
		 */
		adjustUnreadCount: function (queuedIds) {
			var ids = Array.isArray(queuedIds) ? queuedIds : [];
			var dismissed = this.getSet();
			var n = 0;
			for (var i = 0; i < ids.length; i++) {
				var id = ids[i] == null ? "" : String(ids[i]).trim();
				if (id && !dismissed.has(id)) n++;
			}
			return n;
		},
	};
})(typeof window !== "undefined" ? window : globalThis);
