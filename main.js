// ─── Audio ───────────────────────────────────────────────────────────────────
// Uses tikinoise.mp3 for the storm ambience — starts at 52s, loop+pause/resume
var audioContext, gainNode, windGain;
var tikiBuffer = null;       // decoded mp3 data
var tikiSource = null;        // currently playing source (if any)
var tikiStartOffset = 52.0;   // where in the file we are (persists across pauses)
var tikiStartedAt = 0;        // audioContext.currentTime when last started
var TIKI_LOOP_START = 52.0;
var tikiPendingStart = false; // set if startTikiAudio was called before buffer was ready
var tikiArrayBufferPromise = null; // eagerly kick off the MP3 download on page load

// Start downloading the MP3 immediately — AudioContext can't be created until
// a user gesture, but the bytes can be cached. credentials: 'omit' matches the
// <link rel="preload" crossorigin="anonymous"> so the browser reuses its cache.
tikiArrayBufferPromise = fetch('tikinoise.mp3', { credentials: 'omit' })
  .then(function(res) { return res.arrayBuffer(); })
  .catch(function(err) { console.warn('Failed to preload tikinoise.mp3', err); return null; });

function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // iOS audio unlock — play a silent 1-sample buffer within the user gesture
  // to transition the context to running state. Without this, iOS Safari
  // sometimes keeps Web Audio silent even after resume().
  try {
    var silent = audioContext.createBuffer(1, 1, 22050);
    var unlock = audioContext.createBufferSource();
    unlock.buffer = silent;
    unlock.connect(audioContext.destination);
    unlock.start(0);
  } catch(e) { /* ignore */ }

  if (audioContext.state === 'suspended') audioContext.resume();
  gainNode = audioContext.createGain();
  gainNode.gain.value = 1.0;
  gainNode.connect(audioContext.destination);

  windGain = audioContext.createGain();
  windGain.gain.value = 0;
  windGain.connect(gainNode);

  // Some platforms suspend the context again when the tab is backgrounded or
  // when the user switches apps. Resume on every subsequent user gesture.
  var resumeOnGesture = function() {
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
  };
  document.addEventListener('touchstart', resumeOnGesture, { passive: true });
  document.addEventListener('mousedown', resumeOnGesture, { passive: true });

  // Decode the pre-fetched bytes as soon as we have a context
  tikiArrayBufferPromise
    .then(function(data) {
      if (!data) return null;
      return audioContext.decodeAudioData(data);
    })
    .then(function(buf) {
      if (!buf) return;
      tikiBuffer = buf;
      // If the hurricane already tried to start, kick it off now
      if (tikiPendingStart) {
        tikiPendingStart = false;
        startTikiAudio();
      }
    })
    .catch(function(err) { console.warn('Failed to decode tikinoise.mp3', err); });
}

// Start/resume playback of tikinoise.mp3 from where we paused (or 52s first time)
function startTikiAudio() {
  if (!audioContext) return;
  if (!tikiBuffer) { tikiPendingStart = true; return; } // will auto-start when buffer is ready
  if (tikiSource) return; // already playing
  // Mobile Safari/Chrome may re-suspend the context between gestures; nudge it back
  if (audioContext.state === 'suspended') { try { audioContext.resume(); } catch(e){} }
  tikiSource = audioContext.createBufferSource();
  tikiSource.buffer = tikiBuffer;
  tikiSource.loop = true;
  tikiSource.loopStart = TIKI_LOOP_START;
  tikiSource.loopEnd = tikiBuffer.duration;
  tikiSource.connect(windGain);
  tikiStartedAt = audioContext.currentTime;
  tikiSource.start(0, tikiStartOffset);
}

// Pause: stop the source but remember where we were so we can resume
function pauseTikiAudio() {
  if (!tikiSource || !audioContext || !tikiBuffer) return;
  // Update offset by how long we've been playing, wrapping in the loop region
  var elapsed = audioContext.currentTime - tikiStartedAt;
  var loopLen = tikiBuffer.duration - TIKI_LOOP_START;
  // How far have we traveled past the start offset?
  var rel = tikiStartOffset - TIKI_LOOP_START + elapsed;
  rel = ((rel % loopLen) + loopLen) % loopLen; // positive modulo
  tikiStartOffset = TIKI_LOOP_START + rel;
  try { tikiSource.stop(); } catch(e) {}
  try { tikiSource.disconnect(); } catch(e) {}
  tikiSource = null;
}

function setWindIntensity(v) {
  if (!windGain) return;
  windGain.gain.value = Math.min(1, v);
}

// Thunder / modulation are no-ops now since the mp3 contains the storm sound
function triggerThunder() { /* sound is in the mp3 */ }
function modulateWind() { /* sound is in the mp3 */ }

function muteAudio() {
  if (windGain) windGain.gain.value = 0;
  pauseTikiAudio();
}

// ─── DOM ─────────────────────────────────────────────────────────────────────
var splash = document.getElementById('splash');
var acceptButton = document.getElementById('accept');
var shakeHint = document.getElementById('shake');

document.addEventListener('palm-start', function() { start(); }, false);

// ─── Physics ─────────────────────────────────────────────────────────────────
var restDrag = 0.85;
var physics = new ParticleSystem(+0.34, -3, 0, restDrag);

var numPoints = 10;
var segmentLength = getSegmentLength();
var padding = 60;

var mousePos = new Point(view.size.width / 2, view.size.height - segmentLength);
var targetMousePos = new Point(view.size.width / 2, view.size.height - segmentLength);
var easing = 0.04;

var particles = [];
var supports = [];
var supports2 = [];
var springs = [];

var peaking = false;
var prevPeaking = false;
var stress = 0;
var hue = 0;
var frameCount = 0;
var firstPlay = true;
var hintTimeout;
var maxForce = 30;
var bend = -0.012;
// Initialize to mousePos start position so first-frame dx/dy isn't huge
var prevMouseX = view.size.width / 2, prevMouseY = view.size.height - segmentLength;
var mouseSpeed = 0, mouseSpeedSmoothed = 0;
var started = false;
// Initialize to "recent activity" so the idle drift doesn't fire at full strength
// the instant start() is called (before the user has had a chance to move their mouse).
var lastMouseActivityTime = Date.now();

// ─── Scene: day (sun, clouds, ocean, sand) + night (stars, moon) ────────────
var stars = [];
var moon, moonGlow;
var discoGrid = []; // cross-hatch "facets" on the ball
var discoSparkles = []; // bright twinkling dots that flash during the storm
var sunParts = [];
var clouds = [];
var ocean, sand, waveHighlight;
var waveLines = [];
var foamFlecks = [];
var shorelineWave, shorelineSegs, shorelineBaseY;
var oceanTopY, oceanBotY, sandTopY, sandBotY;

function makeOceanDayColor(topY, botY, w) {
  return new GradientColor(
    new Gradient([['#155f7f', 0], ['#2a8fb0', 0.55], ['#5cc0d8', 1]]),
    new Point(0, topY), new Point(0, botY)
  );
}
function makeOceanStormColor(topY, botY) {
  return new GradientColor(
    new Gradient([['#081a24', 0], ['#12323f', 0.6], ['#1d4754', 1]]),
    new Point(0, topY), new Point(0, botY)
  );
}
function makeSandDayColor(topY, botY) {
  return new GradientColor(
    new Gradient([['#F0D9A0', 0], ['#D9BE80', 1]]),
    new Point(0, topY), new Point(0, botY)
  );
}
function makeSandStormColor(topY, botY) {
  return new GradientColor(
    new Gradient([['#9b876a', 0], ['#75634a', 1]]),
    new Point(0, topY), new Point(0, botY)
  );
}

function buildScene() {
  var w = view.size.width;
  var h = view.size.height;

  // ─── Ocean (horizon) and sand (foreground beach) ───
  // Ocean 7.5% tall (was 15%), sand 4.5% tall (was 3%)
  oceanTopY = h * 0.88;
  oceanBotY = h * 0.955;
  sandTopY = h * 0.955;
  sandBotY = h * 1.0;

  ocean = new Path.Rectangle(new Point(0, oceanTopY), new Size(w, oceanBotY - oceanTopY));
  ocean.fillColor = makeOceanDayColor(oceanTopY, oceanBotY, w);

  // Foam flecks — small elliptical highlights scattered across the ocean, drifting horizontally
  var fleckCount = 14;
  for (var fi = 0; fi < fleckCount; fi++) {
    var fx = Math.random() * w;
    var fy = oceanTopY + 3 + Math.random() * (oceanBotY - oceanTopY - 6);
    var fleckW = 5 + Math.random() * 11;
    var fleckH = 1 + Math.random() * 1.2;
    var fleck = new Path.Oval(new Rectangle(fx - fleckW / 2, fy - fleckH / 2, fleckW, fleckH));
    fleck.fillColor = new Color(1, 1, 1, 0.25 + Math.random() * 0.35);
    foamFlecks.push({
      path: fleck,
      x: fx,
      yFrac: (fy - oceanTopY) / (oceanBotY - oceanTopY),
      width: fleckW,
      height: fleckH,
      baseOp: fleck.opacity,
      driftSpeed: 0.12 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
      bobAmp: 0.8 + Math.random() * 1.4
    });
  }

  // Shoreline wave — a gentle wavy curve right where ocean meets sand, like lapping foam
  shorelineWave = new Path();
  shorelineWave.strokeColor = new Color(1, 1, 1, 0.75);
  shorelineWave.strokeWidth = 1.8;
  shorelineWave.strokeCap = 'round';
  shorelineSegs = 28;
  shorelineBaseY = oceanBotY - 1.5;
  for (var si = 0; si <= shorelineSegs; si++) {
    shorelineWave.add(new Point((w / shorelineSegs) * si, shorelineBaseY));
  }
  shorelineWave.smooth();

  // Legacy alias — older code may set .opacity via waveHighlight
  waveHighlight = shorelineWave;

  sand = new Path.Rectangle(new Point(0, sandTopY), new Size(w, sandBotY - sandTopY));
  sand.fillColor = makeSandDayColor(sandTopY, sandBotY);

  // ─── Daytime sun (layered warm glow) ───
  var sx = Math.round(w * 0.82);
  var sy = Math.round(h * 0.15);
  var sunHaze = new Path.Circle(new Point(sx, sy), 80);
  sunHaze.fillColor = new Color(1, 0.95, 0.7, 0.06);
  sunParts.push(sunHaze);
  var sunGlow2 = new Path.Circle(new Point(sx, sy), 55);
  sunGlow2.fillColor = new Color(1, 0.92, 0.5, 0.12);
  sunParts.push(sunGlow2);
  var sunGlow1 = new Path.Circle(new Point(sx, sy), 40);
  sunGlow1.fillColor = new Color(1, 0.9, 0.4, 0.25);
  sunParts.push(sunGlow1);
  var sunCore = new Path.Circle(new Point(sx, sy), 28);
  sunCore.fillColor = new Color(1, 0.97, 0.85, 1);
  sunParts.push(sunCore);

  // ─── Fluffy clouds (multi-blob) ───
  var cloudConfigs = [
    { x: w * 0.12, y: h * 0.1, scale: 1.0 },
    { x: w * 0.38, y: h * 0.16, scale: 0.7 },
    { x: w * 0.58, y: h * 0.08, scale: 0.85 },
    { x: w * 0.75, y: h * 0.22, scale: 0.6 }
  ];
  for (var ci = 0; ci < cloudConfigs.length; ci++) {
    var cc = cloudConfigs[ci];
    var sc = cc.scale;
    var group = [];
    var blobData = [
      { dx: 0, dy: 0, rw: 50, rh: 22 },
      { dx: -30, dy: 4, rw: 35, rh: 18 },
      { dx: 28, dy: 2, rw: 40, rh: 20 },
      { dx: -12, dy: -8, rw: 38, rh: 16 },
      { dx: 15, dy: -6, rw: 32, rh: 14 }
    ];
    for (var bi = 0; bi < blobData.length; bi++) {
      var bd = blobData[bi];
      var blob = new Path.Oval(new Rectangle(
        cc.x + bd.dx * sc - bd.rw * sc / 2,
        cc.y + bd.dy * sc - bd.rh * sc / 2,
        bd.rw * sc, bd.rh * sc
      ));
      blob.fillColor = new Color(1, 1, 1, 0.7 - bi * 0.04);
      group.push(blob);
    }
    clouds.push({ blobs: group, baseX: cc.x, speed: 0.08 + ci * 0.03 });
  }

  // ─── Night stars (hidden during day) ───
  for (var si = 0; si < 80; si++) {
    var sxs = Math.round(Math.random() * w);
    var sys = Math.round(Math.random() * h * 0.7);
    var starSize = 0.5 + Math.random() * 2;
    var baseOp = 0.2 + Math.random() * 0.5;
    var star = new Path.Circle(new Point(sxs, sys), starSize);
    star.fillColor = new Color(1, 1, 1, baseOp);
    star.opacity = 0;
    stars.push({
      path: star,
      baseOpacity: baseOp,
      twinkleSpeed: 0.5 + Math.random() * 2,
      twinklePhase: Math.random() * Math.PI * 2
    });
  }

  // Place the disco ball at the same spot the sun occupies during the day,
  // so the element at the upper-right-corner doesn't "jump" between modes.
  var mx = Math.round(w * 0.82);
  var my = Math.round(h * 0.15);
  var ballR = 25;

  // Halo / glow — matches the original moon's halo (45 radius)
  moonGlow = new Path.Circle(new Point(mx, my), 45);
  moonGlow.fillColor = new Color(1, 0.85, 1, 0.12);
  moonGlow.opacity = 0;

  // The ball body — same radius/position as the original moon
  moon = new Path.Circle(new Point(mx, my), ballR);
  moon.fillColor = new Color(0.78, 0.78, 0.85);
  moon.opacity = 0;

  // Disco facet grid — straight lines across the circle forming a cross-hatch.
  // Using a clip-free approach: draw short chords at various offsets so they
  // naturally stay within the ball's circumference.
  for (var dg = -3; dg <= 3; dg++) {
    var off = dg * 7;
    var inside = ballR * ballR - off * off;
    if (inside <= 0) continue;
    var edge = Math.sqrt(inside);
    // vertical-ish facet line
    var vLine = new Path();
    vLine.strokeColor = new Color(0.25, 0.22, 0.35, 0.6);
    vLine.strokeWidth = 0.8;
    vLine.add(new Point(mx + off, my - edge));
    vLine.add(new Point(mx + off, my + edge));
    vLine.opacity = 0;
    discoGrid.push(vLine);
    // horizontal-ish facet line
    var hLine = new Path();
    hLine.strokeColor = new Color(0.25, 0.22, 0.35, 0.6);
    hLine.strokeWidth = 0.8;
    hLine.add(new Point(mx - edge, my + off));
    hLine.add(new Point(mx + edge, my + off));
    hLine.opacity = 0;
    discoGrid.push(hLine);
  }

  // Bright twinkling sparkles distributed across the ball face
  for (var ds = 0; ds < 8; ds++) {
    var sAngle = (ds / 8) * Math.PI * 2 + Math.random() * 0.6;
    var sR = 4 + Math.random() * (ballR - 8);
    var sx = mx + Math.cos(sAngle) * sR;
    var sy = my + Math.sin(sAngle) * sR;
    var sparkle = new Path.Circle(new Point(sx, sy), 1.8 + Math.random() * 1.7);
    sparkle.fillColor = '#fff';
    sparkle.opacity = 0;
    discoSparkles.push({
      path: sparkle,
      baseX: sx, baseY: sy,
      phase: Math.random() * Math.PI * 2,
      speed: 3 + Math.random() * 5,
      hueOffset: Math.random() * 360
    });
  }
}
buildScene();

// ─── Trunk Paths ─────────────────────────────────────────────────────────────
var trunkFill = new Path();
trunkFill.closed = true;
trunkFill.fillColor = '#B8893E';

var trunkTexture = new Path();
trunkTexture.closed = true;
trunkTexture.fillColor = new Color(0, 0, 0, 0.06);
trunkTexture.visible = false; // perf: 1px-offset duplicate of trunkFill, negligible visual gain

var trunkRings = [];
for (var ri = 0; ri < 6; ri++) {
  var ring = new Path();
  ring.strokeColor = new Color(0.35, 0.24, 0.08, 0.5);
  ring.strokeWidth = 1.5;
  trunkRings.push(ring);
}

// ─── Fronds (unified banana shape with V-notches — 9 fronds) ────────────────
var numFronds = 9;
var frondGroups = [];
var frondJigglers = [];
var frondBaseAngles = [];

for (var fi = 0; fi < numFronds; fi++) {
  var baseAngle = (-165 + fi * (160 / (numFronds - 1))) * Math.PI / 180;
  frondBaseAngles.push(baseAngle);

  // Shadow half (darker) — drawn first, underneath
  var frondShadow = new Path();
  frondShadow.closed = true;
  frondShadow.fillColor = '#2A6B29';

  // Main frond body (lighter) — on top
  var frondBody = new Path();
  frondBody.closed = true;
  frondBody.fillColor = '#5AAE4A';
  frondBody.strokeColor = '#1F5F1F';
  frondBody.strokeWidth = 1.5;
  frondBody.strokeJoin = 'round';

  // Central midrib line
  var midrib = new Path();
  midrib.strokeColor = '#2A6B29';
  midrib.strokeWidth = 1.2;

  frondGroups.push({ body: frondBody, shadow: frondShadow, midrib: midrib });

  var jig = new Jiggler(0);
  jig.k = 2;
  jig.mass = 8;
  jig.d = 0.75;
  jig.rest = Math.sin(fi * 1.3) * 2;
  frondJigglers.push(jig);
}

// ─── Rain drops (pre-allocated, hidden by default) ───────────────────────
var rainCount = 100;
var rainDrops = [];
for (var ri = 0; ri < rainCount; ri++) {
  var drop = new Path();
  var dropLen = 20 + Math.random() * 20;
  drop.add(new Point(0, 0));
  drop.add(new Point(-dropLen * 0.3, dropLen));   // diagonal wind slant
  drop.strokeColor = new Color(0.85, 0.92, 1.0, 0.7);
  drop.strokeWidth = 1 + Math.random();
  drop.strokeCap = 'round';
  drop.opacity = 0;
  drop.position = new Point(-500, -500);
  // Spread drops across the visible area (and slightly past the right edge so wind drifts into view)
  rainDrops.push({
    path: drop,
    x: Math.random() * view.size.width * 1.3,
    y: Math.random() * view.size.height,
    speedY: 14 + Math.random() * 10,
    speedX: -3 - Math.random() * 3
  });
}

// ─── Lightning (one pre-allocated bolt, flashes briefly) ──────────────────
var lightningBolt = new Path();
lightningBolt.strokeColor = new Color(1, 1, 1, 1);
lightningBolt.strokeWidth = 3;
lightningBolt.strokeCap = 'round';
lightningBolt.strokeJoin = 'round';
lightningBolt.opacity = 0;
var nextLightningTime = 0;

// Full-screen white flash that accompanies a lightning strike
var lightningFlash = new Path.Rectangle(new Point(-50, -50),
  new Size(view.size.width + 100, view.size.height + 100));
lightningFlash.fillColor = new Color(1, 1, 1, 1);
lightningFlash.opacity = 0;

// ─── Hurricane Text ──────────────────────────────────────────────────────────
var hurricaneText = new PointText(new Point(view.size.width / 2, view.size.height / 2));
hurricaneText.content = '';
hurricaneText.fillColor = '#fff';
hurricaneText.characterStyle = { font: 'Arial Black', fontSize: 72 };
hurricaneText.paragraphStyle = { justification: 'center' };
hurricaneText.opacity = 0;
var hurricanePhrases = [
  'COCONUT STORM', 'FLAMINGO APOCALYPSE', 'PINEAPPLE PANIC',
  'TIKI TIME', 'MAI TAI MAYHEM', 'HIBISCUS HAVOC',
  'TOO MANY UMBRELLAS', 'WHERE IS MY SUNSCREEN',
  'CAT 5 BUT TROPICAL', 'THIS IS FINE 🍹', 'YIKES',
  'EVACUATE THE BEACH CHAIRS', 'COWABUNGA'
];
var lastPhraseFrame = 0;

// ─── Coconuts ────────────────────────────────────────────────────────────────
var coconuts = [];
var coconutLaunched = false;
var coconutCluster = [];
for (var ci = 0; ci < 5; ci++) {
  var cocoR = 20 + Math.random() * 4;   // bigger coconuts
  // Start off-screen so they don't flash at (0,0) on first render before drawFronds positions them
  var coco = new Path.Circle(new Point(-200, -200), cocoR);
  coco.fillColor = '#5A3518';
  coco.strokeColor = '#3A1F0C';
  coco.strokeWidth = 1.5;
  var highlightR = 6 + Math.random() * 2;
  var highlight = new Path.Circle(new Point(-200, -200), highlightR);
  highlight.fillColor = new Color(1, 1, 1, 0.2);
  coconutCluster.push({
    path: coco,
    highlight: highlight,
    radius: cocoR,
    offsetAngle: Math.PI * 0.3 + ci * 0.35 + Math.random() * 0.15,
    offsetR: 22 + Math.random() * 8
  });
}

// ─── Build Body ──────────────────────────────────────────────────────────────
function buildBody() {
  for (var i = 0; i < numPoints; i++) {
    var x = view.size.width / 2;
    var y = view.size.height - (i - 1) * segmentLength;

    var particle = physics.makeParticle(2.5, x, y, 0);
    var support = physics.makeParticle(1, x, y - segmentLength, 0);
    var support2 = physics.makeParticle(1, x, y + segmentLength, 0);

    if (i > 0) {
      physics.makeSpring(particle, supports[i - 1], 0.6, 0.48, 0);
      physics.makeSpring(particles[i - 1], support2, 0.3, 0.7, 0);
      springs.push(physics.makeSpring(particle, particles[i - 1], 0.2, 0.1, segmentLength));
    }

    if (i < 2) particle.makeFixed();
    support.makeFixed();
    support2.makeFixed();

    particles.push(particle);
    supports.push(support);
    supports2.push(support2);
  }
}
buildBody();

// ─── Input ───────────────────────────────────────────────────────────────────
var isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) shakeHint.textContent = 'Drag your finger.';

function handleTouchPoint(touch) {
  var rect = document.getElementById('canvas').getBoundingClientRect();
  var a = Math.atan2(touch.clientY - rect.top - view.size.height, touch.clientX - rect.left - view.size.width / 2);
  targetMousePos.x = view.size.width / 2 + Math.cos(a) * segmentLength * 3;
  targetMousePos.y = view.size.height + Math.sin(a) * segmentLength;
  lastMouseActivityTime = Date.now();
}

// touchstart — tap moves the palm immediately (not just drag).
// Passive: browser decides scroll behavior itself (touch-action: none on the
// canvas already blocks scroll/zoom there). Calling preventDefault in a
// touchstart listener on desktop trackpads with touch emulation can cancel
// the subsequent mousedown/mousemove chain that Paper.js listens for.
document.addEventListener('touchstart', function(e) {
  if (!e.touches || !e.touches[0]) return;
  if (e.target && e.target.closest && e.target.closest('#splash, #credits, #credits-trigger, #atas-logo-link')) return;
  handleTouchPoint(e.touches[0]);
}, { passive: true });

document.addEventListener('touchmove', function(e) {
  if (!e.touches || !e.touches[0]) return;
  e.preventDefault();
  handleTouchPoint(e.touches[0]);
}, { passive: false });

// Device motion — on iOS 13+ requires a user-gesture permission request.
// We call this on the 'accept' click; see start().
var deviceMotionEnabled = false;
function enableDeviceMotion() {
  if (!window.DeviceMotionEvent) return;
  var attach = function() {
    if (deviceMotionEnabled) return;
    deviceMotionEnabled = true;
    window.addEventListener('devicemotion', function(e) {
      var acc = e.accelerationIncludingGravity;
      if (acc) {
        physics.gravity.x += acc.x * 0.05;
        physics.gravity.y += acc.y * 0.02;
      }
    });
  };
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    // iOS 13+: must request permission from a user gesture
    DeviceMotionEvent.requestPermission()
      .then(function(state) { if (state === 'granted') attach(); })
      .catch(function(){ /* user declined; touch drag still works */ });
  } else {
    // Non-iOS or older iOS: attach directly
    attach();
  }
}

function onMouseMove(event) {
  var a = Math.atan2(event.point.y - view.size.height, event.point.x - view.size.width / 2);
  targetMousePos.x = view.size.width / 2 + Math.cos(a) * segmentLength * 3;
  targetMousePos.y = view.size.height + Math.sin(a) * segmentLength;
  lastMouseActivityTime = Date.now();
}

// When mouse leaves the canvas/page, tree springs back to upright center
document.addEventListener('mouseleave', function() {
  targetMousePos.x = view.size.width / 2;
  targetMousePos.y = view.size.height - segmentLength;
}, false);
document.addEventListener('mouseout', function(e) {
  // Fire only when mouse truly leaves the document (not just moves over a child)
  if (!e.relatedTarget && !e.toElement) {
    targetMousePos.x = view.size.width / 2;
    targetMousePos.y = view.size.height - segmentLength;
  }
}, false);

function onResize() {
  var w = view.size.width, h = view.size.height;
  segmentLength = getSegmentLength();
  particles[0].position.x = w / 2;
  particles[0].position.y = h + segmentLength;
  targetMousePos.x = w / 2;
  targetMousePos.y = h - segmentLength;
  for (var i = 0; i < springs.length; i++) springs[i].length = segmentLength;
  var diag = Math.sqrt(w * w + h * h) * 0.7;
  hurricaneText.point = new Point(w / 2, h / 2);
  oceanTopY = h * 0.88;
  oceanBotY = h * 0.955;
  sandTopY = h * 0.955;
  sandBotY = h * 1.0;
  shorelineBaseY = oceanBotY - 1.5;
  if (ocean) {
    ocean.bounds = new Rectangle(0, oceanTopY, w, oceanBotY - oceanTopY);
    ocean.fillColor = peaking ? makeOceanStormColor(oceanTopY, oceanBotY) : makeOceanDayColor(oceanTopY, oceanBotY, w);
  }
  if (sand) {
    sand.bounds = new Rectangle(0, sandTopY, w, sandBotY - sandTopY);
    sand.fillColor = peaking ? makeSandStormColor(sandTopY, sandBotY) : makeSandDayColor(sandTopY, sandBotY);
  }
  // Re-lay foam flecks across new width, preserving their vertical fraction
  for (var fi = 0; fi < foamFlecks.length; fi++) {
    var ff = foamFlecks[fi];
    ff.x = (ff.x / (ff.x || 1)) * ff.x; // keep x but clamp to new w below
    if (ff.x > w) ff.x = Math.random() * w;
    var newY = oceanTopY + ff.yFrac * (oceanBotY - oceanTopY);
    ff.path.position = new Point(ff.x, newY);
  }
  if (lightningFlash) lightningFlash.bounds = new Rectangle(-50, -50, w + 100, h + 100);
}

function getSegmentLength() { return view.size.height / numPoints * 0.65; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ─── Start ───────────────────────────────────────────────────────────────────
function start() {
  if (started) return;
  started = true;
  splash.style.display = 'none';
  try { initAudio(); muteAudio(); } catch(e) { /* audio may fail, continue anyway */ }
  try { enableDeviceMotion(); } catch(e) { /* ignore */ }
  // Show the hint sooner on mobile where interaction is less obvious
  hintTimeout = setTimeout(function() { shakeHint.style.display = 'block'; }, isTouchDevice ? 5000 : 15000);
  // Reset stress/speed state so anything that built up before click is cleared
  stress = 0;
  mouseSpeed = 0;
  mouseSpeedSmoothed = 0;
  prevMouseX = mousePos.x;
  prevMouseY = mousePos.y;
  lastMouseActivityTime = Date.now();
  // Force initial daytime scene setup (since updateStars only runs transition branches)
  sunParts[0].opacity = 0.06;
  sunParts[1].opacity = 0.12;
  sunParts[2].opacity = 0.25;
  sunParts[3].opacity = 1.0;
  for (var si = 0; si < stars.length; si++) { stars[si].path.opacity = 0; stars[si].path.visible = false; }
  moon.opacity = 0; moon.visible = false;
  moonGlow.opacity = 0; moonGlow.visible = false;
  for (var dgi = 0; dgi < discoGrid.length; dgi++) { discoGrid[dgi].opacity = 0; discoGrid[dgi].visible = false; }
  for (var dsi = 0; dsi < discoSparkles.length; dsi++) { discoSparkles[dsi].path.opacity = 0; discoSparkles[dsi].path.visible = false; }
  lightningBolt.visible = false;
  lightningFlash.visible = false;
  for (var rii = 0; rii < rainDrops.length; rii++) rainDrops[rii].path.visible = false;
  ocean.fillColor = makeOceanDayColor(oceanTopY, oceanBotY);
  sand.fillColor = makeSandDayColor(sandTopY, sandBotY);
  shorelineWave.opacity = 1;
  for (var fi = 0; fi < foamFlecks.length; fi++) foamFlecks[fi].path.opacity = foamFlecks[fi].baseOp;
  for (var ci = 0; ci < clouds.length; ci++) {
    for (var bi = 0; bi < clouds[ci].blobs.length; bi++) {
      clouds[ci].blobs[bi].opacity = 0.7 - bi * 0.04;
    }
  }
}

// Main loop
setInterval(function() {
  physics.gravity.x = Math.sin(Date.now() / 5000) * 0.2 + Math.sin(Date.now() / 8000) * 0.1;
  physics.gravity.y = Math.sin(Date.now() / 6000) * 0.15 - 3;
  setPositions();
  updateAppearance();
  physics.tick(1.0);
  Jiggler.update();
  frameCount++;
  updateStars();
  drawTrunk();
  drawFronds();
  updateCoconuts();
  updateRain();
  updateLightning();
  updateWaves();
  applyScreenShake();
  view.draw();
  prevPeaking = peaking;
}, 1000 / 60);

// Animate shoreline wave crest + drifting foam flecks
function updateWaves() {
  if (peaking) return;
  var w = view.size.width;
  var t = frameCount * 0.05;

  // Shoreline: set each segment's y to a sine-wave for lapping effect
  if (shorelineWave) {
    var segs = shorelineWave.segments;
    for (var i = 0; i < segs.length; i++) {
      var phase = (i / shorelineSegs) * Math.PI * 4;
      segs[i].point.y = shorelineBaseY + Math.sin(t + phase) * 1.6;
    }
  }

  // Drift flecks horizontally, wrap around, bob vertically
  for (var fi = 0; fi < foamFlecks.length; fi++) {
    var ff = foamFlecks[fi];
    ff.x += ff.driftSpeed;
    if (ff.x > w + 20) ff.x = -20;
    var yBase = oceanTopY + ff.yFrac * (oceanBotY - oceanTopY);
    var bob = Math.sin(t + ff.phase) * ff.bobAmp;
    ff.path.position = new Point(ff.x, yBase + bob * 0.3);
    // Subtle opacity twinkle
    ff.path.opacity = ff.baseOp * (0.75 + 0.25 * Math.sin(t * 1.7 + ff.phase));
  }
}

// ─── Set Positions ───────────────────────────────────────────────────────────
function setPositions() {
  // Calm-state idle drift — pulls the tip back to rest after 200ms of no mouse
  // activity. Disabled during peaking: we WANT the palm thrashing wildly
  // throughout the storm, not centering.
  if (started && !peaking) {
    var sinceActivity = Date.now() - lastMouseActivityTime;
    if (sinceActivity > 200) {
      var ramp = Math.min(1, (sinceActivity - 200) / 400);
      var driftStr = 0.18 * ramp;
      var restX = view.size.width / 2;
      var restY = view.size.height - segmentLength;
      targetMousePos.x += (restX - targetMousePos.x) * driftStr;
      targetMousePos.y += (restY - targetMousePos.y) * driftStr;
    }
  }

  // (No storm-wind auto-thrashing — the palm stops when the mouse stops,
  // even mid-hurricane. Stress then naturally decays and the storm winds down.)

  mousePos.x += (targetMousePos.x - mousePos.x) * easing;
  mousePos.y += (targetMousePos.y - mousePos.y) * easing;

  var dx = mousePos.x - prevMouseX;
  var dy = mousePos.y - prevMouseY;
  mouseSpeed = Math.sqrt(dx * dx + dy * dy);
  mouseSpeedSmoothed += (mouseSpeed - mouseSpeedSmoothed) * 0.03;
  prevMouseX = mousePos.x;
  prevMouseY = mousePos.y;

  particles[1].position.x = clamp(mousePos.x, padding, view.size.width - padding);
  particles[1].position.y = mousePos.y;

  var targetStress = 0;

  for (var i = 1; i < numPoints; i++) {
    var curP = particles[i];
    curP.position.x = clamp(curP.position.x, padding, view.size.width - padding);

    var prevP = particles[i - 1];
    var angle = Math.atan2(curP.position.y - prevP.position.y, curP.position.x - prevP.position.x);

    var force = curP.force.length();
    if (force > maxForce) { curP.force.scale(maxForce / force); force = maxForce; }
    if (i > 1) targetStress += force;

    supports[i].position.x = curP.position.x + Math.cos(angle + i * bend) * segmentLength;
    supports[i].position.y = curP.position.y + Math.sin(angle + i * bend) * segmentLength;
    supports2[i].position.x = curP.position.x + Math.cos(Math.PI + angle) * segmentLength;
    supports2[i].position.y = curP.position.y + Math.sin(Math.PI + angle) * segmentLength;
  }

  var speedStress = mouseSpeedSmoothed * 5;
  targetStress = Math.max(targetStress, speedStress);
  stress += (targetStress - stress) * 0.06;
}

// ─── Appearance ──────────────────────────────────────────────────────────────
// Touch devices build stress more slowly (slower drag vs mouse fling) and use
// a narrower screen, so use a lower threshold.
var _touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
// Tuned so ~half a second of sustained vigorous shaking triggers.
var hurricaneThreshold = _touch ? 40 : 50;
var hurricaneExitThreshold = _touch ? 20 : 25;   // HYSTERESIS — must drop below this to exit

function updateAppearance() {
  // No ambient wind sound — audio is totally silent until the hurricane triggers

  // Hysteresis state machine — prevents the peaking flicker that causes freeze
  if (!peaking && stress > hurricaneThreshold) {
    peaking = true;
  } else if (peaking && stress < hurricaneExitThreshold) {
    peaking = false;
  }

  if (peaking) {
    clearTimeout(hintTimeout);
    shakeHint.style.display = 'none';
    // PSYCHEDELIC: color cycling on the Paper.js elements only
    hue = (hue + Math.min(stress > 300 ? Math.pow(stress / 6, 2) : stress / 8, 30)) % 720;

    if (!prevPeaking) {
      physics.drag = 0.55;
      // Single class with CSS-driven color cycle — animation runs on compositor
      document.body.className = 'bg-storm';
      // Start the tikinoise.mp3 storm clip from 51.5s
      startTikiAudio();
      setWindIntensity(1.0);
      firstPlay = false;
    }

    // Thunder: only every 8 seconds at peak, less often otherwise
    var thunderFreq = stress > 400 ? 480 : 720;
    if (frameCount % thunderFreq === 0) triggerThunder();

    // Modulate wind every 15 frames
    if (frameCount % 15 === 0) modulateWind();

    if (frameCount - lastPhraseFrame > 60 + Math.random() * 80) {
      hurricaneText.content = hurricanePhrases[Math.floor(Math.random() * hurricanePhrases.length)];
      hurricaneText.opacity = 0.9;
      lastPhraseFrame = frameCount;
    }
    if (frameCount - lastPhraseFrame > 35) hurricaneText.opacity *= 0.85;

    if (stress > 300 && !coconutLaunched) { coconutLaunched = true; launchCoconuts(); }
  } else {
    if (prevPeaking) {
      document.body.className = '';
      physics.drag = restDrag;
      muteAudio();
      firstPlay = true;
      hurricaneText.opacity = 0;
      coconutLaunched = false;
    }
  }
  // NOTE: prevPeaking is updated at the end of the main loop, not here —
  // updateStars() also uses it for its own scene-transition block.
}

// ─── Coconuts ────────────────────────────────────────────────────────────────
function launchCoconuts() {
  var tip = particles[numPoints - 1];
  for (var c = 0; c < 3 + Math.floor(Math.random() * 3); c++) {
    var co = new Path.Circle(new Point(tip.position.x, tip.position.y), 10);
    co.fillColor = '#5C3317';
    coconuts.push({ path: co, x: tip.position.x, y: tip.position.y, vx: (Math.random() - 0.5) * 12, vy: -6 - Math.random() * 8 });
  }
}

function updateCoconuts() {
  for (var i = coconuts.length - 1; i >= 0; i--) {
    var c = coconuts[i];
    c.vy += 0.4; c.x += c.vx; c.y += c.vy;
    c.path.position = new Point(c.x, c.y);
    if (c.y > view.size.height + 50 || c.x < -50 || c.x > view.size.width + 50) { c.path.remove(); coconuts.splice(i, 1); }
  }
}

// ─── Draw Trunk (WIDER than original — kept change) ─────────────────────────
function drawTrunk() {
  var left = [], right = [];

  for (var i = 0; i < numPoints; i++) {
    var p = particles[i];
    var t = i / (numPoints - 1);
    // Wider trunk with root flare at base and belly
    var baseFlare = t < 0.15 ? (1 - t / 0.15) * 14 : 0;
    var belly = Math.sin(t * Math.PI * 0.6) * 6;
    var halfW = (38 - t * 28) + belly + baseFlare;

    var angle;
    if (i < numPoints - 1) {
      angle = Math.atan2(particles[i + 1].position.y - p.position.y, particles[i + 1].position.x - p.position.x) + Math.PI / 2;
    } else {
      angle = Math.atan2(p.position.y - particles[i - 1].position.y, p.position.x - particles[i - 1].position.x) + Math.PI / 2;
    }

    var jitter = peaking ? (Math.random() - 0.5) * 2 : 0;
    left.push(new Point(p.position.x + Math.cos(angle) * halfW + jitter, p.position.y + Math.sin(angle) * halfW));
    right.push(new Point(p.position.x - Math.cos(angle) * halfW + jitter, p.position.y - Math.sin(angle) * halfW));
  }

  var tSegs = trunkFill.segments;
  var expectedLen = left.length + right.length;
  if (tSegs.length !== expectedLen) {
    trunkFill.removeSegments();
    for (var i = 0; i < left.length; i++) trunkFill.add(left[i]);
    for (var i = right.length - 1; i >= 0; i--) trunkFill.add(right[i]);
    trunkFill.closed = true;
    trunkFill.smooth();
  } else {
    var ti = 0;
    for (var i = 0; i < left.length; i++, ti++) {
      tSegs[ti].point.x = left[i].x; tSegs[ti].point.y = left[i].y;
    }
    for (var i = right.length - 1; i >= 0; i--, ti++) {
      tSegs[ti].point.x = right[i].x; tSegs[ti].point.y = right[i].y;
    }
    trunkFill.smooth();
  }
  trunkFill.fillColor = peaking
    ? 'hsl(' + (Math.round(hue) % 360) + ', 100%, ' + (40 + Math.sin(hue / 20) * 20) + '%)'
    : '#C49A4A';

  // trunkTexture is a 1px-offset duplicate of trunkFill — barely visible, skipping entirely

  // Ring marks (match wider trunk width)
  for (var ri = 0; ri < trunkRings.length; ri++) {
    var ring = trunkRings[ri];
    ring.removeSegments();
    var rt = (ri + 1) / (trunkRings.length + 1);
    var idx = Math.min(Math.floor(rt * (numPoints - 1)), numPoints - 2);
    var rp = particles[idx];
    var rnp = particles[idx + 1];
    var rAngle = Math.atan2(rnp.position.y - rp.position.y, rnp.position.x - rp.position.x) + Math.PI / 2;
    var rW = (38 - rt * 28) + Math.sin(rt * Math.PI * 0.6) * 6;
    ring.add(new Point(rp.position.x + Math.cos(rAngle) * rW * 0.85, rp.position.y + Math.sin(rAngle) * rW * 0.85));
    ring.add(new Point(rp.position.x - Math.cos(rAngle) * rW * 0.85, rp.position.y - Math.sin(rAngle) * rW * 0.85));
    ring.strokeColor = peaking ? new Color(1, 1, 1, 0.3) : new Color(0.27, 0.16, 0.04, 0.7);
    ring.strokeWidth = 2;
  }
}

// ─── Draw Fronds (V-notch banana shape — kept change) ───────────────────────
function drawFronds() {
  var tipP = particles[numPoints - 1];
  var prevP = particles[numPoints - 2];
  var tipX = tipP.position.x;
  var tipY = tipP.position.y;
  var trunkAngle = Math.atan2(tipY - prevP.position.y, tipX - prevP.position.x);

  // Cap fronds by viewport width too, so they don't overflow on narrow (mobile) screens
  var frondLen = Math.min(view.size.height * 0.35, view.size.width * 0.48);
  var numNotches = 5;

  for (var fi = 0; fi < numFronds; fi++) {
    var jig = frondJigglers[fi];
    var fg = frondGroups[fi];

    if (peaking) {
      if (frameCount % 10 === 0) jig.rest = (Math.random() - 0.5) * 30;
      jig.k = 10;
      jig.d = 0.5;
    } else {
      jig.rest = Math.sin(fi * 1.1 + Date.now() / 4000) * 3 + Math.sin(Date.now() / 6000 + fi * 0.7) * 2;
      jig.k = 2;
      jig.d = 0.75;
    }

    var jigAngle = jig.pos * Math.PI / 180;
    var angle = trunkAngle + frondBaseAngles[fi] + jigAngle;

    var droopStrength = 0.35 + 0.4 * (fi / (numFronds - 1));
    var lenScale = 0.85 + 0.18 * (1 - Math.abs(fi - numFronds / 2) / (numFronds / 2));
    var thisLen = frondLen * lenScale;

    // Build rachis curve
    var rachisSegs = 14;
    var rachis = [];
    for (var s = 0; s <= rachisSegs; s++) {
      var t = s / rachisSegs;
      var curAngle = angle + t * t * droopStrength;
      rachis.push({
        x: tipX + Math.cos(curAngle) * t * thisLen,
        y: tipY + Math.sin(curAngle) * t * thisLen,
        angle: curAngle
      });
    }

    // Midrib line — in-place segment update, skip smooth (straight-line midrib doesn't benefit)
    if (fg.midrib.segments.length !== rachisSegs + 1) {
      fg.midrib.removeSegments();
      for (var s = 0; s <= rachisSegs; s++) fg.midrib.add(new Point(rachis[s].x, rachis[s].y));
    } else {
      var mSegs = fg.midrib.segments;
      for (var s = 0; s <= rachisSegs; s++) {
        mSegs[s].point.x = rachis[s].x;
        mSegs[s].point.y = rachis[s].y;
      }
    }
    fg.midrib.strokeColor = peaking ? 'hsl(' + ((Math.round(hue) + fi * 40 + 30) % 360) + ', 70%, 25%)' : '#2A6B29';

    // Unified frond body with V-notches cut into edges
    function widthAt(t) {
      if (t < 0.04) return 2;
      if (t > 0.98) return 1;
      return thisLen * 0.11 * Math.pow(Math.sin(t * Math.PI * 0.85 + 0.15), 0.6);
    }

    var upperEdge = [];
    var lowerEdge = [];

    for (var ni = 0; ni <= numNotches; ni++) {
      var tPeak = ni / numNotches;
      var tValley = (ni + 0.5) / numNotches;

      var rIdxP = Math.min(Math.floor(tPeak * rachisSegs), rachisSegs);
      var raP = rachis[rIdxP];
      var wP = widthAt(tPeak);
      var perpP = raP.angle + Math.PI / 2;
      upperEdge.push({ x: raP.x + Math.cos(perpP) * wP, y: raP.y + Math.sin(perpP) * wP });
      lowerEdge.push({ x: raP.x - Math.cos(perpP) * wP, y: raP.y - Math.sin(perpP) * wP });

      if (ni < numNotches) {
        var rIdxV = Math.min(Math.floor(tValley * rachisSegs), rachisSegs);
        var raV = rachis[rIdxV];
        var wV = widthAt(tValley);
        var perpV = raV.angle + Math.PI / 2;
        var notchDepth = 0.35;
        upperEdge.push({ x: raV.x + Math.cos(perpV) * wV * notchDepth, y: raV.y + Math.sin(perpV) * wV * notchDepth });
        lowerEdge.push({ x: raV.x - Math.cos(perpV) * wV * notchDepth, y: raV.y - Math.sin(perpV) * wV * notchDepth });
      }
    }

    // Body path — assemble point list, then update segments in-place if length matches
    var tipPoint = rachis[rachisSegs];
    var bodyLen = 1 + upperEdge.length + 1 + lowerEdge.length;
    var bSegs = fg.body.segments;
    if (bSegs.length !== bodyLen) {
      fg.body.removeSegments();
      fg.body.add(new Point(rachis[0].x, rachis[0].y));
      for (var i = 0; i < upperEdge.length; i++) fg.body.add(new Point(upperEdge[i].x, upperEdge[i].y));
      fg.body.add(new Point(tipPoint.x, tipPoint.y));
      for (var i = lowerEdge.length - 1; i >= 0; i--) fg.body.add(new Point(lowerEdge[i].x, lowerEdge[i].y));
      fg.body.closed = true;
    } else {
      var bi = 0;
      bSegs[bi].point.x = rachis[0].x; bSegs[bi].point.y = rachis[0].y; bi++;
      for (var j = 0; j < upperEdge.length; j++, bi++) {
        bSegs[bi].point.x = upperEdge[j].x; bSegs[bi].point.y = upperEdge[j].y;
      }
      bSegs[bi].point.x = tipPoint.x; bSegs[bi].point.y = tipPoint.y; bi++;
      for (var j = lowerEdge.length - 1; j >= 0; j--, bi++) {
        bSegs[bi].point.x = lowerEdge[j].x; bSegs[bi].point.y = lowerEdge[j].y;
      }
    }

    // Shadow — same in-place pattern
    var shadowLen = 1 + (rachisSegs + 1) + 1 + lowerEdge.length;
    var sSegs = fg.shadow.segments;
    if (sSegs.length !== shadowLen) {
      fg.shadow.removeSegments();
      fg.shadow.add(new Point(rachis[0].x, rachis[0].y));
      for (var s = 0; s <= rachisSegs; s++) fg.shadow.add(new Point(rachis[s].x, rachis[s].y));
      fg.shadow.add(new Point(tipPoint.x, tipPoint.y));
      for (var i = lowerEdge.length - 1; i >= 0; i--) fg.shadow.add(new Point(lowerEdge[i].x, lowerEdge[i].y));
      fg.shadow.closed = true;
    } else {
      var si = 0;
      sSegs[si].point.x = rachis[0].x; sSegs[si].point.y = rachis[0].y; si++;
      for (var s = 0; s <= rachisSegs; s++, si++) {
        sSegs[si].point.x = rachis[s].x; sSegs[si].point.y = rachis[s].y;
      }
      sSegs[si].point.x = tipPoint.x; sSegs[si].point.y = tipPoint.y; si++;
      for (var j = lowerEdge.length - 1; j >= 0; j--, si++) {
        sSegs[si].point.x = lowerEdge[j].x; sSegs[si].point.y = lowerEdge[j].y;
      }
    }

    // Colors — PSYCHEDELIC in storm with wider hue separation per frond
    if (peaking) {
      var baseH = (Math.round(hue) + fi * 55) % 360;
      var sat = 100;
      var lit = 50 + Math.sin((hue + fi * 40) / 15) * 20;
      fg.body.fillColor = 'hsl(' + baseH + ', ' + sat + '%, ' + lit + '%)';
      fg.body.strokeColor = 'hsl(' + ((baseH + 180) % 360) + ', 100%, 30%)';  // complementary outline
      fg.shadow.fillColor = 'hsl(' + ((baseH + 30) % 360) + ', 90%, 25%)';
    } else {
      var lightness = 45 + fi * 1.2;
      fg.body.fillColor = 'hsl(' + (118 + fi * 2) + ', 45%, ' + lightness + '%)';
      fg.body.strokeColor = '#1F5F1F';
      fg.shadow.fillColor = 'hsl(' + (118 + fi * 2) + ', 45%, ' + (lightness - 15) + '%)';
    }
  }

  // Coconut cluster at base of fronds
  for (var ci = 0; ci < coconutCluster.length; ci++) {
    var cc = coconutCluster[ci];
    var cx = tipX + Math.cos(trunkAngle + cc.offsetAngle) * cc.offsetR;
    var cy = tipY + Math.sin(trunkAngle + cc.offsetAngle) * cc.offsetR;
    cc.path.position = new Point(cx, cy);
    cc.highlight.position = new Point(cx - cc.radius * 0.35, cy - cc.radius * 0.35);
  }
}

// ─── Rain ────────────────────────────────────────────────────────────────────
function updateRain() {
  var w = view.size.width, h = view.size.height;
  if (peaking) {
    for (var ri = 0; ri < rainCount; ri++) {
      var rd = rainDrops[ri];
      if (!rd.path.visible) rd.path.visible = true;
      rd.y += rd.speedY;
      rd.x += rd.speedX;
      if (rd.y > h + 20 || rd.x < -60) {
        rd.y = -30 - Math.random() * 40;
        rd.x = Math.random() * (w * 1.3) - w * 0.1;
      }
      rd.path.position = new Point(rd.x, rd.y);
      rd.path.opacity = 0.6;
    }
  } else {
    // Fade out smoothly, then hide completely to skip render cost during day
    for (var ri2 = 0; ri2 < rainCount; ri2++) {
      var p = rainDrops[ri2].path;
      if (!p.visible) continue;
      if (p.opacity > 0) {
        p.opacity = Math.max(0, p.opacity - 0.06);
      } else {
        p.visible = false;
      }
    }
  }
}

// ─── Lightning ───────────────────────────────────────────────────────────────
function fireLightning() {
  var w = view.size.width, h = view.size.height;
  lightningBolt.removeSegments();
  var startX = Math.random() * w;
  var y = -10;
  var endY = h * (0.45 + Math.random() * 0.3);
  var segments = 8 + Math.floor(Math.random() * 5);
  var x = startX;
  lightningBolt.add(new Point(x, y));
  for (var si = 1; si <= segments; si++) {
    var t = si / segments;
    y = -10 + (endY + 10) * t;
    x += (Math.random() - 0.5) * 70;
    lightningBolt.add(new Point(x, y));
  }
  lightningBolt.strokeWidth = 2.5 + Math.random() * 2;
  // Rainbow-colored lightning — cycles hue per strike for whimsy
  var boltHue = Math.floor(Math.random() * 360);
  lightningBolt.strokeColor = 'hsl(' + boltHue + ', 100%, 85%)';
  lightningBolt.opacity = 1;
  lightningFlash.fillColor = 'hsl(' + boltHue + ', 100%, 90%)';
  lightningFlash.opacity = 0.55;
  // Schedule next strike — more frequent (0.6-3.1s)
  nextLightningTime = Date.now() + 600 + Math.random() * 2500;
}

function updateLightning() {
  if (peaking) {
    if (!lightningBolt.visible) { lightningBolt.visible = true; lightningFlash.visible = true; }
    var now = Date.now();
    if (now > nextLightningTime) {
      fireLightning();
    } else {
      // Fade the current bolt + flash
      if (lightningBolt.opacity > 0) lightningBolt.opacity = Math.max(0, lightningBolt.opacity - 0.1);
      if (lightningFlash.opacity > 0) lightningFlash.opacity = Math.max(0, lightningFlash.opacity - 0.08);
    }
  } else {
    if (lightningBolt.visible) {
      lightningBolt.opacity = 0; lightningBolt.visible = false;
      lightningFlash.opacity = 0; lightningFlash.visible = false;
    }
    nextLightningTime = 0; // so first strike happens quickly on re-entry
  }
}

// ─── Screen Shake ────────────────────────────────────────────────────────────
var shakeOffset = new Point(0, 0);
function applyScreenShake() {
  if (peaking) {
    var sx = (Math.random() * 6 - 3) * Math.min(stress / 200, 2);
    var sy = (Math.random() * 6 - 3) * Math.min(stress / 200, 2);
    view.scrollBy(new Point(sx - shakeOffset.x, sy - shakeOffset.y));
    shakeOffset = new Point(sx, sy);
  } else if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
    view.scrollBy(new Point(-shakeOffset.x, -shakeOffset.y));
    shakeOffset = new Point(0, 0);
  }
}

// ─── Update Scene (day ↔ storm transition) ─────────────────────────────────
function updateStars() {
  var time = Date.now() / 1000;
  var w = view.size.width;

  if (peaking) {
    // STORM / NIGHT — set scene state on entry only, not every frame
    if (!prevPeaking) {
      for (var si = 0; si < sunParts.length; si++) sunParts[si].opacity = 0;
      for (var ci = 0; ci < clouds.length; ci++) {
        for (var bi = 0; bi < clouds[ci].blobs.length; bi++) clouds[ci].blobs[bi].opacity = 0;
      }
      for (var si2 = 0; si2 < stars.length; si2++) {
        stars[si2].path.visible = true;
        stars[si2].path.opacity = stars[si2].baseOpacity;
      }
      // Disco ball! Move the full rig in front of palm fronds so the storm
      // thrashing doesn't occlude it. Paper.js v0.22 has no bringToFront;
      // re-adding to the active layer moves the item to the end of the
      // children array, which draws it last (= on top).
      var layer = project.activeLayer;
      moonGlow.visible = true; layer.addChild(moonGlow);
      moon.visible = true; layer.addChild(moon);
      for (var dgv = 0; dgv < discoGrid.length; dgv++) {
        discoGrid[dgv].visible = true;
        layer.addChild(discoGrid[dgv]);
      }
      for (var dsv = 0; dsv < discoSparkles.length; dsv++) {
        discoSparkles[dsv].path.visible = true;
        layer.addChild(discoSparkles[dsv].path);
      }
      // Match original moon opacity values exactly
      moon.opacity = 0.9;
      moonGlow.opacity = 0.08;
      for (var dgo = 0; dgo < discoGrid.length; dgo++) discoGrid[dgo].opacity = 1;
      ocean.fillColor = makeOceanStormColor(oceanTopY, oceanBotY);
      sand.fillColor = makeSandStormColor(sandTopY, sandBotY);
      shorelineWave.opacity = 0.4;
      for (var ffs = 0; ffs < foamFlecks.length; ffs++) foamFlecks[ffs].path.opacity = foamFlecks[ffs].baseOp * 0.3;
    }
    // Disco sparkles — each twinkles at its own rate with a rainbow-cycling tint
    if (frameCount % 2 === 0) {
      var baseH = Math.round(hue) % 360;
      for (var spi = 0; spi < discoSparkles.length; spi++) {
        var sp = discoSparkles[spi];
        var pulse = 0.3 + Math.abs(Math.sin(time * sp.speed + sp.phase)) * 0.7;
        sp.path.opacity = pulse;
        sp.path.fillColor = 'hsl(' + ((baseH + sp.hueOffset) % 360) + ', 100%, ' + (70 + pulse * 20) + '%)';
      }
    }
    // Subtle disco ball rotation — tilt the grid so it feels like it's spinning
    if (frameCount % 3 === 0) {
      var rotCenter = moon.position;
      for (var dgr = 0; dgr < discoGrid.length; dgr++) discoGrid[dgr].rotate(1.2, rotCenter);
    }
    // Star twinkle every 4 frames
    if (frameCount % 4 === 0) {
      for (var si3 = 0; si3 < stars.length; si3++) {
        var s = stars[si3];
        var twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase) * 0.3 + 0.7;
        s.path.opacity = s.baseOpacity * twinkle;
      }
    }
  } else {
    // DAYTIME — set scene state on exit transition, then drift clouds only
    if (prevPeaking) {
      sunParts[0].opacity = 0.06;
      sunParts[1].opacity = 0.12;
      sunParts[2].opacity = 0.25;
      sunParts[3].opacity = 1.0;
      for (var si4 = 0; si4 < stars.length; si4++) {
        stars[si4].path.opacity = 0;
        stars[si4].path.visible = false;
      }
      moon.opacity = 0; moon.visible = false;
      moonGlow.opacity = 0; moonGlow.visible = false;
      for (var dge = 0; dge < discoGrid.length; dge++) { discoGrid[dge].opacity = 0; discoGrid[dge].visible = false; }
      for (var dse = 0; dse < discoSparkles.length; dse++) { discoSparkles[dse].path.opacity = 0; discoSparkles[dse].path.visible = false; }
      ocean.fillColor = makeOceanDayColor(oceanTopY, oceanBotY);
      sand.fillColor = makeSandDayColor(sandTopY, sandBotY);
      shorelineWave.opacity = 1;
      for (var ffd = 0; ffd < foamFlecks.length; ffd++) foamFlecks[ffd].path.opacity = foamFlecks[ffd].baseOp;
      for (var ci3 = 0; ci3 < clouds.length; ci3++) {
        for (var bi3 = 0; bi3 < clouds[ci3].blobs.length; bi3++) {
          clouds[ci3].blobs[bi3].opacity = 0.7 - bi3 * 0.04;
        }
      }
    }
    // Cloud drift — every frame (cheap, just position updates)
    for (var ci2 = 0; ci2 < clouds.length; ci2++) {
      var c = clouds[ci2];
      c.baseX += c.speed;
      if (c.baseX > w + 120) c.baseX = -120;
      var drift = c.baseX - c.blobs[0].position.x;
      for (var bi2 = 0; bi2 < c.blobs.length; bi2++) {
        c.blobs[bi2].position.x += drift;
      }
    }
  }
}
