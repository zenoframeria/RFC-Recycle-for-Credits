// ขยะแลกแต้ม — Rank tab. Top 10 leaderboard (name + points_total + is_you,
// students only, zero-point students excluded) via the SECURITY DEFINER
// public.leaderboard_top10() function, plus the logged-in student's own
// rank (public.my_rank()) shown separately when they aren't among the
// returned top 10 rows. See sql/phase6b-rank.sql — profiles RLS only lets a
// student read their own row, so a cross-student leaderboard read has to go
// through these functions, not a direct query. The caller's own row is
// identified via the server-computed `is_you` column, not by comparing
// my_rank()'s (possibly tied) rank number against list position.

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  const [{ data: top10, error: top10Error }, { data: myRankRows, error: myRankError }] = await Promise.all([
    supabaseClient.rpc('leaderboard_top10'),
    supabaseClient.rpc('my_rank'),
  ]);

  if (top10Error) {
    console.error('leaderboard_top10 failed', top10Error);
    document.getElementById('rank-podium').innerHTML = '';
    document.getElementById('rank-list').innerHTML = '<div class="history-empty">โหลดอันดับไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    return;
  }

  if (myRankError) {
    console.error('my_rank failed', myRankError);
  }

  const rows = (top10 || []).map((row, i) => ({
    rank: i + 1,
    name: displayName(row.name, row.nickname),
    points: row.points_total,
    isYou: row.is_you === true,
  }));

  renderLeaderboard(rows);

  const isInTop10 = rows.some((r) => r.isYou);
  if (!isInTop10 && !myRankError && myRankRows?.length) {
    renderMyRank(myRankRows[0].my_rank, myRankRows[0].points_total);
  }
});

function renderLeaderboard(rows) {
  renderPodium(rows.slice(0, 3));
  renderList(rows.slice(3));
}

const MEDAL_CLASS = { 1: 'medal-gold', 2: 'medal-silver', 3: 'medal-bronze' };
const BLOCK_CLASS = { 1: 'block-gold', 2: 'block-silver', 3: 'block-bronze' };

// Podium slots 1-3 always render, even before 3 students have points yet —
// a missing slot shows a grayed-out placeholder instead of disappearing,
// so the podium's shape/layout stays stable rather than popping in later.
function podiumSlot(row, rank) {
  return `
    <div class="rank-podium-slot${rank === 1 ? ' is-first' : ''}${row ? '' : ' is-empty'}">
      <div class="rank-medal ${MEDAL_CLASS[rank]}">${rank}</div>
      <div class="name">${row ? escapeHtml(row.name) : 'ยังไม่มีใคร'}</div>
      <div class="pts">${row ? (row.points ?? 0).toLocaleString() : '—'}</div>
      <div class="podium-block ${BLOCK_CLASS[rank]}"></div>
    </div>
  `;
}

function renderPodium(top3) {
  const [first, second, third] = [top3[0] || null, top3[1] || null, top3[2] || null];
  document.getElementById('rank-podium').innerHTML =
    podiumSlot(second, 2) + podiumSlot(first, 1) + podiumSlot(third, 3);
}

function renderList(rest) {
  document.getElementById('rank-list').innerHTML = rest.map((r) => `
    <div class="rank-row${r.isYou ? ' is-you' : ''}">
      <div class="rank-stamp">${r.rank}</div>
      <div class="rank-name">${escapeHtml(r.name)}${r.isYou ? '<span class="you-tag">— คุณ</span>' : ''}</div>
      <div class="rank-pts">${(r.points ?? 0).toLocaleString()}</div>
    </div>
  `).join('');
}

function renderMyRank(rank, points) {
  const el = document.getElementById('rank-own');
  el.hidden = false;
  el.innerHTML = `คุณอยู่อันดับ <b>${rank}</b> · ${(points ?? 0).toLocaleString()} pts`;
}
