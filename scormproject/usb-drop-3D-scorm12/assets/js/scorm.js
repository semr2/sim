/* ===========================================================================
   scorm.js — LMS bridge. Talks SCORM 1.2 by preference and falls back to
   SCORM 2004 if that is what the LMS exposes. When no API is found at all
   (opening index.html directly), it degrades to an in-memory/localStorage
   stub so the course still runs for review.
   =========================================================================== */
(function (global) {
  'use strict';

  var MAP = {
    '1.2':  { init:'LMSInitialize', fin:'LMSFinish', get:'LMSGetValue', set:'LMSSetValue',
              commit:'LMSCommit', err:'LMSGetLastError', errStr:'LMSGetErrorString' },
    '2004': { init:'Initialize', fin:'Terminate', get:'GetValue', set:'SetValue',
              commit:'Commit', err:'GetLastError', errStr:'GetErrorString' }
  };

  var K = {
    '1.2': {
      name:'cmi.core.student_name', id:'cmi.core.student_id', entry:'cmi.core.entry',
      location:'cmi.core.lesson_location', status:'cmi.core.lesson_status',
      raw:'cmi.core.score.raw', max:'cmi.core.score.max', min:'cmi.core.score.min',
      suspend:'cmi.suspend_data', exit:'cmi.core.exit', time:'cmi.core.session_time',
      mode:'cmi.core.lesson_mode'
    },
    '2004': {
      name:'cmi.learner_name', id:'cmi.learner_id', entry:'cmi.entry',
      location:'cmi.location', status:'cmi.completion_status',
      raw:'cmi.score.raw', max:'cmi.score.max', min:'cmi.score.min',
      suspend:'cmi.suspend_data', exit:'cmi.exit', time:'cmi.session_time',
      mode:'cmi.mode'
    }
  };

  /* ------------------------- find the API object ------------------------- */
  function scan(win) {
    var tries = 0;
    while (win && tries < 500) {
      try {
        if (win.API_1484_11) return { api: win.API_1484_11, v: '2004' };
        if (win.API)         return { api: win.API,        v: '1.2'  };
      } catch (e) { /* cross-origin ancestor: keep climbing */ }
      if (!win.parent || win.parent === win) break;
      win = win.parent; tries++;
    }
    return null;
  }

  function discover() {
    var f = scan(global);
    if (!f) { try { if (global.opener && !global.opener.closed) f = scan(global.opener); } catch (e) {} }
    if (!f) { try { if (global.top && global.top.opener) f = scan(global.top.opener); } catch (e) {} }
    return f;
  }

  /* ------------------------------- stub ---------------------------------- */
  function makeStub() {
    var store = {};
    try {
      var saved = global.localStorage.getItem('nwl-cyber-preview');
      if (saved) store = JSON.parse(saved);
    } catch (e) {}
    function persist() {
      try { global.localStorage.setItem('nwl-cyber-preview', JSON.stringify(store)); } catch (e) {}
    }
    return {
      LMSInitialize: function () { return 'true'; },
      LMSFinish: function () { persist(); return 'true'; },
      LMSGetValue: function (k) {
        if (k === 'cmi.core.student_name') return 'Preview Mode';
        return store[k] === undefined ? '' : store[k];
      },
      LMSSetValue: function (k, v) { store[k] = String(v); return 'true'; },
      LMSCommit: function () { persist(); return 'true'; },
      LMSGetLastError: function () { return '0'; },
      LMSGetErrorString: function () { return 'No error'; }
    };
  }

  /* ------------------------- time formatting ----------------------------- */
  function pad(n, w) { n = String(Math.floor(n)); while (n.length < (w || 2)) n = '0' + n; return n; }

  function cmiTime12(ms) {                       /* HHHH:MM:SS.SS */
    var t = Math.max(0, ms) / 1000;
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return pad(h,4) + ':' + pad(m) + ':' + pad(Math.floor(s)) + '.' + pad(Math.round((s % 1) * 100));
  }
  function cmiTime2004(ms) {                     /* ISO 8601 duration */
    var t = Math.max(0, ms) / 1000;
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.round((t % 60) * 100) / 100;
    return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + s + 'S';
  }
  function clockOfDay(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + clockOfDay(d);
  }

  /* ------------------------------ bridge --------------------------------- */
  var S = {
    connected: false, real: false, version: '1.2',
    learnerName: '', learnerId: '', mode: 'normal',
    entry: '', started: 0, finished: false, lastError: '',
    interactionIndex: 0
  };

  var api = null, fn = MAP['1.2'], key = K['1.2'], dirty = false, lastCommit = 0;

  function call(name, a, b) {
    if (!api || typeof api[name] !== 'function') return '';
    try {
      var r = (b === undefined) ? api[name](a === undefined ? '' : a) : api[name](a, b);
      var code = api[fn.err] ? api[fn.err]() : '0';
      if (code && code !== '0') {
        S.lastError = code + ': ' + (api[fn.errStr] ? api[fn.errStr](code) : '');
      }
      return (r === undefined || r === null) ? '' : String(r);
    } catch (e) { S.lastError = e.message; return ''; }
  }

  S.init = function () {
    var found = discover();
    if (found) { api = found.api; S.version = found.v; S.real = true; }
    else       { api = makeStub(); S.version = '1.2'; S.real = false; }

    fn = MAP[S.version]; key = K[S.version];

    var ok = call(fn.init, '');
    S.connected = (ok === 'true' || ok === '1');
    if (!S.connected && S.real) {
      /* some LMSs return "" from Initialize but are still usable — probe */
      var probe = call(fn.get, key.name);
      S.connected = (String(S.lastError).indexOf('301') === -1 && probe !== '');
    }

    S.started     = Date.now();
    S.learnerName = call(fn.get, key.name) || '';
    S.learnerId   = call(fn.get, key.id) || '';
    S.entry       = call(fn.get, key.entry) || '';
    S.mode        = call(fn.get, key.mode) || 'normal';

    /* mark it started immediately so a drop-out is not left "not attempted" */
    if (!S.readOnly()) {
      var cur = call(fn.get, key.status);
      if (!cur || cur === 'not attempted' || cur === 'unknown' || cur === 'not_attempted') {
        S.set(key.status, 'incomplete');
      }
      S.set(key.min, '0'); S.set(key.max, '100');
      S.commit(true);
    }
    return S.connected;
  };

  S.get = function (k) { return call(fn.get, k); };
  S.set = function (k, v) { dirty = true; return call(fn.set, k, String(v)) === 'true'; };

  S.commit = function (force) {
    if (!dirty && !force) return;
    var now = Date.now();
    if (!force && now - lastCommit < 2500) return;     /* throttle chatty LMSs */
    call(fn.commit, ''); dirty = false; lastCommit = now;
  };

  /* --------------------------- course-level API --------------------------- */
  S.readOnly = function () { return S.mode === 'review' || S.mode === 'browse'; };
  S.isResume = function () { return S.entry === 'resume'; };

  S.loadSuspend = function () {
    var raw = call(fn.get, key.suspend);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  };

  S.saveSuspend = function (obj, location) {
    if (S.readOnly()) return;
    var s = JSON.stringify(obj);
    var cap = S.version === '1.2' ? 4000 : 63000;      /* 1.2 hard limit is 4096 */
    if (s.length > cap) s = s.slice(0, cap);
    S.set(key.suspend, s);
    if (location !== undefined) S.set(key.location, String(location).slice(0, 250));
    S.commit();
  };

  S.saveScore = function (pct) {
    if (S.readOnly()) return;
    S.set(key.raw, String(pct));
    S.set(key.max, '100');
    S.set(key.min, '0');
    if (S.version === '2004') S.set('cmi.score.scaled', String(Math.round(pct) / 100));
    S.commit();
  };

  S.saveProgress = function (frac) {
    if (S.version === '2004' && !S.readOnly()) {
      S.set('cmi.progress_measure', String(Math.round(frac * 100) / 100));
    }
  };

  S.complete = function (pct, passed) {
    if (S.readOnly()) return;
    S.saveScore(pct);
    if (S.version === '1.2') {
      S.set(key.status, passed ? 'passed' : 'failed');
    } else {
      S.set('cmi.completion_status', 'completed');
      S.set('cmi.success_status', passed ? 'passed' : 'failed');
      S.set('cmi.progress_measure', '1');
    }
    S.commit(true);
  };

  /* one interaction per decision — this is what makes LMS reporting useful */
  S.interaction = function (o) {
    if (S.readOnly()) return;
    var n = S.interactionIndex++, p = 'cmi.interactions.' + n + '.';
    var id = String(o.id).replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 250);
    S.set(p + 'id', id);
    S.set(p + 'type', 'choice');
    S.set(p + 'weighting', '10');
    if (S.version === '1.2') {
      S.set(p + 'student_response', o.response);
      S.set(p + 'result', o.pts >= 10 ? 'correct' : (o.pts > 0 ? 'neutral' : 'wrong'));
      S.set(p + 'time', clockOfDay(new Date()));
    } else {
      S.set(p + 'description', String(o.text || '').slice(0, 250));
      S.set(p + 'learner_response', o.response);
      S.set(p + 'result', o.pts >= 10 ? 'correct' : (o.pts > 0 ? 'neutral' : 'incorrect'));
      S.set(p + 'timestamp', iso(new Date()));
    }
    if (o.correct) S.set(p + 'correct_responses.0.pattern', o.correct);
    S.commit();
  };

  S.finish = function (suspending) {
    if (S.finished) return;
    S.finished = true;
    if (!S.readOnly()) {
      S.set(key.exit, suspending ? 'suspend' : '');
      S.set(key.time, S.version === '1.2'
        ? cmiTime12(Date.now() - S.started)
        : cmiTime2004(Date.now() - S.started));
    }
    S.commit(true);
    call(fn.fin, '');
  };

  /* the learner will close the tab; make sure the session is not lost */
  function bye() { try { S.finish(true); } catch (e) {} }
  global.addEventListener('beforeunload', bye);
  global.addEventListener('pagehide', bye);
  global.addEventListener('unload', bye);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { try { S.commit(true); } catch (e) {} }
  });

  global.SCORM = S;
})(window);
