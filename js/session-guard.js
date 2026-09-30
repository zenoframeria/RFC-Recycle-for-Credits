// ขยะแลกแต้ม — shared login/session guard for student-only pages.
// Checks both the local `currentUser` flag AND a real Supabase session, so a
// stale/invalid session (expired, or the sb-*-auth-token key cleared/tampered
// with) correctly bounces to login instead of rendering a broken page from
// leftover localStorage data. Used by dashboard.js, shop.js, rank.js, me.js.

async function requireStudentSession() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!currentUser || currentUser.role !== 'student' || !session) {
    localStorage.removeItem('currentUser');
    window.location.href = 'login-student.html';
    return null;
  }

  // every student page has the sidebar, and every one of them passes
  // through here first — so this is the one place to fill it
  renderSidebarUser(currentUser);
  return currentUser;
}
