// ============================================
// STARS — Auth JS
// Handles login + session checking
// ============================================

// ---- LOGIN PAGE ----
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  // Redirect if already logged in
  if (localStorage.getItem('stars_token')) {
    window.location.href = 'dashboard.html';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('loginBtn');
    const errorEl = document.getElementById('loginError');
    const studentId = document.getElementById('studentId').value.trim();
    const password  = document.getElementById('password').value;

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.innerHTML = '';

    try {
      const data = await api.login(studentId, password);

      if (data.success) {
        localStorage.setItem('stars_token', data.token);
        localStorage.setItem('stars_user', JSON.stringify(data.user));
        window.location.href = 'dashboard.html';
      } else {
        if (data.message === 'Cannot connect to server.') {
  errorEl.innerHTML =
    '&#9888;&#65039; Cannot connect to server.<br>' +
    '<small style="color:var(--gray);line-height:1.8">' +
    'Make sure your backend is running on <strong>port 8081</strong>.<br>' +
'Make sure your <strong>Spring Boot backend</strong> is running in NetBeans.' +
    '</small>';
        } else {
          errorEl.textContent = data.message || 'Invalid credentials.';
        }
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

// ---- APP PAGES: Protect + Load User Info ----
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  const token = localStorage.getItem('stars_token');
  const userJson = localStorage.getItem('stars_user');

  if (!token || !userJson) {
    window.location.href = 'index.html';
  } else {
    const user = JSON.parse(userJson);

    const nameEl   = document.getElementById('userName');
    const idEl     = document.getElementById('userStudentId');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl)   nameEl.textContent   = user.full_name || '—';
    if (idEl)     idEl.textContent     = user.student_id || '—';
    if (avatarEl) avatarEl.textContent = (user.full_name || 'S')[0].toUpperCase();
  }

  logoutBtn.addEventListener('click', () => api.logout());
}