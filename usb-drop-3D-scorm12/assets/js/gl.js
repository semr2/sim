/* ===========================================================================
   gl.js — a very small WebGL engine, written for this course.
   No external libraries: SCORM packages must not make network requests.
   Provides: mat4 math, a flat-shaded geometry builder, an orbit camera
   with damping, and ray/AABB picking.
   =========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------ mat4 ---------------------------------- */
  var M4 = {
    ident: function () {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    mul: function (a, b, out) {
      out = out || new Float32Array(16);
      for (var c = 0; c < 4; c++) {
        var b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
        out[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
        out[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
        out[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
        out[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
      }
      return out;
    },
    perspective: function (fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([
        f/aspect,0,0,0,
        0,f,0,0,
        0,0,(far+near)*nf,-1,
        0,0,2*far*near*nf,0
      ]);
    },
    lookAt: function (eye, center, up) {
      var zx=eye[0]-center[0], zy=eye[1]-center[1], zz=eye[2]-center[2];
      var l = Math.hypot(zx,zy,zz) || 1; zx/=l; zy/=l; zz/=l;
      var xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
      l = Math.hypot(xx,xy,xz) || 1; xx/=l; xy/=l; xz/=l;
      var yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
      return new Float32Array([
        xx,yx,zx,0,
        xy,yy,zy,0,
        xz,yz,zz,0,
        -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
        -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
        -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1
      ]);
    },
    /* translate * rotY * rotX * rotZ * scale */
    trs: function (p, r, s) {
      r = r || [0,0,0]; s = s || [1,1,1];
      var cx=Math.cos(r[0]), sx=Math.sin(r[0]),
          cy=Math.cos(r[1]), sy=Math.sin(r[1]),
          cz=Math.cos(r[2]), sz=Math.sin(r[2]);
      // R = Ry * Rx * Rz
      var m00 = cy*cz + sy*sx*sz, m01 = -cy*sz + sy*sx*cz, m02 = sy*cx;
      var m10 = cx*sz,            m11 = cx*cz,             m12 = -sx;
      var m20 = -sy*cz + cy*sx*sz,m21 = sy*sz + cy*sx*cz,  m22 = cy*cx;
      return new Float32Array([
        m00*s[0], m10*s[0], m20*s[0], 0,
        m01*s[1], m11*s[1], m21*s[1], 0,
        m02*s[2], m12*s[2], m22*s[2], 0,
        p[0], p[1], p[2], 1
      ]);
    },
    invert: function (m) {
      var o = new Float32Array(16),
        a00=m[0],a01=m[1],a02=m[2],a03=m[3], a10=m[4],a11=m[5],a12=m[6],a13=m[7],
        a20=m[8],a21=m[9],a22=m[10],a23=m[11], a30=m[12],a31=m[13],a32=m[14],a33=m[15],
        b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10,
        b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12,
        b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30,
        b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32,
        det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
      if (!det) return null; det = 1/det;
      o[0]=(a11*b11-a12*b10+a13*b09)*det;  o[1]=(a02*b10-a01*b11-a03*b09)*det;
      o[2]=(a31*b05-a32*b04+a33*b03)*det;  o[3]=(a22*b04-a21*b05-a23*b03)*det;
      o[4]=(a12*b08-a10*b11-a13*b07)*det;  o[5]=(a00*b11-a02*b08+a03*b07)*det;
      o[6]=(a32*b02-a30*b05-a33*b01)*det;  o[7]=(a20*b05-a22*b02+a23*b01)*det;
      o[8]=(a10*b10-a11*b08+a13*b06)*det;  o[9]=(a01*b08-a00*b10-a03*b06)*det;
      o[10]=(a30*b04-a31*b02+a33*b00)*det; o[11]=(a21*b02-a20*b04-a23*b00)*det;
      o[12]=(a11*b07-a10*b09-a12*b06)*det; o[13]=(a00*b09-a01*b07+a02*b06)*det;
      o[14]=(a31*b01-a30*b03-a32*b00)*det; o[15]=(a20*b03-a21*b01+a22*b00)*det;
      return o;
    },
    /* project a world point; returns [x,y,z,visible] in NDC */
    project: function (m, p) {
      var x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
          y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
          z=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],
          w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
      if (w <= 0.0001) return [0,0,0,false];
      return [x/w, y/w, z/w, true];
    }
  };

  /* --------------------------- colour helper ----------------------------- */
  function rgb(hex) {
    if (Array.isArray(hex)) return hex;
    var h = hex.replace('#','');
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
  }

  /* ------------------------ geometry builder ----------------------------- */
  /* Accumulates triangles into flat arrays. One Builder -> one draw call. */
  function Builder() { this.pos = []; this.nrm = []; this.col = []; this.n = 0;
    this.min = [1e9,1e9,1e9]; this.max = [-1e9,-1e9,-1e9]; }

  Builder.prototype._vert = function (x,y,z, nx,ny,nz, c, e) {
    this.pos.push(x,y,z); this.nrm.push(nx,ny,nz); this.col.push(c[0],c[1],c[2],e||0);
    if (x<this.min[0]) this.min[0]=x; if (x>this.max[0]) this.max[0]=x;
    if (y<this.min[1]) this.min[1]=y; if (y>this.max[1]) this.max[1]=y;
    if (z<this.min[2]) this.min[2]=z; if (z>this.max[2]) this.max[2]=z;
    this.n++;
  };

  /* unit cube faces: [ 4 corner offsets, normal ] */
  var CUBE = [
    { n:[0,0,1],  v:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],      k:'front' },
    { n:[0,0,-1], v:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],  k:'back'  },
    { n:[1,0,0],  v:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],      k:'right' },
    { n:[-1,0,0], v:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],  k:'left'  },
    { n:[0,1,0],  v:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],      k:'top'   },
    { n:[0,-1,0], v:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],  k:'bottom'}
  ];

  /* o = {pos,size,rot,color,emit,faces:{top:'#hex'|{color,emit}}} */
  Builder.prototype.box = function (o) {
    var m = M4.trs(o.pos, o.rot, o.size || [1,1,1]);
    var base = rgb(o.color || '#888888'), emit = o.emit || 0, faces = o.faces || {};
    for (var f = 0; f < 6; f++) {
      var face = CUBE[f], fc = base, fe = emit, ov = faces[face.k];
      if (ov) {
        if (typeof ov === 'string' || Array.isArray(ov)) fc = rgb(ov);
        else { if (ov.color) fc = rgb(ov.color); if (ov.emit !== undefined) fe = ov.emit; }
      }
      /* exact for axis-aligned box faces: normalize(R * n) */
      var nx = m[0]*face.n[0] + m[4]*face.n[1] + m[8]*face.n[2];
      var ny = m[1]*face.n[0] + m[5]*face.n[1] + m[9]*face.n[2];
      var nz = m[2]*face.n[0] + m[6]*face.n[1] + m[10]*face.n[2];
      var l = Math.hypot(nx,ny,nz) || 1; nx/=l; ny/=l; nz/=l;
      var p = [];
      for (var i = 0; i < 4; i++) {
        var v = face.v[i];
        p.push([
          m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
          m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
          m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]
        ]);
      }
      var order = [0,1,2, 0,2,3];
      for (var t = 0; t < 6; t++) {
        var q = p[order[t]];
        this._vert(q[0],q[1],q[2], nx,ny,nz, fc, fe);
      }
    }
    return this;
  };

  /* o = {pos,r,rTop,h,seg,color,emit,rot} — capped cylinder / cone */
  Builder.prototype.cyl = function (o) {
    var seg = o.seg || 14, r0 = o.r, r1 = (o.rTop !== undefined ? o.rTop : o.r), h = o.h;
    var m = M4.trs(o.pos, o.rot, [1,1,1]), c = rgb(o.color || '#888'), e = o.emit || 0;
    var self = this;
    function tp(x,y,z){ return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]]; }
    function tn(x,y,z){ var a=m[0]*x+m[4]*y+m[8]*z, b=m[1]*x+m[5]*y+m[9]*z, d=m[2]*x+m[6]*y+m[10]*z;
      var l=Math.hypot(a,b,d)||1; return [a/l,b/l,d/l]; }
    for (var i = 0; i < seg; i++) {
      var a0 = i/seg*Math.PI*2, a1 = (i+1)/seg*Math.PI*2;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var bl = tp(c0*r0, 0, s0*r0), br = tp(c1*r0, 0, s1*r0);
      var tl = tp(c0*r1, h, s0*r1), tr = tp(c1*r1, h, s1*r1);
      var n0 = tn(c0, .25, s0), n1 = tn(c1, .25, s1);
      self._vert(bl[0],bl[1],bl[2], n0[0],n0[1],n0[2], c, e);
      self._vert(br[0],br[1],br[2], n1[0],n1[1],n1[2], c, e);
      self._vert(tr[0],tr[1],tr[2], n1[0],n1[1],n1[2], c, e);
      self._vert(bl[0],bl[1],bl[2], n0[0],n0[1],n0[2], c, e);
      self._vert(tr[0],tr[1],tr[2], n1[0],n1[1],n1[2], c, e);
      self._vert(tl[0],tl[1],tl[2], n0[0],n0[1],n0[2], c, e);
      /* top cap */
      if (r1 > 0.0005) {
        var ct = tp(0,h,0), up = tn(0,1,0);
        self._vert(ct[0],ct[1],ct[2], up[0],up[1],up[2], c, e);
        self._vert(tl[0],tl[1],tl[2], up[0],up[1],up[2], c, e);
        self._vert(tr[0],tr[1],tr[2], up[0],up[1],up[2], c, e);
      }
    }
    return this;
  };

  /* flat annulus on the XZ plane — used for the floor markers */
  Builder.prototype.ring = function (o) {
    var seg = o.seg || 36, ri = o.inner, ro = o.outer, y = o.y || 0;
    var c = rgb(o.color), e = o.emit === undefined ? 1 : o.emit, p = o.pos || [0,0,0];
    for (var i = 0; i < seg; i++) {
      var a0 = i/seg*Math.PI*2, a1 = (i+1)/seg*Math.PI*2;
      var q = [
        [p[0]+Math.cos(a0)*ri, p[1]+y, p[2]+Math.sin(a0)*ri],
        [p[0]+Math.cos(a1)*ri, p[1]+y, p[2]+Math.sin(a1)*ri],
        [p[0]+Math.cos(a1)*ro, p[1]+y, p[2]+Math.sin(a1)*ro],
        [p[0]+Math.cos(a0)*ro, p[1]+y, p[2]+Math.sin(a0)*ro]
      ];
      var ord = [0,1,2, 0,2,3];
      for (var t = 0; t < 6; t++) {
        var v = q[ord[t]];
        this._vert(v[0],v[1],v[2], 0,1,0, c, e);
      }
    }
    return this;
  };

  /* ------------------------------ shaders -------------------------------- */
  var VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute vec4 aCol;',
    'uniform mat4 uProj, uView, uModel;',
    'varying vec3 vN; varying vec4 vC; varying vec3 vW;',
    'void main(){',
    '  vec4 w = uModel * vec4(aPos,1.0);',
    '  vW = w.xyz;',
    '  vN = mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aNrm;',
    '  vC = aCol;',
    '  gl_Position = uProj * uView * w;',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec3 vN; varying vec4 vC; varying vec3 vW;',
    'uniform vec3 uKeyDir, uKeyCol, uFillDir, uFillCol, uSky, uGround, uFog, uCam, uTint;',
    'uniform float uTintAmt, uOpacity, uFogNear, uFogFar;',
    'void main(){',
    '  vec3 n = normalize(vN);',
    '  float k = max(dot(n, uKeyDir), 0.0);',
    '  float f = max(dot(n, uFillDir), 0.0) * 0.55;',
    '  vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5);',
    '  vec3 lit = vC.rgb * (amb + uKeyCol * k + uFillCol * f);',
    '  lit = mix(lit, vC.rgb * 1.75, vC.a);',           /* emissive faces */
    '  lit = mix(lit, uTint, uTintAmt);',
    '  float d = length(vW - uCam);',
    '  float fg = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0) * (1.0 - vC.a * 0.85);',
    '  gl_FragColor = vec4(mix(lit, uFog, fg), uOpacity);',
    '}'
  ].join('\n');

  /* ----------------------------- renderer -------------------------------- */
  function Renderer(canvas) {
    var opts = { antialias:true, alpha:true, premultipliedAlpha:false, depth:true };
    var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return null;
    this.gl = gl; this.canvas = canvas;

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.prog = p;

    this.a = { pos: gl.getAttribLocation(p,'aPos'), nrm: gl.getAttribLocation(p,'aNrm'), col: gl.getAttribLocation(p,'aCol') };
    this.u = {};
    ['uProj','uView','uModel','uKeyDir','uKeyCol','uFillDir','uFillCol','uSky','uGround',
     'uFog','uCam','uTint','uTintAmt','uOpacity','uFogNear','uFogFar'].forEach(function (k) {
      this.u[k] = gl.getUniformLocation(p, k);
    }, this);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  Renderer.prototype.upload = function (builder) {
    var gl = this.gl;
    function buf(arr, size) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      return { b: b, size: size };
    }
    return {
      pos: buf(builder.pos, 3), nrm: buf(builder.nrm, 3), col: buf(builder.col, 4),
      count: builder.n,
      aabb: { min: builder.min.slice(), max: builder.max.slice() },
      model: M4.ident(), tint: [0.4,1,0.95], tintAmt: 0, opacity: 1, hidden: false
    };
  };

  Renderer.prototype.resize = function () {
    var c = this.canvas, dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.floor(c.clientWidth * dpr), h = Math.floor(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.gl.viewport(0, 0, c.width, c.height);
    return c.clientWidth / Math.max(c.clientHeight, 1);
  };

  Renderer.prototype.begin = function (proj, view, camPos, env) {
    var gl = this.gl, u = this.u;
    gl.clearColor(env.clear[0], env.clear[1], env.clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniform3fv(u.uKeyDir, env.keyDir);   gl.uniform3fv(u.uKeyCol, env.keyCol);
    gl.uniform3fv(u.uFillDir, env.fillDir); gl.uniform3fv(u.uFillCol, env.fillCol);
    gl.uniform3fv(u.uSky, env.sky);         gl.uniform3fv(u.uGround, env.ground);
    gl.uniform3fv(u.uFog, env.fog);         gl.uniform3fv(u.uCam, camPos);
    gl.uniform1f(u.uFogNear, env.fogNear);  gl.uniform1f(u.uFogFar, env.fogFar);
  };

  Renderer.prototype.draw = function (mesh) {
    if (mesh.hidden || !mesh.count) return;
    var gl = this.gl, a = this.a, u = this.u;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos.b); gl.enableVertexAttribArray(a.pos); gl.vertexAttribPointer(a.pos,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nrm.b); gl.enableVertexAttribArray(a.nrm); gl.vertexAttribPointer(a.nrm,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.col.b); gl.enableVertexAttribArray(a.col); gl.vertexAttribPointer(a.col,4,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(u.uModel, false, mesh.model);
    gl.uniform3fv(u.uTint, mesh.tint);
    gl.uniform1f(u.uTintAmt, mesh.tintAmt);
    gl.uniform1f(u.uOpacity, mesh.opacity);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  };

  /* --------------------------- orbit camera ------------------------------ */
  function Camera() {
    this.tgt = [0,1,0];   this.tgtTo = [0,1,0];
    this.yaw = -0.7;      this.yawTo = -0.7;
    this.pitch = 0.52;    this.pitchTo = 0.52;
    this.dist = 20;       this.distTo = 20;
    this.minPitch = 0.10; this.maxPitch = 1.32;
    this.minDist = 4.5;   this.maxDist = 30;
    this.eye = [0,0,0];
    this.idle = 0;
  }
  Camera.prototype.focus = function (tgt, yaw, pitch, dist) {
    this.tgtTo = tgt.slice();
    if (yaw !== undefined) {
      /* take the short way round */
      var d = yaw - this.yawTo;
      while (d > Math.PI) { d -= Math.PI*2; }
      while (d < -Math.PI) { d += Math.PI*2; }
      this.yawTo += d;
    }
    if (pitch !== undefined) this.pitchTo = pitch;
    if (dist !== undefined) this.distTo = dist;
  };
  Camera.prototype.update = function (dt) {
    var k = 1 - Math.pow(0.0016, dt);      /* frame-rate independent damping */
    this.yaw   += (this.yawTo   - this.yaw)   * k;
    this.pitch += (this.pitchTo - this.pitch) * k;
    this.dist  += (this.distTo  - this.dist)  * k;
    for (var i = 0; i < 3; i++) this.tgt[i] += (this.tgtTo[i] - this.tgt[i]) * k;
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.eye[0] = this.tgt[0] + Math.sin(this.yaw) * cp * this.dist;
    this.eye[1] = this.tgt[1] + sp * this.dist;
    this.eye[2] = this.tgt[2] + Math.cos(this.yaw) * cp * this.dist;
    this.view = M4.lookAt(this.eye, this.tgt, [0,1,0]);
    return this.view;
  };

  /* --------------------------- ray / AABB -------------------------------- */
  /* screen (px, relative to canvas) -> world ray */
  function screenRay(px, py, w, h, invVP, eye) {
    var nx = (px / w) * 2 - 1, ny = 1 - (py / h) * 2;
    function un(z) {
      var x=invVP[0]*nx+invVP[4]*ny+invVP[8]*z+invVP[12],
          y=invVP[1]*nx+invVP[5]*ny+invVP[9]*z+invVP[13],
          zz=invVP[2]*nx+invVP[6]*ny+invVP[10]*z+invVP[14],
          ww=invVP[3]*nx+invVP[7]*ny+invVP[11]*z+invVP[15];
      return [x/ww, y/ww, zz/ww];
    }
    var far = un(1);
    var d = [far[0]-eye[0], far[1]-eye[1], far[2]-eye[2]];
    var l = Math.hypot(d[0],d[1],d[2]) || 1;
    return { o: eye, d: [d[0]/l, d[1]/l, d[2]/l] };
  }

  /* slab test; returns distance or -1 */
  function rayAABB(ray, min, max, pad) {
    pad = pad || 0;
    var t0 = -Infinity, t1 = Infinity;
    for (var i = 0; i < 3; i++) {
      var lo = min[i] - pad, hi = max[i] + pad;
      if (Math.abs(ray.d[i]) < 1e-8) { if (ray.o[i] < lo || ray.o[i] > hi) return -1; continue; }
      var inv = 1 / ray.d[i];
      var a = (lo - ray.o[i]) * inv, b = (hi - ray.o[i]) * inv;
      if (a > b) { var tmp = a; a = b; b = tmp; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return -1;
    }
    return t1 < 0 ? -1 : (t0 < 0 ? 0 : t0);
  }

  global.GL = {
    M4: M4, Builder: Builder, Renderer: Renderer, Camera: Camera,
    rgb: rgb, screenRay: screenRay, rayAABB: rayAABB
  };
})(window);
