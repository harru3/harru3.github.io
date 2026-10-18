/* =========================================================
   HALFTONE BACKGROUND SETTINGS — tweak these numbers
   ========================================================= */
const DOT_COLOR = '#bababa';
const DOT_SPACING = 12;     // px between dot centres (smaller = denser)
const DOT_SCALE = 0.5;      // shrinks dots AND spacing together (keeps the same look, just finer)
const MAX_DOT_SIZE = 0.9;   // biggest dot, as a fraction of spacing (1 = dots touch)
const MIN_DOT_SIZE = 0.12;  // smallest dot between bands, as a fraction of the biggest (0 = gaps go blank, 1 = no bands)
const GRID_ANGLE = 45;      // degrees the dot grid is rotated
const BAND_ANGLE = 30;      // degrees the dark bands lean (0 = flat, 90 = upright)
const BAND_WIDTH = 260;     // px from one dark band to the next
const SPEED = 0.55;         // how fast it undulates (0 = frozen)
const TEXT_OVERLAP = 6;     // px the dots are allowed to creep under the text column
const EDGE_DOT = 0.2;       // dot size right at the text edge, as a fraction of full size
const FADE_WIDTH = 0.7;     // how far the fade reaches, as a fraction of the gap between text and screen edge
const EDGE_WOBBLE = 12;     // px the fading edge waves in and out (only ever away from the text)

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
  const spacing = DOT_SPACING * DOT_SCALE;
  const maxR = spacing * MAX_DOT_SIZE * 0.5;

  // the dot colour at every transparency level (0-255), ready to drop into pixels
  const rgb = parseInt(DOT_COLOR.slice(1), 16);
  const colorAt = new Uint32Array(256);
  for (let a = 0; a < 256; a++) {
    colorAt[a] = ((a << 24) | ((rgb & 255) << 16) | (rgb & 0xff00) | (rgb >> 16)) >>> 0;
  }

  let W = 0, H = 0, dpr = 1;       // screen size in CSS pixels, and pixels per CSS pixel
  let PW = 0, PH = 0;              // canvas size in real pixels
  let image = null, pixels = null; // the canvas pixels we draw into
  let colLeft = 0, colRight = 0;   // edges of the text column

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    PW = canvas.width = Math.round(W * dpr);
    PH = canvas.height = Math.round(H * dpr);
    image = ctx.createImageData(PW, PH);
    pixels = new Uint32Array(image.data.buffer);

    // find the text column so the dots can fade out toward it
    const col = document.querySelector('.page');
    const r = col.getBoundingClientRect();
    const cs = getComputedStyle(col);
    colLeft = r.left + parseFloat(cs.paddingLeft);
    colRight = r.right - parseFloat(cs.paddingRight);
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

    // fade out toward the text column on both sides, with a wavy edge
    const right = x > (colLeft + colRight) / 2;
    const gap = right ? W - colRight : colLeft;         // space between text and screen edge
    const dist = right ? x - colRight : colLeft - x;    // how far this dot is from the text
    const wobble = EDGE_WOBBLE * (0.5 + 0.3 * Math.sin(y * 0.006 + t * 0.8)
                                      + 0.2 * Math.sin(y * 0.017 - t * 1.1));
    const start = -TEXT_OVERLAP + wobble;
    if (dist < start) return 0;
    v *= EDGE_DOT + (1 - EDGE_DOT) * smoothstep(start, start + Math.max(1, gap * FADE_WIDTH), dist);

    return Math.min(1, Math.max(0, v));
  }

  // Paint one soft-edged dot straight into the pixels
  function dot(px, py, r) {
    const x0 = Math.max(0, Math.floor(px - r)), x1 = Math.min(PW - 1, Math.ceil(px + r));
    const y0 = Math.max(0, Math.floor(py - r)), y1 = Math.min(PH - 1, Math.ceil(py + r));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - py, row = y * PW;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - px;
        const cover = r + 0.5 - Math.sqrt(dx * dx + dy * dy);   // 1 inside, 0 outside, soft edge
        if (cover > 0) pixels[row + x] = colorAt[cover >= 1 ? 255 : (cover * 255) | 0];
      }
    }
  }

  function draw(time) {
    const t = reduceMotion ? 0 : time * 0.001 * SPEED;
    pixels.fill(0);

    // walk a rotated grid, visiting only the dots that land on screen
    const reach = Math.hypot(W, H);
    const cx = W / 2, cy = H / 2;
    const pad = spacing;
    const skipFrom = colLeft + TEXT_OVERLAP, skipTo = colRight - TEXT_OVERLAP;
    const minR = 0.3;   // skip dots too small to see
    for (let i = -reach; i <= reach; i += spacing) {
      // range of j that keeps x and y on screen for this row
      let jMin = -reach, jMax = reach;
      if (Math.abs(gSin) > 1e-6) {
        const a = (cx + i * gCos + pad) / gSin, b = (cx + i * gCos - W - pad) / gSin;
        jMin = Math.max(jMin, Math.min(a, b)); jMax = Math.min(jMax, Math.max(a, b));
      }
      if (Math.abs(gCos) > 1e-6) {
        const a = (-pad - cy - i * gSin) / gCos, b = (H + pad - cy - i * gSin) / gCos;
        jMin = Math.max(jMin, Math.min(a, b)); jMax = Math.min(jMax, Math.max(a, b));
      }
      for (let j = Math.ceil(jMin / spacing) * spacing; j <= jMax; j += spacing) {
        const x = cx + i * gCos - j * gSin;
        if (x > skipFrom && x < skipTo) continue;
        const y = cy + i * gSin + j * gCos;
        const r = maxR * shade(x, y, t);
        if (r < minR) continue;
        dot(x * dpr, y * dpr, r * dpr);
      }
    }

    // only copy the two side strips; the middle under the text stays empty
    const leftW = Math.min(PW, Math.ceil((skipFrom + spacing) * dpr));
    const rightX = Math.max(0, Math.floor((skipTo - spacing) * dpr));
    ctx.putImageData(image, 0, 0, 0, 0, leftW, PH);
    ctx.putImageData(image, 0, 0, rightX, 0, PW - rightX, PH);
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
