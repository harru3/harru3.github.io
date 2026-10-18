/* =========================================================
   HALFTONE BACKGROUND SETTINGS — tweak these numbers
   ========================================================= */
const DOT_COLOR = '#bababa';
const DOT_SPACING = 12;     // px between dot centres (smaller = denser)
const MAX_DOT_SIZE = 0.9;   // biggest dot, as a fraction of spacing (1 = dots touch)
const MIN_DOT_SIZE = 0.35;  // smallest dot between bands, as a fraction of the biggest (0 = gaps go blank, 1 = no bands)
const GRID_ANGLE = 45;      // degrees the dot grid is rotated
const BAND_ANGLE = 30;      // degrees the dark bands lean (0 = flat, 90 = upright)
const BAND_WIDTH = 260;     // px from one dark band to the next
const SPEED = 0.55;         // how fast it undulates (0 = frozen)
const START_AT = 0.55;      // where the dots begin, as a fraction of screen width
const EDGE_SOFTNESS = 0.3;  // how gradually the dots fade in from the left

/* ========================================================= */

(function () {
  const canvas = document.createElement('canvas');
  canvas.className = 'halftone';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gridA = GRID_ANGLE * Math.PI / 180;
  const bandA = BAND_ANGLE * Math.PI / 180;
  const gCos = Math.cos(gridA), gSin = Math.sin(gridA);
  const bCos = Math.cos(bandA), bSin = Math.sin(bandA);
  let W = 0, H = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function smoothstep(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // How dark the pattern is at a point (0 = no dot, 1 = biggest dot)
  function shade(x, y, t) {
    // position along / across the bands
    const along = x * bCos - y * bSin;
    const across = x * bSin + y * bCos;
    const k = (2 * Math.PI) / BAND_WIDTH;

    let v = Math.sin(across * k + t)                              // main bands
          * (0.6 + 0.4 * Math.sin(along * k * 0.35 - t * 0.6))    // bands swell and thin
          + 0.45 * Math.sin(across * k * 0.53 - along * k * 0.2 + t * 0.7)
          + 0.25 * Math.sin(x * k * 0.8 + y * k * 0.4 - t * 1.3);
    v = 0.45 + v * 0.55;

    // lift the gaps between bands without changing the biggest dots
    v = MIN_DOT_SIZE + (1 - MIN_DOT_SIZE) * Math.min(1, Math.max(0, v));

    // fade out toward the left, with a wavy edge
    const edge = START_AT + 0.06 * Math.sin(y * 0.006 + t * 0.8)
                          + 0.04 * Math.sin(y * 0.017 - t * 1.1);
    v *= smoothstep(edge, edge + EDGE_SOFTNESS, x / W);

    return Math.min(1, Math.max(0, v));
  }

  function draw(time) {
    const t = reduceMotion ? 0 : time * 0.001 * SPEED;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = DOT_COLOR;
    ctx.beginPath();

    // walk a rotated grid that covers the whole screen
    const reach = Math.hypot(W, H);
    const cx = W, cy = H / 2;
    const maxR = DOT_SPACING * MAX_DOT_SIZE * 0.5;
    for (let i = -reach; i <= reach; i += DOT_SPACING) {
      for (let j = -reach; j <= reach; j += DOT_SPACING) {
        const x = cx + i * gCos - j * gSin;
        const y = cy + i * gSin + j * gCos;
        if (x < W * (START_AT - 0.12) || x > W + DOT_SPACING ||
            y < -DOT_SPACING || y > H + DOT_SPACING) continue;
        const r = maxR * shade(x, y, t);
        if (r < 0.3) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  function loop(time) {
    draw(time);
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', () => { resize(); if (reduceMotion) draw(0); });
  if (reduceMotion) draw(0); else requestAnimationFrame(loop);
  requestAnimationFrame(() => canvas.classList.add('shown'));
})();
