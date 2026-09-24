/* SCORM 1.2 adapter. This archive has no course content or completion criteria. */
(function () {
  var api = null, initialized = false, finished = false;
  function findAPI(win) {
    var hops = 0;
    while (win && hops++ < 500) {
      try { if (win.API) return win.API; } catch (_) {}
      if (!win.parent || win.parent === win) break;
      win = win.parent;
    }
    try { if (window.opener && window.opener.API) return window.opener.API; } catch (_) {}
    return null;
  }
  function initialize() {
    api = findAPI(window);
    if (!api) return;
    try { initialized = api.LMSInitialize('') === 'true'; } catch (_) { initialized = false; }
    if (!initialized) return;
    try { api.LMSCommit(''); } catch (_) {}
  }
  function finish() {
    if (finished) return;
    finished = true;
    if (!api || !initialized) return;
    try { api.LMSCommit(''); } catch (_) {}
    try { api.LMSFinish(''); } catch (_) {}
  }
  initialize();
  window.addEventListener('pagehide', finish);
  window.addEventListener('beforeunload', finish);
}());
