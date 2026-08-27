// ขยะแลกแต้ม — session guard for admin-only pages (admin-review.html).
// Mirrors requireStudentSession() in js/session-guard.js, but checks for the
// admin role and bounces to login-admin.html instead of login-student.html.
// Kept as a separate file rather than folded into session-guard.js, since
// that file's own header comment scopes it to "student-only pages".

async function requireAdminSession() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!currentUser || currentUser.role !== 'admin' || !session) {
    localStorage.removeItem('currentUser');
    window.location.href = 'login-admin.html';
    return null;
  }

  return currentUser;
}
