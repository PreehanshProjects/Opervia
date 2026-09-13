// Runs before first paint so a dark-mode user never sees a white flash.
// A separate file, not inline: the Content-Security-Policy is script-src 'self',
// and weakening it for one script would not be a fair trade.
(function () {
  try {
    var t = localStorage.getItem("opervia:theme") || "system";
    var dark =
      t === "dark" ||
      (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0e1a16" : "#f7f8f5");
  } catch (e) {
    /* Private mode: the app still applies the theme once React mounts. */
  }
})();
