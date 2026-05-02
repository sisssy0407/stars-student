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
  document.getElementById('receiptClose').addEventListener('click', closeReceipt);
  document.getElementById('receiptPrint').addEventListener('click', () => window.print());
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
          const name   = escHtml(h.reward_name  || h.rewardName  || '—');
          const pts    = h.points_spent          ?? h.pointsUsed  ?? h.points_used ?? '—';
          const date   = formatDate(h.redeemed_at || h.redeemedAt || h.created_at);
          const status = (h.status || 'pending').toLowerCase();
          return `
            <tr>
              <td>${name}</td>
              <td>${pts} pts</td>
              <td>${date}</td>
              <td><span class="status-badge status-${status}">${capitalize(h.status || 'Pending')}</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ─────────────────────────────────────────
// Confirm Modal
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
    showReceipt(selectedRewardName, selectedRewardCost);
    await loadHistory();
  } else {
    alert(data?.message || 'Redemption failed. Please try again.');
  }

  btn.disabled    = false;
  btn.textContent = 'Redeem Now';
}

// ─────────────────────────────────────────
// Receipt Modal
// ─────────────────────────────────────────
function showReceipt(rewardName, pointsUsed) {
  const user = JSON.parse(localStorage.getItem('stars_user') || '{}');
  const now  = new Date();
  const ref  = 'STARS-' + now.getFullYear()
    + String(now.getMonth()+1).padStart(2,'0')
    + String(now.getDate()).padStart(2,'0')
    + '-' + Math.random().toString(36).substr(2,6).toUpperCase();

  const dateStr = now.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  document.getElementById('rcptRef').textContent    = ref;
  document.getElementById('rcptDate').textContent   = dateStr;
  document.getElementById('rcptName').textContent   = user.full_name   || '—';
  document.getElementById('rcptId').textContent     = user.student_id  || '—';
  document.getElementById('rcptReward').textContent = rewardName;
  document.getElementById('rcptPts').textContent    = pointsUsed + ' pts';
  document.getElementById('rcptBal').textContent    = currentBalance + ' pts';

  document.getElementById('receiptModal').style.display = 'flex';
}

function closeReceipt() {
  document.getElementById('receiptModal').style.display = 'none';
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

function capitalize(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}