/* USB Drop Attack simulation. Fully local, fully simulated. */
(function () {
  'use strict';
  var STAGES = [['discovery', 'Discovery'], ['decision', 'Decision'], ['alert', 'Detection'], ['response', 'Response'], ['debrief', 'Debrief']];
  var root = document.getElementById('stage'), bar = document.getElementById('progress'),
      chip = document.getElementById('scorechip'), modeEl = document.getElementById('mode'),
      threeViewport = document.getElementById('canvas-container');
  var S, leakInterval = null;

  function fresh() {
    return { stage: 'discovery', pts: { d: 0, r: 0, a: 0 }, log: [], choice: 0, connected: false, fileOpened: false,
      al: { disc: 0, ign: 0, open: 0, rep: 0 }, msg: '', seenAlert: false, step: 'check', checked: [], checkDone: false,
      form: { t: '', d: '', a: '' }, reportDone: false, id: '', chatResponses: [],
      proofViewerOpened: false, proofInspected: [], trapClicks: [], completionReported: false };
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function total() { return clamp(40 + S.pts.d + S.pts.r + S.pts.a, 0, 100); }
  function add(c, n, why) { S.pts[c] += n; S.log.push({ w: why, n: n }); }
  function save(commit) {
    SCORM.set('cmi.core.lesson_location', S.stage);
    SCORM.set('cmi.suspend_data', JSON.stringify(S));
    if (commit) SCORM.commit();
  }
  function go(stage) {
    S.stage = stage;
    if (stage === 'alert') S.seenAlert = true;
    if (stage === 'debrief') complete();
    save(true); render(); window.scrollTo(0, 0);
  }
  function complete() {
    SCORM.set('cmi.core.score.min', 0);
    SCORM.set('cmi.core.score.max', 100);
    SCORM.set('cmi.core.score.raw', total());
    SCORM.set('cmi.core.lesson_status', 'completed');
    if (!S.completionReported) {
      S.completionReported = true;
      reportInteractionToSCORM('course_completion', 'debrief_reached', true);
    }
  }

  function handleTrappedClick(actionName) {
    if (!Array.isArray(S.trapClicks)) S.trapClicks = [];
    if (S.trapClicks.indexOf(actionName) !== -1) return;
    S.trapClicks.push(actionName);
    reportInteractionToSCORM('trap_' + actionName, 'clicked', false);
    save(true);
  }

  /* ---------- graphics (local inline SVG) ---------- */
  function usbSvg(w, big) {
    return '<svg viewBox="0 0 220 110" width="' + w + '" role="img" aria-label="USB flash drive labelled 2026_PAYROLL">' +
      '<rect x="4" y="34" width="52" height="42" fill="#c9d3e6"/><rect x="14" y="44" width="12" height="8" fill="#0a1224"/><rect x="14" y="58" width="12" height="8" fill="#0a1224"/>' +
      '<rect x="56" y="24" width="150" height="62" rx="12" fill="#2b4a8f"/><rect x="56" y="24" width="150" height="14" rx="7" fill="#3a5eb0"/>' +
      '<circle cx="190" cy="66" r="5" fill="#ffb43b"/>' +
      (big ? '<rect x="70" y="42" width="100" height="34" rx="4" fill="#f3e9b8"/><text x="120" y="56" text-anchor="middle" font-size="9" font-weight="700" fill="#5a1620" font-family="Arial">2026_PAYROLL</text><text x="120" y="69" text-anchor="middle" font-size="6.5" fill="#5a1620" font-family="Arial">CONFIDENTIAL SALARY DATA</text>' : '') +
      '</svg>';
  }
  function officeSvg() {
    return '<svg viewBox="0 0 640 360" role="img" aria-label="Office with a workstation and a USB drive on the floor">' +
      '<rect width="640" height="360" fill="#0d1830"/><rect y="250" width="640" height="110" fill="#101f3d"/>' +
      '<rect x="40" y="40" width="120" height="150" fill="#13244a" stroke="#243761"/><text x="100" y="120" text-anchor="middle" fill="#6d84b8" font-size="14" font-family="Arial">Finance Wing</text>' +
      '<rect x="230" y="190" width="300" height="14" rx="3" fill="#2a3f70"/><rect x="250" y="204" width="10" height="70" fill="#22335a"/><rect x="500" y="204" width="10" height="70" fill="#22335a"/>' +
      '<rect x="320" y="110" width="140" height="82" rx="6" fill="#0a1224" stroke="#6ea8ff" stroke-width="2"/><rect x="330" y="120" width="120" height="62" fill="#16305f"/>' +
      '<rect x="380" y="192" width="20" height="8" fill="#22335a"/><rect x="270" y="176" width="70" height="12" rx="3" fill="#1c2c52"/>' +
      '<rect x="540" y="196" width="30" height="50" rx="4" fill="#1d3b3a"/><circle cx="555" cy="186" r="22" fill="#256a55"/>' +
      '<rect x="120" y="230" width="60" height="50" rx="10" fill="#1b2b52"/>' +
      '<g transform="translate(365 262) scale(.62)">' + usbSvg(220, false).replace(/<svg[^>]*>/, '').replace('</svg>', '') + '</g>' +
      '</svg>';
  }

  /* ---------- content ---------- */
  var CH = [
    { id: 1, t: 'Plug the USB into the computer' },
    { id: 2, t: 'Open the files directly' },
    { id: 3, t: 'Give the USB to IT/Security' },
    { id: 4, t: 'Take it home' },
    { id: 5, t: 'Ignore it and report the incident' }
  ];
  var FB = {
    1: ['bad', 'Unsafe: connecting an unknown device', 'Plugging an unknown USB into a work computer is exactly what an attacker hopes for. A device can pretend to be a keyboard or carry hidden programs. In this simulation nothing real was connected, but your endpoint security noticed.', 'SIMULATION: An unknown removable device has been connected.'],
    2: ['bad', 'Unsafe: opening files from unknown media', 'You cannot open files without connecting the drive, and opening them is the second mistake. A file named like payroll data is bait that invites a click. Nothing real ran here.', 'SIMULATION: An unknown removable device has been connected.'],
    3: ['good', 'Correct.', 'Correct. Unknown removable media should not be connected to an organizational device. Report it according to your organization\'s security procedure.', ''],
    4: ['bad', 'Unsafe: taking it home', 'Your home computer is not safer, and it may hold work data or credentials. Attackers also count on curious people carrying devices out of the building. Unknown media should go to Security, not into your bag.', ''],
    5: ['good', 'Good instinct.', 'Not touching the drive and reporting it is safe. Better still, hand it to IT/Security rather than leaving it unattended so it can be examined in a controlled way.', '']
  };
  var ITEMS = [
    { id: 'c1', ok: 1, t: 'Stop interacting with the USB', d: 'Do not click, browse or run anything.' },
    { id: 'w1', ok: 0, t: 'Plug it into a personal laptop to see what is on it', d: 'Moves the risk somewhere else.' },
    { id: 'c2', ok: 1, t: 'Disconnect or isolate the workstation if your procedure requires it', d: 'Limits spread while Security decides next steps.' },
    { id: 'c3', ok: 1, t: 'Contact IT/Security right away', d: 'Use the official reporting channel.' },
    { id: 'w2', ok: 0, t: 'Delete the files yourself and keep working', d: 'Destroys evidence and may not remove the threat.' },
    { id: 'c4', ok: 1, t: 'Report what happened: when, where and what you did', d: 'Honest details help responders most.' },
    { id: 'w3', ok: 0, t: 'Ask a coworker to try it on their computer', d: 'Puts another person and device at risk.' },
    { id: 'c5', ok: 1, t: 'Leave investigation and cleanup to authorized staff', d: 'Do not try to remove malware yourself.' }
  ];

  /* ---------- chrome ---------- */
  function drawChrome() {
    var idx = 0, i;
    for (i = 0; i < STAGES.length; i++) if (STAGES[i][0] === S.stage) idx = i;
    bar.innerHTML = STAGES.map(function (s, i) {
      var c = i < idx ? 'done' : (i === idx ? 'now' : '');
      if (s[0] === 'alert' && i < idx && !S.seenAlert) c = 'skip';
      return '<div class="pip ' + c + '"><i></i><span>' + s[1] + (c === 'skip' ? ' (not triggered)' : '') + '</span></div>';
    }).join('');
    chip.textContent = 'Score ' + total();
    var m = SCORM.mode();
    modeEl.textContent = m === 'lms' ? 'SCORM 1.2: LMS connected' : 'SCORM 1.2: local development mode';
  }

  /* ---------- stages ---------- */
  function vDiscovery() {
    return '<h1>Monday morning. You arrive at the office.</h1><p class="mute">Something on the floor near a workstation catches your eye. Look around and click what looks out of place.</p>' +
      '<div class="scene">' + officeSvg() + '<button class="usbhit" data-act="find" aria-label="Inspect the USB drive on the floor"></button><div class="hint">Click the highlighted object</div></div>' +
      '<div id="three-viewport-slot"></div>';
  }
  function vDecision() {
    var c = S.choice, f = c ? FB[c] : null;
    var list = CH.map(function (x) {
      return '<button class="choice' + (c === x.id ? ' sel' : '') + '" data-act="pick" data-v="' + x.id + '"' + (c ? ' disabled' : '') + '><span class="n">' + x.id + '</span>' + x.t + '</button>';
    }).join('');
    var out = '';
    if (f) {
      var next = (c === 1 || c === 2) ? 'Continue: see what happens' : 'Continue to incident response';
      out = (f[3] ? '<div class="note warn"><b>' + f[3] + '</b>Nothing real happened. This is a simulated event.</div>' : '') +
        '<div class="note ' + f[0] + '"><b>' + f[1] + '</b>' + f[2] + '</div><div class="row"><button class="btn primary" data-act="next1">' + next + '</button></div>';
    }
    return '<h1>You found an unknown USB device. What do you do?</h1><div class="grid2"><div class="card usbcard">' + usbSvg(300, true) +
      '<p class="mute">Found on the floor, no owner, and a label built to make you curious.</p></div><div><div class="choices">' + list + '</div></div></div>' +
      '<div style="margin-top:14px">' + out + '</div>';
  }
  function consoleLines() {
    var L = ['<div>[sim] endpoint agent: removable media event</div>', '<div class="w">[sim] device class: unknown, vendor unverified</div>'];
    L.push('<div class="w">[sim] autorun.inf pattern flagged</div>');
    L.push('<div class="e">[sim] unsigned executable: Payroll_2026.exe</div>');
    if (S.al.ign) L.push('<div class="e">[sim] alert dismissed, process still active</div>');
    if (S.al.open) L.push('<div class="e">[sim] file open attempt: payload would launch (nothing ran)</div>');
    if (S.al.disc) L.push('<div>[sim] device disconnected, activity stopped</div>');
    if (S.al.rep) L.push('<div>[sim] incident ticket opened with Security</div>');
    return L.join('');
  }
  function vAlert() {
    var a = S.al, cool = a.disc, ready = a.disc || a.rep;
    var exposure = cool ? '<div class="victim-card"><div><b>Finance workstation</b><span class="mute">Simulated exposure status</span></div><span class="status cool">EXPOSURE STOPPED</span></div>' :
      (S.leakReleased ? '<div class="victim-card"><div><b>Finance workstation</b><span class="mute">Simulated exposure status</span></div><span id="leak-countdown" class="status status-leaked">DATA RELEASED</span></div>' :
      '<div class="victim-card"><div><b>Finance workstation</b><span class="mute">Simulated exposure status</span></div><span id="leak-countdown" class="status hot" aria-live="polite">Starting countdown…</span></div>');
    return '<h1>Your endpoint security responds</h1><p class="mute">This is a fake security console. Choose what to do about the alert.</p>' +
      '<div class="win"><div class="bar"><span>EndpointGuard (simulation)</span><span class="status ' + (cool ? 'cool' : 'hot') + '">' + (cool ? 'Device disconnected' : 'Threat active') + '</span></div><div class="body">' +
      exposure + '<div class="row proof-action"><button class="btn" type="button" data-act="openPortal">View Simulated Disclosure Portal</button><button class="btn" type="button" data-act="viewProof">View Proof Sample</button></div>' +
      '<div class="alerthead"><img src="assets/icons/alert.svg" alt=""><div><h2>SECURITY ALERT</h2><span class="mute">Unknown removable media detected</span></div></div>' +
      '<div class="grid2"><div><h3>Risk indicators</h3><ul class="risks"><li>Unknown device</li><li>Unverified executable</li><li>Suspicious autorun behavior</li><li>Untrusted source</li></ul>' +
      '<div class="row" style="margin-top:0"><button class="btn ok" data-act="al" data-v="disc">Disconnect Device</button><button class="btn danger" data-act="al" data-v="ign">Ignore Alert</button>' +
      '<button class="btn danger" data-act="al" data-v="open">Open File</button><button class="btn ok" data-act="al" data-v="rep">Report Incident</button></div></div>' +
      '<div><h3>Activity log</h3><div class="console" aria-live="polite">' + consoleLines() + '</div></div></div></div></div>' +
      (S.msg ? '<div class="note ' + (S.msgKind || 'warn') + '"><b>' + S.msgHead + '</b>' + S.msg + '</div>' : '') +
      (ready ? '<div class="row"><button class="btn primary" data-act="toResp">Continue to incident response</button></div>' : '<p class="mute" style="margin-top:12px">Pick an action to continue. You can try more than one.</p>');
  }
  var ALM = {
    disc: ['good', 'Good.', 'The device is disconnected in the simulation, which stops further activity. You still need to tell Security.'],
    ign: ['bad', 'Alert ignored: threat still active.', 'Dismissing the alert does not stop the simulated process, which keeps running. Alerts exist so you act, not so you click them away.'],
    open: ['bad', 'SIMULATION: Payroll_2026.exe would have launched a payload.', 'Nothing ran on your device. In a real attack, opening the file could install malware or steal data. Disconnect and report instead.'],
    rep: ['good', 'Good call.', 'Security now has a ticket (simulated). Also disconnect the device if your procedure says so, and do not touch the drive again.']
  };
  function vResp() {
    if (S.step === 'report') return vReport();
    var done = S.checkDone;
    var items = ITEMS.map(function (it) {
      var on = S.checked.indexOf(it.id) > -1, cls = 'item';
      if (done) cls += on ? (it.ok ? ' on ok' : ' on bad') : (it.ok ? ' miss' : '');
      else if (on) cls += ' on';
      var mark = done ? (on ? (it.ok ? '\u2713' : '\u2717') : (it.ok ? '!' : '')) : (on ? '\u2713' : '');
      return '<button class="' + cls + '" data-act="tog" data-v="' + it.id + '"' + (done ? ' disabled' : '') + ' aria-pressed="' + on + '"><span class="box">' + mark + '</span><span>' + it.t + '<small>' + it.d + '</small></span></button>';
    }).join('');
    var wrong = 0; ITEMS.forEach(function (it) { if ((S.checked.indexOf(it.id) > -1) !== !!it.ok) wrong++; });
    var res = done ? '<div class="note ' + (wrong ? 'warn' : 'good') + '"><b>' + (wrong ? 'Close: ' + wrong + ' to review.' : 'Perfect plan.') + '</b>' +
      (wrong ? 'Green ticks were right, red crosses should not be done, and "!" marks steps you missed. ' : '') +
      'The right response: stop interacting, isolate if required, contact IT/Security, report what happened, and leave cleanup to authorized staff.</div><div class="row"><button class="btn primary" data-act="toReport">Continue to incident report</button></div>' :
      '<div class="row"><button class="btn primary" data-act="chk"' + (S.checked.length ? '' : ' disabled') + '>Check my plan</button></div>';
    return '<h1>Incident response</h1><p class="mute">Select every step you would take now. Some choices are traps.</p>' +
      (S.choice === 4 ? '<div class="note warn"><b>Tip</b>You took the drive home, so tell Security exactly where it has been.</div>' : '') +
      '<div class="check">' + items + '</div>' + res;
  }
  var OPT = {
    t: ['USB Drop Attack', 'Phishing email', 'Lost laptop'],
    d: ['Employee workstation', 'Company server', 'Mobile phone'],
    a: ['Reported to Security', 'Ignored the alert', 'Took device home']
  };
  function sel(id, key, disabled) {
    return '<select id="' + id + '"' + (disabled ? ' disabled' : '') + '><option value="">Choose...</option>' + OPT[key].map(function (o) {
      return '<option' + (S.form[key] === o ? ' selected' : '') + '>' + o + '</option>';
    }).join('') + '</select>';
  }
  function vReport() {
    var d = S.reportDone;
    var tail = d ? '<div class="note ' + (S.reportWrong ? 'warn' : 'good') + '"><b>Report submitted (simulated). Ticket ' + S.id + '</b>' +
      (S.reportWrong ? 'Some fields did not match this incident. Expected: USB Drop Attack, Employee workstation, Reported to Security. Accurate reports help Security respond faster.' : 'Accurate and complete. Security can act on this.') +
      '</div><div class="row"><button class="btn primary" data-act="toDebrief">See debrief</button></div>' :
      '<div class="row"><button class="btn primary" data-act="submit">Submit report</button></div>';
    return '<h1>Incident report</h1><p class="mute">Fill in the report. No personal information is needed.</p><div class="card form">' +
      '<label>Incident type' + sel('f-t', 't', d) + '</label><label>Device' + sel('f-d', 'd', d) + '</label><label>Action taken' + sel('f-a', 'a', d) + '</label>' +
      '<label>Notes (optional)<textarea id="f-n" placeholder="What did you see, and when? Leave out names and personal details."' + (d ? ' disabled' : '') + '></textarea></label></div>' + tail;
  }
  function meter(label, v, max) {
    var p = Math.round(clamp(v / max, 0, 1) * 100), w = p >= 85 ? 'Strong' : (p >= 50 ? 'Developing' : 'Needs practice');
    return '<div class="meter"><div class="lab"><span>' + label + '</span><span>' + w + '</span></div><div class="track"><div class="fill" style="width:' + p + '%"></div></div></div>';
  }
  function vDebrief() {
    var sc = total(), C = 2 * Math.PI * 50, off = C * (1 - sc / 100);
    var rev = S.review ? '<div class="card" style="margin-top:14px"><h3>What happened</h3><ul class="tl">' + S.log.map(function (e) {
      return '<li><span>' + e.w + '</span><span class="' + (e.n >= 0 ? 'p' : 'm') + '">' + (e.n >= 0 ? '+' : '') + e.n + '</span></li>';
    }).join('') + '</ul><p class="mute" style="margin-top:10px">Score = 40 starting points plus the changes above (limited to 0 to 100).</p></div>' : '';
    return '<div class="hero"><svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Score ' + sc + ' out of 100"><circle cx="60" cy="60" r="50" fill="none" stroke="#243761" stroke-width="10"/>' +
      '<circle cx="60" cy="60" r="50" fill="none" stroke="#6ea8ff" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
      '<text x="60" y="66" text-anchor="middle" font-size="26" font-weight="700" fill="#e6edf9" font-family="Arial">' + sc + '</text></svg>' +
      '<div><h1>USB Drop Attack Detected</h1><p>An attacker may deliberately leave a USB device where someone is likely to find it. The goal is to convince the person to connect the device and interact with potentially malicious content.</p></div></div>' +
      '<div class="grid2"><div class="card"><h2>Your results</h2>' + meter('Decision quality', S.pts.d, 20) + meter('Incident response', S.pts.r, 20) + meter('Security awareness', S.pts.a, 20) +
      '<p class="mute">Final simulation score: <b>' + sc + ' / 100</b>. Your score has been saved.</p></div>' +
      '<div class="card"><h2>Key rules</h2><ul class="rules"><li>Never connect an unknown USB device to an organizational computer.</li><li>Do not open files from an unknown USB.</li><li>Do not take unknown devices home.</li><li>Report suspicious removable media to IT/Security.</li><li>Follow your organization\'s removable-media policy.</li></ul></div></div>' +
      '<div class="row"><button class="btn primary" data-act="retry">Try Again</button><button class="btn" data-act="review" aria-expanded="' + !!S.review + '">Review What Happened</button></div>' + rev;
  }

  function render() {
    var v = { discovery: vDiscovery, decision: vDecision, alert: vAlert, response: vResp, debrief: vDebrief }[S.stage]();
    root.innerHTML = v; drawChrome();
    var viewportSlot = document.getElementById('three-viewport-slot');
    if (threeViewport) {
      if (viewportSlot) {
        threeViewport.hidden = false;
        viewportSlot.appendChild(threeViewport);
      } else {
        threeViewport.hidden = true;
      }
    }
    if (S.stage === 'alert' && !S.al.disc && !S.leakReleased && S.leakDeadline) {
      startLeakCountdown('leak-countdown', S.leakDeadline);
    }
  }

  function startLeakCountdown(elementId, targetDate) {
    var timerElement = document.getElementById(elementId);
    if (!timerElement) return;
    function tick() {
      if (S.al.disc) {
        if (leakInterval) { clearInterval(leakInterval); leakInterval = null; }
        return;
      }
      var distance = targetDate - Date.now();
      if (distance <= 0) {
        if (leakInterval) { clearInterval(leakInterval); leakInterval = null; }
        S.leakReleased = true;
        var countdown = document.getElementById(elementId);
        if (countdown) {
          countdown.textContent = 'DATA RELEASED';
          countdown.classList.remove('hot');
          countdown.classList.add('status-leaked');
        }
        var portalTimer = document.getElementById('timer-1');
        if (portalTimer) portalTimer.textContent = 'DATA RELEASED';
        var portalBadge = document.getElementById('portal-badge');
        if (portalBadge) { portalBadge.textContent = 'SIMULATED DATA RELEASED'; portalBadge.className = 'badge released'; }
        save(true);
        return;
      }
      var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      var seconds = Math.floor((distance % (1000 * 60)) / 1000);
      var value = hours + 'h ' + minutes + 'm ' + seconds + 's';
      var countdown = document.getElementById(elementId);
      if (countdown) countdown.textContent = value;
      var portalTimer = document.getElementById('timer-1');
      if (portalTimer) portalTimer.textContent = value;
    }
    if (leakInterval) clearInterval(leakInterval);
    tick();
    if (!S.leakReleased) leakInterval = setInterval(tick, 1000);
  }

  /* ---------- actions ---------- */
  var A = {
    find: function () {
      reportInteractionToSCORM('usb_discovery', 'inspect_usb', true);
      go('decision');
    },
    pick: function (v) {
      if (S.choice) return; v = +v; S.choice = v;
      reportInteractionToSCORM('usb_decision', String(v), v === 3 || v === 5);
      if (v === 1) { S.connected = true; add('d', -10, 'Connected an unknown USB to a workstation'); }
      if (v === 2) { S.connected = true; S.fileOpened = true; add('d', -20, 'Tried to open files from an unknown USB'); }
      if (v === 3) add('d', 20, 'Handed the USB to IT/Security');
      if (v === 4) add('d', -10, 'Took an unknown USB home');
      if (v === 5) add('d', 20, 'Left it untouched and reported the incident');
      save(true); render();
    },
    next1: function () {
      if (S.connected && !S.leakDeadline) S.leakDeadline = Date.now() + 2 * 60 * 1000;
      go(S.connected ? 'alert' : 'response');
    },
    al: function (k) {
      var firstAction = !S.al[k];
      if (k === 'disc' && !S.al.disc) { S.al.disc = 1; add('r', 5, 'Disconnected the device'); }
      if (k === 'rep' && !S.al.rep) { S.al.rep = 1; add('r', 5, 'Reported from the alert'); }
      if (k === 'ign' && !S.al.ign) { S.al.ign = 1; add('r', -10, 'Ignored the security alert'); }
      if (k === 'open' && !S.al.open) { S.al.open = 1; S.fileOpened = true; add('r', -20, 'Opened a suspicious file'); }
      if (firstAction) reportInteractionToSCORM('endpoint_' + k, k, k === 'disc' || k === 'rep');
      var m = ALM[k]; S.msgKind = m[0]; S.msgHead = m[1]; S.msg = m[2]; save(true); render();
    },
    toResp: function () { go('response'); },
    tog: function (v) {
      if (S.checkDone) return; var i = S.checked.indexOf(v);
      if (i > -1) S.checked.splice(i, 1); else S.checked.push(v);
      render();
    },
    chk: function () {
      if (S.checkDone || !S.checked.length) return; var wrong = 0;
      ITEMS.forEach(function (it) { if ((S.checked.indexOf(it.id) > -1) !== !!it.ok) wrong++; });
      S.checkDone = true; add('a', clamp(20 - 5 * wrong, 0, 20), wrong ? 'Response plan: ' + wrong + ' step(s) to review' : 'Chose the correct response steps');
      reportInteractionToSCORM('response_plan', S.checked.slice().sort().join(',') || 'none', wrong === 0);
      save(true); render();
    },
    toReport: function () { S.step = 'report'; save(true); render(); },
    submit: function () {
      if (S.reportDone) return;
      var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
      S.form = { t: g('f-t'), d: g('f-d'), a: g('f-a') };
      var wrong = (S.form.t !== OPT.t[0]) + (S.form.d !== OPT.d[0]) + (S.form.a !== OPT.a[0]);
      S.reportWrong = wrong; S.reportDone = true; S.id = 'INC-SIM-' + String(Date.now() % 100000);
      reportInteractionToSCORM('incident_report', 'type:' + (S.form.t === OPT.t[0] ? 'usb_attack' : 'other') +
        '|device:' + (S.form.d === OPT.d[0] ? 'workstation' : 'other') +
        '|action:' + (S.form.a === OPT.a[0] ? 'reported' : 'other'), wrong === 0);
      add('r', clamp(20 - 10 * wrong, 0, 20), wrong ? 'Incident report submitted with ' + wrong + ' inaccurate field(s)' : 'Submitted an accurate incident report');
      save(true); render();
    },
    toDebrief: function () { go('debrief'); },
    review: function () { S.review = !S.review; render(); },
    retry: function () {
      if (leakInterval) { clearInterval(leakInterval); leakInterval = null; }
      S = fresh(); SCORM.reopen(); save(true); render(); window.scrollTo(0, 0);
    },
    viewProof: openProofModal,
    openPortal: openPortal
  };
  root.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    var fn = A[b.dataset.act]; if (fn) fn(b.dataset.v);
  });

  var fileModal = document.getElementById('file-modal');
  var modalPanel = fileModal.querySelector('.modal-content');
  var previewBox = document.getElementById('file-preview-box');
  var lastModalTrigger = null;
  var leakPortal = document.getElementById('leak-portal');
  var portalPanel = leakPortal.querySelector('.portal-content');
  var torrentModal = document.getElementById('torrent-modal');
  var torrentPanel = torrentModal.querySelector('.torrent-content');
  var lastPortalTrigger = null;
  var lastTorrentTrigger = null;
  var proofSamples = {
    salaries: ['Executive_Salaries.csv', 'Redacted CSV sample', 'Simulated evidence: salary values and employee identifiers are redacted. No real payroll file was accessed.'],
    passports: ['Executive_Passports.pdf', 'Redacted PDF sample', 'Simulated evidence: document images and passport numbers are omitted. No identity documents were accessed.'],
    database: ['production_db.sql', 'Redacted SQL sample', 'Simulated evidence: table names and record contents are omitted. No production database was accessed.']
  };
  var CHAT_RESPONSES = {
    extension: {
      learner: 'We need more time to analyze this.',
      operator: '[Operator]: The deadline remains. We will publish the files.',
      coach: 'This models artificial urgency. Employees should stop the conversation and escalate through the organization’s incident-response process.'
    },
    proof: {
      learner: 'Send proof of decryption.',
      operator: '[Operator]: We can provide a sample, but you cannot verify its scope here.',
      coach: 'A sample does not establish what was accessed. Do not open links or files from an attacker; let authorized responders preserve and assess evidence.'
    },
    escalate: {
      learner: 'I’m ending this chat and notifying our incident-response team.',
      operator: '[Operator]: Your organization must decide how to respond.',
      coach: 'Good response. Preserve the message according to policy, avoid sharing internal details, and notify the designated incident-response team.'
    }
  };
  function addChatMessage(kind, label, text) {
    var box = document.getElementById('chat-box');
    if (!box) return;
    var message = document.createElement('div');
    message.className = 'message ' + kind;
    var heading = document.createElement('strong');
    heading.textContent = label;
    message.appendChild(heading);
    message.appendChild(document.createTextNode(text));
    box.appendChild(message);
    box.scrollTop = box.scrollHeight;
  }
  function renderChat() {
    var box = document.getElementById('chat-box');
    if (!box) return;
    while (box.children.length > 1) box.removeChild(box.lastChild);
    (S.chatResponses || []).forEach(function (choice) {
      var response = CHAT_RESPONSES[choice];
      if (!response) return;
      addChatMessage('learner', '[You]:', response.learner);
      addChatMessage('threat-actor', '[Operator]:', response.operator.replace(/^\[Operator\]:\s*/, ''));
      addChatMessage('coach', 'Training feedback:', response.coach);
    });
    Array.prototype.forEach.call(leakPortal.querySelectorAll('[data-chat-response]'), function (button) {
      button.disabled = (S.chatResponses || []).indexOf(button.dataset.chatResponse) !== -1;
    });
  }
  function sendPresetMessage(choice) {
    var response = CHAT_RESPONSES[choice];
    if (!response || S.chatResponses.indexOf(choice) !== -1) return;
    S.chatResponses.push(choice);
    addChatMessage('learner', '[You]:', response.learner);
    addChatMessage('threat-actor', '[Operator]:', response.operator.replace(/^\[Operator\]:\s*/, ''));
    addChatMessage('coach', 'Training feedback:', response.coach);
    reportInteractionToSCORM('operator_chat_' + choice, choice, choice === 'escalate');
    renderChat();
    save(true);
  }
  function openProofModal() {
    lastModalTrigger = document.activeElement;
    if (!S.proofViewerOpened) {
      S.proofViewerOpened = true;
      reportInteractionToSCORM('proof_viewer_open', 'opened', 'neutral');
      save(true);
    }
    fileModal.hidden = false;
    fileModal.classList.remove('hidden');
    modalPanel.focus();
  }
  function closeProofModal() {
    fileModal.hidden = true;
    fileModal.classList.add('hidden');
    if (lastModalTrigger && lastModalTrigger.isConnected) lastModalTrigger.focus();
  }
  function syncPortalStatus() {
    var badge = document.getElementById('portal-badge');
    var timer = document.getElementById('timer-1');
    if (!badge || !timer) return;
    if (S.al.disc) {
      badge.textContent = 'EXPOSURE STOPPED'; badge.className = 'badge stopped'; timer.textContent = 'STOPPED';
    } else if (S.leakReleased) {
      badge.textContent = 'SIMULATED DATA RELEASED'; badge.className = 'badge released'; timer.textContent = 'DATA RELEASED';
    } else {
      badge.textContent = 'SIMULATED EXPOSURE IN PROGRESS'; badge.className = 'badge';
      if (S.leakDeadline) {
        var remaining = Math.max(0, S.leakDeadline - Date.now());
        var hours = Math.floor((remaining % 86400000) / 3600000);
        var minutes = Math.floor((remaining % 3600000) / 60000);
        var seconds = Math.floor((remaining % 60000) / 1000);
        timer.textContent = remaining ? hours + 'h ' + minutes + 'm ' + seconds + 's' : 'DATA RELEASED';
      }
    }
  }
  function openPortal() {
    lastPortalTrigger = document.activeElement;
    syncPortalStatus();
    leakPortal.hidden = false;
    leakPortal.classList.remove('hidden');
    portalPanel.focus();
  }
  function closePortal() {
    leakPortal.hidden = true;
    leakPortal.classList.add('hidden');
    if (lastPortalTrigger && lastPortalTrigger.isConnected) lastPortalTrigger.focus();
  }
  function openTorrentNotice(trigger) {
    lastTorrentTrigger = trigger || document.activeElement;
    torrentModal.hidden = false;
    torrentModal.classList.remove('hidden');
    torrentPanel.focus();
  }
  function closeTorrentNotice() {
    torrentModal.hidden = true;
    torrentModal.classList.add('hidden');
    if (lastTorrentTrigger && lastTorrentTrigger.isConnected) lastTorrentTrigger.focus();
  }
  leakPortal.addEventListener('click', function (ev) {
    if (ev.target === leakPortal || ev.target.closest('[data-close-portal]')) { closePortal(); return; }
    var action = ev.target.closest('[data-portal-action]');
    if (action) {
      if (action.dataset.portalAction === 'samples') openProofModal();
      if (action.dataset.portalAction === 'torrent') {
        handleTrappedClick('torrent_download');
        openTorrentNotice(action);
      }
      return;
    }
    var chatButton = ev.target.closest('[data-chat-response]');
    if (chatButton && !chatButton.disabled) sendPresetMessage(chatButton.dataset.chatResponse);
  });
  torrentModal.addEventListener('click', function (ev) {
    if (ev.target === torrentModal || ev.target.closest('[data-close-torrent]')) closeTorrentNotice();
  });
  fileModal.addEventListener('click', function (ev) {
    if (ev.target === fileModal || ev.target.closest('[data-close-modal]')) {
      closeProofModal();
      return;
    }
    var fileButton = ev.target.closest('[data-preview]');
    if (!fileButton) return;
    var sample = proofSamples[fileButton.dataset.preview];
    if (!sample) return;
    if (!Array.isArray(S.proofInspected)) S.proofInspected = [];
    if (S.proofInspected.indexOf(fileButton.dataset.preview) === -1) {
      S.proofInspected.push(fileButton.dataset.preview);
      reportInteractionToSCORM('proof_' + fileButton.dataset.preview, 'inspected', 'neutral');
      save(true);
    }
    previewBox.textContent = '';
    var title = document.createElement('strong');
    title.textContent = sample[0];
    var kind = document.createElement('span');
    kind.className = 'preview-kind';
    kind.textContent = sample[1];
    var detail = document.createElement('p');
    detail.textContent = sample[2];
    previewBox.appendChild(title);
    previewBox.appendChild(kind);
    previewBox.appendChild(detail);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!torrentModal.hidden) closeTorrentNotice();
    else if (!fileModal.hidden) closeProofModal();
    else if (!leakPortal.hidden) closePortal();
  });

  /* ---------- start ---------- */
  SCORM.init();
  var st = SCORM.get('cmi.core.lesson_status');
  if (!st || st === 'not attempted' || st === 'unknown') SCORM.set('cmi.core.lesson_status', 'incomplete');
  SCORM.set('cmi.core.score.min', 0); SCORM.set('cmi.core.score.max', 100);
  S = fresh();
  try {
    var sd = JSON.parse(SCORM.get('cmi.suspend_data') || 'null');
    if (sd && sd.pts && sd.stage && sd.stage !== 'debrief') S = sd;
  } catch (e) { S = fresh(); }
  if (!Array.isArray(S.chatResponses)) S.chatResponses = [];
  if (!Array.isArray(S.proofInspected)) S.proofInspected = [];
  if (!Array.isArray(S.trapClicks)) S.trapClicks = [];
  if (typeof S.proofViewerOpened !== 'boolean') S.proofViewerOpened = false;
  if (typeof S.completionReported !== 'boolean') S.completionReported = false;
  renderChat();
  SCORM.commit(); render();
  var closeIt = function () { save(true); SCORM.finish(); };
  window.addEventListener('beforeunload', closeIt);
  window.addEventListener('unload', closeIt);
})();
