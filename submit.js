// ============================================
// STARS — Submit Achievement JS
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  const zone      = document.getElementById('uploadZone');
  const fileInput = document.getElementById('proofFile');
  const preview   = document.getElementById('uploadPreview');

  const CATEGORY_NOTES = {
    '1': '📌 Upload your certificate, photo, or proof of your contest/competition placement.',
    '2': '📌 Upload your event certificate, photo, or participation proof.',
    '3': '📌 Upload the Lost & Found certificate given to you, then enter your PIN below.'
  };

  document.getElementById('achCategory').addEventListener('change', function () {
    const pinGroup  = document.getElementById('pinGroup');
    const pinInput  = document.getElementById('achPin');
    const noteEl    = document.getElementById('categoryNote');

    noteEl.textContent = CATEGORY_NOTES[this.value] || '';

    if (this.value === '3') {
      pinGroup.style.display = 'block';
      pinInput.required = true;
    } else {
      pinGroup.style.display = 'none';
      pinInput.required = false;
      pinInput.value = '';
    }
  });

  // ---- FILE UPLOAD ----
  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      document.getElementById('submitError').textContent = 'File too large. Max 5MB.';
      return;
    }
    fileInput._selectedFile = file;
    preview.textContent = `✓ Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    document.getElementById('submitError').textContent = '';
  }

  // ---- FORM SUBMIT ----
  const form = document.getElementById('submitForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn       = document.getElementById('submitBtn');
    const errEl     = document.getElementById('submitError');
    const successEl = document.getElementById('submitSuccess');

    errEl.textContent     = '';
    successEl.textContent = '';

    const categoryId = document.getElementById('achCategory').value;
    const pin        = document.getElementById('achPin').value.trim().toUpperCase();

    // ---- GET STUDENT ID ----
    const user = JSON.parse(localStorage.getItem('stars_user') || '{}');
    const studentId = user.student_id || '';
    if (!studentId) {
      errEl.textContent = 'Session expired. Please login again.';
      return;
    }

    // ---- PROOF REQUIRED ----
    if (!fileInput._selectedFile) {
      errEl.textContent = '📎 Please upload proof for your achievement.';
      return;
    }

    // ---- PIN VALIDATION for Lost & Found ----
    if (categoryId === '3') {
      if (!pin) {
        errEl.textContent = 'Please enter your Lost & Found PIN code.';
        return;
      }
      try {
        const pinCheck = await fetch(`http://localhost:8081/api/submissions/verify-pin?pin=${pin}`);
        const pinData  = await pinCheck.json();
        if (!pinData.valid) {
          errEl.textContent = '❌ ' + pinData.message;
          return;
        }
      } catch {
        errEl.textContent = 'Could not verify PIN. Make sure the backend is running.';
        return;
      }
    }

    btn.disabled    = true;
    btn.textContent = 'Submitting...';

    // ---- BUILD FORM DATA ----
    const formData = new FormData();
    formData.append('studentId',        studentId);  // ✅ fixed
    formData.append('title',            document.getElementById('achTitle').value.trim());
    formData.append('category_id',      categoryId);
    formData.append('description',      document.getElementById('achDesc').value.trim());
    formData.append('points_requested', 0);
    formData.append('proof',            fileInput._selectedFile);

    if (categoryId === '3' && pin) {
      formData.append('pin_code', pin);
    }

    try {
      const data = await api.submitAchievement(formData);
      if (data.success) {
        successEl.textContent = '✓ Submitted! Waiting for admin review.';
        form.reset();
        preview.textContent = '';
        fileInput._selectedFile = null;
        document.getElementById('pinGroup').style.display   = 'none';
        document.getElementById('categoryNote').textContent = '';
      } else {
        errEl.textContent = data.message || 'Submission failed.';
      }
    } catch {
      errEl.textContent = 'Connection error. Please try again.';
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Submit for Review →';
    }
  });

});