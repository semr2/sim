/* ===========================================================================
   kit.js — shared palette, local-frame helper and furniture builders.
   Every course composes its environment from these.
   Convention: props are authored facing +Z at the local origin, then placed
   with At(builder, x, z, rotY).
   =========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------ palette -------------------------------- */
  var C = {
    /* structure */
    floor:'#18202f', floorWarm:'#241f2b', floorPale:'#232c3d', rim:'#28334c',
    walk:'#232e45', wall:'#212b40', wallTop:'#2b3750', glass:'#3d5878',
    /* furniture */
    deskTop:'#414d6b', deskLight:'#4b5878', deskEdge:'#333d57', leg:'#1b2231',
    metal:'#2b3550', dark:'#151b28', darker:'#0f141e', steel:'#39445f',
    chair:'#2a344f', cushion:'#3b4a72', sofa:'#354265', sofaArm:'#2c3757',
    counter:'#3a4560', counterTop:'#4c5877', wood:'#5a4a3c', woodTop:'#6b5a49',
    /* accents */
    screen:'#0d1420', paper:'#c9d6ea', chrome:'#8f9fbb',
    plant:'#2f8f6b', plantDark:'#25755a', pot:'#3d4a4a',
    accent:'#34e0d0', blue:'#4aa8ff', amber:'#f6b93b',
    good:'#3ad986', bad:'#ff5f6d', gold:'#c9a227', panelLight:'#dfeaff'
  };

  /* --------------------------- local frame -------------------------------- */
  function At(b, ox, oz, ry) {
    this.b = b; this.ox = ox || 0; this.oz = oz || 0; this.ry = ry || 0;
    this.c = Math.cos(this.ry); this.s = Math.sin(this.ry);
  }
  At.prototype.xf = function (p) {
    return [p[0]*this.c + p[2]*this.s + this.ox, p[1], -p[0]*this.s + p[2]*this.c + this.oz];
  };
  At.prototype.box = function (o) {
    var r = o.rot || [0,0,0];
    this.b.box({ pos:this.xf(o.pos), size:o.size, rot:[r[0], r[1]+this.ry, r[2]],
                 color:o.color, emit:o.emit, faces:o.faces });
    return this;
  };
  At.prototype.cyl = function (o) {
    var r = o.rot || [0,0,0];
    this.b.cyl({ pos:this.xf(o.pos), r:o.r, rTop:o.rTop, h:o.h, seg:o.seg,
                 rot:[r[0], r[1]+this.ry, r[2]], color:o.color, emit:o.emit });
    return this;
  };
  /* a nested frame, for composing a prop out of other props */
  At.prototype.at = function (x, z, ry) {
    var p = this.xf([x, 0, z]);
    return new At(this.b, p[0], p[2], this.ry + (ry || 0));
  };

  /* ============================== furniture ============================== */
  var K = {};

  K.floorSlab = function (a, w, d, col, rimCol) {
    a.box({ pos:[0,-0.22,0], size:[w,0.44,d], color:col || C.floor });
    a.box({ pos:[0,-0.46,0], size:[w+0.6,0.16,d+0.6], color:rimCol || C.rim });
    return a;
  };

  K.walkway = function (a, x, z, w, d, col) {
    a.box({ pos:[x,0.005,z], size:[w,0.02,d], color:col || C.walk });
    return a;
  };

  K.partition = function (a, x, z, ry, w, h, col) {
    h = h || 1.56;
    a.box({ pos:[x,h/2,z], size:[w,h,0.2], rot:[0,ry,0], color:col || C.wall,
            faces:{ top:C.wallTop } });
    return a;
  };

  /* a wall with a doorway gap in the middle */
  K.wallWithDoor = function (a, x, z, ry, w, h, gap) {
    h = h || 2.7; gap = gap || 1.7;
    var side = (w - gap) / 2;
    a.box({ pos:[x - (gap/2 + side/2), h/2, z], size:[side,h,0.22], rot:[0,ry,0],
            color:C.wall, faces:{ top:C.wallTop } });
    a.box({ pos:[x + (gap/2 + side/2), h/2, z], size:[side,h,0.22], rot:[0,ry,0],
            color:C.wall, faces:{ top:C.wallTop } });
    a.box({ pos:[x, h - 0.2, z], size:[gap,0.4,0.22], rot:[0,ry,0],
            color:C.wall, faces:{ top:C.wallTop } });
    return a;
  };

  K.desk = function (a, w) {
    w = w || 2.6;
    a.box({ pos:[0,0.74,0], size:[w,0.08,1.25], color:C.deskTop, faces:{ top:C.deskLight } });
    a.box({ pos:[0,0.70,-0.6], size:[w,0.06,0.06], color:C.deskEdge });
    [-1,1].forEach(function (s) {
      a.box({ pos:[s*(w/2-0.12),0.37,0], size:[0.09,0.72,1.05], color:C.leg });
    });
    a.box({ pos:[0,0.45,-0.55], size:[w-0.5,0.5,0.05], color:C.leg });
    a.box({ pos:[w/2-0.55,0.32,0.05], size:[0.62,0.62,0.98], color:C.metal,
            faces:{ front:C.steel } });
    a.box({ pos:[w/2-0.55,0.48,0.55], size:[0.34,0.03,0.03], color:'#5c6a8c' });
    a.box({ pos:[w/2-0.55,0.22,0.55], size:[0.34,0.03,0.03], color:'#5c6a8c' });
    return a;
  };

  /* a plain table top on four legs */
  K.table = function (a, x, z, ry, w, d, col) {
    a.box({ pos:[x,0.72,z], size:[w,0.08,d], rot:[0,ry,0], color:col || C.deskTop,
            faces:{ top:C.deskLight } });
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (s) {
      var lx = s[0]*(w/2-0.12), lz = s[1]*(d/2-0.12);
      var rx = lx*Math.cos(ry) + lz*Math.sin(ry), rz = -lx*Math.sin(ry) + lz*Math.cos(ry);
      a.box({ pos:[x+rx,0.36,z+rz], size:[0.08,0.72,0.08], color:C.leg });
    });
    return a;
  };

  K.roundTable = function (a, x, z, r, col) {
    a.cyl({ pos:[x,0,z], r:r*0.5, rTop:r*0.2, h:0.68, seg:14, color:C.leg });
    a.cyl({ pos:[x,0.68,z], r:r, h:0.07, seg:20, color:col || C.deskTop });
    return a;
  };

  K.monitor = function (a, x, y, z, ry, screenCol, emit, w) {
    w = w || 0.92;
    a.box({ pos:[x,y-0.28,z], size:[0.34,0.03,0.24], color:C.dark, rot:[0,ry,0] });
    a.box({ pos:[x,y-0.13,z], size:[0.07,0.3,0.07], color:'#232c3f', rot:[0,ry,0] });
    a.box({ pos:[x,y+0.14,z], size:[w,0.56,0.045], color:C.dark, rot:[0,ry,-0.03],
            faces:{ front:{ color:screenCol, emit:emit === undefined ? 0.9 : emit } } });
    return a;
  };

  /* a banner across a monitor's screen — used to make an alert readable in 3D */
  K.screenBanner = function (a, x, y, z, ry, col, w, h) {
    a.box({ pos:[x,y,z], size:[w || 0.78, h || 0.13, 0.02], rot:[0,ry,0],
            color:'#0b1a2b', faces:{ front:{ color:col, emit:1 } } });
    return a;
  };

  K.laptop = function (a, x, y, z, ry, screenCol, emit) {
    a.box({ pos:[x,y,z], size:[0.62,0.02,0.42], rot:[0,ry,0], color:C.metal });
    a.box({ pos:[x - Math.sin(ry)*0.22, y+0.17, z - Math.cos(ry)*0.22],
            size:[0.62,0.38,0.025], rot:[0.42,ry,0], color:'#1c2434',
            faces:{ front:{ color:screenCol, emit:emit === undefined ? 0.9 : emit } } });
    return a;
  };

  K.chair = function (a, x, z, ry) {
    a.cyl({ pos:[x,0.02,z], r:0.28, rTop:0.24, h:0.05, seg:12, color:C.dark });
    a.cyl({ pos:[x,0.07,z], r:0.05, h:0.35, seg:8, color:C.steel });
    a.box({ pos:[x,0.45,z], size:[0.5,0.1,0.5], color:C.cushion, rot:[0,ry,0] });
    a.box({ pos:[x - Math.sin(ry)*0.24, 0.72, z - Math.cos(ry)*0.24],
            size:[0.5,0.44,0.09], color:C.chair, rot:[0.1,ry,0] });
    return a;
  };

  /* a simple stool / cafe chair with four legs */
  K.stool = function (a, x, z, ry, col) {
    a.box({ pos:[x,0.44,z], size:[0.42,0.07,0.42], rot:[0,ry,0], color:col || C.cushion });
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (s) {
      a.box({ pos:[x+s[0]*0.16,0.22,z+s[1]*0.16], size:[0.05,0.44,0.05], color:C.leg });
    });
    a.box({ pos:[x - Math.sin(ry)*0.19, 0.68, z - Math.cos(ry)*0.19],
            size:[0.42,0.4,0.06], rot:[0.08,ry,0], color:col || C.chair });
    return a;
  };

  K.sofa = function (a, x, z, ry, w) {
    w = w || 2.6;
    var l = a.at(x, z, ry);
    l.box({ pos:[0,0.22,0], size:[w,0.44,0.95], color:C.sofa });
    l.box({ pos:[0,0.5,0], size:[w-0.1,0.18,0.85], color:'#3f4d75' });
    l.box({ pos:[0,0.62,-0.5], size:[w,0.7,0.22], rot:[-0.09,0,0], color:C.sofaArm });
    l.box({ pos:[-(w/2-0.11),0.52,0], size:[0.22,0.5,0.95], color:C.sofaArm });
    l.box({ pos:[ (w/2-0.11),0.52,0], size:[0.22,0.5,0.95], color:C.sofaArm });
    return a;
  };

  K.plant = function (a, x, z, scale) {
    var k = scale || 1;
    a.cyl({ pos:[x,0,z], r:0.2*k, rTop:0.24*k, h:0.34*k, seg:12, color:C.pot });
    a.box({ pos:[x,0.34*k+0.02,z], size:[0.44*k,0.05,0.44*k], color:'#2c3a34' });
    for (var i = 0; i < 6; i++) {
      var ang = i / 6 * Math.PI * 2 + x, lean = 0.42 + (i % 3) * 0.12;
      a.box({ pos:[x + Math.cos(ang)*0.17*k, (0.62 + (i%3)*0.16)*k, z + Math.sin(ang)*0.17*k],
              size:[0.1*k, 0.5*k, 0.3*k], rot:[lean*Math.sin(ang), -ang, lean*Math.cos(ang)],
              color:i % 2 ? C.plant : C.plantDark });
    }
    return a;
  };

  K.mug = function (a, x, y, z, col) {
    a.cyl({ pos:[x,y,z], r:0.055, h:0.11, seg:10, color:col || '#d8dee9' });
    return a;
  };

  K.paper = function (a, x, y, z, ry, w, d) {
    a.box({ pos:[x,y,z], size:[w || 0.32, 0.02, d || 0.24], rot:[0,ry||0,0], color:C.paper });
    return a;
  };

  K.keyboard = function (a, x, y, z, ry, w) {
    a.box({ pos:[x,y,z], size:[w || 1.0, 0.03, 0.32], rot:[0,ry||0,0], color:'#222c40' });
    return a;
  };

  K.bin = function (a, x, z, col) {
    a.cyl({ pos:[x,0,z], r:0.24, rTop:0.28, h:0.6, seg:12, color:col || C.metal });
    return a;
  };

  K.cabinet = function (a, x, z, ry, w, h, drawers) {
    w = w || 0.9; h = h || 1.35; drawers = drawers || 4;
    var l = a.at(x, z, ry);
    l.box({ pos:[0,h/2,0], size:[w,h,0.66], color:C.metal, faces:{ front:C.steel, top:'#465274' } });
    for (var i = 0; i < drawers; i++) {
      var y = h * (i + 0.5) / drawers;
      l.box({ pos:[0,y,0.34], size:[w-0.1,h/drawers-0.05,0.03], color:'#3f4a66' });
      l.box({ pos:[0,y,0.36], size:[0.26,0.035,0.03], color:C.chrome });
    }
    return a;
  };

  K.shelf = function (a, x, z, ry, w, h, levels) {
    w = w || 1.8; h = h || 1.9; levels = levels || 4;
    var l = a.at(x, z, ry);
    l.box({ pos:[-(w/2),h/2,0], size:[0.07,h,0.42], color:C.metal });
    l.box({ pos:[ (w/2),h/2,0], size:[0.07,h,0.42], color:C.metal });
    for (var i = 0; i < levels; i++) {
      var y = 0.14 + i * (h - 0.2) / levels;
      l.box({ pos:[0,y,0], size:[w,0.05,0.42], color:C.steel, faces:{ top:'#4a5674' } });
      /* box files, alternating so shelves do not look identical */
      for (var j = -1; j <= 1; j++) {
        if ((i + j + 3) % 3 === 0) continue;
        l.box({ pos:[j*0.52, y + 0.19, 0], size:[0.4,0.32,0.3],
                color:(i + j) % 2 ? '#4a4056' : '#3e4a63' });
      }
    }
    return a;
  };

  K.rack = function (a, x, z, ry, units, seed) {
    units = units || 8; seed = seed || 0;
    var l = a.at(x, z, ry);
    l.box({ pos:[0,1.05,0], size:[0.95,2.1,0.85], color:'#121824',
            faces:{ front:'#1a2130', top:'#1d2534' } });
    l.box({ pos:[0,2.14,0], size:[1.0,0.08,0.9], color:C.metal });
    for (var i = 0; i < units; i++) {
      var y = 0.28 + i * (1.7 / units);
      l.box({ pos:[0,y,0.44], size:[0.78,0.14,0.03], color:'#222b3d' });
      l.box({ pos:[-0.3,y,0.462], size:[0.05,0.05,0.02],
              color:(i + seed) % 4 === 0 ? C.amber : C.good, emit:1 });
      l.box({ pos:[-0.2,y,0.462], size:[0.04,0.04,0.02], color:C.blue, emit:0.9 });
    }
    return a;
  };

  K.door = function (a, x, z, ry, reader, openCol) {
    var l = a.at(x, z, ry);
    l.box({ pos:[0,1.15,0], size:[1.5,2.3,0.09], color:'#1c2536',
            faces:{ front:{ color:openCol || '#243350' } } });
    l.box({ pos:[-0.78,1.15,0], size:[0.1,2.35,0.16], color:'#3a4560' });
    l.box({ pos:[ 0.78,1.15,0], size:[0.1,2.35,0.16], color:'#3a4560' });
    l.box({ pos:[0.52,1.05,0.09], size:[0.07,0.07,0.2], color:C.chrome });
    if (reader !== false) {
      l.box({ pos:[1.05,1.15,0.06], size:[0.17,0.26,0.09], color:C.dark,
              faces:{ front:{ color:reader || C.amber, emit:1 } } });
    }
    return a;
  };

  K.counter = function (a, x, z, ry, w) {
    w = w || 3.4;
    var l = a.at(x, z, ry);
    l.box({ pos:[0,0.5,0], size:[w,1.0,0.7], color:C.counter, faces:{ top:C.counterTop } });
    l.box({ pos:[0,1.04,0], size:[w+0.2,0.09,0.9], color:C.counterTop });
    return a;
  };

  /* kitchen-style run with an upper cupboard */
  K.galley = function (a, x, z, ry, w) {
    w = w || 3.6;
    var l = a.at(x, z, ry);
    l.box({ pos:[0,0.44,0], size:[w,0.88,0.78], color:C.counter });
    l.box({ pos:[0,0.92,0], size:[w+0.15,0.09,0.88], color:C.counterTop });
    l.box({ pos:[-0.6,0.44,0.41], size:[0.02,0.7,0.02], color:'#5c6a8c' });
    l.box({ pos:[ 0.6,0.44,0.41], size:[0.02,0.7,0.02], color:'#5c6a8c' });
    l.box({ pos:[0,2.0,-0.28], size:[w-0.4,0.75,0.42], color:'#333e58', faces:{ bottom:'#232d42' } });
    return a;
  };

  K.printer = function (a, x, z, ry) {
    var l = a.at(x, z, ry);
    l.box({ pos:[0,0.35,0], size:[1.15,0.7,0.8], color:C.metal });
    l.box({ pos:[0,0.74,0], size:[1.0,0.1,0.7], color:C.steel, faces:{ top:'#465274' } });
    l.box({ pos:[0,0.82,0.25], size:[0.62,0.02,0.4], color:C.paper });
    l.box({ pos:[0.36,0.8,-0.05], size:[0.16,0.06,0.1], color:C.dark,
            faces:{ top:{ color:C.good, emit:0.9 } } });
    return a;
  };

  K.shredder = function (a, x, z, ry) {
    var l = a.at(x, z, ry);
    l.cyl({ pos:[0,0,0], r:0.3, rTop:0.32, h:0.6, seg:12, color:'#2b3550' });
    l.box({ pos:[0,0.66,0], size:[0.72,0.14,0.5], color:C.dark, faces:{ top:'#39445f' } });
    l.box({ pos:[0,0.735,0], size:[0.44,0.02,0.05], color:'#0a0e16' });
    l.box({ pos:[0.26,0.7,0.26], size:[0.06,0.04,0.03], color:C.good, emit:1 });
    return a;
  };

  K.coffeeMachine = function (a, x, y, z, ry) {
    var l = a.at(x, z, ry);
    l.box({ pos:[0,y+0.28,0], size:[0.55,0.55,0.5], color:C.dark, faces:{ front:C.metal } });
    l.box({ pos:[0,y+0.38,0.24], size:[0.2,0.12,0.04], color:'#1a2130',
            faces:{ front:{ color:C.good, emit:0.9 } } });
    return a;
  };

  K.lamp = function (a, x, z, col) {
    a.cyl({ pos:[x,0,z], r:0.18, rTop:0.06, h:0.06, seg:12, color:C.dark });
    a.cyl({ pos:[x,0.06,z], r:0.035, h:1.5, seg:8, color:C.steel });
    a.cyl({ pos:[x,1.56,z], r:0.1, rTop:0.24, h:0.3, seg:14, color:col || '#e8dfc8', emit:0.8 });
    return a;
  };

  K.whiteboard = function (a, x, z, ry, w, h) {
    w = w || 2.4; h = h || 1.15;
    var l = a.at(x, z, ry);
    l.box({ pos:[0,1.05,0], size:[w,h,0.07], color:C.steel,
            faces:{ front:{ color:'#aebdd4', emit:0.16 } } });
    l.box({ pos:[0,0.44,0.05], size:[0.6,0.05,0.05], color:C.chrome });
    return a;
  };

  /* wall-mounted sign / display panel */
  K.sign = function (a, x, y, z, ry, w, h, col, emit) {
    a.box({ pos:[x,y,z], size:[w,h,0.05], rot:[0,ry,0], color:'#1a2333',
            faces:{ front:{ color:col || C.accent, emit:emit === undefined ? 0.85 : emit } } });
    return a;
  };

  /* free-standing wall screen (SOC / lobby display) */
  K.wallScreen = function (a, x, y, z, ry, w, h, col, emit) {
    a.box({ pos:[x,y,z], size:[w,h,0.09], rot:[0,ry,0], color:'#0f141e',
            faces:{ front:{ color:col || '#12324a', emit:emit === undefined ? 0.75 : emit } } });
    return a;
  };

  K.deskPhone = function (a, x, y, z, ry, ringing) {
    a.box({ pos:[x,y,z], size:[0.42,0.09,0.34], rot:[0,ry,0], color:'#1d2534',
            faces:{ top:C.metal } });
    a.box({ pos:[x - Math.sin(ry)*0.1, y+0.08, z - Math.cos(ry)*0.1],
            size:[0.44,0.07,0.11], rot:[0,ry,0], color:'#28324a' });
    a.box({ pos:[x + Math.sin(ry)*0.1, y+0.06, z + Math.cos(ry)*0.1],
            size:[0.2,0.05,0.12], rot:[0,ry,0], color:'#141a26',
            faces:{ top:{ color:ringing ? C.amber : '#4a5674', emit:ringing ? 1 : 0.3 } } });
    return a;
  };

  K.usbStick = function (a, x, y, z, ry) {
    a.box({ pos:[x,y,z], size:[0.19,0.06,0.075], rot:[0,ry,0], color:'#2c3550' });
    a.box({ pos:[x + Math.cos(ry)*0.14, y, z - Math.sin(ry)*0.14],
            size:[0.1,0.045,0.055], rot:[0,ry,0], color:C.chrome,
            faces:{ top:{ color:C.bad, emit:1 } } });
    a.box({ pos:[x,y+0.035,z], size:[0.1,0.005,0.05], rot:[0,ry,0], color:C.paper, emit:0.5 });
    return a;
  };

  K.phone = function (a, x, y, z, ry, screenCol) {
    a.box({ pos:[x,y,z], size:[0.15,0.02,0.3], rot:[0,ry,0], color:'#161d2b',
            faces:{ top:{ color:screenCol || C.blue, emit:0.95 } } });
    return a;
  };

  K.badge = function (a, x, y, z, ry, col) {
    a.box({ pos:[x,y,z], size:[0.16,0.01,0.24], rot:[0,ry,0], color:'#e8eefb',
            faces:{ top:{ color:col || C.blue, emit:0.5 } } });
    return a;
  };

  K.crate = function (a, x, z, ry, s, col) {
    s = s || 0.7;
    a.box({ pos:[x,s/2,z], size:[s,s,s*0.8], rot:[0,ry,0], color:col || C.wood,
            faces:{ top:C.woodTop } });
    return a;
  };

  K.bed = function (a, x, z, ry) {
    var l = a.at(x, z, ry);
    l.box({ pos:[0,0.22,0], size:[1.5,0.44,2.1], color:C.metal });
    l.box({ pos:[0,0.48,0.05], size:[1.46,0.16,1.9], color:'#4a5578' });
    l.box({ pos:[0,0.6,-0.85], size:[1.2,0.2,0.35], color:'#c3cee2' });
    l.box({ pos:[0,0.75,-1.1], size:[1.6,1.0,0.1], color:C.wood });
    return a;
  };

  /* airport / lounge seating bank */
  K.seatBank = function (a, x, z, ry, n) {
    n = n || 3;
    var l = a.at(x, z, ry);
    l.box({ pos:[0,0.16,0], size:[n*0.62,0.1,0.6], color:C.metal });
    for (var i = 0; i < n; i++) {
      var sx = (i - (n-1)/2) * 0.62;
      l.box({ pos:[sx,0.42,0], size:[0.56,0.1,0.56], color:C.cushion });
      l.box({ pos:[sx,0.66,-0.26], size:[0.56,0.44,0.08], rot:[-0.12,0,0], color:C.chair });
      l.box({ pos:[sx,0.22,0.02], size:[0.07,0.32,0.5], color:C.leg });
    }
    return a;
  };

  K.turnstile = function (a, x, z, ry) {
    var l = a.at(x, z, ry);
    [-0.55, 0.55].forEach(function (sx) {
      l.box({ pos:[sx,0.5,0], size:[0.34,1.0,1.3], color:C.metal, faces:{ top:C.counterTop } });
      l.box({ pos:[sx,1.02,0.4], size:[0.2,0.06,0.24], color:C.dark,
              faces:{ top:{ color:C.good, emit:0.9 } } });
    });
    l.box({ pos:[-0.2,0.62,0], size:[0.42,0.05,0.9], rot:[0,0,0], color:C.chrome, emit:0.2 });
    return a;
  };

  K.lockerBank = function (a, x, z, ry, n) {
    n = n || 4;
    var l = a.at(x, z, ry);
    for (var i = 0; i < n; i++) {
      var sx = (i - (n-1)/2) * 0.46;
      l.box({ pos:[sx,0.9,0], size:[0.44,1.8,0.5], color:C.metal,
              faces:{ front:i % 2 ? '#3f4a66' : C.steel, top:'#465274' } });
      l.box({ pos:[sx+0.14,1.0,0.26], size:[0.04,0.1,0.02], color:C.chrome });
      l.box({ pos:[sx,1.55,0.26], size:[0.16,0.04,0.02], color:C.paper });
    }
    return a;
  };

  /* a large safe / vault door — the hero prop for the credentials course */
  K.vault = function (a, x, z, ry, lit) {
    var l = a.at(x, z, ry);
    l.box({ pos:[0,1.5,-0.2], size:[3.4,3.0,0.5], color:'#1b2434', faces:{ top:'#2b3750' } });
    l.box({ pos:[0,1.45,0.08], size:[2.5,2.4,0.22], color:'#28324a',
            faces:{ front:{ color:'#37455f' } } });
    l.cyl({ pos:[0,1.45,0.2], r:0.5, h:0.12, seg:24, rot:[Math.PI/2,0,0], color:'#46536f' });
    l.cyl({ pos:[0,1.45,0.26], r:0.16, h:0.1, seg:16, rot:[Math.PI/2,0,0],
            color:lit || C.accent, emit:1 });
    [0, Math.PI/2, Math.PI, -Math.PI/2].forEach(function (ang) {
      l.box({ pos:[Math.cos(ang)*0.72, 1.45 + Math.sin(ang)*0.72, 0.22],
              size:[0.5,0.1,0.08], rot:[0,0,ang], color:'#5a6884' });
    });
    l.box({ pos:[0,0.06,0.6], size:[3.0,0.12,1.2], color:'#232d42' });
    return a;
  };

  global.Kit = { C:C, At:At };
  Object.keys(K).forEach(function (k) { global.Kit[k] = K[k]; });
})(window);
