/* ===========================================================================
   scene.js — turns a course definition into GPU meshes.
   The course supplies buildStatic() for the environment and one build() per
   station; everything else (markers, bounding boxes, camera framing) is
   derived here so course files stay content-shaped.
   =========================================================================== */
(function (global) {
  'use strict';

  function build(renderer, course) {
    var K = global.Kit;

    var sb = new GL.Builder();
    course.buildStatic(new K.At(sb, 0, 0, 0), K);
    var staticMesh = renderer.upload(sb);

    var stations = course.stations.map(function (def) {
      var b = new GL.Builder();
      def.build(new K.At(b, def.pos[0], def.pos[2], def.ry || 0), K);
      var mesh = renderer.upload(b);

      /* floating pin above the station */
      var pb = new GL.Builder();
      pb.cyl({ pos:[0,0.34,0], r:0.21, rTop:0.001, h:0.36, seg:5, color:'#ffffff', emit:1 });
      pb.cyl({ pos:[0,0.34,0], r:0.21, rTop:0.001, h:-0.40, seg:5, color:'#ffffff', emit:1 });
      var pin = renderer.upload(pb);

      /* pulsing ring on the floor */
      var rb = new GL.Builder();
      rb.ring({ inner:0.62, outer:0.76, y:0.03, color:'#ffffff', emit:1, seg:40 });
      var ring = renderer.upload(rb);

      /* Stations are authored facing +Z, so world facing is (sin ry, cos ry).
         Framing from that side shows the front of the prop, not its back. */
      var ry = def.ry || 0, fx = Math.sin(ry), fz = Math.cos(ry);
      var anchor = def.anchor || [def.pos[0], 2.0, def.pos[2]];

      return {
        id:def.id, num:def.num, name:def.name, tag:def.tag,
        mesh:mesh, pin:pin, ring:ring,
        anchor:anchor,
        pinPos:[anchor[0], anchor[1] + 0.55, anchor[2]],
        focus:{
          tgt:[def.pos[0] + fx * 0.7, def.focusY || 1.15, def.pos[2] + fz * 0.7],
          right:[Math.cos(ry), 0, -Math.sin(ry)],
          yaw:ry, pitch:def.pitch === undefined ? 0.34 : def.pitch,
          dist:def.dist || 6.2
        }
      };
    });

    return { staticMesh: staticMesh, stations: stations };
  }

  global.Scene = { build: build };
})(window);
