// #850: dev-server staleness detector. The docs server (Eleventy :8080) can crash
// or fail a rebuild while the browser keeps showing the last-built HTML, so authors
// silently read stale docs. This polls /build-id.json and raises a fixed red banner
// when the served build id drifts from the one this page was built with (a newer
// build exists → reload) or the fetch fails (server down). No-op in production: the
// banner only ever appears against a live dev server that has moved on or died.
(function () {
  "use strict";

  var meta = document.querySelector('meta[name="build-id"]');
  if (!meta) return; // no build stamp → nothing to compare against
  var pageBuildId = meta.getAttribute("content");
  if (!pageBuildId) return;

  var POLL_MS = 4000;
  var banner = null;

  function showBanner(message) {
    if (banner) {
      banner.querySelector(".we-stale-text").textContent = message;
      return;
    }
    banner = document.createElement("div");
    banner.className = "we-stale-banner";
    banner.setAttribute("role", "alert");
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
      "background:#b91c1c;color:#fff;font:600 14px/1.4 system-ui,sans-serif;" +
      "padding:8px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3);";
    var text = document.createElement("span");
    text.className = "we-stale-text";
    text.textContent = message;
    banner.appendChild(text);
    var reload = document.createElement("button");
    reload.textContent = "Reload";
    reload.style.cssText =
      "margin-left:12px;background:#fff;color:#b91c1c;border:0;border-radius:4px;" +
      "padding:2px 10px;font:inherit;font-weight:700;cursor:pointer;";
    reload.addEventListener("click", function () {
      location.reload();
    });
    banner.appendChild(reload);
    document.body.appendChild(banner);
  }

  function clearBanner() {
    if (banner) {
      banner.remove();
      banner = null;
    }
  }

  function poll() {
    fetch("/build-id.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("status " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.id && data.id !== pageBuildId) {
          showBanner("STALE — this page is outdated; the server has rebuilt since you loaded it.");
        } else {
          clearBanner();
        }
      })
      .catch(function () {
        showBanner("STALE — dev server is down or unreachable.");
      });
  }

  setInterval(poll, POLL_MS);
  poll();
})();
