/* ===========================================================================
   app.js — course runtime: render loop, picking, scenario flow, scoring
   and everything that talks to the SCORM bridge.
   =========================================================================== */
(function () {
  'use strict';

  var DATA = window.COURSE;
  var MODULES = DATA.stations;          /* a station carries its geometry AND its content */
  function modMax(m) { return m.steps.length * 10; }
  var MAX_PTS = MODULES.reduce(function (t, m) { return t + modMax(m); }, 0);
  var LETTERS = ['a','b','c','d','e'];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    loading:$('loading'), welcome:$('welcome'), begin:$('beginSimulation'),
    settings:$('settingsDialog'), openSettings:$('openSettings'), closeSettings:$('closeSettings'),
    motionToggle:$('motionToggle'), roleIntro:$('roleIntro'), roleContinue:$('roleContinue'),
    storyRail:$('storyRail'), storyContent:$('storyContent'), storyNext:$('storyNext'),
    storyProgressText:$('storyProgressText'), storyProgressBar:$('storyProgressBar'),
    storyPrompt:$('storyPrompt'), usbTarget:$('usbTarget'), usbLabel:$('usbLabel'),
    canvas:$('gl'), labels:$('labels'), glfail:$('glfail'),
    learner:$('learner'), statDone:$('statDone'), statScore:$('statScore'), bar:$('bar'),
    dock:$('dock'), hint:$('hint'),
    modal:$('modal'), mStation:$('mStation'), mStep:$('mStep'), mTitle:$('mTitle'),
    mBody:$('mBody'), mMeta:$('mMeta'), mNext:$('mNext'), mClose:$('mClose'),
    done:$('done'), dTitle:$('dTitle'), dBody:$('dBody'), dMeta:$('dMeta'), dReview:$('dReview')
  };

  /* ------------------------------- state --------------------------------- */
  var state = { v:1, m:{}, c:{}, challenge:0 }; /* m: points per module, c: choice indices */
  var activeStoryIndex = 0;
  var cur = null;                        /* the module currently open */
  var completedOnce = false;

  function moduleScore(id) {
    var a = state.m[id];
    if (!a) return null;
    return a.reduce(function (x, y) { return x + y; }, 0);
  }
  function totalPoints() {
    return MODULES.reduce(function (t, m) { return t + (moduleScore(m.id) || 0); }, 0);
  }
  function doneCount() {
    return MODULES.filter(function (m) { return state.m[m.id]; }).length;
  }
  function percent() { return MAX_PTS ? Math.round(totalPoints() / MAX_PTS * 100) : 0; }

  function byId(id) {
    for (var i = 0; i < MODULES.length; i++) if (MODULES[i].id === id) return MODULES[i];
    return null;
  }
  function bandOf(id) {                  /* drives marker colour, chips and labels */
    var s = moduleScore(id);
    if (s === null) return 'todo';
    var m = byId(id), f = m ? s / modMax(m) : 0;
    if (f >= 0.8) return 'done';                   /* the module pass mark */
    return f >= 0.5 ? 'partial' : 'weak';
  }

  /* ------------------------------ escaping -------------------------------- */
  var ENT = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ENT[c]; }); }
  function fmt(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[\[(.+?)\]\]/g, '<span class="flag">$1</span>');
  }

  /* ============================ 3D VIEW ==================================== */
  var R = null, cam = null, scene = null, running = false;
  var usb = { mesh:null, ring:null, pos:[0.45,0.09,2.85], start:[0.45,0.09,2.85], target:[-0.55,1.04,-2.69], dragging:false };
  var dragChallengeActive = false;
  var pointer = { x:-1, y:-1, inside:false };
  var drag = { on:false, moved:0, lx:0, ly:0, id:null };
  var pinch = { on:false, d0:0, dist0:0 };
  var hovered = null, lastInput = 0, clock = 0, idleMotion = true, started = false;

  function initGL() {
    try { R = new GL.Renderer(el.canvas); } catch (e) { R = null; }
    if (!R || !R.gl) {
      el.canvas.style.display = 'none';
      el.glfail.hidden = false;
      hideLoading();
      return false;
    }
    cam = new GL.Camera();
    var h = DATA.home;
    cam.yaw = cam.yawTo = h.yaw; cam.pitch = cam.pitchTo = h.pitch;
    cam.dist = h.dist + 8; cam.distTo = h.dist;         /* gentle push-in on load */
    cam.tgt = h.tgt.slice(); cam.tgtTo = h.tgt.slice();
    scene = window.Scene.build(R, DATA);
    var usbBuilder = new GL.Builder();
    window.Kit.usbStick(new window.Kit.At(usbBuilder, 0, 0, 0), 0, 0, 0, 0);
    usb.mesh = R.upload(usbBuilder);
    var usbRingBuilder = new GL.Builder();
    usbRingBuilder.ring({ inner:0.42, outer:0.58, y:0.025, color:'#34e0d0', emit:1, seg:36 });
    usb.ring = R.upload(usbRingBuilder);
    buildLabels();
    bindInput();
    running = true;
    requestAnimationFrame(frame);
    return true;
  }

  function goHome() {
    if (!cam) return;
    var h = DATA.home;
    cam.focus(h.tgt, h.yaw, h.pitch, h.dist);
  }

  /* --------------------------- floating labels ---------------------------- */
  var labelEls = [];
  function buildLabels() {
    scene.stations.forEach(function (st, i) {
      var d = document.createElement('div');
      d.className = 'lbl';
      d.innerHTML = '<b>' + esc(st.num + '. ' + st.name) + '</b><span>' + esc(st.tag) + '</span>';
      d.addEventListener('click', function (e) { e.stopPropagation(); openModule(i); });
      el.labels.appendChild(d);
      labelEls.push(d);
    });
  }

  function updateLabels(vp) {
    var w = el.canvas.clientWidth, h = el.canvas.clientHeight;
    /* when the scenario panel is a right-hand rail, don't let markers slide
       under it — clip them at the rail's edge instead */
    var limit = w + 999;
    if (!el.modal.hidden && w >= 900) {
      var sh = el.modal.querySelector('.sheet');
      if (sh) limit = w - sh.offsetWidth - 14;
    }
    scene.stations.forEach(function (st, i) {
      var d = labelEls[i];
      var p = GL.M4.project(vp, [st.pinPos[0], st.pinPos[1] + 0.55, st.pinPos[2]]);
      var sx = (p[0] * 0.5 + 0.5) * w;
      if (!p[3] || p[0] < -1.3 || p[0] > 1.3 || p[1] < -1.3 || p[1] > 1.3 || sx > limit) {
        d.style.opacity = '0'; d.style.pointerEvents = 'none'; return;
      }
      d.style.opacity = '1'; d.style.pointerEvents = 'auto';
      d.style.left = sx.toFixed(1) + 'px';
      d.style.top  = ((-p[1] * 0.5 + 0.5) * h).toFixed(1) + 'px';
      var band = bandOf(MODULES[i].id);
      d.className = 'lbl' + (band === 'todo' ? '' : ' ' + band);
    });
    if (el.usbTarget) {
      var showTarget = dragChallengeActive && state.challenge === 0;
      el.usbTarget.classList.toggle('active', showTarget);
      if (showTarget) {
        var target = GL.M4.project(vp, usb.target);
        if (target[3]) {
          el.usbTarget.style.left = ((target[0] * 0.5 + 0.5) * w).toFixed(1) + 'px';
          el.usbTarget.style.top = ((-target[1] * 0.5 + 0.5) * h).toFixed(1) + 'px';
        }
      }
    }
    if (el.usbLabel) {
      var showUsbLabel = state.challenge === 0;
      el.usbLabel.classList.toggle('visible', showUsbLabel);
      if (showUsbLabel) {
        var usbLabelPoint = GL.M4.project(vp, [usb.pos[0], usb.pos[1] + 0.28, usb.pos[2]]);
        if (usbLabelPoint[3]) {
          el.usbLabel.style.left = ((usbLabelPoint[0] * 0.5 + 0.5) * w).toFixed(1) + 'px';
          el.usbLabel.style.top = ((-usbLabelPoint[1] * 0.5 + 0.5) * h).toFixed(1) + 'px';
        }
      }
    }
  }

  function usbBounds() {
    var b = usb.mesh.aabb, scale = 1.8;
    return {
      min:[b.min[0] * scale + usb.pos[0], b.min[1] * scale + usb.pos[1], b.min[2] * scale + usb.pos[2]],
      max:[b.max[0] * scale + usb.pos[0], b.max[1] * scale + usb.pos[1], b.max[2] * scale + usb.pos[2]]
    };
  }

  function rayAt(clientX, clientY) {
    var rect = el.canvas.getBoundingClientRect();
    var inv = GL.M4.invert(GL.M4.mul(R.proj, cam.view));
    if (!inv) return null;
    return GL.screenRay(clientX - rect.left, clientY - rect.top,
                        el.canvas.clientWidth, el.canvas.clientHeight, inv, cam.eye);
  }

  function moveUsbToPointer(clientX, clientY) {
    var ray = rayAt(clientX, clientY);
    if (!ray || Math.abs(ray.d[1]) < 0.0001) return;
    var t = (usb.start[1] - ray.o[1]) / ray.d[1];
    if (t < 0) return;
    usb.pos[0] = Math.max(-8, Math.min(8, ray.o[0] + ray.d[0] * t));
    usb.pos[1] = usb.start[1];
    usb.pos[2] = Math.max(-6.5, Math.min(6.5, ray.o[2] + ray.d[2] * t));
  }

  function droppedOnComputer(clientX, clientY) {
    var rect = el.canvas.getBoundingClientRect();
    var p = GL.M4.project(GL.M4.mul(R.proj, cam.view), usb.target);
    if (!p[3]) return false;
    var x = (p[0] * 0.5 + 0.5) * el.canvas.clientWidth + rect.left;
    var y = (-p[1] * 0.5 + 0.5) * el.canvas.clientHeight + rect.top;
    return Math.hypot(clientX - x, clientY - y) < 72;
  }

  function completeUsbDrop() {
    state.challenge = 1;
    dragChallengeActive = false;
    usb.pos = usb.target.slice();
    window.SCORM.interaction({
      id:'usb_insert_attempt', text:'What do you do with the unknown USB drive?',
      response:'a', correct:'b', pts:0
    });
    save();
    renderStoryRail();
  }

  /* ------------------------------ input ----------------------------------- */
  function bindInput() {
    var c = el.canvas;

    c.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && drag.on) { return; }
      var ray = rayAt(e.clientX, e.clientY);
      if (dragChallengeActive && state.challenge === 0 && ray && usb.mesh &&
          GL.rayAABB(ray, usbBounds().min, usbBounds().max, 0.18) >= 0) {
        usb.dragging = true; drag.id = e.pointerId;
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
        c.classList.add('usb-dragging');
        lastInput = clock;
        return;
      }
      drag.on = true; drag.moved = 0; drag.lx = e.clientX; drag.ly = e.clientY; drag.id = e.pointerId;
      c.setPointerCapture && c.setPointerCapture(e.pointerId);
      c.classList.add('dragging');
      lastInput = clock; fadeHint();
    });

    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.inside = true;
      if (usb.dragging && e.pointerId === drag.id) {
        moveUsbToPointer(e.clientX, e.clientY);
        lastInput = clock;
        return;
      }
      if (!drag.on || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      drag.lx = e.clientX; drag.ly = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      cam.yawTo -= dx * 0.0062;
      cam.pitchTo = Math.max(cam.minPitch, Math.min(cam.maxPitch, cam.pitchTo + dy * 0.0052));
      lastInput = clock;
    });

    function endDrag(e) {
      if (usb.dragging && e.pointerId === drag.id) {
        usb.dragging = false;
        c.classList.remove('usb-dragging');
        if (droppedOnComputer(e.clientX, e.clientY)) completeUsbDrop();
        else { usb.pos = usb.start.slice(); el.storyPrompt.textContent = 'Try again: drop the drive onto the computer screen.'; }
        lastInput = clock;
        return;
      }
      if (!drag.on) return;
      drag.on = false; c.classList.remove('dragging');
      if (drag.moved < 6) pickAt(pointer.x, pointer.y);
      lastInput = clock;
    }
    c.addEventListener('pointerup', endDrag);
    c.addEventListener('pointercancel', function () {
      drag.on = false; usb.dragging = false;
      c.classList.remove('dragging','usb-dragging');
      if (dragChallengeActive && state.challenge === 0) usb.pos = usb.start.slice();
    });
    c.addEventListener('pointerleave', function () { pointer.inside = false; });

    c.addEventListener('wheel', function (e) {
      e.preventDefault();
      var k = Math.exp((e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0011);
      cam.distTo = Math.max(cam.minDist, Math.min(cam.maxDist, cam.distTo * k));
      lastInput = clock; fadeHint();
    }, { passive:false });

    /* pinch to zoom */
    var touches = {};
    c.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinch.on = true;
        pinch.dist0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                                 e.touches[0].clientY - e.touches[1].clientY);
        pinch.d0 = cam.distTo; drag.on = false;
      }
    }, { passive:true });
    c.addEventListener('touchmove', function (e) {
      if (!pinch.on || e.touches.length !== 2) return;
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                         e.touches[0].clientY - e.touches[1].clientY);
      if (d > 4) cam.distTo = Math.max(cam.minDist, Math.min(cam.maxDist, pinch.d0 * pinch.dist0 / d));
      lastInput = clock;
    }, { passive:true });
    c.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch.on = false; }, { passive:true });

    window.addEventListener('keydown', function (e) {
      if (!el.modal.hidden) {
        if (e.key === 'Escape') closeModal();
        return;
      }
      if (e.key >= '1' && e.key <= '9' && +e.key <= MODULES.length) openModule(+e.key - 1);
      else if (e.key === 'ArrowLeft')  { cam.yawTo += 0.25; lastInput = clock; }
      else if (e.key === 'ArrowRight') { cam.yawTo -= 0.25; lastInput = clock; }
      else if (e.key === 'Home' || e.key === 'h') goHome();
    });
  }

  function fadeHint() { if (el.hint) el.hint.classList.add('gone'); }

  function pickAt(px, py) {
    if (!scene) return;
    var w = el.canvas.clientWidth, h = el.canvas.clientHeight;
    var vp = GL.M4.mul(R.proj, cam.view);
    var inv = GL.M4.invert(vp);
    if (!inv) return;
    var ray = GL.screenRay(px, py, w, h, inv, cam.eye);
    var best = -1, bestD = Infinity;
    scene.stations.forEach(function (st, i) {
      var d = GL.rayAABB(ray, st.mesh.aabb.min, st.mesh.aabb.max, 0.35);
      if (d >= 0 && d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) openModule(best);
  }

  function hoverTest() {
    if (!scene || drag.on || usb.dragging || !pointer.inside || !el.modal.hidden) { hovered = null; return; }
    var w = el.canvas.clientWidth, h = el.canvas.clientHeight;
    var inv = GL.M4.invert(GL.M4.mul(R.proj, cam.view));
    if (!inv) return;
    var ray = GL.screenRay(pointer.x, pointer.y, w, h, inv, cam.eye);
    var best = null, bestD = Infinity;
    scene.stations.forEach(function (st) {
      var d = GL.rayAABB(ray, st.mesh.aabb.min, st.mesh.aabb.max, 0.35);
      if (d >= 0 && d < bestD) { bestD = d; best = st; }
    });
    hovered = best;
    el.canvas.style.cursor = best ? 'pointer' : (drag.on ? 'grabbing' : 'grab');
  }

  /* ---------------------------- render loop -------------------------------- */
  var BAND_COL = {
    todo:   [0.204, 0.878, 0.816],
    done:   [0.227, 0.851, 0.525],
    partial:[0.965, 0.725, 0.231],
    weak:   [1.000, 0.373, 0.427]
  };

  var last = 0;
  var firstFrame = true;
  function frame(t) {
    if (!running) return;
    var dt = Math.min((t - last) / 1000 || 0.016, 0.05);
    last = t; clock += dt;

    var aspect = R.resize();
    R.proj = GL.M4.perspective(50 * Math.PI / 180, aspect, 0.1, 120);

    /* drift slowly when the learner is idle and nothing is open */
    if (idleMotion && el.modal.hidden && el.done.hidden && clock - lastInput > 10) cam.yawTo -= dt * 0.045;

    cam.update(dt);
    hoverTest();

    R.begin(R.proj, cam.view, cam.eye, DATA.env);
    R.draw(scene.staticMesh);

    scene.stations.forEach(function (st, i) {
      var band = bandOf(MODULES[i].id);
      var col = BAND_COL[band];

      st.mesh.tint = [0.20, 0.88, 0.82];
      var want = (hovered === st) ? 0.17 : 0;
      st.mesh.tintAmt += (want - st.mesh.tintAmt) * Math.min(1, dt * 9);
      R.draw(st.mesh);

      /* pin: bob + spin, tinted by state */
      var bob = Math.sin(clock * 1.9 + i) * 0.09;
      st.pin.model = GL.M4.trs([st.pinPos[0], st.pinPos[1] + bob, st.pinPos[2]],
                               [0, clock * 0.9 + i, 0],
                               [1, 1, 1]);
      st.pin.tint = col; st.pin.tintAmt = 1;
      st.pin.opacity = band === 'todo' ? 1 : 0.85;
      R.draw(st.pin);

      /* ring: pulse only while the station is still outstanding */
      var pulse = band === 'todo' ? 1 + Math.sin(clock * 2.1 + i * 0.7) * 0.09 : 1;
      st.ring.model = GL.M4.trs([st.pinPos[0], 0.02, st.pinPos[2]], [0,0,0], [pulse, 1, pulse]);
      st.ring.tint = col; st.ring.tintAmt = 1;
      st.ring.opacity = band === 'todo'
        ? 0.5 + Math.sin(clock * 2.1 + i * 0.7) * 0.22
        : 0.32;
      R.draw(st.ring);
    });

    if (usb.mesh) {
      var usbScale = 1.8;
      if (usb.ring && state.challenge === 0) {
        var pulse = 1 + Math.sin(clock * 2.4) * 0.05;
        usb.ring.model = GL.M4.trs([usb.pos[0],0,usb.pos[2]], [0,0,0], [pulse,pulse,pulse]);
        R.draw(usb.ring);
      }
      usb.mesh.model = GL.M4.trs(usb.pos, [0,0,0], [usbScale,usbScale,usbScale]);
      R.draw(usb.mesh);
    }

    updateLabels(GL.M4.mul(R.proj, cam.view));
    if (firstFrame) {
      firstFrame = false;
      hideLoading();
      el.roleIntro.hidden = false;
      el.roleContinue.focus();
    }
    requestAnimationFrame(frame);
  }

  function hideLoading() {
    if (el.loading) {
      el.loading.classList.add('is-ready');
      el.loading.setAttribute('aria-hidden', 'true');
    }
  }

  function startSimulation() {
    if (started) return;
    started = true;
    el.welcome.hidden = true;
    el.loading.classList.remove('is-ready');
    el.loading.setAttribute('aria-hidden', 'false');
    window.setTimeout(initGL, 80);
  }

  function bindWelcome() {
    el.begin.addEventListener('click', startSimulation);
    el.openSettings.addEventListener('click', function () { el.settings.hidden = false; el.closeSettings.focus(); });
    el.closeSettings.addEventListener('click', function () { el.settings.hidden = true; el.openSettings.focus(); });
    el.settings.addEventListener('click', function (e) { if (e.target === el.settings) el.settings.hidden = true; });
    el.motionToggle.addEventListener('change', function () { idleMotion = el.motionToggle.checked; });
    el.roleContinue.addEventListener('click', function () {
      el.roleIntro.hidden = true;
      el.storyRail.hidden = false;
      document.body.classList.add('guided');
      renderStoryRail();
    });
    el.storyNext.addEventListener('click', function () {
      if (state.m.page1 && state.challenge < 2) {
        if (state.challenge === 1) {
          state.challenge = 2;
          var next = MODULES.findIndex(function (m) { return !state.m[m.id]; });
          if (next >= 0) activeStoryIndex = next;
          save();
          renderStoryRail();
        } else if (!dragChallengeActive) {
          dragChallengeActive = true;
          usb.pos = usb.start.slice();
          el.storyPrompt.textContent = 'Drag the USB flash drive onto the computer screen.';
          el.storyNext.textContent = 'Reset USB Position';
        } else {
          usb.pos = usb.start.slice();
          el.storyPrompt.textContent = 'Drag the USB flash drive onto the computer screen.';
        }
        return;
      }
      if (doneCount() === MODULES.length) { showDebrief(); return; }
      openModule(activeStoryIndex);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !el.settings.hidden) { el.settings.hidden = true; el.openSettings.focus(); }
    });
  }

  function renderStoryRail() {
    if (!el.storyRail || el.storyRail.hidden) return;
    var pct = !state.m.page1 ? 9 : (state.challenge < 2 ? 17 : Math.round(doneCount() / MODULES.length * 100));
    el.storyProgressText.textContent = pct + '%';
    el.storyProgressBar.style.width = pct + '%';
    if (state.m.page1 && state.challenge < 2) {
      var challengeDone = state.challenge === 1;
      el.storyContent.innerHTML = '<h2 class="story-heading"><span>2</span>The Temptation</h2>' +
        (challengeDone
          ? '<p>You inserted the unknown USB drive. That is exactly what a USB drop attack relies on: curiosity, urgency, or the promise of interesting files.</p><section class="story-insight"><h3>✦ &nbsp;SECURITY RESPONSE</h3><p>Do not open files or continue using the device. Disconnect it if safe to do so and report it to IT/Security immediately.</p></section>'
          : '<p><strong>Abebe</strong> picks up the drive, curiosity piqued. Someone from her building must work at her company — or maybe a competitor? She knows she should turn it in to IT, but...</p><p><em>“I’ll just check what’s on it first,”</em> she thinks. <em>“If it’s really HR data, I should verify it’s ours before handing it over.”</em></p><section class="story-insight"><h3>✦ &nbsp;INSIGHT</h3><p>Attackers use curiosity and convincing labels to get people to plug in unknown USB devices.</p></section>');
      el.storyPrompt.textContent = challengeDone
        ? 'The device is connected. Continue to see the security response.'
        : (dragChallengeActive ? 'Drag the USB flash drive onto the computer screen.' : 'Click Start Interaction, then drag the USB drive to the computer.');
      el.storyNext.textContent = challengeDone ? 'Continue' : (dragChallengeActive ? 'Reset USB Position' : 'Start Interaction');
      return;
    }
    var mod = MODULES[activeStoryIndex];
    if (!mod) return;
    var step = mod.steps[0];
    var paragraphs = fmt(step.setting).split(/\n+/).map(function (p) { return '<p>' + p + '</p>'; }).join('');
    var insight = mod.takeaways && mod.takeaways[0] ? mod.takeaways[0] : mod.objective;
    el.storyContent.innerHTML = '<h2 class="story-heading"><span>' + (activeStoryIndex + 1) + '</span>' + esc(mod.name) + '</h2>' +
      paragraphs + '<section class="story-insight"><h3>✦ &nbsp;INSIGHT</h3><p>' + fmt(insight) + '</p></section>';
    if (doneCount() === MODULES.length) {
      el.storyContent.innerHTML = '<h2 class="story-heading"><span>✓</span>Lab complete</h2><p>You have finished all four stages of the USB drop attack scenario.</p>';
      el.storyPrompt.textContent = 'Review your results.';
      el.storyNext.textContent = 'View Results';
      return;
    }
    el.storyPrompt.textContent = 'Click Next Step to continue.';
    el.storyNext.textContent = state.m[mod.id] ? 'Review This Step' : 'Next Step';
  }

  /* ============================ SCENARIO UI ================================ */
  function mockHTML(m) {
    if (!m) return '';
    var h = '<div class="screenmock"><div class="bar-top"><i></i><i></i><i></i>' + esc(m.title) + '</div>';
    if (m.rows && m.rows.length) {
      h += '<div class="rows">';
      m.rows.forEach(function (r) {
        h += '<div class="row"><div class="k">' + esc(r.k) + '</div><div class="v' +
             (r.flag ? ' flag' : '') + '">' + esc(r.v) + '</div></div>';
      });
      h += '</div>';
    }
    if (m.body && m.body.length) {
      h += '<div class="body">' + m.body.map(function (p) { return '<p style="margin:0 0 8px">' + fmt(p) + '</p>'; }).join('') + '</div>';
    }
    return h + '</div>';
  }

  /* one owner for the Continue button, so a click can never fire two handlers */
  function setNext(label, fn) {
    el.mNext.onclick = fn || null;
    if (!label) { el.mNext.hidden = true; return; }
    el.mNext.textContent = label;
    el.mNext.hidden = false;
  }

  function openModule(i) {
    var mod = MODULES[i];
    cur = { i:i, mod:mod, step:0, pts:[], picks:[], retake: !!state.m[mod.id] };
    if (cam && scene) {
      var f = scene.stations[i].focus;
      /* on wide screens the sheet is a right-hand rail: slide the camera target
         sideways so the station itself stays in the open half of the screen */
      var off = window.innerWidth >= 900 ? 2.6 : 0;
      cam.focus([f.tgt[0] + f.right[0] * off, f.tgt[1], f.tgt[2] + f.right[2] * off],
                f.yaw, f.pitch, f.dist);
      lastInput = clock;
    }
    fadeHint();
    el.modal.hidden = false;
    renderStep();
    renderDock();
  }

  function renderStep() {
    var mod = cur.mod, step = mod.steps[cur.step];
    el.mStation.textContent = (MODULES.length > 1 ? 'Station ' + (cur.i + 1) + ' · ' : '') + mod.name;
    el.mStep.textContent = 'Decision ' + (cur.step + 1) + ' of ' + mod.steps.length;
    el.mTitle.textContent = mod.title;
    setNext(null, null);

    var h = '<div class="setting">' + fmt(step.setting) +
            (cur.step === 0 ? '<em>' + esc(mod.objective) + '</em>' : '') + '</div>';
    h += mockHTML(step.mock);
    h += '<p class="prompt">' + fmt(step.prompt) + '</p>';
    h += '<ul class="choices">';
    step.choices.forEach(function (c, ci) {
      h += '<li><button class="choice" data-i="' + ci + '"><span class="key">' +
           LETTERS[ci].toUpperCase() + '</span><span>' + fmt(c.t) + '</span></button></li>';
    });
    h += '</ul>';
    el.mBody.innerHTML = h;
    el.mBody.scrollTop = 0;
    el.mMeta.innerHTML = cur.retake
      ? 'Retaking this station — your new answers replace the old ones'
      : 'Choose the response you would actually give';

    Array.prototype.forEach.call(el.mBody.querySelectorAll('.choice'), function (b) {
      b.addEventListener('click', function () { answer(+b.dataset.i); });
    });
  }

  function answer(ci) {
    var mod = cur.mod, step = mod.steps[cur.step], choice = step.choices[ci];
    cur.pts[cur.step] = choice.pts;
    cur.picks[cur.step] = ci;

    var correctIdx = 0;
    step.choices.forEach(function (c, k) { if (c.pts >= 10) correctIdx = k; });

    /* lock the list and mark what was chosen */
    Array.prototype.forEach.call(el.mBody.querySelectorAll('.choice'), function (b) {
      b.disabled = true;
      if (+b.dataset.i === ci) b.className = 'choice picked ' + choice.tone;
    });

    var head = choice.tone === 'good' ? 'Good call' : choice.tone === 'mid' ? 'Partly right' : 'Risky';
    var fb = document.createElement('div');
    fb.className = 'fb ' + choice.tone;
    fb.innerHTML = '<h4>' + head + ' · ' + choice.pts + '/10</h4><p>' + fmt(choice.fb) + '</p>';
    el.mBody.appendChild(fb);
    fb.scrollIntoView({ behavior:'smooth', block:'nearest' });

    window.SCORM.interaction({
      id: mod.id + '_' + (cur.step + 1),
      text: step.prompt,
      response: LETTERS[ci],
      correct: LETTERS[correctIdx],
      pts: choice.pts
    });

    var lastStep = cur.step === mod.steps.length - 1;
    setNext(lastStep ? 'See the takeaways' : 'Next decision', function () {
      if (lastStep) finishModule();
      else { cur.step++; renderStep(); }
    });
    el.mMeta.innerHTML = 'Station running total: <b>' +
      cur.pts.reduce(function (a, b) { return a + b; }, 0) + ' / ' + ((cur.step + 1) * 10) + '</b>';
  }

  function finishModule() {
    var mod = cur.mod;
    state.m[mod.id] = cur.pts.slice();
    state.c[mod.id] = cur.picks.slice();
    save();
    var nextStory = MODULES.findIndex(function (m) { return !state.m[m.id]; });
    if (nextStory >= 0) activeStoryIndex = nextStory;
    renderStoryRail();

    var got = cur.pts.reduce(function (a, b) { return a + b; }, 0);
    var max = modMax(mod), frac = got / max;
    var band = frac >= 0.8 ? 'good' : frac >= 0.5 ? 'mid' : 'bad';
    var head = band === 'good' ? 'Station cleared' : band === 'mid' ? 'Station passed with gaps' : 'Station needs another look';

    el.mStep.textContent = 'Debrief';
    el.mTitle.textContent = mod.title;
    el.mBody.innerHTML =
      '<div class="fb ' + band + '"><h4>' + head + ' · ' + got + '/' + max + '</h4><p>' +
      esc(mod.objective) + '</p></div>' +
      '<div class="takeaway"><h4>What to carry out of this room</h4><ul>' +
      mod.takeaways.map(function (t) { return '<li>' + fmt(t) + '</li>'; }).join('') +
      '</ul></div>';
    el.mBody.scrollTop = 0;
    el.mMeta.innerHTML = doneCount() + ' of ' + MODULES.length +
      (MODULES.length === 1 ? ' section' : ' stations') + ' complete · overall <b>' + percent() + '%</b>';
    var all = doneCount() === MODULES.length;
    setNext(all ? 'View your results' : (DATA.backLabel || 'Back to the floor'), function () {
      closeModal();
      if (all) setTimeout(showDebrief, 420);
    });
    refreshHUD();
  }

  function closeModal() {
    el.modal.hidden = true;
    cur = null;
    setNext(null, null);
    goHome();
    renderDock();
  }
  el.mClose.addEventListener('click', closeModal);
  el.modal.addEventListener('click', function (e) { if (e.target === el.modal) closeModal(); });

  /* ------------------------------- debrief --------------------------------- */
  function showDebrief() {
    var pct = percent(), passed = pct >= DATA.passMark;
    var circ = 2 * Math.PI * 40;
    var dash = (circ * pct / 100).toFixed(1);
    var col = passed ? 'var(--good)' : 'var(--warn)';

    el.dTitle.textContent = passed ? (DATA.passTitle || 'Passed') : (DATA.failTitle || 'Not passed yet');

    var rows = MODULES.map(function (m) {
      var mx = modMax(m), s = moduleScore(m.id) || 0, p = Math.round(s / mx * 100);
      var cls = p >= 80 ? '' : p >= 50 ? 'mid' : 'bad';
      return '<div class="rowscore"><div class="t">' + esc(m.title) +
             '<small>' + esc(m.name) + '</small></div>' +
             '<div class="m"><i class="' + cls + '" style="width:' + p + '%"></i></div>' +
             '<div class="p">' + s + '/' + mx + '</div></div>';
    }).join('');

    el.dBody.innerHTML =
      '<div class="result">' +
        '<div class="ring"><svg width="92" height="92" viewBox="0 0 92 92">' +
          '<circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="7"/>' +
          '<circle cx="46" cy="46" r="40" fill="none" stroke="' + col + '" stroke-width="7" ' +
          'stroke-linecap="round" stroke-dasharray="' + dash + ' ' + circ.toFixed(1) + '"/>' +
        '</svg><div class="val"><b>' + pct + '%</b><span>Score</span></div></div>' +
        '<div class="result-txt"><h3>' + (passed ? 'Well handled.' : 'Close, but not there.') + '</h3>' +
        '<p>' + (passed
          ? 'You scored ' + pct + '%, above the ' + DATA.passMark + '% pass mark. Your result and every individual decision have been sent to the LMS.'
          : 'You scored ' + pct + '%, below the ' + DATA.passMark + '% pass mark. Revisit the weakest ' + (MODULES.length === 1 ? 'section' : 'stations') + ' below — reopening one lets you answer again, and your new answers replace the old ones.') +
        '</p></div>' +
      '</div>' +
      '<div class="rows-score">' + rows + '</div>';

    document.body.classList.add('debrief');
    el.dMeta.innerHTML = 'Pass mark <b>' + DATA.passMark + '%</b> · ' +
      (window.SCORM.real ? 'Recorded in the LMS via SCORM ' + window.SCORM.version : 'Preview mode — not recorded');
    el.done.hidden = false;
  }
  el.dReview.textContent = DATA.backLabel || 'Back to the floor';
  el.dReview.addEventListener('click', function () {
    el.done.hidden = true;
    document.body.classList.remove('debrief');
    goHome();
  });

  /* -------------------------------- HUD ------------------------------------ */
  function renderDock() {
    el.dock.innerHTML = '';
    MODULES.forEach(function (m, i) {
      var band = bandOf(m.id);
      var b = document.createElement('button');
      b.className = 'chip' + (band === 'todo' ? '' : ' ' + band);
      var s = moduleScore(m.id);
      b.innerHTML = '<span class="dot"></span><span>' + esc(m.name) + '</span>' +
                    '<span class="n">' + (s === null ? (i + 1) + '/' + MODULES.length
                                                    : s + '/' + modMax(m)) + '</span>';
      b.addEventListener('click', function () { openModule(i); });
      el.dock.appendChild(b);
    });
  }

  /* the dock wraps to a second row on courses with five or six stations,
     so the hint has to sit above whatever height it actually is */
  function placeHint() {
    if (!el.hint || !el.dock) return;
    el.hint.style.bottom = (el.dock.offsetHeight + 12) + 'px';
  }

  function refreshHUD() {
    el.statDone.textContent = doneCount() + '/' + MODULES.length;
    el.statScore.textContent = percent() + '%';
    el.bar.style.width = (doneCount() / MODULES.length * 100) + '%';
    renderDock();
    placeHint();
  }

  window.addEventListener('resize', placeHint);

  /* ------------------------------ persistence ------------------------------ */
  function save() {
    var pct = percent();
    window.SCORM.saveSuspend(state, 'station-' + doneCount());
    window.SCORM.saveScore(pct);
    window.SCORM.saveProgress(doneCount() / MODULES.length);
    if (doneCount() === MODULES.length) {
      /* re-sent on each change so a retake updates the record, but the
         status itself only ever moves forward */
      window.SCORM.complete(pct, pct >= DATA.passMark);
      completedOnce = true;
    } else if (completedOnce) {
      window.SCORM.saveScore(pct);
    }
  }

  function restore() {
    var s = window.SCORM.loadSuspend();
    if (s && s.m && typeof s.m === 'object') {
      if (s.challenge === 1 || s.challenge === 2) state.challenge = s.challenge;
      /* only trust modules that still exist and have the right shape */
      MODULES.forEach(function (m) {
        var a = s.m[m.id];
        if (Array.isArray(a) && a.length === m.steps.length) {
          state.m[m.id] = a.map(function (n) { return Math.max(0, Math.min(10, +n || 0)); });
          if (s.c && Array.isArray(s.c[m.id])) state.c[m.id] = s.c[m.id];
        }
      });
    }
  }

  /* -------------------------------- boot ----------------------------------- */
  function boot() {
    window.SCORM.init();
    restore();
    var firstUnfinished = MODULES.findIndex(function (m) { return !state.m[m.id]; });
    activeStoryIndex = firstUnfinished >= 0 ? firstUnfinished : 0;

    var name = (window.SCORM.learnerName || '').trim();
    if (name && name.indexOf(',') > -1) {                /* "Last, First" -> "First Last" */
      var p = name.split(',');
      name = (p[1] || '').trim() + ' ' + (p[0] || '').trim();
    }
    el.learner.textContent = name
      ? name.trim() + ' · ' + DATA.subtitle
      : DATA.subtitle;

    refreshHUD();
    bindWelcome();

    if (doneCount() > 0) {
      fadeHint();
      if (el.hint) {
        el.hint.classList.remove('gone');
        el.hint.innerHTML = 'Welcome back — <b>' + doneCount() + ' of ' + MODULES.length +
                            '</b> stations done. Pick up where you left off.';
        setTimeout(function () { el.hint.classList.add('gone'); }, 6000);
      }
    }
    if (doneCount() === MODULES.length) setTimeout(showDebrief, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
