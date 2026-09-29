// ขยะแลกแต้ม — login/signup form handling, shared by login-student.html and login-admin.html.
// Talks to real Supabase Auth + the `profiles` table (see CLAUDE.md Phase 2).
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

    try {
      const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: idToEmail(idInput.value, role),
        password: pwInput.value,
      });

      if (signInError) {
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

    try {
      let rosterName = null;
      let rosterClassroom = null;

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

        rosterName = roster.name;
        rosterClassroom = roster.class_room;
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

        rosterName = roster.name;
      }

      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email: idToEmail(id, role),
        password,
      });

      if (signUpError) {
        throw new Error(/already registered/i.test(signUpError.message)
          ? 'มีบัญชีนี้อยู่แล้ว ลองเข้าสู่ระบบแทน'
          : 'สมัครสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง');
      }

      const authUser = signUpData.user;
      if (!authUser || !signUpData.session) {
        throw new Error('สมัครสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง');
      }

      const profileRow = role === 'student'
        ? { id: authUser.id, role, student_id: id, name: rosterName, class_room: rosterClassroom }
        : { id: authUser.id, role, student_id: id, name: rosterName };

      const { error: insertError } = await supabaseClient.from('profiles').insert(profileRow);
      if (insertError) {
        throw new Error('สร้างบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง');
      }

      saveCurrentUser(role, { ...profileRow, points_total: 0 });
      goToRoleHome(role);
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      setLoading(submitBtn, false);
    }
  });
}
