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
// SVG instead of a ✅ emoji, which looks different on every phone/OS.
const TOAST_CHECK_SVG = '<svg class="toast-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
function showToast(message, { success = false } = {}) {
  const toast = document.getElementById('toast');
  toast.innerHTML = success ? TOAST_CHECK_SVG : '';
  toast.append(message);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// Escapes free text (names, comments, category/item names) before it's
// dropped into innerHTML — shared by dashboard.js, rank.js and the admin
// console, since all of them render other people's data.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
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

// Shop receipt code = the redemptions row id, e.g. 42 -> "R-0042". The
// student shows it at pickup; the admin Pickups tab types it back in.
function receiptCode(id) {
  return `R-${String(id).padStart(4, '0')}`;
}

// "R-0042", "r42", "0042", "42" -> 42. Anything without digits -> null.
function parseReceiptCode(text) {
  const digits = String(text || '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

// Fills the sidebar's user block (only visible at lg / 1024px+). Pages
// without the sidebar markup (admin, login) have no #side-name, so this
// quietly does nothing there.
function renderSidebarUser(user) {
  const nameEl = document.getElementById('side-name');
  if (!nameEl) return;
  const shownName = displayName(user.name || '', user.nickname);
  nameEl.textContent = shownName;
  document.getElementById('side-initial').textContent = shownName.charAt(0);
  renderSidebarPoints(user.pointsTotal);
}

function renderSidebarPoints(points) {
  const el = document.getElementById('side-points');
  if (el) countUp(el, points ?? 0);
}

// Report / feedback goes to a Google Form (owned by the student council),
// not Supabase — no table, no photo storage. The entry.* ids are the form's
// field ids; if the council renames a topic option in the form, update
// FEEDBACK_TOPIC_REWARD too or the Shop button just won't pre-tick it.
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSex_du1tVdrBtr6WPr5tttt7ls2yYukcAVNfv6LcZtLyyEtCQ/viewform';
const FEEDBACK_FIELDS = {
  studentId: 'entry.7297159',
  name: 'entry.721026053',
  classroom: 'entry.1008551516',
  topic: 'entry.2090703568',
};
const FEEDBACK_TOPIC_REWARD = 'มีของรางวัลที่อยากเสนอให้แลกได้';

// Pre-fills ID / name / classroom from the cached currentUser so students
// only type the topic and details. They can still edit these in the form.
function feedbackFormUrl(user, topic) {
  const params = new URLSearchParams({ usp: 'pp_url' });
  if (user.studentId) params.set(FEEDBACK_FIELDS.studentId, user.studentId);
  if (user.name) params.set(FEEDBACK_FIELDS.name, user.name);
  if (user.classroom) params.set(FEEDBACK_FIELDS.classroom, user.classroom);
  if (topic) params.set(FEEDBACK_FIELDS.topic, topic);
  return `${FEEDBACK_FORM_URL}?${params}`;
}

// Any element with data-open-feedback opens the form in a new tab;
// data-feedback-topic="reward" pre-ticks the reward-suggestion option.
function wireFeedbackButtons(user) {
  document.querySelectorAll('[data-open-feedback]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const topic = btn.dataset.feedbackTopic === 'reward' ? FEEDBACK_TOPIC_REWARD : null;
      window.open(feedbackFormUrl(user, topic), '_blank', 'noopener');
    });
  });
}
