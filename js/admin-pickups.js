// ขยะแลกแต้ม — Admin console, Pickups tab. A student shows their Shop
// receipt (code R-0042 = redemptions.id 42); the council member types the
// code here, checks the name against the student in front of them, hands
// the item over and taps "มอบแล้ว". That goes through
// mark_redemption_picked_up() (sql/shop-redemption.sql), which only flips a
// still-pending receipt — so the same receipt can't be used twice, even if
// two admins tap at once.

const pickupState = { row: null };

function initPickupsTab() {
  document.getElementById('pickup-search').addEventListener('submit', (e) => {
    e.preventDefault();
    lookupReceipt();
  });
}

async function lookupReceipt() {
  const result = document.getElementById('pickup-result');
  const id = parseReceiptCode(document.getElementById('pickup-code').value);
  pickupState.row = null;

  if (!id) {
    result.innerHTML = '<div class="coming-soon">พิมพ์รหัสใบเสร็จก่อน เช่น R-0042</div>';
    return;
  }

  result.innerHTML = '<div class="coming-soon">กำลังค้นหา...</div>';

  const { data, error } = await supabaseClient
    .from('redemptions')
    .select(`
      id, created_at, item_name, cost, status, picked_up_at,
      student:profiles!user_id ( name, student_id, class_room ),
      picker:profiles!picked_up_by ( name )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('lookupReceipt failed', id, error);
    result.innerHTML = '<div class="coming-soon">ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง</div>';
    return;
  }
  if (!data) {
    result.innerHTML = `<div class="coming-soon">ไม่พบใบเสร็จ ${receiptCode(id)}</div>`;
    return;
  }

  pickupState.row = data;
  renderReceipt();
}

function formatPickupTime(dateStr) {
  return new Date(dateStr).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderReceipt() {
  const r = pickupState.row;
  const pickedUp = r.status === 'picked_up';
  const student = r.student || {};

  document.getElementById('pickup-result').innerHTML = `
    <div class="pickup-card${pickedUp ? ' is-picked-up' : ''}">
      <div class="pickup-card-top">
        <span class="pickup-code">${receiptCode(r.id)}</span>
        <span class="pickup-status">${pickedUp ? 'รับแล้ว' : 'รอรับ'}</span>
      </div>
      <div class="feed-card-info">
        <div class="feed-card-row"><span class="k">นักเรียน</span><span class="v">${escapeHtml(student.name || '-')}</span></div>
        <div class="feed-card-row"><span class="k">รหัส · ห้อง</span><span class="v">${escapeHtml(student.student_id || '-')} · ${escapeHtml(student.class_room || '-')}</span></div>
        <div class="feed-card-row"><span class="k">ของที่แลก</span><span class="v">${escapeHtml(r.item_name)}</span></div>
        <div class="feed-card-row"><span class="k">แต้มที่ใช้</span><span class="v points">${r.cost.toLocaleString()} pts</span></div>
        <div class="feed-card-row"><span class="k">แลกเมื่อ</span><span class="v">${formatPickupTime(r.created_at)}</span></div>
      </div>
      ${pickedUp
        ? `<div class="pickup-done">มอบไปแล้วเมื่อ ${formatPickupTime(r.picked_up_at)}${r.picker ? ` โดย ${escapeHtml(r.picker.name)}` : ''} · ห้ามมอบซ้ำ</div>`
        : `<div class="pickup-hint">เช็กชื่อกับตัวน้องก่อนมอบของนะ</div>
           <button type="button" class="btn-approve pickup-confirm-btn" id="pickup-confirm-btn">มอบแล้ว ✓</button>`}
    </div>
  `;

  const btn = document.getElementById('pickup-confirm-btn');
  if (btn) btn.addEventListener('click', markPickedUp);
}

async function markPickedUp() {
  const r = pickupState.row;
  if (!r) return;

  const btn = document.getElementById('pickup-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  const { data, error } = await supabaseClient.rpc('mark_redemption_picked_up', { p_redemption_id: r.id });
  const result = data && data[0];

  if (error || !result) {
    console.error('mark_redemption_picked_up failed', r.id, error);
    btn.disabled = false;
    btn.textContent = 'มอบแล้ว ✓';
    showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    return;
  }

  if (result.success) showToast(`มอบ ${receiptCode(r.id)} แล้ว`);
  else if (result.message === 'already picked up') showToast('ใบเสร็จนี้มีคนมอบไปแล้ว');
  else showToast('ไม่พบใบเสร็จนี้');

  // re-read so the card shows who handed it over and when
  await lookupReceipt();
}
