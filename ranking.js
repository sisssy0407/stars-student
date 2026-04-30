// ============================================
// STARS — Ranking JS
// ============================================

let currentYear = '';
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = JSON.parse(localStorage.getItem('stars_user') || '{}');

  // Load initial ranking (all years)
  await loadRanking('');

  // Year tab switching
  document.querySelectorAll('.year-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentYear = tab.dataset.year;
      await loadRanking(currentYear);
    });
  });
});

async function loadRanking(year) {
  const container = document.getElementById('rankingContainer');
  container.innerHTML = '<div class="loading-ranking">Loading rankings...</div>';

  const data = await api.getRanking(year);

  if (!data || !data.success || data.ranking.length === 0) {
    container.innerHTML = '<p class="empty-ranking">No students found.</p>';
    document.getElementById('myRankPill').style.display = 'none';
    return;
  }

  const myStudentId = currentUser?.student_id || '';

  // Find current user's rank
  const myEntry = data.ranking.find(r => r.student_id === myStudentId);
if (myEntry) {
  const myRank = data.ranking.indexOf(myEntry) + 1;
  document.getElementById('myRankDisplay').textContent = `#${myRank}`;
    document.getElementById('myRankPill').style.display = 'inline-flex';
  } else {
    document.getElementById('myRankPill').style.display = 'none';
  }

  const rankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  container.innerHTML = `
    <table class="ranking-table">
      <thead>
        <tr>
          <th style="text-align:center">Rank</th>
          <th>Student</th>
          <th>ID</th>
          <th>Year</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        ${data.ranking.map(r => {
          const rank = data.ranking.indexOf(r) + 1;
const isMe = r.student_id === myStudentId;
const rankClass = rank <= 3 ? `rank-${rank}` : '';
const yearLabel = r.year_level ? `${r.year_level}${ordinal(r.year_level)} Year` : '—';
return `
  <tr class="${isMe ? 'me' : ''}">
    <td class="rank-cell ${rankClass}">${rankIcon(rank)}</td>
    <td>${escHtml(r.full_name)}${isMe ? ' <span style="font-size:0.75rem;color:var(--primary,#6366f1);font-weight:700">(You)</span>' : ''}</td>
    <td style="color:var(--gray,#6b7280)">${escHtml(r.student_id)}</td>
    <td>${yearLabel}</td>
    <td><strong>${r.total_points}</strong> pts</td>
  </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function ordinal(n) {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}