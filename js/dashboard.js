// ขยะแลกแต้ม — populates the dashboard from the fake data in data.js.

const STAT_ICONS = [
  { d: 'M7 7l-3 5 3 2M17 7l3 5-3 2M7 17h10M12 4 8 10h8z', tint: 'var(--sb-green)' },
  { d: 'M12 3c2 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 1-5 1-8z', tint: 'var(--sb-red)' },
  { d: 'M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l8-8', tint: 'var(--accent)' },
];

document.addEventListener('DOMContentLoaded', () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!currentUser || currentUser.role !== 'student') {
    window.location.href = 'login-student.html';
    return;
  }

  renderHeader(currentUser);
  renderProgressRing(FAKE_DASHBOARD.points);
  renderStats(FAKE_DASHBOARD.stats);
  renderLeaderboard(FAKE_DASHBOARD.classLeaderboard);
  renderEnergyBar(FAKE_DASHBOARD.schoolEnergy);
  wireNav();
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

function renderLeaderboard({ myRank, totalRooms, myClass, squadName, rows }) {
  document.getElementById('war-rank-num').innerHTML = `<span class="hash">#</span>${myRank}`;
  document.getElementById('war-of').textContent = `OF ${totalRooms} ROOMS`;
  document.getElementById('war-class-name').textContent = myClass;
  document.getElementById('war-squad').textContent = `· ${squadName} ·`;

  const myRow = rows.find((r) => r.mine);
  document.getElementById('war-pts').innerHTML = `${(myRow.pts).toLocaleString()} <span>pts</span>`;

  const board = document.getElementById('war-board');
  board.innerHTML = rows.map((r) => `
    <div class="war-row${r.mine ? ' mine' : ''}" data-rank="${r.rank}">
      <div class="rank">#${r.rank}</div>
      <div class="name">${r.name}${r.mine ? '<span class="you-tag">YOU</span>' : ''}</div>
      <div class="pts">${(r.pts / 1000).toFixed(1)}k</div>
    </div>
  `).join('');
}

function renderEnergyBar({ total, target, helpers }) {
  const pct = Math.min(total / target, 1);
  document.getElementById('energy-pct-num').textContent = Math.round(pct * 100);
  document.getElementById('energy-fill').style.width = `${pct * 100}%`;
  document.getElementById('energy-total').textContent = `${(total / 1000).toFixed(1)}K`;
  document.getElementById('energy-target').textContent = `/ ${(target / 1000).toFixed(0)}K pts`;
  document.getElementById('energy-helpers').textContent = `${helpers} คนช่วยกัน`;
}

const TAB_TOAST_MESSAGES = {
  map: '🗺️ แผนที่ — coming soon · เร็ว ๆ นี้',
  scan: '📸 สแกน — coming soon · เร็ว ๆ นี้',
  rank: '🏆 อันดับ — coming soon · เร็ว ๆ นี้',
  me: '🙋 โปรไฟล์ — coming soon · เร็ว ๆ นี้',
};

function wireNav() {
  document.querySelectorAll('.nav-item[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'home') return;
      document.querySelectorAll('.nav-item[data-tab]').forEach((b) => b.classList.remove('active'));
      if (tab !== 'scan') btn.classList.add('active');
      showToast(TAB_TOAST_MESSAGES[tab] || 'coming soon · เร็ว ๆ นี้');
    });
  });

  document.getElementById('scan-btn').addEventListener('click', () => {
    showToast(TAB_TOAST_MESSAGES.scan);
  });
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}
