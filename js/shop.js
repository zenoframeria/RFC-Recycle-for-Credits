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
  wireScanFab();
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
      <div class="stationery-photo" style="--tint:${item.tint}"></div>
      <div class="stationery-name">${item.name}</div>
      <div class="stationery-foot">
        <div class="price-badge">${item.cost.toLocaleString()}<br>pts</div>
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
        <div class="limited-photo" style="--tint:${item.tint}"></div>
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
