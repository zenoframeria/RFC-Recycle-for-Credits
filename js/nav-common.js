// ขยะแลกแต้ม — bits shared across every logged-in page: the toast helper,
// and the display-name helpers (nickname-or-first-name) originally written
// for the dashboard header's nickname-edit feature, now also used by the
// Rank leaderboard to show other students' names the same way. Scan is a
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
