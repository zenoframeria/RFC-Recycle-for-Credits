// ขยะแลกแต้ม — populates the dashboard with real data from Supabase:
// profiles.points_total (via currentUser, same pattern me.html/shop.js
// already use) + the student's own submissions (activity history).
// The points ring shows fill toward a fixed 50,000-point storage cap
// (display only, not a level/goal system — see CLAUDE.md's
// "Product model (current)" section for why levels don't exist here).
//
// Recent Activity only ever shows pending/rejected submissions (tabbed);
// the notification bell lists every reviewed submission (approved +
// rejected) with an unread count, and updates live via Supabase Realtime.

const STATUS_LABEL = {
  approved: 'อนุมัติแล้ว',
  pending: 'รอตรวจสอบ',
  rejected: 'ถูกปฏิเสธ',
};

// Storage cap for the points ring — not a goal, just the display ceiling.
const POINTS_CAP = 50000;
// Ring geometry (see .points-ring-conic/.points-ring-cap in dashboard.css):
// midline radius = (outer 90 + inner 78) / 2 = 84px from the 200x200 wrap's center.
const RING_CENTER = 100;
const RING_MID_RADIUS = 84;
const RING_TRACK_COLOR = '#EDE3CC';
// Seedling → Sprout → Gold → Master tiers, each stop scaled by the real
// points fraction so the gradient always ends exactly where the fill does.
const RING_TIER_COLORS = ['#F8E29A', '#F2C84B', '#1E3A8A', '#0F2461'];
const RING_TIER_STOPS = [0, 30, 62, 100];
const PAGE_SIZE = 5;
const REJECTED_VISIBLE_DAYS = 7;

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  renderHeader(currentUser);
  renderPoints(currentUser.pointsTotal);
  wireNotifications(currentUser.id);
  wireFeedbackButtons(currentUser);
  wireActivityTabs();
  wireLightbox();
  wireClearRejected(currentUser.id);
  wireNicknameEdit(currentUser);
  wireProgressHelp();

  await Promise.all([
    loadPendingTab(currentUser.id),
    loadRejectedTab(currentUser.id),
    loadNotifications(currentUser.id),
  ]);
  await refreshPoints(currentUser.id);
  subscribeToReviews(currentUser.id);
});

function renderHeader(user) {
  const shownName = displayName(user.name, user.nickname);
  document.getElementById('student-name').textContent = shownName;
  document.getElementById('student-fullname').textContent = stripTitle(user.name);
  document.getElementById('avatar-initial').textContent = shownName.charAt(0);
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
    renderSidebarUser(currentUser);
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
  countUp(document.getElementById('points-value'), points);
  renderPointsRing(points);
}

function ringCapPosition(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    top: RING_CENTER - RING_MID_RADIUS * Math.cos(rad),
    left: RING_CENTER + RING_MID_RADIUS * Math.sin(rad),
  };
}

function renderPointsRing(points) {
  const fraction = Math.max(0, Math.min(points / POINTS_CAP, 1));
  const conic = document.getElementById('points-ring-conic');
  const capStart = document.getElementById('points-ring-cap-start');
  const capEnd = document.getElementById('points-ring-cap-end');

  if (fraction <= 0) {
    conic.style.background = RING_TRACK_COLOR;
    capStart.style.display = 'none';
    capEnd.style.display = 'none';
    return;
  }

  const [c0, c1, c2, c3] = RING_TIER_COLORS;
  const [, s1, s2, s3] = RING_TIER_STOPS.map((pct) => pct * fraction);
  conic.style.background = `conic-gradient(from 0deg, ${c0} 0%, ${c1} ${s1}%, ${c2} ${s2}%, ${c3} ${s3}%, ${RING_TRACK_COLOR} ${s3}%, ${RING_TRACK_COLOR} 100%)`;

  const startPos = ringCapPosition(0);
  capStart.style.display = '';
  capStart.style.top = `${startPos.top}px`;
  capStart.style.left = `${startPos.left}px`;
  capStart.style.background = c0;

  const endPos = ringCapPosition(360 * fraction);
  capEnd.style.display = '';
  capEnd.style.top = `${endPos.top}px`;
  capEnd.style.left = `${endPos.left}px`;
  capEnd.style.background = c3;
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
  renderSidebarPoints(pointsTotal);

  const cached = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (cached) {
    cached.pointsTotal = pointsTotal;
    localStorage.setItem('currentUser', JSON.stringify(cached));
  }
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
    const before = listEl.children.length;
    const batch = rows.slice(shown, shown + PAGE_SIZE);
    await renderBatch(batch);
    shown += batch.length;
    toggleEl.hidden = shown >= rows.length;
    return listEl.children[before];
  }

  // a list that scrolls inside its own box (the bell panel) gets the new
  // rows below the fold — scroll the box so the first new row is on top
  async function onMoreClick() {
    const firstNew = await revealNext();
    if (!firstNew || listEl.scrollHeight <= listEl.clientHeight) return;
    const offset = firstNew.getBoundingClientRect().top - listEl.getBoundingClientRect().top;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listEl.scrollTo({ top: listEl.scrollTop + offset, behavior: reduce ? 'auto' : 'smooth' });
  }

  toggleEl.textContent = 'แสดงเพิ่มเติม';
  toggleEl.onclick = onMoreClick;
  revealNext();
}

// "i" next to Personal Progress — same sticky-note help as Rank / My Rewards
function wireProgressHelp() {
  const infoBtn = document.getElementById('progress-info-btn');
  const help = document.getElementById('progress-help');
  infoBtn.addEventListener('click', () => {
    help.hidden = !help.hidden;
    infoBtn.setAttribute('aria-expanded', String(!help.hidden));
  });
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

  // also called again by the realtime refresh — start from an empty list
  listEl.innerHTML = '';
  toggleEl.hidden = true;

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
// rule) until the student presses "ล้างทั้งหมด". The list only shows the
// last 7 days (display-only cutoff), but every rejected row is loaded so the
// clear button also appears — and clears — when only older ones are left.
async function loadRejectedTab(userId) {
  const listEl = document.getElementById('rejected-list');
  const toggleEl = document.getElementById('rejected-toggle');
  const actionsEl = document.getElementById('rejected-actions');

  const { data, error } = await supabaseClient
    .from('submissions')
    .select(`id, created_at, weight_kg, comment, photo_url, waste_categories ( name )`)
    .eq('user_id', userId)
    .eq('status', 'rejected')
    .order('created_at', { ascending: false });

  listEl.innerHTML = '';
  toggleEl.hidden = true;
  actionsEl.hidden = true;

  if (error) {
    listEl.innerHTML = '<div class="history-empty">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    console.error('loadRejectedTab failed', error);
    return;
  }

  const allRows = data || [];
  actionsEl.hidden = !allRows.length;

  const cutoff = Date.now() - REJECTED_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
  const rows = allRows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
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

// ── rejected tab: "ล้างทั้งหมด" ──────────────────────────────────────
// Deletes every rejected submission of this student (old ones too) —
// photo first through the Storage API, then the rows via
// clear_my_rejected() (sql/clear-rejected.sql). A row is only deleted once
// its photo is really gone, so a failed photo delete never leaves an
// orphaned file nobody can find.
const clearRejectedState = { rows: [] };

function wireClearRejected(userId) {
  const overlay = document.getElementById('clear-rejected-confirm');
  const close = () => overlay.classList.remove('open');

  document.getElementById('rejected-clear').addEventListener('click', () => openClearRejected(userId));
  document.getElementById('clear-rejected-close').addEventListener('click', close);
  document.getElementById('clear-rejected-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });
  document.getElementById('clear-rejected-ok').addEventListener('click', () => confirmClearRejected(userId));
}

async function openClearRejected(userId) {
  // fresh list at click time — the tab may be stale
  const { data, error } = await supabaseClient
    .from('submissions')
    .select('id, photo_url')
    .eq('user_id', userId)
    .eq('status', 'rejected');

  if (error) {
    console.error('openClearRejected failed', error);
    showToast('โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง');
    return;
  }

  clearRejectedState.rows = data || [];
  if (!clearRejectedState.rows.length) {
    loadRejectedTab(userId);
    return;
  }

  const okBtn = document.getElementById('clear-rejected-ok');
  okBtn.disabled = false;
  okBtn.textContent = 'ลบทั้งหมด';
  document.getElementById('clear-rejected-count').textContent = clearRejectedState.rows.length;
  document.getElementById('clear-rejected-confirm').classList.add('open');
}

async function confirmClearRejected(userId) {
  const rows = clearRejectedState.rows;
  if (!rows.length) return;

  const okBtn = document.getElementById('clear-rejected-ok');
  okBtn.disabled = true; // a double-tap must not run the delete twice
  okBtn.textContent = 'กำลังลบ...';

  const gone = await removeRejectedPhotos(userId, rows);
  const ids = rows.filter((r) => !r.photo_url || gone.has(r.photo_url)).map((r) => r.id);

  let failed = ids.length < rows.length;
  if (ids.length) {
    const { error } = await supabaseClient.rpc('clear_my_rejected', { p_ids: ids });
    if (error) {
      console.error('clear_my_rejected failed', error);
      failed = true;
    }
  }

  clearRejectedState.rows = [];
  document.getElementById('clear-rejected-confirm').classList.remove('open');
  // the bell lists rejected rows too
  await Promise.all([loadRejectedTab(userId), loadNotifications(userId)]);
  showToast(failed ? 'ลบได้ไม่ครบ ลองกดล้างอีกครั้ง' : 'ล้างรายการที่ถูกปฏิเสธแล้ว', { success: !failed });
}

// Returns the photo paths that are now gone from Storage: removed just
// now, or already missing (an earlier clear removed the photo but failed
// before deleting its row).
async function removeRejectedPhotos(userId, rows) {
  const gone = new Set();
  const paths = rows.map((r) => r.photo_url).filter(Boolean);
  if (!paths.length) return gone;

  const { data, error } = await supabaseClient.storage.from('submissions').remove(paths);
  if (error) console.error('remove rejected photos failed', error);
  (data || []).forEach((file) => gone.add(file.name));

  const leftover = paths.filter((p) => !gone.has(p));
  if (!leftover.length) return gone;

  // Storage reports a blocked delete and an already-missing file the same
  // way (just absent from `data`), so check which leftovers still exist.
  const { data: files, error: listError } = await supabaseClient
    .storage.from('submissions')
    .list(userId, { limit: 1000 });
  if (listError) {
    console.error('list submission photos failed', listError);
    return gone;
  }
  const existing = new Set((files || []).map((f) => `${userId}/${f.name}`));
  leftover.filter((p) => !existing.has(p)).forEach((p) => gone.add(p));
  return gone;
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

// ── notification bell: reviewed submissions (approved + rejected) ────
// "Seen" and "cleared" are two timestamps on the student's own profiles
// row (sql/notifications.sql), so they carry across devices. The badge
// counts reviews after notif_seen_at; the list hides reviews before
// notif_cleared_at.
const notifState = { unread: 0, loadId: 0 };

async function loadNotifications(userId) {
  const listEl = document.getElementById('notif-list');
  const toggleEl = document.getElementById('notif-toggle');
  const clearBtn = document.getElementById('notif-clear');
  // calls can overlap (clear, realtime, page load) — only the newest one
  // may render, so a slow older response can't bring cleared rows back
  const loadId = ++notifState.loadId;

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('notif_seen_at, notif_cleared_at')
    .eq('id', userId)
    .single();
  if (profileError) console.error('loadNotifications profile failed', profileError);
  const seenAt = profile?.notif_seen_at ? new Date(profile.notif_seen_at) : null;
  const clearedAt = profile?.notif_cleared_at || null;

  let query = supabaseClient
    .from('submissions')
    .select(`id, status, reviewed_at, points_awarded, comment, waste_categories ( name )`)
    .eq('user_id', userId)
    .in('status', ['approved', 'rejected'])
    .not('reviewed_at', 'is', null)
    .order('reviewed_at', { ascending: false });
  if (clearedAt) query = query.gt('reviewed_at', clearedAt);
  const { data, error } = await query;
  if (loadId !== notifState.loadId) return;

  listEl.innerHTML = '';
  toggleEl.hidden = true;

  if (error) {
    listEl.innerHTML = '<div class="notif-empty">โหลดข้อมูลไม่สำเร็จ</div>';
    console.error('loadNotifications failed', error);
    return;
  }

  const rows = data || [];
  clearBtn.hidden = !rows.length;
  setUnread(rows.filter((r) => !seenAt || new Date(r.reviewed_at) > seenAt).length);

  // a review arrived while the panel is open — the student is looking at it
  if (notifState.unread && document.getElementById('notif-panel').classList.contains('open')) {
    markNotificationsSeen();
  }

  if (!rows.length) {
    listEl.innerHTML = '<div class="notif-empty">ยังไม่มีการแจ้งเตือน</div>';
    return;
  }

  setupPager(rows, listEl, toggleEl, async (batch) => {
    listEl.insertAdjacentHTML('beforeend', batch.map(renderNotifRow).join(''));
  });
}

function setUnread(count) {
  notifState.unread = count;
  const badge = document.getElementById('notif-badge');
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.hidden = count === 0;
  document.getElementById('notif-btn').setAttribute(
    'aria-label',
    count ? `Notifications (${count} ใหม่)` : 'Notifications',
  );
}

async function markNotificationsSeen() {
  setUnread(0);
  const { error } = await supabaseClient.rpc('mark_notifications_seen');
  if (error) console.error('mark_notifications_seen failed', error);
}

function renderNotifRow(row) {
  const category = escapeHtml(row.waste_categories?.name || '-');
  const when = formatDateTime(row.reviewed_at);

  if (row.status === 'rejected') {
    const reasonHtml = row.comment
      ? `<div class="reason">เหตุผล: ${escapeHtml(row.comment)}</div>`
      : '';
    return `
      <div class="notif-item">
        <div class="content">
          <div class="text">${category} <span class="notif-rejected">ถูกตีกลับ</span></div>
          ${reasonHtml}
          <div class="time">${when}</div>
        </div>
      </div>
    `;
  }

  const points = (row.points_awarded ?? 0).toLocaleString();
  return `
    <div class="notif-item">
      <div class="content">
        <div class="text">${category} ได้รับการอนุมัติแล้ว <span class="notif-points">+${points} pts</span></div>
        <div class="time">${when}</div>
      </div>
    </div>
  `;
}

// Realtime: when an admin approves/rejects one of this student's
// submissions while Home is open, refresh the bell, both activity tabs and
// the points. Debounced — approve fires more than one UPDATE (status, then
// photo cleanup), and an admin may review several in a row.
function subscribeToReviews(userId) {
  let timer = null;
  supabaseClient
    .channel(`reviews-${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `user_id=eq.${userId}` },
      (payload) => {
        const status = payload.new?.status;
        if (status !== 'approved' && status !== 'rejected') return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          loadNotifications(userId);
          loadPendingTab(userId);
          loadRejectedTab(userId);
          refreshPoints(userId);
        }, 400);
      },
    )
    .subscribe();
}

function wireNotifications(userId) {
  const btn = document.getElementById('notif-btn');
  const panel = document.getElementById('notif-panel');
  const clearBtn = document.getElementById('notif-clear');

  function closePanel() {
    panel.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !panel.classList.contains('open');
    panel.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen && notifState.unread) markNotificationsSeen();
  });

  clearBtn.addEventListener('click', async () => {
    clearBtn.disabled = true;
    const { error } = await supabaseClient.rpc('clear_notifications');
    clearBtn.disabled = false;
    if (error) {
      showToast('ล้างการแจ้งเตือนไม่สำเร็จ');
      console.error('clear_notifications failed', error);
      return;
    }
    await loadNotifications(userId);
  });

  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('open')) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    closePanel();
  });
}
