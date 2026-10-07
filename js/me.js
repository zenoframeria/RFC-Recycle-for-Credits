// ขยะแลกแต้ม — Me tab. Fills in the account info from `currentUser` and wires
// the logout button (the only "working" part of this page per Round 3b scope —
// this fills the gap left when profile/logout was cut entirely in Round 3a).

document.addEventListener('DOMContentLoaded', async () => {
  // show the saved info right away instead of "-" while the session check runs
  try {
    const cached = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (cached && cached.role === 'student') renderMeInfo(cached);
  } catch (err) { /* bad cache — the check below handles it */ }

  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  renderMeInfo(currentUser);
  wireLogout();
});

function renderMeInfo(user) {
  document.getElementById('me-name').textContent = user.name || '-';
  document.getElementById('me-id').textContent = user.studentId || '-';
  document.getElementById('me-classroom').textContent = user.classroom || '-';
  document.getElementById('me-points').textContent = (user.pointsTotal ?? 0).toLocaleString();
}

function wireLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('currentUser');
    window.location.href = 'login-student.html';
  });
}
