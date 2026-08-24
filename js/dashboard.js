// ขยะแลกแต้ม — populates the dashboard from the fake data in data.js.

const STAT_ICONS = [
  { d: 'M7 7l-3 5 3 2M17 7l3 5-3 2M7 17h10M12 4 8 10h8z', tint: 'var(--sb-green)' },
  { d: 'M12 3c2 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 1-5 1-8z', tint: 'var(--sb-red)' },
  { d: 'M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l8-8', tint: 'var(--accent)' },
];

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  renderHeader(currentUser);
  renderProgressRing(FAKE_DASHBOARD.points);
  renderStats(FAKE_DASHBOARD.stats);
  wireNotifications();
  wireReportModal();
});

function renderHeader(user) {
  document.getElementById('student-name').textContent = user.name;
  document.getElementById('avatar-initial').textContent = user.name.trim().charAt(0);
}

function renderProgressRing({ value, target, nextRankIn, level }) {
  const r = 74;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / target, 1);
  const filled = pct * circ;

  const fillCircle = document.getElementById('ring-fill');
  // start fully empty, then transition the dashoffset so the ring visibly fills on load
  fillCircle.style.transition = 'none';
  fillCircle.setAttribute('stroke-dasharray', `${circ} ${circ}`);
  fillCircle.setAttribute('stroke-dashoffset', circ);
  fillCircle.getBoundingClientRect(); // force layout so the empty state registers first
  requestAnimationFrame(() => {
    fillCircle.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)';
    fillCircle.setAttribute('stroke-dashoffset', circ - filled);
  });

  const ticks = document.getElementById('ring-ticks');
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
    const r1 = r + 5, r2 = r + 9;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 95 + Math.cos(a) * r1);
    line.setAttribute('y1', 95 + Math.sin(a) * r1);
    line.setAttribute('x2', 95 + Math.cos(a) * r2);
    line.setAttribute('y2', 95 + Math.sin(a) * r2);
    line.setAttribute('stroke', 'rgba(26,31,51,0.2)');
    line.setAttribute('stroke-width', '0.6');
    ticks.appendChild(line);
  }

  document.getElementById('ring-value').textContent = value.toLocaleString();
  document.getElementById('ring-target').textContent = `/ ${target.toLocaleString()} pts`;
  document.getElementById('ring-next').textContent = nextRankIn.toLocaleString();
  document.getElementById('level-stamp').textContent = `LV ⋅ ${level}`;
}

function renderStats(stats) {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = stats.map((s, i) => {
    const icon = STAT_ICONS[i % STAT_ICONS.length];
    return `
      <div class="stat-tile">
        <svg width="14" height="14" viewBox="0 0 24 24"><path d="${icon.d}" fill="none" stroke="${icon.tint}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="value">${s.value}<span class="unit">${s.unit}</span></div>
        <div class="label">${s.label}</div>
      </div>
    `;
  }).join('');
}

const FAKE_NOTIFICATIONS = [
  { text: 'submission ของคุณ (พลาสติก PET) ได้รับการอนุมัติแล้ว ✅', time: '10 นาทีที่แล้ว' },
  { text: 'แต้มของคุณเพิ่มขึ้น +150 pts จากการรีไซเคิลกระป๋องอลูมิเนียม', time: '2 ชั่วโมงที่แล้ว' },
  { text: 'รอบเก็บขยะประจำเดือนนี้จะเปิดรับวันจันทร์หน้า อย่าลืมมาชั่งน้ำหนัก!', time: 'เมื่อวาน' },
  { text: 'คุณขยับขึ้นอันดับในห้องของคุณ 🎉', time: '2 วันที่แล้ว' },
];

function wireNotifications() {
  const btn = document.getElementById('notif-btn');
  const panel = document.getElementById('notif-panel');
  const list = document.getElementById('notif-list');

  list.innerHTML = FAKE_NOTIFICATIONS.length
    ? FAKE_NOTIFICATIONS.map((n) => `
        <div class="notif-item">
          <div class="dot"></div>
          <div class="content">
            <div class="text">${n.text}</div>
            <div class="time">${n.time}</div>
          </div>
        </div>
      `).join('')
    : '<div class="notif-empty">ยังไม่มีการแจ้งเตือน</div>';

  function closePanel() {
    panel.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !panel.classList.contains('open');
    panel.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
  });

  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('open')) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    closePanel();
  });
}

function wireReportModal() {
  const fab = document.getElementById('report-fab');
  const overlay = document.getElementById('report-modal');
  const closeBtn = document.getElementById('report-close');
  const submitBtn = document.getElementById('report-submit');
  const textarea = document.getElementById('report-text');

  function openModal() {
    overlay.classList.add('open');
    textarea.focus();
  }
  function closeModal() {
    overlay.classList.remove('open');
  }

  fab.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  submitBtn.addEventListener('click', () => {
    const message = textarea.value.trim();
    if (!message) {
      textarea.focus();
      return;
    }
    console.log('report submitted:', message);
    textarea.value = '';
    closeModal();
    showToast('ส่งแล้ว ✅');
  });
}
