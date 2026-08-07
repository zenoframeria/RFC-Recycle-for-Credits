// ขยะแลกแต้ม — login form handling, shared by login-student.html and login-admin.html.
// Checks the ID + password typed in against the fake accounts in data.js.

const EYE_PATH = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
const EYE_OFF_PATH = 'M3 3l18 18M10.5 10.5a2 2 0 0 0 3 3M9.4 6.3A10 10 0 0 1 12 6c5 0 9 4 10 6-.4.8-1.2 2-2.5 3.3M6.3 6.3C4 7.7 2.4 10 2 12c1 2 5 6 10 6 1.3 0 2.5-.3 3.6-.7';

document.addEventListener('DOMContentLoaded', () => {
  const role = document.body.dataset.role;
  const form = document.getElementById('login-form');
  const idInput = document.getElementById('field-id');
  const pwInput = document.getElementById('field-password');
  const errorEl = document.getElementById('login-error');
  const toggleBtn = document.getElementById('toggle-password');
  const eyePath = document.getElementById('eye-path');

  toggleBtn.addEventListener('click', () => {
    const showing = pwInput.type === 'text';
    pwInput.type = showing ? 'password' : 'text';
    eyePath.setAttribute('d', showing ? EYE_PATH : EYE_OFF_PATH);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const accounts = FAKE_ACCOUNTS[role] || [];
    const match = accounts.find(
      (a) => a.id === idInput.value.trim() && a.password === pwInput.value
    );

    if (!match) {
      errorEl.hidden = false;
      return;
    }

    localStorage.setItem('currentUser', JSON.stringify({ role, ...match }));

    if (role === 'student') {
      window.location.href = 'dashboard.html';
    } else {
      showAdminComingSoon();
    }
  });
});

function showAdminComingSoon() {
  const card = document.getElementById('login-card');
  card.innerHTML = `
    <div class="card-heading">
      <span class="line"></span>
      <span class="label">◆ ENTER CONSOLE ◆</span>
      <span class="line"></span>
    </div>
    <div class="coming-soon">
      Admin console — coming soon<br>ระบบผู้ดูแลกำลังอยู่ระหว่างพัฒนา
    </div>
  `;
}
