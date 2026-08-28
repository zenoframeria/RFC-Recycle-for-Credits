// ขยะแลกแต้ม — populates the dashboard with real data from Supabase:
// profiles.points_total (via currentUser, same pattern me.html/shop.js
// already use) + the student's own submissions (kg recycled + history).
// No fake percentage/level/target — those concepts don't exist in the
// current product model, see CLAUDE.md's "Product model (current)" section.

const STATUS_LABEL = {
  approved: 'อนุมัติแล้ว',
  pending: 'รอตรวจสอบ',
  rejected: 'ถูกปฏิเสธ',
};

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  renderHeader(currentUser);
  renderPoints(currentUser.pointsTotal);
  wireNotifications();
  wireReportModal();

  await loadRecycledTotal(currentUser.id);
  await loadHistory(currentUser.id);
  await refreshPoints(currentUser.id);
});

function renderHeader(user) {
  document.getElementById('student-name').textContent = user.name;
  document.getElementById('avatar-initial').textContent = user.name.trim().charAt(0);
}

function renderPoints(pointsTotal) {
  document.getElementById('points-value').textContent = (pointsTotal ?? 0).toLocaleString();
}

// Instant paint above uses the cached currentUser.pointsTotal (set at login,
// never updated after). This corrects it in the background from the live
// profiles.points_total once it arrives, and writes the fresh value back to
// localStorage so me.html/shop.js (which read the same cached field) also
// pick up the correction on their next load.
async function refreshPoints(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('points_total')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('refreshPoints failed', error);
    return; // keep showing the cached value already on screen
  }

  const pointsTotal = data.points_total ?? 0;
  renderPoints(pointsTotal);

  const cached = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (cached) {
    cached.pointsTotal = pointsTotal;
    localStorage.setItem('currentUser', JSON.stringify(cached));
  }
}

// Sum of weight_kg across this student's approved submissions only —
// pending/rejected don't count since nothing was actually awarded for them.
async function loadRecycledTotal(userId) {
  const el = document.getElementById('kg-recycled-value');

  const { data, error } = await supabaseClient
    .from('submissions')
    .select('weight_kg')
    .eq('user_id', userId)
    .eq('status', 'approved');

  if (error) {
    console.error('loadRecycledTotal failed', error);
    el.textContent = '-';
    return;
  }

  const totalKg = (data || []).reduce((sum, row) => sum + Number(row.weight_kg || 0), 0);
  el.textContent = totalKg.toFixed(1);
}

async function loadHistory(userId) {
  const list = document.getElementById('history-list');

  const { data, error } = await supabaseClient
    .from('submissions')
    .select(`
      id, created_at, weight_kg, status, points_awarded, comment,
      waste_categories ( name )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    list.innerHTML = '<div class="history-empty">โหลดประวัติไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    console.error('loadHistory failed', error);
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    list.innerHTML = '<div class="history-empty">ยังไม่มีประวัติการส่งขยะ ลองไปที่ Scan &amp; Launch ดูสิ</div>';
    return;
  }

  list.innerHTML = rows.map(renderHistoryRow).join('');
}

// Escapes user/admin-entered free text before it's dropped into innerHTML.
// Used for row.comment (an admin-typed rejection reason rendered into a
// different user's — the student's — session) and, defensively, for
// category, in case waste_categories.name ever includes admin free text.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderHistoryRow(row) {
  const category = escapeHtml(row.waste_categories?.name || '-');
  const when = new Date(row.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

  let statusHtml;
  if (row.status === 'approved') {
    statusHtml = `
      <span class="history-status is-approved">${STATUS_LABEL.approved}</span>
      <span class="history-points">+${(row.points_awarded ?? 0).toLocaleString()} pts</span>
    `;
  } else if (row.status === 'pending') {
    statusHtml = `<span class="history-status is-pending">${STATUS_LABEL.pending}</span>`;
  } else {
    statusHtml = `<span class="history-status is-rejected">${STATUS_LABEL.rejected}</span>`;
  }

  const commentHtml = (row.status === 'rejected' && row.comment)
    ? `<div class="history-comment">เหตุผล: ${escapeHtml(row.comment)}</div>`
    : '';

  return `
    <div class="history-row">
      <div class="history-top">
        <div class="history-category">${category}</div>
        <div class="history-weight">${Number(row.weight_kg).toFixed(2)} kg</div>
      </div>
      <div class="history-status-row">${statusHtml}</div>
      ${commentHtml}
      <div class="history-time">${when}</div>
    </div>
  `;
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
