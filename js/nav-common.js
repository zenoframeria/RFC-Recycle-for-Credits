// ขยะแลกแต้ม — bits shared across every logged-in page: the toast helper,
// and the display-name helpers (nickname-or-first-name) originally written
// for the dashboard header's nickname-edit feature, now also used by the
// Rank leaderboard to show other students' names the same way, and the
// shared compressImage() photo compressor (scan.js + admin-shop.js; the
// admin page loads this file too), the desktop sidebar's user block, and the
// shared countUp() number animation. Scan is a
// real link to scan.html now (Phase 4), same as Home/Shop/Rank/Me, so it no
// longer needs its own click handler here.

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// Thai honorific prefixes that can appear in student_roster.name, with or
// without a space before the first name (e.g. "เด็กชายปิยะ ใจดี" or "ด.ช. ปิยะ ใจดี").
const THAI_TITLES = ['เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'นางสาว', 'นาย', 'นาง'];

function stripTitle(fullName) {
  let name = fullName.trim();
  for (const title of THAI_TITLES) {
    if (name.startsWith(title)) {
      name = name.slice(title.length).trim();
      break;
    }
  }
  return name;
}

function firstNameOnly(fullName) {
  return stripTitle(fullName).split(/\s+/)[0] || fullName;
}

// The shared "what do we call this student" rule: their nickname if they've
// set one, else just their first name (title stripped, no surname).
function displayName(name, nickname) {
  const trimmedNickname = (nickname || '').trim();
  return trimmedNickname || firstNameOnly(name);
}

// Shared client-side image compressor — draws the source image onto a
// canvas scaled to maxWidth and re-encodes as JPEG. Used by both scan.js
// (submission photos) and admin-shop.js (shop item photos) so the resize
// logic isn't duplicated.
function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob); else reject(new Error('compress failed'));
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Animates a number in `el` up/down to `target`, eased, formatted like the
// rest of the app (toLocaleString). Safe to call repeatedly: the same target
// while an animation toward it is running is left alone (so the cached-then-
// live points refresh doesn't cut the count short), and a new target
// mid-animation glides on from the number currently on screen. Skips straight
// to the final value when the OS "reduce motion" setting is on.
function countUp(el, target, duration = 800) {
  const to = Number(target) || 0;
  const running = el.dataset.countFrame;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (running && !reduceMotion && Number(el.dataset.countValue) === to) return;
  if (running) cancelAnimationFrame(Number(running));
  delete el.dataset.countFrame;

  const from = Number(el.dataset.countShown || 0);
  el.dataset.countValue = String(to);
  if (reduceMotion || from === to) {
    el.dataset.countShown = String(to);
    el.textContent = to.toLocaleString();
    return;
  }

  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const shown = Math.round(from + (to - from) * eased);
    el.dataset.countShown = String(shown);
    el.textContent = shown.toLocaleString();
    if (t < 1) el.dataset.countFrame = String(requestAnimationFrame(step));
    else delete el.dataset.countFrame;
  }
  el.dataset.countFrame = String(requestAnimationFrame(step));
}

// Fills the sidebar's user block (only visible at lg / 1024px+). Pages
// without the sidebar markup (admin, login) have no #side-name, so this
// quietly does nothing there.
function renderSidebarUser(user) {
  const nameEl = document.getElementById('side-name');
  if (!nameEl) return;
  const shownName = displayName(user.name, user.nickname);
  nameEl.textContent = shownName;
  document.getElementById('side-initial').textContent = shownName.charAt(0);
  renderSidebarPoints(user.pointsTotal);
}

function renderSidebarPoints(points) {
  const el = document.getElementById('side-points');
  if (el) countUp(el, points ?? 0);
}
