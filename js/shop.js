// ขยะแลกแต้ม — Shop tab. Points balance is real (currentUser.pointsTotal,
// same profiles.points_total source me.html reads). The reward catalog and
// the redeem action are still mock/local-only: there is no rewards or
// redemptions table in Supabase yet (that's Phase 5/6 territory), so
// "redeeming" here only updates local page state for the demo and resets on
// reload — nothing is written back to the account.

const SHOP_ITEMS = [
  { id: 'cert', section: 'cert', name: 'แลกเกียรติบัตร', desc: 'เกียรติบัตรผู้พิทักษ์โลกดิจิทัล', cost: 1800 },
  { id: 'pen', section: 'stationery', name: 'ปากกาเจลหมึกสี', cost: 350, tint: 'var(--sb-tape)' },
  { id: 'notebook', section: 'stationery', name: 'สมุดโน้ตลายแผนที่', cost: 480, tint: 'var(--sb-blue-mist)' },
  { id: 'stickers', section: 'stationery', name: 'สติกเกอร์ตราไปรษณีย์', cost: 220, tint: 'var(--sb-yellow-soft)' },
  { id: 'highlighter', section: 'stationery', name: 'ไฮไลท์เตอร์ 3 สี', cost: 300, tint: 'var(--sb-blue-soft)' },
  { id: 'washi', section: 'stationery', name: 'วอชิเทปลายแผนที่', cost: 260, tint: 'var(--sb-green)' },
  { id: 'passportbook', section: 'stationery', name: 'สมุดพาสปอร์ตสะสมตรา', cost: 3200, tint: 'var(--sb-red)' },
  { id: 'tote', section: 'limited', name: 'กระเป๋าผ้าลายตราไปรษณีย์', cost: 900, stock: 3, stockMax: 10, tint: 'var(--sb-tape)' },
  { id: 'bottle', section: 'limited', name: 'กระบอกน้ำสะสม', cost: 1500, stock: 0, stockMax: 10, tint: 'var(--sb-blue-mist)' },
  { id: 'pin', section: 'limited', name: 'เข็มกลัดตราปั๊ม', cost: 650, notYetOpen: true, opensOn: '1 ต.ค.', tint: 'var(--sb-yellow-soft)' },
];

// one line-icon per item, shown inside its .item-medallion badge — replaces
// the old flat diagonal-stripe placeholder rectangles (see rank.js's medal
// badges for the same "icon-in-a-tinted-circle" language this borrows).
const ITEM_ICONS = {
  pen: '<path d="M4 20h3.2l10-10-3.2-3.2-10 10V20zM13.8 5l3.2 3.2"/>',
  notebook: '<path d="M5 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5zM5 3v18M9 8h6M9 12h6"/>',
  stickers: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  highlighter: '<path d="M8 21 4 17l9-9 4 4-9 9zM13 8l3-3 4 4-3 3"/>',
  washi: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.6"/>',
  passportbook: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18"/>',
  tote: '<path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM9 8V6a3 3 0 0 1 6 0v2"/>',
  bottle: '<path d="M9 2h6v3.5L17 8v12a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V8l2-2.5z"/>',
  pin: '<path d="M12 2v6M8 8h8l2 12H6z"/>',
};

function itemMedallion(item) {
  return `
    <div class="item-medallion" style="--tint:${item.tint}" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ITEM_ICONS[item.id] || ''}</svg>
    </div>
  `;
}

const shopState = { points: 0, redeemed: new Set() };

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  shopState.points = currentUser.pointsTotal ?? 0;

  renderCert();
  renderStationery();
  renderLimited();
  refreshButtons();
  wireRedeemClicks();
});

function itemStatus(item) {
  if (shopState.redeemed.has(item.id)) return { disabled: true, label: 'แลกแล้ว ✓' };
  if (item.notYetOpen) return { disabled: true, label: 'ยังไม่เปิด' };
  if (item.stock !== undefined && item.stock <= 0) return { disabled: true, label: 'ของหมด' };
  if (shopState.points < item.cost) return { disabled: true, label: 'แต้มไม่พอ' };
  return { disabled: false, label: 'แลกเลย' };
}

function renderCert() {
  const item = SHOP_ITEMS.find((i) => i.id === 'cert');
  document.getElementById('shop-cert').innerHTML = `
    <div class="shop-cert">
      <div class="shop-cert-badge">★</div>
      <div class="shop-cert-body">
        <div class="shop-cert-tag">honor &amp; recognition</div>
        <div class="shop-cert-title">${item.name} <span class="cost">· ${item.cost.toLocaleString()} pts</span></div>
        <div class="shop-cert-desc">${item.desc}</div>
      </div>
      <button class="redeem-btn" data-item="${item.id}"></button>
    </div>
  `;
}

function renderStationery() {
  const items = SHOP_ITEMS.filter((i) => i.section === 'stationery');
  document.getElementById('shop-stationery').innerHTML = items.map((item) => `
    <div class="stationery-item">
      <div class="stationery-top">
        ${itemMedallion(item)}
        <div class="stationery-name">${item.name}</div>
      </div>
      <div class="stationery-foot">
        <div class="price-chip">${item.cost.toLocaleString()}<span class="unit">&nbsp;pts</span></div>
        <button class="redeem-btn" data-item="${item.id}"></button>
      </div>
    </div>
  `).join('');
}

function limitedMeta(item) {
  if (item.notYetOpen) return `${item.cost.toLocaleString()} pts · เปิดรอบถัดไป ${item.opensOn}`;
  return `${item.cost.toLocaleString()} pts · เหลือ ${item.stock}/${item.stockMax}`;
}

function renderLimited() {
  const items = SHOP_ITEMS.filter((i) => i.section === 'limited');
  document.getElementById('shop-limited').innerHTML = items.map((item) => {
    const unavailable = item.notYetOpen || item.stock <= 0;
    const stamp = item.notYetOpen
      ? '<div class="limited-stamp" style="transform:rotate(12deg)">ปิดรับ<br>แลก</div>'
      : (item.stock <= 0 ? '<div class="limited-stamp" style="transform:rotate(-16deg)">SOLD<br>OUT</div>' : '');
    const stockBar = item.notYetOpen
      ? ''
      : `<div class="limited-stock-bar"><div class="fill" data-fill style="width:${(item.stock / item.stockMax) * 100}%"></div></div>`;
    return `
      <div class="limited-item${unavailable ? ' is-unavailable' : ''}" data-limited="${item.id}">
        ${itemMedallion(item)}
        <div class="limited-body">
          <div class="name">${item.name}</div>
          <div class="meta" data-meta>${limitedMeta(item)}</div>
          ${stockBar}
        </div>
        <button class="redeem-btn redeem-btn--limited" data-item="${item.id}"></button>
        ${stamp}
      </div>
    `;
  }).join('');
}

function refreshButtons() {
  document.getElementById('shop-points').textContent = shopState.points.toLocaleString();

  SHOP_ITEMS.forEach((item) => {
    const btn = document.querySelector(`.redeem-btn[data-item="${item.id}"]`);
    if (!btn) return;
    const { disabled, label } = itemStatus(item);
    btn.disabled = disabled;
    btn.textContent = label;
  });
}

function wireRedeemClicks() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.redeem-btn');
    if (!btn || btn.disabled) return;

    const item = SHOP_ITEMS.find((i) => i.id === btn.dataset.item);
    if (!item) return;

    shopState.points -= item.cost;
    shopState.redeemed.add(item.id);
    if (item.stock !== undefined) item.stock -= 1;

    if (item.section === 'limited') {
      const row = document.querySelector(`[data-limited="${item.id}"] [data-meta]`);
      if (row) row.textContent = limitedMeta(item);
      const fill = document.querySelector(`[data-limited="${item.id}"] [data-fill]`);
      if (fill) fill.style.width = `${(item.stock / item.stockMax) * 100}%`;
    }

    refreshButtons();
    showToast('แลกแล้ว ✅ · เดโม (ยังไม่หักแต้มจริง)');
  });
}
