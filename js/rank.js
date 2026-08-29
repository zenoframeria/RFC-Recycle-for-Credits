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
    initial: (row.name || '-').trim().charAt(0) || '-',
    name: row.name,
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
  const podiumEl = document.getElementById('rank-podium');
  const listEl = document.getElementById('rank-list');

  if (!rows.length) {
    podiumEl.innerHTML = '';
    listEl.innerHTML = '<div class="history-empty">ยังไม่มีใครสะสมแต้มเลย รอนักเรียนคนแรกส่งขยะก่อน</div>';
    return;
  }

  if (rows.length >= 3) {
    renderPodium(rows.slice(0, 3));
    renderList(rows.slice(3));
  } else {
    podiumEl.innerHTML = '';
    renderList(rows);
  }
}

function renderPodium(top3) {
  const [first, second, third] = top3;
  document.getElementById('rank-podium').innerHTML = `
    <div class="rank-podium-slot">
      <div class="rank-avatar">${escapeHtml(second.initial)}</div>
      <div class="num">#${second.rank}</div>
      <div class="name">${escapeHtml(second.name)}</div>
      <div class="pts">${(second.points ?? 0).toLocaleString()}</div>
    </div>
    <div class="rank-podium-slot is-first">
      <div class="rank-star">★</div>
      <div class="rank-avatar">${escapeHtml(first.initial)}</div>
      <div class="num">#${first.rank}</div>
      <div class="name">${escapeHtml(first.name)}</div>
      <div class="pts">${(first.points ?? 0).toLocaleString()}</div>
    </div>
    <div class="rank-podium-slot">
      <div class="rank-avatar">${escapeHtml(third.initial)}</div>
      <div class="num">#${third.rank}</div>
      <div class="name">${escapeHtml(third.name)}</div>
      <div class="pts">${(third.points ?? 0).toLocaleString()}</div>
    </div>
  `;
}

function renderList(rest) {
  document.getElementById('rank-list').innerHTML = rest.map((r) => `
    <div class="rank-row${r.isYou ? ' is-you' : ''}">
      <div class="rank-num">${String(r.rank).padStart(2, '0')}</div>
      <div class="rank-avatar">${escapeHtml(r.initial)}</div>
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
