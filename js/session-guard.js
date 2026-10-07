// ขยะแลกแต้ม — shared login/session guard for student-only pages.
// Checks both the local `currentUser` flag AND a real Supabase session, so a
// stale/invalid session (expired, or the sb-*-auth-token key cleared/tampered
// with) correctly bounces to login instead of rendering a broken page from
// leftover localStorage data. Used by dashboard.js, shop.js, rank.js, me.js.

async function requireStudentSession() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

  // fill the sidebar from the saved login right away, so it isn't blank /
  // "0 pts" while the checks below talk to Supabase (filled again after them)
  if (currentUser && currentUser.role === 'student') {
    try { renderSidebarUser(currentUser); } catch (err) { console.error('renderSidebarUser failed', err); }
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!currentUser || currentUser.role !== 'student' || !session) {
    return bounceToStudentLogin();
  }

  // localStorage is editable from devtools, so confirm with the real profiles
  // row too (same check as requireAdminSession). A query error only bounces.
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) return bounceToStudentLogin();
  if (!profile || profile.role !== 'student') {
    await supabaseClient.auth.signOut();
    return bounceToStudentLogin();
  }

  // every student page has the sidebar, and every one of them passes
  // through here first — so this is the one place to fill it
  try { renderSidebarUser(currentUser); } catch (err) { console.error('renderSidebarUser failed', err); }
  return currentUser;
}

function bounceToStudentLogin() {
  localStorage.removeItem('currentUser');
  window.location.href = 'login-student.html';
  return null;
}
