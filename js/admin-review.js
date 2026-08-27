// ขยะแลกแต้ม — Admin Console (Phase 5). Pending-submissions review feed +
// waste category price editor. Approve is a single RPC call
// (public.approve_submission, see sql/phase5-admin-review.sql) so points are
// awarded atomically server-side — never a client-side read-then-write on
// profiles.points_total. Reject is a guarded client update (WHERE
// status='pending') since it never touches points or Storage.

const adminState = {
  currentUser: null,
  feedRows: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireAdminSession();
  if (!currentUser) return;
  adminState.currentUser = currentUser;

  document.getElementById('admin-name').textContent = currentUser.name;

  wireTabs();
  wireLogout();
  wireLightbox();

  await loadFeed();
  await loadCategoriesForEditing();
});

// ── tabs ────────────────────────────────────────────────────────────
function wireTabs() {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.admin-panel').forEach((p) => {
        p.classList.toggle('active', p.id === tab.dataset.panel);
      });
    });
  });
}

// ── logout ──────────────────────────────────────────────────────────
function wireLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('currentUser');
    window.location.href = 'login-admin.html';
  });
}

// ── lightbox (full-size photo view) ────────────────────────────────
function wireLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox-overlay') closeLightbox();
  });
}
function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox-overlay').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox-overlay').classList.remove('open');
  document.getElementById('lightbox-img').src = '';
}

// ── feed ────────────────────────────────────────────────────────────
async function loadFeed() {
  const list = document.getElementById('feed-list');

  const { data, error } = await supabaseClient
    .from('submissions')
    .select(`
      id, created_at, weight_kg, photo_url, waste_category_id, point_value_snapshot,
      profiles!user_id ( name, student_id, class_room ),
      waste_categories ( name, point_value )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    list.innerHTML = '<div class="coming-soon">โหลดรายการไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    console.error('loadFeed failed', error);
    return;
  }

  const rows = data || [];
  const withUrls = await Promise.all(rows.map(async (row) => {
    if (!row.photo_url) return { ...row, signedUrl: null };
    const { data: signed, error: signErr } = await supabaseClient
      .storage.from('submissions')
      .createSignedUrl(row.photo_url, 300);
    if (signErr) console.error('sign url failed', row.id, signErr);
    return { ...row, signedUrl: signed?.signedUrl || null };
  }));

  adminState.feedRows = withUrls;
  renderFeed();
}

function suggestedPoints(row) {
  const price = row.point_value_snapshot ?? row.waste_categories?.point_value ?? 0;
  return Math.round(row.weight_kg * price);
}

function renderFeed() {
  const list = document.getElementById('feed-list');

  if (!adminState.feedRows.length) {
    list.innerHTML = '<div class="coming-soon feed-empty">ไม่มีรายการรอตรวจสอบตอนนี้</div>';
    return;
  }

  list.innerHTML = adminState.feedRows.map((row) => {
    const student = row.profiles || {};
    const category = row.waste_categories || {};
    const when = new Date(row.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

    return `
      <div class="card feed-card" data-id="${row.id}">
        <div class="feed-card-top">
          <div class="feed-card-student">${student.name || 'ไม่ทราบชื่อ'}</div>
          <div class="feed-card-meta">${student.student_id || '-'} · ${student.class_room || '-'}</div>
        </div>
        ${row.signedUrl
          ? `<img class="feed-card-photo" src="${row.signedUrl}" alt="รูปหลักฐาน" data-lightbox="${row.signedUrl}">`
          : `<div class="coming-soon">ไม่มีรูป</div>`}
        <div class="feed-card-info">
          <div class="feed-card-row"><span class="k">หมวด</span><span class="v">${category.name || '-'}</span></div>
          <div class="feed-card-row"><span class="k">น้ำหนัก</span><span class="v">${Number(row.weight_kg).toFixed(2)} kg</span></div>
          <div class="feed-card-row"><span class="k">แต้มที่คาด</span><span class="v points">${suggestedPoints(row).toLocaleString()} pts</span></div>
          <div class="feed-card-row"><span class="k">เวลาส่ง</span><span class="v">${when}</span></div>
        </div>
        <textarea class="feed-card-comment" placeholder="เหตุผล (ถ้ามี — ใช้ตอนปฏิเสธ)"></textarea>
        <div class="feed-card-actions">
          <button type="button" class="btn-approve" data-action="approve">อนุมัติ · Approve</button>
          <button type="button" class="btn-reject" data-action="reject">ปฏิเสธ · Reject</button>
        </div>
      </div>
    `;
  }).join('');
}

function removeCardFromFeed(id) {
  adminState.feedRows = adminState.feedRows.filter((r) => r.id !== id);
  renderFeed();
}

// ── price editor (implemented in a later commit; placeholder here so the
//    page doesn't error before that lands) ─────────────────────────────
async function loadCategoriesForEditing() {
  // implemented below
}
