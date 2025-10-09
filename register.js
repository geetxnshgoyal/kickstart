(function () {
  /** Utility to wait for DOM ready before running setup */
  function onDomReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onDomReady(() => {
    const toggleButtons = document.querySelectorAll('.form-toggle__button');
    const forms = {
      individual: document.getElementById('individual-form'),
      team: document.getElementById('team-form')
    };
    const alertBox = document.querySelector('.form-alert');

    if (!forms.individual || !forms.team) {
      console.error('One or both registration forms not found in DOM:', forms);
      return;
    }
    if (!alertBox) {
      console.error('Alert box element .form-alert not found.');
      // we continue but showAlert will fail
    }

    /** Show only one of the forms, hide the other */
    function setActiveForm(target) {
      console.log('Switching active form to:', target);
      Object.entries(forms).forEach(([key, form]) => {
        const isTarget = key === target;
        form.classList.toggle('is-hidden', !isTarget);
      });

      toggleButtons.forEach((button) => {
        const isTarget = button.dataset.target === target;
        button.classList.toggle('is-active', isTarget);
        button.setAttribute('aria-selected', String(isTarget));
      });

      if (alertBox) {
        alertBox.hidden = true;
        alertBox.textContent = '';
      }
    }

    toggleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tgt = button.dataset.target;
        if (!tgt || !(tgt in forms)) {
          console.warn('Toggle button data-target invalid or missing:', button);
          return;
        }
        setActiveForm(tgt);
      });
    });

    function showAlert(message, variant = 'info') {
      if (!alertBox) {
        console.warn('Cannot show alert, alertBox is null. Message:', message);
        return;
      }
      alertBox.hidden = false;
      alertBox.textContent = message;
      alertBox.dataset.variant = variant;
    }

    function sanitizePhoneValue(value) {
      if (!value) return '';
      const cleaned = String(value).replace(/[^0-9+()\\-\\s]/g, '');
      return cleaned.replace(/\\s{2,}/g, ' ').slice(0, 20);
    }

    function attachPhoneHandlers(root = document) {
      const phoneInputs = root.querySelectorAll('input[type="tel"]');
      phoneInputs.forEach((input) => {
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
            try {
              cur.setSelectionRange(pos - 1, pos - 1);
            } catch (_) { }
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
      console.log('submitIndividual invoked');
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
      console.log('submitTeam invoked');
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
      if (!submitButton) {
        console.error('Submit button not found inside form:', form);
        return;
      }
      submitButton.disabled = true;
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Submitting…';

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
          const errMsg = data?.error || 'We could not save your registration. Try again.';
          showAlert(errMsg, 'error');
          console.error('Server responded with error:', data);
          return;
        }

        form.reset();
        showAlert('Registration submitted! We will be in touch soon.', 'success');
        console.log('Registration success:', data);
      } catch (err) {
        console.error('Registration submit failed (network or JS):', err);
        showAlert('Network hiccup. Please try again.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }

    forms.individual.addEventListener('submit', submitIndividual);
    forms.team.addEventListener('submit', submitTeam);

    // Initialize forms: hide team by default (or choose whichever you want)
    setActiveForm('individual');

    // Attach phone input sanitization handlers
    attachPhoneHandlers();
  });
})();
