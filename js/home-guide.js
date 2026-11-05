// ขยะแลกแต้ม — Home "วิธีใช้" guide: a floating button (bottom-right,
// shrinks to its icon while the page is scrolled) that opens a swipeable
// 5-card popup walking through the student journey. Opens by itself once
// per student per browser. Spec: docs/superpowers/specs/2026-11-05-home-guide-design.md
// Entry point: initHomeGuide(studentId), called by dashboard.js after the
// session check.

const GUIDE_ICON = (paths) =>
  `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

// Static copy (not live data), so building cards with innerHTML is safe.
// Order is on purpose: "rejected" comes before "earn" so the guide ends happy.
const GUIDE_STEPS = [
  {
    en: 'Sort', th: 'แยกขยะ', from: '#D6EBDD', to: '#8FC7A8',
    desc: 'ตอนนี้รับขยะ 4 ประเภท: กระดาษรวม ขวดพลาสติกใส กระป๋องอลูมิเนียม และขวดแก้ว',
    icon: GUIDE_ICON('<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" /><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" /><path d="m14 16-3 3 3 3" /><path d="M8.293 13.596 7.196 9.5 3.1 10.598" /><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" /><path d="m13.378 9.633 4.096 1.098 1.097-4.096" />'),
  },
  {
    en: 'Scan', th: 'ชั่งแล้วส่ง', from: '#CCD8F4', to: '#6F8FDB',
    desc: 'ชั่งขยะที่จุดรับ แล้วกดปุ่มกล้อง เลือกประเภท ใส่น้ำหนัก ถ่ายรูปขยะบนตาชั่งคู่กับบัตรนักเรียน แล้วกดส่งเลย!',
    icon: GUIDE_ICON('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" />'),
  },
  {
    en: 'Review', th: 'รอสภาฯ ตรวจ', from: '#F8EBB8', to: '#EEC458',
    desc: 'สภานักเรียนจะเช็กว่าประเภทและน้ำหนักตรงกับรูป และบัตรนักเรียนเป็นของคนส่งจริง',
    icon: GUIDE_ICON('<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" />'),
  },
  {
    en: 'Oops', th: 'ถูกตีกลับ', from: '#F5D9C8', to: '#E3A07F',
    desc: 'ถ้ามีอะไรไม่ตรง รายการจะถูกตีกลับพร้อมบอกเหตุผล ไม่ต้องห่วง แก้ให้ถูกแล้วส่งใหม่ได้เลย',
    icon: GUIDE_ICON('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />'),
  },
  {
    en: 'Earn', th: 'ได้แต้ม!', from: '#E3D6F0', to: '#A98BCF',
    desc: 'ผ่านแล้ว แต้มเข้าบัญชีของเราทันที! สะสมไว้เรื่อย ๆ แล้วไปแลกของรางวัลใน Shop ได้เลย',
    icon: GUIDE_ICON('<rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />'),
  },
];

// carousel geometry + spring (from the owner's reference design)
const GUIDE_PEEK_TOTAL = 140; // card width = stage width − this (≈50px peek + 20px gap each side)
const GUIDE_GAP = 20;
const GUIDE_SPRING_W = 15;    // ω₀
const GUIDE_SPRING_Z = 0.68;  // ζ → ~3% overshoot
const GUIDE_FLICK = 0.3;      // px/ms — a faster release moves one card
const GUIDE_DOT_R = 4, GUIDE_DOT_GAP = 10, GUIDE_DOT_PILL = 18;

function initHomeGuide(studentId) {
  const btn = document.getElementById('guide-btn');
  const overlay = document.getElementById('guide-modal');
  if (!btn || !overlay) return;

  wireGuideButtonShrink(btn);
  const carousel = buildGuideCarousel(overlay);

  function openGuide() {
    if (overlay.classList.contains('open')) return;
    carousel.reset();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    carousel.start();
    document.getElementById('guide-close').focus();
  }

  function closeGuide() {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
    carousel.stop();
    btn.focus();
  }

  btn.addEventListener('click', openGuide);
  document.getElementById('guide-close').addEventListener('click', closeGuide);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeGuide(); });
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeGuide();
    else if (e.key === 'ArrowLeft') carousel.prev();
    else if (e.key === 'ArrowRight') carousel.next();
  });
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

// Builds the cards + dots inside the popup and runs the swipe. `pos` is the
// fractional card position (0 … N−1); while not dragging, a spring pulls it
// to `target`. Animation only runs while something moves.
function buildGuideCarousel(root) {
  const stage = root.querySelector('#guide-stage');
  const descEl = root.querySelector('#guide-desc');
  const dotsEl = root.querySelector('#guide-dots');
  const prevBtn = root.querySelector('#guide-prev');
  const nextBtn = root.querySelector('#guide-next');
  const N = GUIDE_STEPS.length;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const cards = GUIDE_STEPS.map((step, i) => {
    const card = document.createElement('div');
    card.className = 'guide-card';
    card.style.background = `linear-gradient(160deg, ${step.from}, ${step.to})`;
    card.innerHTML = step.icon
      + `<span class="guide-card-num">${i + 1}/${N}</span>`
      + `<span class="guide-card-cap">${step.en}<small>${step.th}</small></span>`;
    stage.appendChild(card);
    return card;
  });

  const dots = GUIDE_STEPS.map((step, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'guide-dot';
    dot.setAttribute('aria-label', `ขั้นที่ ${i + 1}: ${step.th}`);
    dot.innerHTML = '<span class="guide-dot-fill"></span>';
    dot.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(dot);
    return dot;
  });

  let pos = 0, vel = 0, target = 0, drag = null, shown = -1, raf = 0, lastT = 0;

  function render() {
    const W = stage.clientWidth;
    const cardW = W - GUIDE_PEEK_TOTAL;
    const step = cardW + GUIDE_GAP;
    cards.forEach((card, i) => {
      const off = i - pos;
      card.style.width = cardW + 'px';
      card.style.visibility = Math.abs(off) > 1.5 ? 'hidden' : 'visible';
      card.style.transform = `translateX(${(W - cardW) / 2 + off * step}px)`;
    });

    // dots: the current one stretches into a pill; width + colour slide with pos
    let x = 0;
    const widths = dots.map((_, i) => 2 * GUIDE_DOT_R + GUIDE_DOT_PILL * Math.max(0, 1 - Math.abs(pos - i)));
    dotsEl.style.width = (widths.reduce((a, b) => a + b, 0) + GUIDE_DOT_GAP * (N - 1)) + 'px';
    dots.forEach((dot, i) => {
      dot.style.left = x + 'px';
      dot.style.width = widths[i] + 'px';
      dot.firstChild.style.opacity = Math.max(0, 1 - Math.abs(pos - i));
      dot.setAttribute('aria-current', i === target ? 'step' : 'false');
      x += widths[i] + GUIDE_DOT_GAP;
    });

    prevBtn.hidden = target <= 0;
    nextBtn.hidden = target >= N - 1;

    const near = Math.min(N - 1, Math.max(0, Math.round(pos)));
    if (near !== shown) showDesc(near);
  }

  function showDesc(i) {
    shown = i;
    if (reduceMotion.matches) { descEl.textContent = GUIDE_STEPS[i].desc; return; }
    descEl.classList.add('is-fading');
    setTimeout(() => {
      if (shown !== i) return; // moved on again meanwhile
      descEl.textContent = GUIDE_STEPS[i].desc;
      descEl.classList.remove('is-fading');
    }, 120);
  }

  function tick(now) {
    const dt = Math.min(0.032, (now - lastT) / 1000);
    lastT = now;
    if (!drag) {
      const acc = -GUIDE_SPRING_W * GUIDE_SPRING_W * (pos - target) - 2 * GUIDE_SPRING_Z * GUIDE_SPRING_W * vel;
      vel += acc * dt;
      pos += vel * dt;
      if (Math.abs(pos - target) < 0.0005 && Math.abs(vel) < 0.001) { pos = target; vel = 0; }
    }
    render();
    raf = (drag || pos !== target) ? requestAnimationFrame(tick) : 0;
  }

  function kick() {
    if (reduceMotion.matches && !drag) { pos = target; vel = 0; render(); return; }
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
  }

  function goTo(i) {
    target = Math.min(N - 1, Math.max(0, i));
    kick();
  }

  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    const t = performance.now();
    drag = { startX: e.clientX, startPos: pos, lastX: e.clientX, lastT: t, vx: 0 };
    vel = 0;
    stage.classList.add('is-dragging');
    kick();
  });

  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const step = stage.clientWidth - GUIDE_PEEK_TOTAL + GUIDE_GAP;
    let next = drag.startPos - (e.clientX - drag.startX) / step;
    if (next < 0) next *= 0.3;                               // resist past the first card
    if (next > N - 1) next = N - 1 + (next - (N - 1)) * 0.3; // … and the last
    pos = next;
    const t = performance.now();
    drag.vx = (e.clientX - drag.lastX) / Math.max(1, t - drag.lastT);
    drag.lastX = e.clientX;
    drag.lastT = t;
  });

  function endDrag() {
    if (!drag) return;
    let to = Math.round(pos);
    // a quick flick moves one card even if the drag was short
    if (Math.abs(drag.vx) > GUIDE_FLICK && Math.abs(pos - drag.startPos) < 0.5) {
      to = Math.round(drag.startPos) + (drag.vx < 0 ? 1 : -1);
    }
    drag = null;
    stage.classList.remove('is-dragging');
    goTo(to);
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag); // browser took over (vertical scroll)

  prevBtn.addEventListener('click', () => goTo(target - 1));
  nextBtn.addEventListener('click', () => goTo(target + 1));

  const onResize = () => render();

  return {
    reset() { pos = 0; vel = 0; target = 0; drag = null; shown = -1; descEl.textContent = ''; },
    start() { render(); window.addEventListener('resize', onResize); },
    stop() { cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', onResize); },
    prev() { goTo(target - 1); },
    next() { goTo(target + 1); },
  };
}
