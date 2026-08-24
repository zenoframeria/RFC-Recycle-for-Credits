// ขยะแลกแต้ม — Me tab. Fills in the account info from `currentUser` and wires
// the logout button (the only "working" part of this page per Round 3b scope —
// this fills the gap left when profile/logout was cut entirely in Round 3a).

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  document.getElementById('me-name').textContent = currentUser.name;
  document.getElementById('me-id').textContent = currentUser.studentId || '-';
  document.getElementById('me-classroom').textContent = currentUser.classroom || '-';
  document.getElementById('me-points').textContent = (currentUser.pointsTotal ?? 0).toLocaleString();

  wireLogout();
});

function wireLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('currentUser');
    window.location.href = 'login-student.html';
  });
}
