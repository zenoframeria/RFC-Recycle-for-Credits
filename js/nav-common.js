// ขยะแลกแต้ม — bits shared by the bottom nav on every logged-in page: the
// toast helper. Scan is a real link to scan.html now (Phase 4), same as
// Home/Shop/Rank/Me, so it no longer needs its own click handler here.

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}
