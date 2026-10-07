// ขยะแลกแต้ม — login/signup form handling, shared by login-student.html and login-admin.html.
// Talks to real Supabase Auth + the `profiles` table (see CLAUDE.md Phase 2).
// Profiles are created only by the server via create_my_profile() (sql/secure-signup.sql).
//
// Supabase Auth needs an email, but this app only collects a student/admin ID,
// so we map id -> a synthetic email under a fake local domain (id@student.kyt.local
// or id@admin.kyt.local). That address is never emailed to anyone; it only exists
// so Supabase Auth has something unique to key the account on.

document.addEventListener('DOMContentLoaded', () => {
  const role = document.body.dataset.role;
  wirePasswordToggle();
  wireAuthTabs();
  wireForgotLink();
  wireLoginForm(role);
  wireSignupForm(role);
});

// iOS Safari only shows :active tap feedback when the page listens for
// touches (same one-liner as nav-common.js, which login pages don't load)
document.addEventListener('touchstart', () => {}, { passive: true });

// ── CAPTCHA (Cloudflare Turnstile) ─────────────────────────────────────
// Every sign-in/sign-up sends a one-time token from the Turnstile box, so a
// script calling supabaseClient.auth directly (no real page) can't get one.
// Supabase checks the token only once CAPTCHA is switched on in Dashboard →
// Authentication → Bot and Abuse Protection; until then it's ignored.
// The site key is public by design (the secret key lives only in Supabase).
const TURNSTILE_SITE_KEY = '0x4AAAAAAFP8b5DAbnsWVzkY';
const captchaWidgets = {}; // slot id -> Turnstile widget id

// Called by the Turnstile script (onload=onTurnstileLoad in the login pages).
window.onTurnstileLoad = () => {
  ['login-captcha', 'signup-captcha'].forEach((slotId) => {
    captchaWidgets[slotId] = turnstile.render(`#${slotId}`, {
      sitekey: TURNSTILE_SITE_KEY,
      size: 'flexible',
      language: 'th',
      // Hidden unless Cloudflare wants a click (Managed mode's checkbox).
      appearance: 'interaction-only',
    });
  });
};

// Returns the token, '' if the box is still checking, or undefined if the
// Turnstile script never loaded (then we send nothing and let Supabase decide).
function getCaptchaToken(slotId) {
  if (!window.turnstile || captchaWidgets[slotId] === undefined) return undefined;
  return turnstile.getResponse(captchaWidgets[slotId]) || '';
}

// The hidden check takes a second or two after the page loads (and after every
// reset), so a fast tap waits for it here instead of asking the student to tap
// again. Polls until a token arrives or the time runs out — long enough for
// someone to click the checkbox if Managed mode shows one.
const CAPTCHA_WAIT_MS = 15000;

async function waitForCaptchaToken(slotId) {
  const deadline = Date.now() + CAPTCHA_WAIT_MS;
  let token = getCaptchaToken(slotId);
  while (!token && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    token = getCaptchaToken(slotId);
  }
  return token;
}

// Tokens are single-use, so get a fresh one after every attempt.
function resetCaptcha(slotId) {
  if (window.turnstile && captchaWidgets[slotId] !== undefined) {
    turnstile.reset(captchaWidgets[slotId]);
  }
}

const CAPTCHA_WAIT_MSG = 'ระบบตรวจว่าไม่ใช่บอทยังไม่เสร็จ ลองรีเฟรชหน้าแล้วกดอีกครั้ง';

function isCaptchaError(error) {
  return /captcha/i.test(error?.message || '');
}

function idToEmail(id, role) {
  return `${id.trim().toLowerCase()}@${role}.kyt.local`;
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function hideError(el) {
  el.hidden = true;
}

function setLoading(button, loading) {
  button.disabled = loading;
  button.style.opacity = loading ? '0.6' : '';
}

// Swaps the button's label while waiting on the CAPTCHA; pass null to restore it.
function setButtonLabel(button, text) {
  const label = button.querySelector('.label');
  if (!label) return;
  if (!label.dataset.original) label.dataset.original = label.textContent;
  label.textContent = text ?? label.dataset.original;
}

function saveCurrentUser(role, profile) {
  localStorage.setItem('currentUser', JSON.stringify({
    role,
    id: profile.id,
    name: profile.name,
    nickname: profile.nickname || null,
    studentId: profile.student_id || null,
    classroom: profile.class_room || null,
    pointsTotal: profile.points_total || 0,
  }));
}

function goToRoleHome(role) {
  window.location.href = role === 'student' ? 'dashboard.html' : 'admin-review.html';
}

// ── password show/hide (login form only) ─────────────────────────────
const EYE_PATH = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
const EYE_OFF_PATH = 'M3 3l18 18M10.5 10.5a2 2 0 0 0 3 3M9.4 6.3A10 10 0 0 1 12 6c5 0 9 4 10 6-.4.8-1.2 2-2.5 3.3M6.3 6.3C4 7.7 2.4 10 2 12c1 2 5 6 10 6 1.3 0 2.5-.3 3.6-.7';

function wirePasswordToggle() {
  const toggleBtn = document.getElementById('toggle-password');
  const pwInput = document.getElementById('field-password');
  const eyePath = document.getElementById('eye-path');

  toggleBtn.addEventListener('click', () => {
    const showing = pwInput.type === 'text';
    pwInput.type = showing ? 'password' : 'text';
    eyePath.setAttribute('d', showing ? EYE_PATH : EYE_OFF_PATH);
    toggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
}

// ── forgot password (student login only — no real reset flow exists since
// this app has no real email, so this just points to the same manual-reset
// path signup already tells rejected roster IDs to use) ──────────────────
function wireForgotLink() {
  const forgotBtn = document.querySelector('.forgot-link');
  if (!forgotBtn) return;
  const errorEl = document.getElementById('login-error');

  forgotBtn.addEventListener('click', () => {
    showError(errorEl, 'ลืมรหัสผ่าน? กรุณาติดต่อสภานักเรียนเพื่อขอรีเซ็ตรหัสผ่าน');
  });
}

// ── login / signup tab switcher ───────────────────────────────────────
function wireAuthTabs() {
  const tabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      loginForm.hidden = mode !== 'login';
      signupForm.hidden = mode !== 'signup';
      hideError(loginError);
      hideError(signupError);
    });
  });
}

// ── login ───────────────────────────────────────────────────────────
function wireLoginForm(role) {
  const form = document.getElementById('login-form');
  const idInput = document.getElementById('field-id');
  const pwInput = document.getElementById('field-password');
  const errorEl = document.getElementById('login-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(errorEl);

    setLoading(submitBtn, true);
    setButtonLabel(submitBtn, 'CHECKING…');
    const captchaToken = await waitForCaptchaToken('login-captcha');
    setButtonLabel(submitBtn, null);
    if (captchaToken === '') {
      setLoading(submitBtn, false);
      showError(errorEl, CAPTCHA_WAIT_MSG);
      return;
    }

    try {
      const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: idToEmail(idInput.value, role),
        password: pwInput.value,
        options: { captchaToken },
      });

      if (signInError) {
        if (isCaptchaError(signInError)) throw new Error('ตรวจว่าไม่ใช่บอทไม่ผ่าน ลองใหม่อีกครั้ง');
        throw new Error(role === 'student'
          ? 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง'
          : 'รหัสผู้ดูแลหรือรหัสผ่านไม่ถูกต้อง');
      }

      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', signInData.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง');
      }

      saveCurrentUser(role, profile);
      goToRoleHome(role);
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      setLoading(submitBtn, false);
      resetCaptcha('login-captcha');
    }
  });
}

// ── signup ──────────────────────────────────────────────────────────
function wireSignupForm(role) {
  const form = document.getElementById('signup-form');
  const errorEl = document.getElementById('signup-error');
  const submitBtn = form.querySelector('button[type="submit"]');
  const idInput = document.getElementById('signup-id');
  const pwInput = document.getElementById('signup-password');
  const pwConfirmInput = document.getElementById('signup-password-confirm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(errorEl);

    const id = idInput.value.trim();
    const password = pwInput.value;

    if (!id) {
      showError(errorEl, 'กรุณากรอกรหัสนักเรียน');
      return;
    }
    if (password.length < 6) {
      showError(errorEl, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== pwConfirmInput.value) {
      showError(errorEl, 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setLoading(submitBtn, true);
    setButtonLabel(submitBtn, 'CHECKING…');
    const captchaToken = await waitForCaptchaToken('signup-captcha');
    setButtonLabel(submitBtn, null);
    if (captchaToken === '') {
      setLoading(submitBtn, false);
      showError(errorEl, CAPTCHA_WAIT_MSG);
      return;
    }

    try {
      // Roster check before creating the auth account, only for a friendly
      // error message — the real check runs on the server in create_my_profile().
      if (role === 'student') {
        const { data: rosterData, error: rosterError } = await supabaseClient.rpc('check_roster', {
          p_student_id: id,
        });

        if (rosterError) {
          throw new Error('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง');
        }

        const roster = Array.isArray(rosterData) ? rosterData[0] : rosterData;
        if (!roster || !roster.found) {
          throw new Error('ไม่พบรหัสนักเรียนนี้ในทะเบียนโรงเรียน กรุณาติดต่อสภานักเรียน');
        }
      } else {
        const { data: rosterData, error: rosterError } = await supabaseClient.rpc('check_admin_roster', {
          p_student_id: id,
        });

        if (rosterError) {
          throw new Error('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง');
        }

        const roster = Array.isArray(rosterData) ? rosterData[0] : rosterData;
        if (!roster || !roster.found) {
          throw new Error('ไม่พบรหัสนักเรียนนี้ในทะเบียนสภานักเรียน กรุณาติดต่อผู้ดูแลระบบ');
        }
      }

      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email: idToEmail(id, role),
        password,
        options: { captchaToken },
      });

      if (signUpError) {
        if (isCaptchaError(signUpError)) throw new Error('ตรวจว่าไม่ใช่บอทไม่ผ่าน ลองใหม่อีกครั้ง');
        throw new Error(/already registered/i.test(signUpError.message)
          ? 'มีบัญชีนี้อยู่แล้ว ลองเข้าสู่ระบบแทน'
          : 'สมัครสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง');
      }

      const authUser = signUpData.user;
      if (!authUser || !signUpData.session) {
        throw new Error('สมัครสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง');
      }

      // The server builds the profile itself (role, name, class from the
      // roster) — see sql/secure-signup.sql. The browser can't send any of it.
      const { data: profile, error: profileError } = await supabaseClient.rpc('create_my_profile');
      if (profileError || !profile) {
        throw new Error('สร้างบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง');
      }

      saveCurrentUser(role, profile);
      goToRoleHome(role);
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      setLoading(submitBtn, false);
      resetCaptcha('signup-captcha');
    }
  });
}
