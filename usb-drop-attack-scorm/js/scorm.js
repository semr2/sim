/* Minimal SCORM 1.2 wrapper with a local-development fallback. */
var SCORM = (function () {
  var api = null, mode = 'none', finished = false, KEY = 'usbdrop_scorm12_dev', nextInteractionIndex = 0;
  var store = {}, memOnly = false;

  function findAPI(w) {
    var n = 0;
    try {
      while (w && !w.API && w.parent && w.parent !== w && n < 12) { w = w.parent; n++; }
      return (w && w.API) ? w.API : null;
    } catch (e) { return null; }
  }
  function locate() {
    var a = findAPI(window);
    if (!a) { try { if (window.opener) { a = findAPI(window.opener); } } catch (e) {} }
    return a;
  }
  function persist() {
    if (memOnly) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { memOnly = true; }
  }
  function loadLocal() {
    try { store = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; memOnly = true; }
    if (!store['cmi.core.lesson_status']) store['cmi.core.lesson_status'] = 'not attempted';
  }

  return {
    version: '1.2',
    init: function () {
      api = locate();
      if (api) {
        var ok = false;
        try { ok = String(api.LMSInitialize('')) === 'true'; } catch (e) { ok = false; }
        if (ok) {
          mode = 'lms';
          try { nextInteractionIndex = parseInt(api.LMSGetValue('cmi.interactions._count'), 10) || 0; } catch (e) { nextInteractionIndex = 0; }
          return true;
        }
        api = null;
      }
      mode = 'local'; loadLocal();
      nextInteractionIndex = parseInt(store['cmi.interactions._count'], 10) || 0;
      return true;
    },
    get: function (k) {
      if (mode === 'lms') { try { return String(api.LMSGetValue(k)); } catch (e) { return ''; } }
      return store[k] === undefined ? '' : String(store[k]);
    },
    set: function (k, v) {
      if (mode === 'lms') { try { return String(api.LMSSetValue(k, String(v))) === 'true'; } catch (e) { return false; } }
      store[k] = String(v); return true;
    },
    commit: function () {
      if (mode === 'lms') { try { return String(api.LMSCommit('')) === 'true'; } catch (e) { return false; } }
      persist(); return true;
    },
    save: function () { return this.commit(); },
    recordInteraction: function (interactionId, userResponse, isCorrect) {
      if (mode !== 'lms' && mode !== 'local') return false;
      var index = nextInteractionIndex;
      if (mode === 'lms') {
        try {
          var count = parseInt(api.LMSGetValue('cmi.interactions._count'), 10);
          if (!isNaN(count)) index = Math.max(index, count);
        } catch (e) {}
      } else {
        var localCount = parseInt(store['cmi.interactions._count'], 10);
        if (!isNaN(localCount)) index = Math.max(index, localCount);
      }
      var prefix = 'cmi.interactions.' + index + '.';
      var fields = [
        [prefix + 'id', String(interactionId).slice(0, 255)],
        [prefix + 'type', 'choice'],
        [prefix + 'student_response', String(userResponse).slice(0, 255)],
        [prefix + 'result', isCorrect === 'neutral' ? 'neutral' : (isCorrect ? 'correct' : 'wrong')]
      ];
      for (var i = 0; i < fields.length; i++) {
        if (!this.set(fields[i][0], fields[i][1])) return false;
      }
      nextInteractionIndex = index + 1;
      if (mode === 'local') store['cmi.interactions._count'] = String(nextInteractionIndex);
      return this.commit();
    },
    finish: function () {
      if (finished) return true; finished = true;
      if (mode === 'lms') { try { return String(api.LMSFinish('')) === 'true'; } catch (e) { return false; } }
      persist(); return true;
    },
    reopen: function () { finished = false; },
    mode: function () { return mode; }
  };
})();

/* Record a SCORM 1.2 choice interaction through the adapter. SCORM 1.2 uses
   "wrong" for an incorrect response result. */
function reportInteractionToSCORM(interactionId, userResponse, isCorrect) {
  if (typeof SCORM !== 'undefined' && SCORM.version === '1.2') {
    return SCORM.recordInteraction(interactionId, userResponse, isCorrect === 'neutral' ? 'neutral' : !!isCorrect);
  }
  return false;
}
