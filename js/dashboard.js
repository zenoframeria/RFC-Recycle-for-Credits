// ขยะแลกแต้ม — populates the dashboard with real data from Supabase:
// profiles.points_total (via currentUser, same pattern me.html/shop.js
// already use) + the student's own submissions (kg recycled + activity).
// The points ring shows fill toward a fixed 50,000-point storage cap
// (display only, not a level/goal system — see CLAUDE.md's
// "Product model (current)" section for why levels don't exist here).
//
// Recent Activity only ever shows pending/rejected submissions (tabbed);
// approved submissions moved to the notification bell's history list.

const STATUS_LABEL = {
  approved: 'อนุมัติแล้ว',
  pending: 'รอตรวจสอบ',
  rejected: 'ถูกปฏิเสธ',
};

// Storage cap for the points ring — not a goal, just the display ceiling.
const POINTS_CAP = 50000;
const RING_RADIUS = 78;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const PAGE_SIZE = 5;
const REJECTED_VISIBLE_DAYS = 7;

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  renderHeader(currentUser);
  renderPoints(currentUser.pointsTotal);
  wireNotifications();
  wireReportModal();
  wireActivityTabs();
  wireLightbox();
  wireNicknameEdit(currentUser);

  await loadRecycledTotal(currentUser.id);
  await Promise.all([
    loadPendingTab(currentUser.id),
    loadRejectedTab(currentUser.id),
    loadNotifications(currentUser.id),
  ]);
  await refreshPoints(currentUser.id);
});

// Thai honorific prefixes that can appear in student_roster.name, with or
// without a space before the first name (e.g. "เด็กชายปิยะ ใจดี" or "ด.ช. ปิยะ ใจดี").
const THAI_TITLES = ['เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'นางสาว', 'นาย', 'นาง'];

function stripTitle(fullName) {
  let name = fullName.trim();
  for (const title of THAI_TITLES) {
    if (name.startsWith(title)) {
      name = name.slice(title.length).trim();
      break;
    }
  }
  return name;
}

function firstNameOnly(fullName) {
  return stripTitle(fullName).split(/\s+/)[0] || fullName;
}

function renderHeader(user) {
  const nickname = user.nickname?.trim();
  const displayName = nickname || firstNameOnly(user.name);
  document.getElementById('student-name').textContent = displayName;
  document.getElementById('student-fullname').textContent = stripTitle(user.name);
  document.getElementById('avatar-initial').textContent = displayName.charAt(0);
}

function wireNicknameEdit(currentUser) {
  const nameRow = document.getElementById('student-name-row');
  const editRow = document.getElementById('nickname-edit-row');
  const editBtn = document.getElementById('nickname-edit-btn');
  const input = document.getElementById('nickname-input');
  const saveBtn = document.getElementById('nickname-save-btn');
  const cancelBtn = document.getElementById('nickname-cancel-btn');

  function openEditor() {
    input.value = currentUser.nickname || '';
    nameRow.hidden = true;
    editRow.hidden = false;
    input.focus();
    input.select();
  }

  function closeEditor() {
    editRow.hidden = true;
    nameRow.hidden = false;
  }

  async function saveNickname() {
    const trimmed = input.value.trim();
    const newNickname = trimmed || null;

    saveBtn.disabled = true;
    const { error } = await supabaseClient
      .from('profiles')
      .update({ nickname: newNickname })
      .eq('id', currentUser.id);
    saveBtn.disabled = false;

    if (error) {
      showToast('บันทึกชื่อเล่นไม่สำเร็จ');
      console.error('saveNickname failed', error);
      return;
    }

    currentUser.nickname = newNickname;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    renderHeader(currentUser);
    closeEditor();
    showToast('บันทึกชื่อเล่นแล้ว');
  }

  editBtn.addEventListener('click', openEditor);
  cancelBtn.addEventListener('click', closeEditor);
  saveBtn.addEventListener('click', saveNickname);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveNickname();
    if (e.key === 'Escape') closeEditor();
  });
}

function renderPoints(pointsTotal) {
  const points = pointsTotal ?? 0;
  document.getElementById('points-value').textContent = points.toLocaleString();

  const fraction = Math.min(points / POINTS_CAP, 1);
  const ring = document.getElementById('points-ring-fill');
  ring.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  ring.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - fraction)}`;

  const remaining = Math.max(POINTS_CAP - points, 0);
  document.getElementById('points-remaining').textContent = remaining > 0
    ? `เก็บได้อีก ${remaining.toLocaleString()} pts ก่อนเต็ม`
    : 'เก็บครบเพดานแล้ว';
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

// Escapes user/admin-entered free text before it's dropped into innerHTML.
// Used for row.comment (an admin-typed rejection reason rendered into a
// different user's — the student's — session) and, defensively, for
// category, in case waste_categories.name ever includes admin free text.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

// Reveals `rows` into listEl in pages of PAGE_SIZE, wiring toggleEl to load
// the next page on click and hiding it once every row has been shown.
// renderBatch does the actual (possibly async, e.g. signed-URL-fetching)
// append work for one page.
function setupPager(rows, listEl, toggleEl, renderBatch) {
  let shown = 0;

  async function revealNext() {
    const batch = rows.slice(shown, shown + PAGE_SIZE);
    await renderBatch(batch);
    shown += batch.length;
    toggleEl.hidden = shown >= rows.length;
  }

  toggleEl.textContent = 'แสดงเพิ่มเติม';
  toggleEl.onclick = revealNext;
  revealNext();
}

// ── recent activity: pending tab ─────────────────────────────────────
async function loadPendingTab(userId) {
  const listEl = document.getElementById('pending-list');
  const toggleEl = document.getElementById('pending-toggle');

  const { data, error } = await supabaseClient
    .from('submissions')
    .select(`id, created_at, weight_kg, waste_categories ( name )`)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = '<div class="history-empty">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    console.error('loadPendingTab failed', error);
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    listEl.innerHTML = '<div class="history-empty">ไม่มีรายการที่รอตรวจสอบ</div>';
    return;
  }

  setupPager(rows, listEl, toggleEl, async (batch) => {
    listEl.insertAdjacentHTML('beforeend', batch.map(renderPendingRow).join(''));
  });
}

function renderPendingRow(row) {
  const category = escapeHtml(row.waste_categories?.name || '-');
  const when = formatDateTime(row.created_at);

  return `
    <div class="history-row">
      <div class="history-top">
        <div class="history-category">${category}</div>
        <div class="history-weight">${Number(row.weight_kg).toFixed(2)} kg</div>
      </div>
      <div class="history-status-row">
        <span class="history-status is-pending">${STATUS_LABEL.pending}</span>
      </div>
      <div class="history-time">${when}</div>
    </div>
  `;
}

// ── recent activity: rejected tab ────────────────────────────────────
// Rejected submissions keep their photo (per CLAUDE.md's photo-lifecycle
// rule), and only stay visible in this tab for 7 days — the row itself is
// untouched in the DB, this is a display-only cutoff enforced at query time.
async function loadRejectedTab(userId) {
  const listEl = document.getElementById('rejected-list');
  const toggleEl = document.getElementById('rejected-toggle');

  const cutoff = new Date(Date.now() - REJECTED_VISIBLE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseClient
    .from('submissions')
    .select(`id, created_at, weight_kg, comment, photo_url, waste_categories ( name )`)
    .eq('user_id', userId)
    .eq('status', 'rejected')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = '<div class="history-empty">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    console.error('loadRejectedTab failed', error);
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    listEl.innerHTML = '<div class="history-empty">ไม่มีรายการที่ถูกปฏิเสธในช่วง 7 วันที่ผ่านมา</div>';
    return;
  }

  setupPager(rows, listEl, toggleEl, async (batch) => {
    const withUrls = await Promise.all(batch.map(attachSignedUrl));
    listEl.insertAdjacentHTML('beforeend', withUrls.map(renderRejectedRow).join(''));
  });
}

// submissions bucket is private — a rejected row's photo needs a signed URL
// before it can be shown as a thumbnail. Same pattern as admin-review.js.
async function attachSignedUrl(row) {
  if (!row.photo_url) return { ...row, signedUrl: null };

  const { data: signed, error } = await supabaseClient
    .storage.from('submissions')
    .createSignedUrl(row.photo_url, 300);

  if (error) console.error('createSignedUrl failed', row.id, error);
  return { ...row, signedUrl: signed?.signedUrl || null };
}

function renderRejectedRow(row) {
  const category = escapeHtml(row.waste_categories?.name || '-');
  const when = formatDateTime(row.created_at);
  const commentHtml = row.comment
    ? `<div class="history-comment">เหตุผล: ${escapeHtml(row.comment)}</div>`
    : '';
  const thumbHtml = row.signedUrl
    ? `<button class="history-thumb" data-lightbox="${row.signedUrl}" aria-label="ดูรูปหลักฐาน"><img src="${row.signedUrl}" alt="รูปหลักฐาน"></button>`
    : `<div class="history-thumb history-thumb--empty">ไม่มีรูป</div>`;

  return `
    <div class="history-row history-row--with-photo">
      ${thumbHtml}
      <div class="history-row-body">
        <div class="history-top">
          <div class="history-category">${category}</div>
          <div class="history-weight">${Number(row.weight_kg).toFixed(2)} kg</div>
        </div>
        <div class="history-status-row">
          <span class="history-status is-rejected">${STATUS_LABEL.rejected}</span>
        </div>
        ${commentHtml}
        <div class="history-time">${when}</div>
      </div>
    </div>
  `;
}

function wireActivityTabs() {
  const tabs = document.querySelectorAll('.activity-tab');
  const panels = {
    pending: document.getElementById('panel-pending'),
    rejected: document.getElementById('panel-rejected'),
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      Object.entries(panels).forEach(([key, el]) => {
        el.hidden = key !== tab.dataset.tab;
      });
    });
  });
}

function wireLightbox() {
  const overlay = document.getElementById('photo-lightbox');
  const img = document.getElementById('lightbox-img');
  const closeBtn = document.getElementById('lightbox-close');
  const rejectedList = document.getElementById('rejected-list');

  function open(url) {
    img.src = url;
    overlay.classList.add('open');
  }
  function close() {
    overlay.classList.remove('open');
    img.src = '';
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  rejectedList.addEventListener('click', (e) => {
    const thumb = e.target.closest('.history-thumb[data-lightbox]');
    if (thumb) open(thumb.dataset.lightbox);
  });
}

// ── notification bell: approved submissions history ──────────────────
async function loadNotifications(userId) {
  const listEl = document.getElementById('notif-list');
  const toggleEl = document.getElementById('notif-toggle');

  const { data, error } = await supabaseClient
    .from('submissions')
    .select(`id, created_at, points_awarded, waste_categories ( name )`)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = '<div class="notif-empty">โหลดข้อมูลไม่สำเร็จ</div>';
    console.error('loadNotifications failed', error);
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    listEl.innerHTML = '<div class="notif-empty">ยังไม่มีรายการที่อนุมัติ</div>';
    return;
  }

  setupPager(rows, listEl, toggleEl, async (batch) => {
    listEl.insertAdjacentHTML('beforeend', batch.map(renderNotifRow).join(''));
  });
}

function renderNotifRow(row) {
  const category = escapeHtml(row.waste_categories?.name || '-');
  const when = formatDateTime(row.created_at);
  const points = (row.points_awarded ?? 0).toLocaleString();

  return `
    <div class="notif-item">
      <div class="content">
        <div class="text">${category} ได้รับการอนุมัติแล้ว ✅ <span class="notif-points">+${points} pts</span></div>
        <div class="time">${when}</div>
      </div>
    </div>
  `;
}

function wireNotifications() {
  const btn = document.getElementById('notif-btn');
  const panel = document.getElementById('notif-panel');

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
