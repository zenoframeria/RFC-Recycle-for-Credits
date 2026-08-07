// ขยะแลกแต้ม — fake data standing in for a real database.
// Edit the values below to change what shows up on the login/dashboard pages.
// There is no real security here yet — passwords are plain text in this file,
// which is fine for a local prototype but must NOT be used once this app is real.

const FAKE_ACCOUNTS = {
  student: [
    { id: '654321', password: 'demo1234', name: 'พิมพ์ชนก ว.', avatarInitial: 'พ', classroom: 'ม.6/1' },
  ],
  admin: [
    { id: 'admin-001', password: 'admin1234', name: 'ผู้ดูแลระบบ' },
  ],
};

// Sample dashboard numbers for the logged-in student.
const FAKE_DASHBOARD = {
  points: { value: 2847, target: 4000, nextRankIn: 1153, level: 7 },
  stats: [
    { label: 'รีไซเคิล', value: '48.2', unit: 'kg' },
    { label: 'สตรีค', value: '12', unit: 'วัน' },
    { label: 'CO₂', value: '7.3', unit: 'kg' },
  ],
  classLeaderboard: {
    myRank: 3,
    totalRooms: 24,
    myClass: 'ม.6/1',
    squadName: 'Phoenix Squad',
    rows: [
      { rank: 1, name: 'ม.6/2', pts: 42180, mine: false },
      { rank: 2, name: 'ม.5/1', pts: 38920, mine: false },
      { rank: 3, name: 'ม.6/1', pts: 36470, mine: true },
    ],
  },
  schoolEnergy: { total: 245680, target: 360000, helpers: 342 },
};
