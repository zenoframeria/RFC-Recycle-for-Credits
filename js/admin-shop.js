// ขยะแลกแต้ม — Admin console, Shop tab (Phase 7). Lets an admin manage the
// real shop_items catalog (name/section/cost/stock/opens_on + a photo) that
// js/shop.js reads on the student side, replacing the old SHOP_ITEMS mock
// array. Photos are compressed client-side (shared compressImage() from
// nav-common.js) and stored in the public `shop-items` Storage bucket —
// public because product photos aren't sensitive, unlike the private
// `submissions` bucket (see CLAUDE.md). See sql/phase7-shop-catalog.sql for
// the table/RLS/bucket this depends on — must be run by hand in Supabase
// first (no direct DB access from this environment).

const SHOP_ITEM_PHOTO_MAX_WIDTH = 800;
const SHOP_ITEM_PHOTO_QUALITY = 0.7;

const shopManageState = {
  items: [],
  editingId: null,
  photoBlob: null,
  photoPreviewUrl: null,
};

const SHOP_SECTION_LABELS = { cert: 'เกียรติบัตร', stationery: 'เครื่องเขียน', limited: 'Limited Edition' };

async function initShopTab() {
  wireShopModal();
  document.getElementById('shop-add-btn').addEventListener('click', () => openShopItemModal(null));
  await loadShopItems();
}

// ── list ────────────────────────────────────────────────────────────
async function loadShopItems() {
  const list = document.getElementById('shop-manage-list');

  const { data, error } = await supabaseClient
    .from('shop_items')
    .select('*')
    .order('id');

  if (error) {
    list.innerHTML = '<div class="coming-soon">โหลดรายการสินค้าไม่สำเร็จ</div>';
    console.error('loadShopItems failed', error);
    return;
  }

  shopManageState.items = data || [];
  renderShopManageList();
}

function shopItemImageUrl(item) {
  if (!item.image_path) return null;
  return supabaseClient.storage.from('shop-items').getPublicUrl(item.image_path).data.publicUrl;
}

function shopItemMeta(item) {
  const parts = [`${item.cost.toLocaleString()} pts`];
  if (item.section === 'limited') {
    if (item.stock !== null && item.stock !== undefined) parts.push(`คงเหลือ ${item.stock}/${item.stock_max ?? '-'}`);
    if (item.opens_on) parts.push(`เปิด ${item.opens_on}`);
  }
  return parts.join(' · ');
}

function renderShopManageList() {
  const list = document.getElementById('shop-manage-list');

  if (!shopManageState.items.length) {
    list.innerHTML = '<div class="coming-soon">ยังไม่มีสินค้า กด "+ เพิ่มสินค้า" เพื่อเริ่มเลย</div>';
    return;
  }

  const sections = ['cert', 'stationery', 'limited'];
  list.innerHTML = sections.map((section) => {
    const items = shopManageState.items.filter((i) => i.section === section);
    if (!items.length) return '';
    return `
      <div class="shop-manage-section-label">${SHOP_SECTION_LABELS[section]}</div>
      ${items.map((item) => {
        const url = shopItemImageUrl(item);
        return `
          <div class="shop-manage-item" data-id="${item.id}">
            ${url
              ? `<img class="shop-manage-thumb" src="${url}" alt="${item.name}">`
              : `<div class="shop-manage-thumb is-empty">ไม่มีรูป</div>`}
            <div class="shop-manage-info">
              <div class="shop-manage-name">${item.name}</div>
              <div class="shop-manage-meta">${shopItemMeta(item)}</div>
            </div>
            <div class="shop-manage-actions">
              <button type="button" class="shop-manage-edit" data-action="edit">แก้ไข</button>
              <button type="button" class="shop-manage-delete" data-action="delete">ลบ</button>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }).join('');

  list.querySelectorAll('.shop-manage-item').forEach((card) => {
    const id = Number(card.dataset.id);
    card.querySelector('[data-action="edit"]').addEventListener('click', () => {
      const item = shopManageState.items.find((i) => i.id === id);
      openShopItemModal(item);
    });
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteShopItem(id));
  });
}

// ── modal (add / edit) ─────────────────────────────────────────────
function wireShopModal() {
  document.getElementById('shop-item-modal-close').addEventListener('click', closeShopItemModal);
  document.getElementById('shop-item-modal').addEventListener('click', (e) => {
    if (e.target.id === 'shop-item-modal') closeShopItemModal();
  });

  const photoInput = document.getElementById('shop-item-photo-input');
  const photoTrigger = document.getElementById('shop-item-photo-trigger');
  photoTrigger.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;

    const label = photoTrigger.querySelector('.label');
    photoTrigger.disabled = true;
    label.textContent = 'กำลังบีบอัดรูป...';

    try {
      const blob = await compressImage(file, SHOP_ITEM_PHOTO_MAX_WIDTH, SHOP_ITEM_PHOTO_QUALITY);
      shopManageState.photoBlob = blob;

      if (shopManageState.photoPreviewUrl) URL.revokeObjectURL(shopManageState.photoPreviewUrl);
      shopManageState.photoPreviewUrl = URL.createObjectURL(blob);

      document.getElementById('shop-item-photo-preview-img').src = shopManageState.photoPreviewUrl;
      document.getElementById('shop-item-photo-preview').hidden = false;
    } catch (err) {
      shopManageState.photoBlob = null;
      showToast('แนบรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      photoTrigger.disabled = false;
      label.textContent = shopManageState.photoBlob ? 'เปลี่ยนรูป' : 'แนบรูปสินค้า';
    }
  });

  document.getElementById('shop-item-save-btn').addEventListener('click', saveShopItem);

  // clear a field's red error as soon as the admin starts fixing it
  REQUIRED_SHOP_FIELDS.forEach((id) => {
    document.getElementById(id).addEventListener('input', () => setShopFieldError(id, ''));
  });
}

function openShopItemModal(item) {
  shopManageState.editingId = item ? item.id : null;
  shopManageState.photoBlob = null;
  if (shopManageState.photoPreviewUrl) {
    URL.revokeObjectURL(shopManageState.photoPreviewUrl);
    shopManageState.photoPreviewUrl = null;
  }

  clearShopFieldErrors();
  document.getElementById('shop-item-modal-title').textContent = item ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า';
  document.getElementById('shop-item-name').value = item?.name || '';
  document.getElementById('shop-item-section').value = item?.section || 'stationery';
  document.getElementById('shop-item-cost').value = item?.cost ?? '';
  document.getElementById('shop-item-desc').value = item?.description || '';
  document.getElementById('shop-item-stock').value = item?.stock ?? '';
  document.getElementById('shop-item-stock-max').value = item?.stock_max ?? '';
  document.getElementById('shop-item-opens-on').value = item?.opens_on || '';

  const preview = document.getElementById('shop-item-photo-preview');
  const previewImg = document.getElementById('shop-item-photo-preview-img');
  const existingUrl = item ? shopItemImageUrl(item) : null;
  if (existingUrl) {
    previewImg.src = existingUrl;
    preview.hidden = false;
  } else {
    previewImg.src = '';
    preview.hidden = true;
  }
  document.getElementById('shop-item-photo-trigger').querySelector('.label').textContent = 'แนบรูปสินค้า';

  document.getElementById('shop-item-modal').classList.add('open');
}

function closeShopItemModal() {
  document.getElementById('shop-item-modal').classList.remove('open');
}

function readShopItemForm() {
  const name = document.getElementById('shop-item-name').value.trim();
  const section = document.getElementById('shop-item-section').value;
  const cost = parseInt(document.getElementById('shop-item-cost').value, 10);
  const description = document.getElementById('shop-item-desc').value.trim() || null;
  const stockRaw = document.getElementById('shop-item-stock').value.trim();
  const stockMaxRaw = document.getElementById('shop-item-stock-max').value.trim();
  const opensOnRaw = document.getElementById('shop-item-opens-on').value;

  return {
    name,
    section,
    cost,
    description,
    stock: stockRaw === '' ? null : parseInt(stockRaw, 10),
    stock_max: stockMaxRaw === '' ? null : parseInt(stockMaxRaw, 10),
    opens_on: opensOnRaw || null,
  };
}

// Required-field errors shown inline in red under each field (plus a red
// border on its box), instead of a toast that vanishes before it's read.
const REQUIRED_SHOP_FIELDS = ['shop-item-name', 'shop-item-cost'];

function setShopFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(`${inputId}-error`);
  input.closest('.field-box').classList.toggle('is-invalid', !!message);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  errorEl.textContent = message || '';
  errorEl.hidden = !message;
}

function clearShopFieldErrors() {
  REQUIRED_SHOP_FIELDS.forEach((id) => setShopFieldError(id, ''));
}

function validateShopItemForm(form) {
  const errors = {};
  if (!form.name) errors['shop-item-name'] = 'กรุณากรอกชื่อสินค้า';
  if (!Number.isFinite(form.cost)) errors['shop-item-cost'] = 'กรุณากรอกราคาเป็นตัวเลข';
  else if (form.cost < 0) errors['shop-item-cost'] = 'ราคาต้องไม่ติดลบ';

  REQUIRED_SHOP_FIELDS.forEach((id) => setShopFieldError(id, errors[id]));

  const firstInvalid = REQUIRED_SHOP_FIELDS.find((id) => errors[id]);
  if (firstInvalid) {
    const input = document.getElementById(firstInvalid);
    input.closest('.field').scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  }
  return !firstInvalid;
}

async function saveShopItem() {
  const form = readShopItemForm();
  if (!validateShopItemForm(form)) return;

  const saveBtn = document.getElementById('shop-item-save-btn');
  const saveLabel = document.getElementById('shop-item-save-label');
  saveBtn.disabled = true;
  saveLabel.textContent = 'กำลังบันทึก...';

  try {
    let itemId = shopManageState.editingId;
    const payload = {
      name: form.name, section: form.section, cost: form.cost, description: form.description,
      stock: form.stock, stock_max: form.stock_max, opens_on: form.opens_on,
    };

    if (itemId) {
      const { error } = await supabaseClient.from('shop_items').update(payload).eq('id', itemId);
      if (error) throw new Error('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    } else {
      const { data, error } = await supabaseClient.from('shop_items').insert(payload).select().single();
      if (error) throw new Error('เพิ่มสินค้าไม่สำเร็จ ลองใหม่อีกครั้ง');
      itemId = data.id;
    }

    if (shopManageState.photoBlob) {
      const oldItem = shopManageState.items.find((i) => i.id === itemId);
      const oldPath = oldItem?.image_path || null;

      const newPath = `${itemId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabaseClient
        .storage.from('shop-items')
        .upload(newPath, shopManageState.photoBlob, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ (ข้อมูลสินค้าบันทึกแล้ว) ลองแก้ไขแล้วอัปโหลดรูปอีกครั้ง');

      const { error: patchError } = await supabaseClient
        .from('shop_items')
        .update({ image_path: newPath })
        .eq('id', itemId);
      if (patchError) throw new Error('บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง');

      if (oldPath) {
        const { error: delErr } = await supabaseClient.storage.from('shop-items').remove([oldPath]);
        if (delErr) console.error('non-fatal: failed to delete replaced shop item photo', oldPath, delErr);
      }
    }

    showToast('บันทึกแล้ว');
    closeShopItemModal();
    await loadShopItems();
  } catch (err) {
    showToast(err.message);
    console.error('saveShopItem failed', err);
  } finally {
    saveBtn.disabled = false;
    saveLabel.textContent = 'บันทึก';
  }
}

async function deleteShopItem(id) {
  const item = shopManageState.items.find((i) => i.id === id);
  if (!item) return;
  if (!window.confirm(`ลบ "${item.name}" ใช่ไหม?`)) return;

  const { error } = await supabaseClient.from('shop_items').delete().eq('id', id);
  if (error) {
    showToast('ลบไม่สำเร็จ ลองใหม่อีกครั้ง');
    console.error('deleteShopItem failed', id, error);
    return;
  }

  if (item.image_path) {
    const { error: delErr } = await supabaseClient.storage.from('shop-items').remove([item.image_path]);
    if (delErr) console.error('non-fatal: failed to delete removed shop item photo', item.image_path, delErr);
  }

  showToast('ลบสินค้าแล้ว');
  await loadShopItems();
}
