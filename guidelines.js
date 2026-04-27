// ============================================
// STARS — Guidelines JS
// Dark Mode + Tab Switching
// ============================================

// ---- DARK MODE ----
const toggle = document.getElementById('darkModeToggle');
const themeIcon = document.getElementById('themeIcon');

// Load saved preference
const savedTheme = localStorage.getItem('stars_theme');
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
  if (toggle) toggle.checked = true;
  if (themeIcon) themeIcon.textContent = '☀️';
}

if (toggle) {
  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('stars_theme', 'dark');
      if (themeIcon) themeIcon.textContent = '☀️';
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('stars_theme', 'light');
      if (themeIcon) themeIcon.textContent = '🌙';
    }
  });
}

// ---- TAB SWITCHING ----
function switchGuide(tab) {
  const studentGuide = document.getElementById('studentGuide');
  const adminGuide   = document.getElementById('adminGuide');
  const tabs = document.querySelectorAll('.guide-tab');

  if (tab === 'student') {
    if (studentGuide) studentGuide.style.display = 'block';
    if (adminGuide)   adminGuide.style.display   = 'none';
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
  } else {
    if (studentGuide) studentGuide.style.display = 'none';
    if (adminGuide)   adminGuide.style.display   = 'block';
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
  }
}