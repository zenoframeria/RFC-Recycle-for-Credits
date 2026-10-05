// ขยะแลกแต้ม — Shop tab (Phase 7). Points balance is real (currentUser.pointsTotal,
// same profiles.points_total source me.html reads). The reward catalog is now
// real too — shop_items table, managed by admins via the new Shop tab in
// admin-review.html (see sql/phase7-shop-catalog.sql) — replacing the old
// SHOP_ITEMS mock array. The redeem action itself is still local/mock-only:
// there is no redemptions table in Supabase yet, so "redeeming" here only
// updates local page state for the demo and resets on reload — nothing is
// written back to the account. This mirrors the same "UI-only scaffolding"
// pattern already used for the report modal (Phase 3 Round 3a).

const shopState = { points: 0, redeemed: new Set(), items: [] };

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  shopState.points = currentUser.pointsTotal ?? 0;
  wireFeedbackButtons(currentUser);

  await loadShopItems();
  refreshButtons();
  wireRedeemClicks();
  wireItemDetail();
});

async function loadShopItems() {
  const { data, error } = await supabaseClient
    .from('shop_items')
    .select('*')
    .order('id');

  if (error) {
    console.error('loadShopItems failed', error);
    document.getElementById('shop-cert').innerHTML = '<div class="coming-soon">โหลดร้านค้าไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    return;
  }

  shopState.items = data || [];
  renderCert();
  renderStationery();
  renderLimited();
}

function itemImageUrl(item) {
  if (!item.image_path) return null;
  return supabaseClient.storage.from('shop-items').getPublicUrl(item.image_path).data.publicUrl;
}

// Generic gift-box icon shown when an admin hasn't attached a photo yet —
// items no longer have a fixed per-id icon mapping since they're now
// dynamic database rows an admin can add at any time.
function itemMedallion(item) {
  const url = itemImageUrl(item);
  if (url) {
    return `
      <div class="item-medallion" aria-hidden="true">
        <img src="${url}" alt="">
        <span class="item-zoom-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg></span>
      </div>
    `;
  }
  return `
    <div class="item-medallion" style="--tint:var(--sb-cream2)" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 7h-3.2l-1.8-2.8a2 2 0 0 0-3.4 0L9.8 7H4a1 1 0 0 0-1 1v3a2 2 0 0 0 2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1zM12 4.3 13.5 7h-3z"/>
      </svg>
    </div>
  `;
}

function isNotYetOpen(item) {
  if (!item.opens_on) return false;
  return new Date(item.opens_on) > new Date();
}

function itemStatus(item) {
  if (shopState.redeemed.has(item.id)) return { disabled: true, label: 'แลกแล้ว ✓' };
  if (isNotYetOpen(item)) return { disabled: true, label: 'ยังไม่เปิด' };
  if (item.stock !== null && item.stock !== undefined && item.stock <= 0) return { disabled: true, label: 'ของหมด' };
  if (shopState.points < item.cost) return { disabled: true, label: 'แต้มไม่พอ' };
  return { disabled: false, label: 'แลกเลย' };
}

function renderCert() {
  const items = shopState.items.filter((i) => i.section === 'cert');
  // Same markup/classes as Home's "Scan & launch" button (owner asked for an
  // exact match), star instead of camera; the yellow arrow is the redeem button.
  document.getElementById('shop-cert').innerHTML = items.map((item) => `
    <div class="launch-btn shop-cert">
      <div class="launch-glow"></div>
      <div class="launch-body">
        <div class="camera-disc" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24"><path d="M12 3l2.4 5.5 6 .5-4.5 4 1.4 6-5.3-3.2L6.7 19l1.4-6L3.6 9l6-.5z" fill="none" stroke="var(--sb-ink)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="launch-text" ${openItemAttrs(item)}>
          <span class="lets-go">honor &amp; recognition ★</span>
          <div class="headline">${escapeHtml(item.name)}</div>
          <div class="sub">${item.cost.toLocaleString()} pts${item.description ? ` · ${escapeHtml(item.description)}` : ''}<span data-cert-status></span></div>
        </div>
        <button class="launch-arrow redeem-btn" data-item="${item.id}" data-cert>
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" fill="none" stroke="var(--sb-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function renderStationery() {
  const items = shopState.items.filter((i) => i.section === 'stationery');
  document.getElementById('shop-stationery').innerHTML = items.map((item) => `
    <div class="stationery-item">
      <div class="stationery-top" ${openItemAttrs(item)}>
        ${itemMedallion(item)}
        <div class="stationery-name">${escapeHtml(item.name)}</div>
      </div>
      <div class="stationery-foot">
        <div class="price-chip">${item.cost.toLocaleString()}<span class="unit">&nbsp;pts</span></div>
        <button class="redeem-btn" data-item="${item.id}"></button>
      </div>
    </div>
  `).join('');
}

function limitedMeta(item) {
  if (isNotYetOpen(item)) {
    const opensLabel = new Date(item.opens_on).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    return `${item.cost.toLocaleString()} pts · เปิดรอบถัดไป ${opensLabel}`;
  }
  if (item.stock !== null && item.stock !== undefined) {
    return `${item.cost.toLocaleString()} pts · เหลือ ${item.stock}/${item.stock_max ?? '-'}`;
  }
  return `${item.cost.toLocaleString()} pts`;
}

function renderLimited() {
  const items = shopState.items.filter((i) => i.section === 'limited');
  document.getElementById('shop-limited').innerHTML = items.map((item) => {
    const soldOut = item.stock !== null && item.stock !== undefined && item.stock <= 0;
    const notYetOpen = isNotYetOpen(item);
    const unavailable = notYetOpen || soldOut;
    const stamp = notYetOpen
      ? '<div class="limited-stamp" style="transform:rotate(12deg)">ปิดรับ<br>แลก</div>'
      : (soldOut ? '<div class="limited-stamp" style="transform:rotate(-16deg)">SOLD<br>OUT</div>' : '');
    const stockBar = (!notYetOpen && item.stock !== null && item.stock !== undefined)
      ? `<div class="limited-stock-bar"><div class="fill" data-fill style="width:${(item.stock / (item.stock_max || 1)) * 100}%"></div></div>`
      : '';
    return `
      <div class="limited-item${unavailable ? ' is-unavailable' : ''}" data-limited="${item.id}" ${openItemAttrs(item)}>
        ${itemMedallion(item)}
        <div class="limited-body">
          <div class="name">${escapeHtml(item.name)}</div>
          <div class="meta" data-meta>${limitedMeta(item)}</div>
          ${stockBar}
        </div>
        <button class="redeem-btn redeem-btn--limited" data-item="${item.id}"></button>
        ${stamp}
      </div>
    `;
  }).join('');
}

// ── item detail popup (tap an item to see its photo full-size + its
//    description, which the compact grid/list cards have no room for) ──
function openItemAttrs(item) {
  return `data-open-item="${item.id}" role="button" tabindex="0" aria-label="ดูรายละเอียดสินค้า"`;
}

function openItemDetail(item) {
  const img = document.getElementById('item-detail-img');
  const url = itemImageUrl(item);
  img.hidden = !url;
  img.src = url || '';
  img.alt = url ? item.name : '';

  // textContent, not innerHTML — admin-typed name/description never get
  // parsed as markup here.
  document.getElementById('item-detail-name').textContent = item.name;
  document.getElementById('item-detail-cost').textContent = `${item.cost.toLocaleString()} pts`;

  const desc = document.getElementById('item-detail-desc');
  desc.textContent = item.description || '';
  desc.hidden = !item.description;

  document.getElementById('item-detail').classList.add('open');
}

function wireItemDetail() {
  const overlay = document.getElementById('item-detail');
  const close = () => overlay.classList.remove('open');

  document.getElementById('item-detail-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const openFrom = (target) => {
    if (target.closest('.redeem-btn')) return false; // redeem keeps its own behavior
    const el = target.closest('[data-open-item]');
    if (!el) return false;
    const item = shopState.items.find((i) => String(i.id) === el.dataset.openItem);
    if (!item) return false;
    openItemDetail(item);
    return true;
  };

  document.addEventListener('click', (e) => openFrom(e.target));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && openFrom(e.target)) e.preventDefault();
  });
}

function refreshButtons() {
  document.getElementById('shop-points').textContent = shopState.points.toLocaleString();

  shopState.items.forEach((item) => {
    const btn = document.querySelector(`.redeem-btn[data-item="${item.id}"]`);
    if (!btn) return;
    const { disabled, label } = itemStatus(item);
    btn.disabled = disabled;
    if (btn.hasAttribute('data-cert')) {
      // the cert's button is an arrow icon — keep the SVG, put the status
      // in its label and (when it can't be redeemed) on the sub line
      btn.setAttribute('aria-label', label);
      const status = btn.closest('.launch-body').querySelector('[data-cert-status]');
      if (status) status.textContent = disabled ? ` · ${label}` : '';
    } else {
      btn.textContent = label;
    }
  });
}

function wireRedeemClicks() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.redeem-btn');
    if (!btn || btn.disabled) return;

    const item = shopState.items.find((i) => String(i.id) === btn.dataset.item);
    if (!item) return;

    shopState.points -= item.cost;
    shopState.redeemed.add(item.id);
    if (item.stock !== null && item.stock !== undefined) item.stock -= 1;

    if (item.section === 'limited') {
      const row = document.querySelector(`[data-limited="${item.id}"] [data-meta]`);
      if (row) row.textContent = limitedMeta(item);
      const fill = document.querySelector(`[data-limited="${item.id}"] [data-fill]`);
      if (fill) fill.style.width = `${(item.stock / (item.stock_max || 1)) * 100}%`;
    }

    refreshButtons();
    showToast('แลกแล้ว ✅ · เดโม (ยังไม่หักแต้มจริง)');
  });
}
