// ขยะแลกแต้ม — bits shared by the bottom nav on every logged-in page:
// the toast helper and the Scan FAB click handler (Scan & Launch is Phase 4,
// so it still just shows a "coming soon" toast on every page).

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function wireScanFab() {
  const btn = document.getElementById('scan-btn');
  if (!btn) return;
  btn.addEventListener('click', () => showToast('📸 สแกน — coming soon · เร็ว ๆ นี้'));
}
