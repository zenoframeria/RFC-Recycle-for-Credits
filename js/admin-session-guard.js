// ขยะแลกแต้ม — session guard for admin-only pages (admin-review.html).
// Mirrors requireStudentSession() in js/session-guard.js, but checks for the
// admin role and bounces to login-admin.html instead of login-student.html.
// Kept as a separate file rather than folded into session-guard.js, since
// that file's own header comment scopes it to "student-only pages".

async function requireAdminSession() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!currentUser || currentUser.role !== 'admin' || !session) {
    return bounceToAdminLogin();
  }

  // localStorage is editable from devtools, so confirm the role with the real
  // profiles row too. This is a courtesy check — the actual protection is RLS
  // and is_admin() on the server, which already refuse every admin write.
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) return bounceToAdminLogin();
  if (!profile || profile.role !== 'admin') {
    await supabaseClient.auth.signOut();
    return bounceToAdminLogin();
  }

  return currentUser;
}

function bounceToAdminLogin() {
  localStorage.removeItem('currentUser');
  window.location.href = 'login-admin.html';
  return null;
}
