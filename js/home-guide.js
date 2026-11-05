// ขยะแลกแต้ม — Home "วิธีใช้" guide: a floating button (bottom-right,
// shrinks to its icon while the page is scrolled) that opens a swipeable
// 5-card popup walking through the student journey. Opens by itself once
// per student per browser. Spec: docs/superpowers/specs/2026-11-05-home-guide-design.md
// Entry point: initHomeGuide(studentId), called by dashboard.js after the
// session check.

function initHomeGuide(studentId) {
  const btn = document.getElementById('guide-btn');
  if (!btn) return;
  wireGuideButtonShrink(btn);
}

// Full "📖 วิธีใช้" pill near the top; just the 📖 once scrolled > 40px.
// Home scrolls the window (html/body), not an inner element.
function wireGuideButtonShrink(btn) {
  let queued = false;
  const update = () => {
    queued = false;
    btn.classList.toggle('is-mini', window.scrollY > 40);
  };
  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}
