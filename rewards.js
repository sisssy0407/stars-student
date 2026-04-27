// ============================================
// STARS — Rewards JS
// ============================================

let selectedRewardId   = null;
let selectedRewardName = null;
let selectedRewardCost = null;
let currentBalance     = 0;

document.addEventListener('DOMContentLoaded', async () => {

  // ── Load balance ──
  const pointsData = await api.getMyPoints();
  if (pointsData && pointsData.success) {
    currentBalance = pointsData.balance ?? 0;
    setEl('balanceDisplay', `${currentBalance} pts`);
  }

  // ── Load rewards ──
  const rwData = await api.getRewards();
  const grid   = document.getElementById('rewardsGrid');

  if (rwData && rwData.success && rwData.rewards.length > 0) {
    grid.innerHTML = rwData.rewards.map(r => {
      const outOfStock = r.stock <= 0;
      const canRedeem  = currentBalance >= r.points_required && !outOfStock;
      const stockLabel = outOfStock
        ? `<span class="stock-badge out">Out of Stock</span>`
        : `<span class="stock-badge in">${r.stock} left</span>`;

      let btnLabel;
      if (outOfStock)        btnLabel = 'Out of Stock';
      else if (canRedeem)    btnLabel = 'Redeem Now';
      else                   btnLabel = `Need ${r.points_required - currentBalance} more pts`;

      return `
        <div class="reward-card ${canRedeem ? '' : 'locked'}">
          <p class="reward-pts">${r.points_required} pts</p>
          <p class="reward-name">${escHtml(r.reward_name)}</p>
          <p class="reward-desc">${escHtml(r.description || '')}</p>
          ${stockLabel}
          <button class="btn-primary"
            onclick="openRedeemModal(${r.reward_id}, '${escHtml(r.reward_name)}', ${r.points_required})"
            ${canRedeem ? '' : 'disabled'}>
            ${btnLabel}
          </button>
        </div>
      `;
    }).join('');
  } else {
    grid.innerHTML = '<p style="color:var(--gray)">No rewards available.</p>';
  }

  // ── Load redemption history ──
  await loadHistory();

  // ── Modal events ──
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalConfirm').addEventListener('click', confirmRedeem);
});

// ─────────────────────────────────────────
// Load & render redemption history
// ─────────────────────────────────────────
async function loadHistory() {
  const container = document.getElementById('historyContainer');
  const histData  = await api.getRedemptionHistory();

  if (!histData || !histData.success || histData.history.length === 0) {
    container.innerHTML = '<p class="empty-history" style="padding:1rem;">No redemptions yet.</p>';
    return;
  }

  container.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>Reward</th>
          <th>Points Used</th>
          <th>Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${histData.history.map(h => {
          const name   = escHtml(h.rewardName   || h.reward_name  || '—');
          const pts    = h.pointsUsed            ?? h.points_used  ?? '—';
          const date   = formatDate(h.redeemedAt || h.redeemed_at || h.createdAt || h.created_at);
          const status = (h.status || 'pending').toLowerCase();
          return `
            <tr>
              <td>${name}</td>
              <td>${pts}</td>
              <td>${date}</td>
              <td><span class="status-badge status-${status}">${h.status || 'Pending'}</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ─────────────────────────────────────────
// Modal
// ─────────────────────────────────────────
function openRedeemModal(id, name, cost) {
  selectedRewardId   = id;
  selectedRewardName = name;
  selectedRewardCost = cost;

  document.getElementById('modalText').textContent =
    `Redeem "${name}" for ${cost} points? Your new balance will be ${currentBalance - cost} pts.`;
  document.getElementById('redeemModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('redeemModal').style.display = 'none';
}

async function confirmRedeem() {
  const btn = document.getElementById('modalConfirm');
  btn.disabled    = true;
  btn.textContent = 'Processing...';

  const data = await api.redeemReward(selectedRewardId);
  closeModal();

  if (data && data.success) {
    currentBalance -= selectedRewardCost;
    setEl('balanceDisplay', `${currentBalance} pts`);
    alert(`✓ Redeemed: ${selectedRewardName}! Show this to your coordinator.`);
    location.reload();
  } else {
    alert(data?.message || 'Redemption failed. Please try again.');
  }

  btn.disabled    = false;
  btn.textContent = 'Redeem Now';
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}