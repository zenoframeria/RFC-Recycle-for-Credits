// ขยะแลกแต้ม — Rank tab. There is no real Top 10 query yet: `profiles` RLS
// only lets a student SELECT their own row, so a cross-student leaderboard
// read isn't possible without a schema/RLS change, which is Phase 6 work
// (see CLAUDE.md). Until then this list is mock data, same convention as
// FAKE_DASHBOARD/FAKE_NOTIFICATIONS elsewhere in this app.

const FAKE_LEADERBOARD = [
  { rank: 1, initial: 'ณ', name: 'ณัฐวุฒิ ก.', points: 12480 },
  { rank: 2, initial: 'พ', name: 'พิมพ์ชนก ส.', points: 11920 },
  { rank: 3, initial: 'อ', name: 'อรรถพล ว.', points: 10750 },
  { rank: 4, initial: 'ช', name: 'ชนากานต์ ม.', points: 9300 },
  { rank: 5, initial: 'ธ', name: 'ธีรภัทร จ.', points: 8110 },
  { rank: 6, initial: 'ฐ', name: 'ฐิติพร ล.', points: 7640, isYou: true },
  { rank: 7, initial: 'ก', name: 'กมลชนก อ.', points: 6980 },
  { rank: 8, initial: 'ป', name: 'ปฏิภาณ บ.', points: 6410 },
  { rank: 9, initial: 'ส', name: 'สุพิชญา ท.', points: 5875 },
  { rank: 10, initial: 'ว', name: 'วรเมธ ศ.', points: 5220 },
];

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await requireStudentSession();
  if (!currentUser) return;

  renderPodium(FAKE_LEADERBOARD.slice(0, 3));
  renderList(FAKE_LEADERBOARD.slice(3));

  wireScanFab();
});

function renderPodium(top3) {
  const [first, second, third] = top3;
  document.getElementById('rank-podium').innerHTML = `
    <div class="rank-podium-slot">
      <div class="rank-avatar">${second.initial}</div>
      <div class="num">#${second.rank}</div>
      <div class="name">${second.name}</div>
      <div class="pts">${second.points.toLocaleString()}</div>
    </div>
    <div class="rank-podium-slot is-first">
      <div class="rank-star">★</div>
      <div class="rank-avatar">${first.initial}</div>
      <div class="num">#${first.rank}</div>
      <div class="name">${first.name}</div>
      <div class="pts">${first.points.toLocaleString()}</div>
    </div>
    <div class="rank-podium-slot">
      <div class="rank-avatar">${third.initial}</div>
      <div class="num">#${third.rank}</div>
      <div class="name">${third.name}</div>
      <div class="pts">${third.points.toLocaleString()}</div>
    </div>
  `;
}

function renderList(rest) {
  document.getElementById('rank-list').innerHTML = rest.map((r) => `
    <div class="rank-row${r.isYou ? ' is-you' : ''}">
      <div class="rank-num">${String(r.rank).padStart(2, '0')}</div>
      <div class="rank-avatar">${r.initial}</div>
      <div class="rank-name">${r.name}${r.isYou ? '<span class="you-tag">— คุณ</span>' : ''}</div>
      <div class="rank-pts">${r.points.toLocaleString()}</div>
    </div>
  `).join('');
}
