// ============================================
// STARS — Dashboard JS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {

  const user = JSON.parse(localStorage.getItem('stars_user') || '{}');

  // Greeting
  const greetEl = document.getElementById('greetingText');
  if (greetEl) {
    const hour = new Date().getHours();
    const tod  = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    greetEl.textContent = `${tod}, ${user.full_name || 'Student'}!`;
  }

  // Load points
  const pointsData = await api.getMyPoints();
  let currentBalance = 0;

  if (pointsData && pointsData.success) {
    const { balance, categories } = pointsData;
    currentBalance = balance ?? 0;

    setEl('totalBalance', currentBalance);

    const catMap = {
      SCHOLAR:  'scholarPts',
      PUNCTUAL: 'punctualPts',
      ACHIEVER: 'achieverPts',
      ENGAGE:   'engagePts',
      GENERAL:  'generalPts'   // ✅ ADDED
    };
    categories.forEach(c => {
      setEl(catMap[c.category_code], c.points_earned ?? 0);
    });

    // ✅ Set all unset badges to 0
    Object.values(catMap).forEach(id => {
      const el = document.getElementById(id);
      if (el && el.textContent === '—') el.textContent = '0';
    });
  }

  // Show skeleton for submissions while loading
  const tbody = document.getElementById('submissionsBody');
  tbody.innerHTML = Array(4).fill(`
    <tr class="skeleton-row">
      <td><span class="skeleton"></span></td>
      <td><span class="skeleton" style="width:60%"></span></td>
      <td><span class="skeleton" style="width:50%"></span></td>
      <td><span class="skeleton" style="width:40%"></span></td>
      <td><span class="skeleton" style="width:45%"></span></td>
    </tr>
  `).join('');

  // Load rewards first (needed for both milestones + preview)
  const rwData = await api.getRewards();
  const allRewards = rwData?.rewards ?? [];

  // ── MOTIVATION MILESTONES ──────────────────────────────
  const MILESTONES = allRewards.length > 0
    ? allRewards.map(r => ({
        pts:   r.points_required,
        label: r.reward_name
      }))
    : [
        { pts: 30,  label: '🖨️ Free Printing (10 pages)' },
        { pts: 50,  label: '📚 Library Priority Pass'    },
        { pts: 80,  label: '🍜 Canteen Voucher ₱50'      },
        { pts: 200, label: '👕 Department Hoodie'         },
        { pts: 500, label: '📱 Smartphone'                },
      ];

  MILESTONES.sort((a, b) => a.pts - b.pts);

  const nextMilestone = MILESTONES.find(m => currentBalance < m.pts);
  const prevMilestone = [...MILESTONES].reverse().find(m => currentBalance >= m.pts);

  if (nextMilestone) {
    const fromPts = prevMilestone ? prevMilestone.pts : 0;
    const range   = nextMilestone.pts - fromPts;
    const earned  = currentBalance - fromPts;
    const pct     = Math.min(100, Math.round((earned / range) * 100));

    setEl('motBannerTitle', `Next reward: ${nextMilestone.label}`);
    setEl('motBannerSub',   `${nextMilestone.pts - currentBalance} pts to go — keep submitting your achievements!`);
    setEl('motCurrentPts',  `${currentBalance} pts`);
    setEl('motTargetPts',   `${nextMilestone.pts} pts`);

    setTimeout(() => {
      const fill = document.getElementById('motProgressFill');
      if (fill) fill.style.width = pct + '%';
    }, 300);
  } else {
    setEl('motBannerTitle', "🏆 You've unlocked all rewards!");
    setEl('motBannerSub',   'Amazing work! You have reached the top. Keep it up!');
    setEl('motCurrentPts',  `${currentBalance} pts`);
    setEl('motTargetPts',   'Max');
    setTimeout(() => {
      const fill = document.getElementById('motProgressFill');
      if (fill) fill.style.width = '100%';
    }, 300);
  }

  const mgEl = document.getElementById('milestonesGrid');
  if (mgEl) {
    mgEl.innerHTML = MILESTONES.map(m => {
      const unlocked = currentBalance >= m.pts;
      const isNext   = nextMilestone && m.pts === nextMilestone.pts;
      return `
        <div class="ms-card ${unlocked ? 'ms-unlocked' : isNext ? 'ms-next' : 'ms-locked'}">
          <p class="ms-pts">${m.pts} pts</p>
          <p class="ms-reward-name">${escHtml(m.label)}</p>
          <span class="ms-status-badge">
            ${unlocked ? '✓ Unlocked' : isNext ? '🎯 Next goal' : '🔒 Locked'}
          </span>
        </div>`;
    }).join('');
  }
  // ── END MOTIVATION MILESTONES ──────────────────────────

  // Load recent submissions
  const subData = await api.getMySubmissions();
  if (subData && subData.success && subData.submissions.length > 0) {
    tbody.innerHTML = subData.submissions.map(s => `
      <tr>
        <td>${escHtml(s.title)}</td>
        <td>${escHtml(s.category_name)}</td>
        <td><strong>${s.points_requested} pts</strong></td>
        <td><span class="status-badge status-${s.status}">${capitalize(s.status)}</span></td>
        <td style="color:var(--gray);font-size:13px">${formatDate(s.submitted_at)}</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No submissions yet.</td></tr>';
  }

  // Load rewards preview
  const rwEl = document.getElementById('rewardsPreview');
  if (rwData && rwData.success && rwEl) {
    rwEl.innerHTML = allRewards.slice(0, 4).map(r => {
      const canRedeem = currentBalance >= r.points_required;
      return `
        <div class="reward-card ${canRedeem ? '' : 'locked'}">
          <p class="reward-pts">${r.points_required} pts</p>
          <p class="reward-name">${escHtml(r.reward_name)}</p>
          <button class="btn-primary" onclick="window.location.href='rewards.html'"
            ${canRedeem ? '' : 'disabled'}>
            ${canRedeem ? 'Redeem' : 'Locked'}
          </button>
        </div>
      `;
    }).join('');
  }
});

// ---- HELPERS ----
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}