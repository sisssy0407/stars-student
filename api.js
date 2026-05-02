// ============================================
// STARS — API (Node.js/Express Backend)
// ============================================

const API_BASE = 'https://stars-student.onrender.com/api';

const api = {

  async login(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('stars_token', data.token);
        return {
          success: true,
          token: data.token,
          user: {
            full_name:   data.fullName   || '',
            student_id:  data.studentId  || '',
            email:       data.email      || '',
            program:     data.program    || '',
            block:       data.block      || '',
            year_level:  data.yearLevel  || ''
          }
        };
      }
      return { success: false, message: data.message || 'Invalid credentials.' };
    } catch {
      return { success: false, message: 'Cannot connect to server.' };
    }
  },

  async register(fullName, studentId, email, program, block, yearLevel, password) {
    try {
      const res = await fetch(`${API_BASE}/students/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, studentId, email, program, block, yearLevel, password })
      });
      const data = await res.json();
      if (data.success) return { success: true };
      return { success: false, message: data.message || 'Registration failed.' };
    } catch {
      return { success: false, message: 'Cannot connect to server.' };
    }
  },

  async changePassword(currentPassword, newPassword) {
    try {
      const user = JSON.parse(localStorage.getItem('stars_user') || '{}');
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user.student_id, currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) return { success: true };
      return { success: false, message: data.message || 'Failed to update password.' };
    } catch {
      return { success: false, message: 'Cannot connect to server.' };
    }
  },

  async logout() {
    localStorage.removeItem('stars_token');
    localStorage.removeItem('stars_user');
    window.location.href = 'index.html';
  },

  async getMyPoints() {
    const user = JSON.parse(localStorage.getItem('stars_user') || '{}');
    try {
      const res = await fetch(`${API_BASE}/points/${user.student_id}`, {
        headers: this._auth()
      });
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          balance: data.total ?? 0,
          categories: data.categories || []
        };
      }
      return {
        success: true,
        balance: 0,
        categories: []
      };
    } catch {
      return {
        success: true,
        balance: 0,
        categories: []
      };
    }
  },

  async getMySubmissions() {
    const user = JSON.parse(localStorage.getItem('stars_user') || '{}');
    try {
      const res = await fetch(`${API_BASE}/submissions/student/${user.student_id}`, {
        headers: this._auth()
      });
      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.submissions)
          ? data.submissions
          : [];

      const normalized = list.map(s => ({
        title:            s.title           || s.achievementTitle  || s.achievement_title || '—',
        category_name:    s.categoryName    || s.category_name     || s.category          || '—',
        points_requested: s.points_awarded  ?? s.pointsAwarded     ?? s.pointsRequested   ?? s.points_requested ?? s.points ?? 0,
        status:           s.status          || 'pending',
        submitted_at:     s.submittedAt     || s.submitted_at      || s.createdAt          || s.created_at || null
      }));

      return { success: true, submissions: normalized };
    } catch {
      return { success: true, submissions: [] };
    }
  },

  async submitAchievement(formData) {
    try {
      const res = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        headers: this._auth(),
        body: formData
      });
      return res.json();
    } catch {
      return { success: false, message: 'Connection error.' };
    }
  },

  async getRewards() {
    try {
      // ✅ No auth needed — public endpoint
      const res = await fetch(`${API_BASE}/rewards`);
      const data = await res.json();

      const list = Array.isArray(data) ? data : Array.isArray(data.rewards) ? data.rewards : [];

      const normalized = list.map(r => ({
        reward_id:       r.reward_id       || r.rewardId       || r.id,
        reward_name:     r.reward_name     || r.rewardName     || r.name     || '—',
        points_required: r.points_required ?? r.pointsRequired ?? r.cost     ?? 0,
        description:     r.description    || '',
        stock:           r.stock          ?? 0
      }));

      return { success: true, rewards: normalized };
    } catch {
      return {
        success: true,
        rewards: [
          { reward_id: 1, reward_name: 'Free Printing (10 pages)', points_required: 30,  description: 'Redeem at the CCS lab.',         stock: 10 },
          { reward_id: 2, reward_name: 'Library Priority Pass',    points_required: 50,  description: 'Skip the queue at the library.', stock: 5  },
          { reward_id: 3, reward_name: 'Canteen Voucher P50',      points_required: 80,  description: 'Valid at the main canteen.',      stock: 8  },
          { reward_id: 4, reward_name: 'Department Hoodie',        points_required: 200, description: 'Official CCS merch.',            stock: 0  }
        ]
      };
    }
  },

  async redeemReward(rewardId) {
    try {
      const user = JSON.parse(localStorage.getItem('stars_user') || '{}');
      const res = await fetch(`${API_BASE}/rewards/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this._auth() },
        body: JSON.stringify({ rewardId, studentId: user.student_id })
      });
      return res.json();
    } catch {
      return { success: false, message: 'Connection error.' };
    }
  },

  async getRedemptionHistory() {
    try {
      const user = JSON.parse(localStorage.getItem('stars_user') || '{}');
      const res  = await fetch(`${API_BASE}/rewards/history/${user.student_id}`, {
        headers: this._auth()
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data.history) ? data.history : [];
      return { success: true, history: list };
    } catch {
      return { success: false, history: [] };
    }
  },

  async getRanking(year) {
    try {
      const url = year
        ? `${API_BASE}/ranking?year=${year}`
        : `${API_BASE}/ranking`;
      const res  = await fetch(url, { headers: this._auth() });
      const data = await res.json();
      const list = Array.isArray(data) ? data :
                   Array.isArray(data.ranking) ? data.ranking : [];
      return { success: true, ranking: list };
    } catch {
      return { success: false, ranking: [] };
    }
  },

  _auth() {
    return { 'Authorization': `Bearer ${localStorage.getItem('stars_token')}` };
  }
};