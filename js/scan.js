// ขยะแลกแต้ม — Scan & Launch (Phase 4). Student weighs their own sorted
// waste, photographs it, picks a category, and the app compresses + uploads
// the photo and inserts a `submissions` row with status='pending'.
//
// No auto-approve, ever — every submission needs a human admin to look at
// the photo and approve/reject via the feed (Phase 5). This form never sets
// status to anything but 'pending'.
//
// No time-gating and no round-dates banner in this pass (deliberately
// deferred per CLAUDE.md — collection_rounds doesn't exist yet).

const MAX_PHOTO_WIDTH = 800;
const PHOTO_QUALITY = 0.7;
const MIN_WEIGHT_KG = 0.05;
// mainly a typo guard (e.g. "50" for "5.0") — every submission is still
// checked by an admin with the photo
const MAX_WEIGHT_KG = 10;

const scanState = {
  currentUser: null,
  categories: [],
  selectedCategoryId: null,
  photoBlob: null,
  photoPreviewUrl: null,
};

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;
  scanState.currentUser = currentUser;

  await loadCategories();
  wireWeightInput();
  wirePhotoInput();
  wireSubmit();
  wireSubmitAnother();
});

// ── categories ──────────────────────────────────────────────────────
async function loadCategories() {
  const list = document.getElementById('category-list');
  const { data, error } = await supabaseClient
    .from('waste_categories')
    .select('id, name, point_value')
    .order('id');

  if (error || !data || !data.length) {
    list.innerHTML = '<div class="coming-soon">โหลดหมวดขยะไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    return;
  }

  scanState.categories = data;
  list.innerHTML = data.map((cat) => `
    <button type="button" class="category-item" data-category="${cat.id}">
      <div class="category-name">${cat.name}</div>
    </button>
  `).join('');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-item');
    if (!btn) return;
    scanState.selectedCategoryId = Number(btn.dataset.category);
    list.querySelectorAll('.category-item').forEach((el) => {
      el.classList.toggle('is-selected', el === btn);
    });
    refreshConfirmState();
  });
}

// ── weight ──────────────────────────────────────────────────────────
function wireWeightInput() {
  document.getElementById('weight-input').addEventListener('input', () => {
    validateWeight();
    refreshConfirmState();
  });
}

// Enforces a flat minimum weight per submission across all categories, so
// splitting one weighing into several tiny submissions can't out-earn
// submitting it as one (points round per-submission, see CLAUDE.md).
// The three fields can be filled in any order — only the submit button
// waits for all of them (refreshConfirmState).
function validateWeight() {
  const weight = parseFloat(document.getElementById('weight-input').value);
  const errorEl = document.getElementById('weight-error');
  const belowMin = weight > 0 && weight < MIN_WEIGHT_KG;
  const aboveMax = weight > MAX_WEIGHT_KG;

  if (belowMin) {
    errorEl.textContent = `น้ำหนักต้องอย่างน้อย ${MIN_WEIGHT_KG} กก. (${Math.round(MIN_WEIGHT_KG * 1000)} กรัม) ต่อการส่งหนึ่งครั้ง`;
  } else if (aboveMax) {
    errorEl.textContent = `น้ำหนักต้องไม่เกิน ${MAX_WEIGHT_KG} กก. ต่อการส่งหนึ่งครั้ง ถ้ามีมากกว่านี้ให้แบ่งส่งหลายครั้ง`;
  } else {
    errorEl.textContent = '';
  }
  errorEl.hidden = !belowMin && !aboveMax;

  return isWeightOk(weight);
}

function isWeightOk(weight) {
  return weight >= MIN_WEIGHT_KG && weight <= MAX_WEIGHT_KG;
}

// ── photo (compress client-side before it ever touches state; compressImage
//    itself now lives in nav-common.js, shared with admin-shop.js) ───────

function wirePhotoInput() {
  const input = document.getElementById('photo-input');
  const trigger = document.getElementById('photo-trigger');
  const preview = document.getElementById('photo-preview');
  const previewImg = document.getElementById('photo-preview-img');
  const sizeNote = document.getElementById('photo-size-note');
  const triggerLabel = trigger.querySelector('.label');

  trigger.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    trigger.disabled = true;
    triggerLabel.textContent = 'กำลังบีบอัดรูป...';

    try {
      const blob = await compressImage(file, MAX_PHOTO_WIDTH, PHOTO_QUALITY);
      scanState.photoBlob = blob;

      if (scanState.photoPreviewUrl) URL.revokeObjectURL(scanState.photoPreviewUrl);
      scanState.photoPreviewUrl = URL.createObjectURL(blob);
      previewImg.src = scanState.photoPreviewUrl;
      preview.hidden = false;
      sizeNote.textContent = `${(file.size / 1024).toFixed(0)} KB → ${(blob.size / 1024).toFixed(0)} KB`;
    } catch (err) {
      scanState.photoBlob = null;
      showToast('แนบรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      trigger.disabled = false;
      triggerLabel.textContent = scanState.photoBlob ? 'เปลี่ยนรูป' : 'แนบรูปถ่าย';
      refreshConfirmState();
    }
  });
}

// ── confirm state ──────────────────────────────────────────────────
function refreshConfirmState() {
  const weight = parseFloat(document.getElementById('weight-input').value);
  const ready = scanState.selectedCategoryId && isWeightOk(weight) && scanState.photoBlob;
  document.getElementById('confirm-btn').disabled = !ready;
}

// ── submit ──────────────────────────────────────────────────────────
function wireSubmit() {
  document.getElementById('confirm-btn').addEventListener('click', async () => {
    const weight = parseFloat(document.getElementById('weight-input').value);
    const cat = scanState.categories.find((c) => c.id === scanState.selectedCategoryId);
    if (!cat || !isWeightOk(weight) || !scanState.photoBlob) return;

    setSubmitLoading(true);

    const submissionId = crypto.randomUUID();
    const photoPath = `${scanState.currentUser.id}/${submissionId}.jpg`;

    try {
      const { error: uploadError } = await supabaseClient
        .storage
        .from('submissions')
        .upload(photoPath, scanState.photoBlob, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง');

      const { error: insertError } = await supabaseClient
        .from('submissions')
        .insert({
          id: submissionId,
          user_id: scanState.currentUser.id,
          waste_category_id: cat.id,
          weight_kg: weight,
          photo_url: photoPath,
          status: 'pending',
          // point_value_snapshot is filled in by the server (sql/price-snapshot-server.sql).
        });

      if (insertError) {
        await supabaseClient.storage.from('submissions').remove([photoPath]);
        throw new Error('บันทึกข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง');
      }

      showSuccess(cat, weight);
    } catch (err) {
      showToast(err.message);
    } finally {
      setSubmitLoading(false);
    }
  });
}

function setSubmitLoading(loading) {
  const btn = document.getElementById('confirm-btn');
  btn.disabled = loading;
  btn.querySelector('.label').textContent = loading ? 'กำลังส่ง...' : 'ส่งข้อมูล';
}

// ── success / submit-another ──────────────────────────────────────
function showSuccess(cat, weight) {
  document.getElementById('success-category').textContent = cat.name;
  document.getElementById('success-weight').textContent = `${weight.toFixed(2)} kg`;

  document.getElementById('scan-form').hidden = true;
  document.getElementById('scan-success').hidden = false;
  showToast('ส่งข้อมูลแล้ว · รอแอดมินตรวจสอบ', { success: true });
}

function wireSubmitAnother() {
  document.getElementById('submit-another-btn').addEventListener('click', resetForm);
}

function resetForm() {
  scanState.selectedCategoryId = null;
  scanState.photoBlob = null;
  if (scanState.photoPreviewUrl) {
    URL.revokeObjectURL(scanState.photoPreviewUrl);
    scanState.photoPreviewUrl = null;
  }

  document.getElementById('weight-input').value = '';
  document.getElementById('photo-input').value = '';
  document.getElementById('photo-preview').hidden = true;
  document.getElementById('photo-trigger').querySelector('.label').textContent = 'แนบรูปถ่าย';
  document.querySelectorAll('.category-item').forEach((el) => el.classList.remove('is-selected'));

  validateWeight();
  refreshConfirmState();

  document.getElementById('scan-form').hidden = false;
  document.getElementById('scan-success').hidden = true;
}
