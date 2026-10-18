/* =========================================================
   ANIMATION SETTINGS — tweak these numbers
   ========================================================= */
const STAGGER_MS = 10;     // delay between each line appearing
const DURATION_MS = 700;   // how long each line takes to fade/slide in
const DISTANCE_PX = 16;    // how far each line slides up from

const SMOOTH_SCROLL = 1.2; // smooth scroll duration (seconds); 0 = off

/* ========================================================= */

// --- Fade-up intro ---
const root = document.documentElement;
root.style.setProperty('--fade-duration', DURATION_MS + 'ms');
root.style.setProperty('--fade-distance', DISTANCE_PX + 'px');

// For bullets that contain sub-bullets, animate only their own text
// (so the sub-bullets can come in separately, after it)
document.querySelectorAll('li').forEach(li => {
  if (!li.querySelector('ul')) return;
  const span = document.createElement('span');
  while (li.firstChild && li.firstChild.nodeName !== 'UL') {
    span.appendChild(li.firstChild);
  }
  li.prepend(span);
  li.classList.add('has-sublist');
});

// Every "line" on the page, top to bottom
const lines = [...document.querySelectorAll(
  'h1, .tagline, h2, p, li:not(.has-sublist), li.has-sublist > span, .link'
)].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

lines.forEach((el, i) => {
  el.classList.add('fade-up');
  el.style.animationDelay = (i * STAGGER_MS) + 'ms';
});

// --- Smooth scroll (uses the Lenis library) ---
if (SMOOTH_SCROLL > 0 && window.Lenis &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const lenis = new Lenis({ duration: SMOOTH_SCROLL });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

// Everything is set up — show the page (the animation starts now)
root.classList.add('ready');
