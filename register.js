(function () {
  const toggleButtons = document.querySelectorAll('.form-toggle__button');
  const forms = {
    individual: document.getElementById('individual-form'),
    team: document.getElementById('team-form')
  };
  const alertBox = document.querySelector('.form-alert');

  // ✅ Add keyboard navigation (ArrowLeft / ArrowRight) and ARIA roles
  toggleButtons.forEach((btn) => {
    btn.setAttribute('role', 'tab'); // ✅ added
    btn.setAttribute('tabindex', btn.classList.contains('is-active') ? '0' : '-1'); // ✅ added
  });

  const toggleGroup = document.querySelector('.form-toggle');
  if (toggleGroup) toggleGroup.setAttribute('role', 'tablist'); // ✅ added

  function setActiveForm(target) {
    Object.entries(forms).forEach(([key, form]) => {
      const isTarget = key === target;
      form.classList.toggle('is-hidden', !isTarget);
    });

    toggleButtons.forEach((button) => {
      const isTarget = button.dataset.target === target;
      button.classList.toggle('is-active', isTarget);
      button.setAttribute('aria-selected', String(isTarget));
      button.setAttribute('tabindex', isTarget ? '0' : '-1'); // ✅ added
    });

    // ✅ Move focus to active toggle for accessibility
    const activeButton = document.querySelector(`.form-toggle__button[data-target="${target}"]`);
    if (activeButton) activeButton.focus();

    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveForm(button.dataset.target));

    // ✅ Allow arrow key navigation between toggles
    button.addEventListener('keydown', (e) => {
      const currentIndex = Array.from(toggleButtons).indexOf(button);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const nextIndex =
          e.key === 'ArrowRight'
            ? (currentIndex + 1) % toggleButtons.length
            : (currentIndex - 1 + toggleButtons.length) % toggleButtons.length;
        const nextButton = toggleButtons[nextIndex];
        setActiveForm(nextButton.dataset.target);
      }
    });
  });

  function showAlert(message, variant = 'info') {
    alertBox.hidden = false;
    alertBox.textContent = message;
    alertBox.dataset.variant = variant;
  }

  // Phone input sanitization: strip alphabetic characters and limit length
  function sanitizePhoneValue(value) {
    if (!value) return '';
    // allow digits, plus, parentheses, spaces, hyphens
    const cleaned = String(value).replace(/[^0-9+()\-\s]/g, '');
    // collapse multiple spaces
    return cleaned.replace(/\s{2,}/g, ' ').slice(0, 20);
  }

  function attachPhoneHandlers(root = document) {
    const phoneInputs = root.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach((input) => {
      // ensure mobile keyboard suggestion and basic pattern exist
      input.setAttribute('inputmode', input.getAttribute('inputmode') || 'tel');
      if (!input.getAttribute('pattern')) {
        input.setAttribute('pattern', '[0-9+()\\-\\s]*');
      }

      input.addEventListener('input', (e) => {
        const cur = e.currentTarget;
        const pos = cur.selectionStart;
        const before = cur.value;
        const cleaned = sanitizePhoneValue(before);
        if (before !== cleaned) {
          cur.value = cleaned;
          try { cur.setSelectionRange(pos - 1, pos - 1); } catch (err) { /* ignore */ }
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text') || '';
        const cleaned = sanitizePhoneValue(text);
        const el = e.currentTarget;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const newVal = (el.value.slice(0, start) + cleaned + el.value.slice(end)).slice(0, 20);
        el.value = newVal;
      });
    });
  }

  async function submitIndividual(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      type: 'individual',
      participant: {
        name: formData.get('name')?.trim(),
        email: formData.get('email')?.trim(),
        phone: formData.get('phone')?.trim(),
        profileLink: formData.get('profileLink')?.trim(),
        notes: formData.get('notes')?.trim()
      }
    };

    if (!payload.participant.name || !payload.participant.email) {
      showAlert('Please share both your name and email to register.', 'error');
      return;
    }

    await sendRegistration(form, payload);
  }

  async function submitTeam(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const members = [2, 3, 4]
      .map((index) => ({
        name: formData.get(`member${index}Name`)?.trim() || '',
        email: formData.get(`member${index}Email`)?.trim() || '',
        phone: formData.get(`member${index}Phone`)?.trim() || '',
        profileLink: formData.get(`member${index}Profile`)?.trim() || ''
      }))
      .filter((member) => member.name || member.email || member.phone || member.profileLink);

    const payload = {
      type: 'team',
      teamName: formData.get('teamName')?.trim(),
      leader: {
        name: formData.get('leaderName')?.trim(),
        email: formData.get('leaderEmail')?.trim(),
        phone: formData.get('leaderPhone')?.trim(),
        profileLink: formData.get('leaderProfile')?.trim()
      },
      members,
      notes: formData.get('notes')?.trim()
    };

    if (!payload.teamName) {
      showAlert('Give your team a name before submitting.', 'error');
      return;
    }

    if (!payload.leader.name || !payload.leader.email) {
      showAlert('Team lead needs a name and email.', 'error');
      return;
    }

    await sendRegistration(form, payload);
  }

  async function sendRegistration(form, payload) {
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.error || 'We could not save your registration. Try again.';
        showAlert(errorMessage, 'error');
        return;
      }

      form.reset();
      showAlert('Registration submitted! We will be in touch soon.', 'success');
    } catch (error) {
      console.error('Registration submit failed:', error);
      showAlert('Network hiccup. Please try again.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent =
        form.dataset.form === 'individual'
          ? 'Submit Registration'
          : 'Submit Team';
    }
  }

  forms.individual.addEventListener('submit', submitIndividual);
  forms.team.addEventListener('submit', submitTeam);

  // Attach phone handlers on load
  attachPhoneHandlers();
})();
