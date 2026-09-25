/* USB Drop Attack — 4 stations in 3D space */
window.COURSE = {
  id:'usb-drop-3d',
  slug:'usb-drop-3d',
  identifier:'USBDROP-3D-SCORM12',
  title:'USB Drop Attack',
  heading:'USB Drop Attack',
  subtitle:'Learn how to recognize and respond to a dropped USB device',
  passMark:70,
  backLabel:'Back to the office',
  passTitle:'Mission passed',
  failTitle:'Try again',

  env:{
    clear:[0.022,0.036,0.066],
    keyDir:[0.45,0.78,0.44], keyCol:[0.90,0.93,1.02],
    fillDir:[-0.52,0.34,-0.60], fillCol:[0.28,0.42,0.68],
    sky:[0.38,0.45,0.60], ground:[0.14,0.17,0.24],
    fog:[0.042,0.062,0.106], fogNear:20, fogFar:52
  },
  home:{ tgt:[0,1.0,0.4], yaw:0.18, pitch:0.47, dist:14 },

  buildStatic:function (a, K) {
    var C = K.C;
    K.floorSlab(a, 18, 15, '#1a2230', '#28334c');
    K.walkway(a, 0, 0.4, 15, 2.0, '#232e45');
    K.partition(a, 0, -4.8, 0, 15.5, 1.5);
    K.partition(a, -6.2, -1.8, Math.PI/2, 5.0, 1.5);
    K.partition(a,  6.2, -1.8, Math.PI/2, 5.0, 1.5);
    K.plant(a, 7.0, -3.5, 1.1);
    K.plant(a, -7.0, 3.9, 0.9);
    K.bin(a, 2.8, 3.6, '#2b3550');
    K.printer(a, 6.8, 2.8, -1.1);
    K.whiteboard(a, -7.2, -0.8, Math.PI/2, 2.2, 1.05);
    K.sign(a, 0, 1.15, -4.66, 0, 2.8, 0.3, C.blue, 0.6);
  },

  stations:[
    {
      id:'page1', num:1, name:'A Morning Discovery', tag:'Found it',
      pos:[0,0,-2.5], ry:0, anchor:[0,2.1,-2.5], dist:5.6, pitch:0.30, focusY:1.1,
      build:function (a, K) {
        K.desk(a, 3.0);
        K.monitor(a, -0.55, 0.9, -0.28, -0.18, '#1e3a5f', 0.75, 1.05);
        K.chair(a, 0, 1.35, Math.PI);
      },
      title:'An unknown USB drive on the floor',
      objective:'Never connect an unknown USB device to an organizational computer — hand it to IT/Security instead.',
      steps:[{
        setting:'Monday morning. You spot a USB drive on the floor near a workstation, labelled "2026_PAYROLL — CONFIDENTIAL SALARY DATA". It has no owner in sight.',
        prompt:'What should you do first?',
        choices:[
          { t:'Leave it untouched and report it to IT/Security', pts:10, tone:'good', fb:'Correct. Unknown removable media should never be connected — hand it to Security so it can be examined safely.' },
          { t:'Plug it into your work computer to see what is on it', pts:0, tone:'bad', fb:'This is exactly what a USB drop attack counts on. An unknown device can run hidden programs the moment it is connected.' },
          { t:'Take it home to check it safely later', pts:0, tone:'bad', fb:'Home is not safer, and it may still hold work data or credentials. Unknown media should go to Security, not into your bag.' }
        ]
      }]
    },
    {
      id:'page2', num:2, name:'Page 2', tag:'Detection',
      pos:[-5.8,-2.2,-1.5], ry:Math.PI/2, anchor:[-5.8,2.1,-1.5], dist:5.6, pitch:0.30, focusY:1.1,
      build:function (a, K) {
        K.desk(a, 3.0);
        K.monitor(a, -0.55, 0.9, -0.28, -0.18, '#1e3a5f', 0.75, 1.05);
        K.chair(a, 0, 1.35, Math.PI);
        K.wallScreen(a, 0, 1.5, -0.62, 0, 1.6, 1.0, '#3a1420', 0.85);
      },
      title:'Your endpoint security responds',
      objective:'Act on a security alert immediately — disconnect the device and let Security investigate.',
      steps:[{
        setting:'The drive got connected in this scenario, and your endpoint security flags it: unverified device, suspicious autorun behaviour, an unsigned executable.',
        prompt:'What is the right response to the alert?',
        choices:[
          { t:'Disconnect the device and let Security investigate', pts:10, tone:'good', fb:'Correct. Disconnecting stops further activity immediately; Security can take it from there.' },
          { t:'Dismiss the alert since nothing looks broken', pts:0, tone:'bad', fb:'Dismissing an alert does not stop the process behind it — it keeps running in the background.' },
          { t:'Open the flagged file to see how dangerous it really is', pts:0, tone:'bad', fb:'Opening a flagged file can launch the very payload the alert is warning you about.' }
        ]
      }]
    },
    {
      id:'page3', num:3, name:'Page 3', tag:'Containment',
      pos:[5.8,-2.2,-1.5], ry:-Math.PI/2, anchor:[5.8,2.1,-1.5], dist:5.6, pitch:0.30, focusY:1.1,
      build:function (a, K) {
        K.desk(a, 3.0);
        K.monitor(a, -0.55, 0.9, -0.28, -0.18, '#1e3a5f', 0.75, 1.05);
        K.chair(a, 0, 1.35, Math.PI);
        K.printer(a, 1.35, -0.35, 0.3);
      },
      title:'Containing the incident',
      objective:'Follow your procedure and leave investigation and cleanup to authorized staff.',
      steps:[{
        setting:'Security is deciding next steps for the workstation while the ticket is open.',
        prompt:'Which action best supports containment?',
        choices:[
          { t:'Isolate the workstation if your procedure requires it, and wait for authorized staff', pts:10, tone:'good', fb:'Correct. Isolating the machine limits spread while trained responders take over.' },
          { t:'Delete the suspicious files yourself and keep working', pts:0, tone:'bad', fb:'Deleting files yourself can destroy evidence and may not remove the threat at all.' },
          { t:'Ask a coworker to try the drive on their computer to compare notes', pts:0, tone:'bad', fb:'That only spreads the risk to a second person and a second device.' }
        ]
      }]
    },
    {
      id:'page4', num:4, name:'Page 4', tag:'Reporting',
      pos:[0,0,2.8], ry:Math.PI, anchor:[0,2.1,2.8], dist:5.6, pitch:0.30, focusY:1.1,
      build:function (a, K) {
        K.desk(a, 3.0);
        K.monitor(a, -0.55, 0.9, -0.28, -0.18, '#1e3a5f', 0.75, 1.05);
        K.chair(a, 0, 1.35, 0);
        K.deskPhone(a, 0.75, 0.78, -0.3, 0.2, false);
      },
      title:'Filing the incident report',
      objective:'Report what happened accurately and promptly through the official channel — it helps responders and protects others.',
      steps:[{
        setting:'You need to file a report so Security has a complete record of what happened.',
        prompt:'What should the report include?',
        choices:[
          { t:'Accurate details: what happened, where, and what actions were taken', pts:10, tone:'good', fb:'Correct. Honest, specific details help responders act quickly and correctly.' },
          { t:'A vague note that "something weird happened with a USB"', pts:0, tone:'bad', fb:'Vague reports slow down the response and may miss the details that matter most.' },
          { t:'Nothing — the security alert already logged it automatically', pts:0, tone:'bad', fb:'An automated alert does not capture what you saw or did. Your report still matters.' }
        ]
      }]
    }
  ],

  takeawaysById:null
};

/* per-station debrief takeaways, kept separate for readability */
(function () {
  var T = {
    page1:[
      'Never connect an unknown USB device to an organizational computer.',
      'Do not take an unknown device home — hand it to IT/Security instead.'
    ],
    page2:[
      'Act on a security alert right away; do not dismiss it.',
      'Disconnecting a flagged device stops the activity while Security investigates.'
    ],
    page3:[
      'Isolate a compromised machine if your procedure calls for it.',
      'Leave investigation and cleanup to authorized staff — do not try to fix it yourself.'
    ],
    page4:[
      'Report suspicious removable media through your official reporting channel.',
      'Give accurate, specific details: what happened, when, where and what you did.'
    ]
  };
  window.COURSE.stations.forEach(function (s) { s.takeaways = T[s.id]; });
})();
