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
  wireReportModal();
  wireActivityTabs();
  wireLightbox();
  wireNicknameEdit(currentUser);

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

  listEl.innerHTML = '';
  toggleEl.hidden = true;

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

// ── notification bell: reviewed submissions (approved + rejected) ────
// "Seen" and "cleared" are two timestamps on the student's own profiles
// row (sql/notifications.sql), so they carry across devices. The badge
// counts reviews after notif_seen_at; the list hides reviews before
// notif_cleared_at.
const notifState = { unread: 0 };

async function loadNotifications(userId) {
  const listEl = document.getElementById('notif-list');
  const toggleEl = document.getElementById('notif-toggle');
  const clearBtn = document.getElementById('notif-clear');

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
          <div class="text">${category} <span class="notif-rejected">ถูกตีกลับ ❌</span></div>
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
        <div class="text">${category} ได้รับการอนุมัติแล้ว ✅ <span class="notif-points">+${points} pts</span></div>
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

function wireReportModal() {
  const triggers = document.querySelectorAll('[data-open-report]');
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

  triggers.forEach((btn) => btn.addEventListener('click', openModal));
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
