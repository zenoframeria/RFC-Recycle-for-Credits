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
  refreshMePoints(currentUser.id);
});

// The cached pointsTotal is set at login and goes stale after approvals or
// redeems — read the live value (same pattern as Home's refreshPoints()) and
// save it back so the other pages' instant paint is fresh too.
async function refreshMePoints(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('points_total')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('refreshMePoints failed', error);
    return; // keep showing the cached value
  }

  const pointsTotal = data.points_total ?? 0;
  document.getElementById('me-points').textContent = pointsTotal.toLocaleString();
  renderSidebarPoints(pointsTotal);

  try {
    const cached = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (cached) {
      cached.pointsTotal = pointsTotal;
      localStorage.setItem('currentUser', JSON.stringify(cached));
    }
  } catch (err) { /* bad cache — nothing to update */ }
}

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
