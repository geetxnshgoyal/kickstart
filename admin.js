(function () {
  const authForm = document.getElementById('admin-auth-form');
  const adminKeyInput = document.getElementById('admin-key');
  const clearKeyButton = document.getElementById('clear-key');
  const rememberKeyCheckbox = document.getElementById('remember-key');
  const adminKeyInfo = document.getElementById('admin-key-info');
  const dashboard = document.querySelector('.admin-dashboard');
  const adminAlert = document.getElementById('admin-alert');
  const tabs = document.querySelectorAll('.admin-tab');
  const refreshButton = document.getElementById('refresh-view');
  const exportButton = document.getElementById('export-view');
  const viewStatus = document.getElementById('view-status');
  const teamUpName = document.getElementById('team-up-name');
  const teamUpCreateButton = document.getElementById('team-up-create');
  const individualList = document.getElementById('individual-list');
  const teamList = document.getElementById('team-list');
  const emptyIndividual = document.querySelector('#view-individuals .data-empty');
  const emptyTeams = document.querySelector('#view-teams .data-empty');

  const MAX_TEAM_SELECTION = 4;

  const state = {
    adminKey: '',
    view: 'individuals',
    individuals: [],
    teams: [],
    selectedParticipants: new Set(),
    leaderParticipantId: null
  };

  // Build absolute API URLs using the page origin to avoid wrong-origin requests
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
  function api(path) {
    // ensure leading slash
    if (!path.startsWith('/')) path = `/${path}`;
    return `${API_BASE}${path}`;
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  // Admin status banner
  const adminStatusEl = document.createElement('div');
  adminStatusEl.id = 'admin-status';
  adminStatusEl.style.margin = '12px 0';
  adminStatusEl.style.padding = '8px 12px';
  adminStatusEl.style.borderRadius = '4px';
  adminStatusEl.style.fontWeight = '600';
  adminStatusEl.style.display = 'none';
  document.body.insertBefore(adminStatusEl, document.body.firstChild);

  async function refreshAdminStatus() {
    try {
      const res = await fetch(api('/api/status'));
      const json = await res.json();
      adminStatusEl.style.display = 'block';
      if (json.status === 'connected') {
        adminStatusEl.textContent = `DB connected (${json.mode})`;
        adminStatusEl.style.background = '#0b8a3e22';
        adminStatusEl.style.color = '#0bd67a';
      } else if (json.status === 'mock') {
        adminStatusEl.textContent = `Using mock DB (development)`;
        adminStatusEl.style.background = '#0b64ff22';
        adminStatusEl.style.color = '#3aa0ff';
      } else {
        adminStatusEl.textContent = `DB offline: ${json.message || 'no credentials'}`;
        adminStatusEl.style.background = '#ff3b3022';
        adminStatusEl.style.color = '#ff3b30';
      }
    } catch (err) {
      adminStatusEl.style.display = 'block';
      adminStatusEl.textContent = 'Status unavailable';
      adminStatusEl.style.background = '#ffcc0022';
      adminStatusEl.style.color = '#ffcc00';
    }
  }

  // Add small CSS rule for present seat highlight
  const style = document.createElement('style');
  style.textContent = `.seat-present { background: #ffc0e4; border-radius: 4px; padding: 4px; }`;
  document.head.appendChild(style);

  function showAlert(message, variant = 'info') {
    adminAlert.hidden = false;
    adminAlert.textContent = message;
    adminAlert.dataset.variant = variant;
  }

  function clearAlert() {
    adminAlert.hidden = true;
    adminAlert.textContent = '';
    delete adminAlert.dataset.variant;
  }

  function setDashboardEnabled(enabled) {
    dashboard.classList.toggle('is-disabled', !enabled);
    dashboard.setAttribute('aria-disabled', String(!enabled));
  }

  function saveAdminKey(key) {
    state.adminKey = key;
    if (rememberKeyCheckbox && rememberKeyCheckbox.checked) {
      localStorage.setItem('kickstart-admin-key', key);
      adminKeyInfo.textContent = 'Key saved to device.';
    } else {
      // do not persist
      localStorage.removeItem('kickstart-admin-key');
      adminKeyInfo.textContent = 'Key in memory for this session only.';
    }
    clearKeyButton.hidden = false;
  }

  function loadAdminKey() {
    const saved = localStorage.getItem('kickstart-admin-key');
    if (saved) {
      adminKeyInput.value = saved;
      state.adminKey = saved;
      clearKeyButton.hidden = false;
      rememberKeyCheckbox.checked = true;
      adminKeyInfo.textContent = 'Key saved on device.';
      return true;
    }
    return false;
  }

  async function unlockDashboard(event) {
    event.preventDefault();
    clearAlert();

    const key = adminKeyInput.value.trim();
    if (!key) {
      showAlert('Enter the admin access key to continue.', 'error');
      return;
    }

    state.adminKey = key;
    saveAdminKey(key);
    setDashboardEnabled(true);
    showAlert('Dashboard unlocked.', 'success');
    await loadView(state.view);
  }

  function resetSelection() {
    state.selectedParticipants.clear();
    state.leaderParticipantId = null;
    teamUpName.value = '';
    teamUpCreateButton.disabled = true;
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const selectionSize = state.selectedParticipants.size;
    const withinLimit = selectionSize >= 2 && selectionSize <= MAX_TEAM_SELECTION;

    teamUpCreateButton.disabled = !withinLimit || !teamUpName.value.trim();

    const leaderRadios = individualList.querySelectorAll('.select-leader');
    leaderRadios.forEach((radio) => {
      const participantId = radio.dataset.participantId;
      const isSelected = state.selectedParticipants.has(participantId);
      radio.disabled = !isSelected;
      radio.checked = state.leaderParticipantId === participantId;
    });
  }

  function setView(view) {
    state.view = view;
    tabs.forEach((tab) => {
      const isActive = tab.dataset.view === view;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    document.querySelectorAll('.admin-view').forEach((panel) => {
      panel.classList.toggle('is-hidden', panel.dataset.view !== view);
    });

    viewStatus.textContent = 'Loading…';
    loadView(view);
  }

  async function loadView(view) {
    try {
      const response = await fetch(api(`/api/admin/registrations?view=${view}`), {
        headers: {
          'x-admin-key': state.adminKey
        }
      });

      if (response.status === 401) {
        // Do not remove the saved key on 401 — keep it persisted so the admin
        // can re-check or clear it manually. Show a clear error instead.
        showAlert('Access denied: admin key rejected by server. Check or clear the saved key.', 'error');
        return;
      }

      // Ensure the server returned JSON. If not, read the raw text to aid debugging.
      const contentType = response.headers.get('content-type') || '';
      let data;
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Expected JSON but server returned:', text);
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 1000)}`);
      }

      try {
        data = await response.json();
      } catch (parseErr) {
        const raw = await response.text().catch(() => '<<unavailable>>');
        console.error('Failed to parse JSON response:', parseErr, 'raw response:', raw);
        throw new Error('Invalid JSON from server. See console for full response.');
      }
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to fetch data');
      }

      const teams = Array.isArray(data.teams) ? data.teams : [];
      if (view === 'individuals') {
        state.individuals = teams;
        renderIndividuals();
      } else {
        state.teams = teams;
        renderTeams();
      }

      viewStatus.textContent = `Loaded ${teams.length} record${teams.length === 1 ? '' : 's'}.`;
    } catch (error) {
      console.error('Load view failed:', error);
      viewStatus.textContent = 'Error loading data.';
      showAlert(error.message || 'Unable to load data. Try again.', 'error');
    }
    // refresh admin status indicator after each load
    try { refreshAdminStatus(); } catch (e) { /* ignore */ }
  }

  function renderIndividuals() {
    // reset selection state
    state.selectedParticipants.clear();
    state.leaderParticipantId = null;

    if (!Array.isArray(state.individuals) || state.individuals.length === 0) {
      individualList.innerHTML = '';
      emptyIndividual.hidden = false;
      updateSelectionUI();
      return;
    }

    emptyIndividual.hidden = true;

    const cards = state.individuals.map((item) => {
      // The API may return several shapes: an object with `.participants` array,
      // a wrapper with `{ participant: {...} }`, or a single participant object.
      let participant = null;

      if (item && Array.isArray(item.participants) && item.participants.length) {
        participant = item.participants[0];
      } else if (item && item.participant) {
        participant = item.participant;
      } else if (item && (item.id || item.name)) {
        participant = item; // already a participant
      }

      if (!participant || !participant.id) return '';

      // coerce id to string for dataset consistency
      const participantId = String(participant.id);
      const checkboxId = `participant-${participantId}`;
      const leaderId = `leader-${participantId}`;

      const phoneLine = participant.phone ? `<span>${participant.phone}</span>` : '';
      const profileLine = participant.profile
        ? `<a href="${participant.profile}" target="_blank" rel="noopener">Profile ↗</a>`
        : '';

      return `
        <li class="card card--individual" data-participant-id="${escapeAttribute(participantId)}">
          <div class="card__select">
            <input type="checkbox" class="select-participant" id="${escapeAttribute(checkboxId)}" data-participant-id="${escapeAttribute(participantId)}">
            <label for="${escapeAttribute(checkboxId)}">Select</label>
          </div>
          <div class="card__body">
            <h3>${escapeAttribute(participant.name || 'Unnamed')}</h3>
            <p>${escapeAttribute(participant.email || '')}</p>
            <div class="card__meta">
              ${phoneLine}
              ${profileLine}
            </div>
            <span class="tag">Registered solo</span>
          </div>
          <div class="card__leader">
            <label for="${escapeAttribute(leaderId)}">
              <input type="radio" class="select-leader" name="team-leader" id="${escapeAttribute(leaderId)}" data-participant-id="${escapeAttribute(participantId)}" disabled>
              Lead
            </label>
          </div>
        </li>
      `;
    });

    individualList.innerHTML = cards.join('');

    // wire up controls
    individualList.querySelectorAll('.select-participant').forEach((checkbox) => {
      checkbox.addEventListener('change', onParticipantToggle);
    });

    individualList.querySelectorAll('.select-leader').forEach((radio) => {
      radio.addEventListener('change', () => {
        state.leaderParticipantId = String(radio.dataset.participantId);
        updateSelectionUI();
      });
    });

    updateSelectionUI();
  }

  function onParticipantToggle(event) {
    const checkbox = event.currentTarget;
    const participantId = checkbox.dataset.participantId;

    if (checkbox.checked) {
      if (state.selectedParticipants.size >= MAX_TEAM_SELECTION) {
        checkbox.checked = false;
        showAlert(`You can only group up to ${MAX_TEAM_SELECTION} solo participants at once.`, 'error');
        return;
      }

      state.selectedParticipants.add(participantId);
      if (!state.leaderParticipantId) {
        state.leaderParticipantId = participantId;
      }
    } else {
      state.selectedParticipants.delete(participantId);
      if (state.leaderParticipantId === participantId) {
        const firstSelected = state.selectedParticipants.values().next().value;
        state.leaderParticipantId = firstSelected !== undefined ? firstSelected : null;
      }
    }

    updateSelectionUI();
  }

  function renderTeams() {
    if (!state.teams.length) {
      teamList.innerHTML = '';
      emptyTeams.hidden = false;
      return;
    }

    emptyTeams.hidden = true;

    const cards = state.teams.map((team) => {
      const participants = Array.isArray(team.participants) ? team.participants : [];
      const leader = participants.find((member) => member.role === 'leader') || participants[0];
      const others = participants.filter((member) => member.id !== leader?.id);

      const seatValue = team.seat_number || '';
      const seatLabel = seatValue ? `Seat ${seatValue}` : 'Seat not assigned';
      const attendanceLabel = team.attendance_marked ? 'Present' : 'Not checked-in';

      const sourceMap = {
        individual_form: 'Solo',
        team_form: 'Team',
        admin_team_up: 'Formed'
      };
      const sourceLabel = sourceMap[team.source] || 'Unknown';

      const created = team.created_at
        ? new Date(team.created_at).toLocaleString()
        : 'Pending';

      const seatInputId = `seat-${team.id}`;

      const membersList = others
        .map((member) => {
          const profileLink = member.profile
            ? `<a href="${member.profile}" target="_blank" rel="noopener">Profile ↗</a>`
            : '';
          const phoneLine = member.phone ? `<span>${member.phone}</span>` : '';
          return `
            <li>
              <strong>${member.name}</strong>
              <span>${member.email || 'No email'}</span>
              ${phoneLine}
              ${profileLink}
            </li>
          `;
        })
        .join('');

      const memberBlock = membersList
        ? `<ul class="member-list" aria-label="Team members">${membersList}</ul>`
        : '<p class="card__empty">No additional members listed.</p>';

      const leaderProfile = leader?.profile
        ? `<a href="${leader.profile}" target="_blank" rel="noopener">Profile ↗</a>`
        : '';
      const leaderPhone = leader?.phone ? `<span>${leader.phone}</span>` : '';

      const markButtonLabel = team.attendance_marked ? 'Reassign seat' : 'Mark present';
      const secondaryButton = team.attendance_marked
        ? `<button type="button" class="button button--ghost" data-action="clear" data-team-id="${team.id}">Clear attendance</button>`
        : '';
      const seatValueAttr = escapeAttribute(seatValue);

      return `
        <li class="card card--team" data-team-id="${team.id}">
          <header class="card__header">
            <div>
              <h3>${team.name}</h3>
              <span class="tag">${sourceLabel}</span>
            </div>
            <div class="card__status">
              <span>${seatLabel}</span>
              <span>${attendanceLabel}</span>
            </div>
          </header>
          <div class="card__body">
            <div class="lead-info">
              <strong>Lead:</strong>
              <span>${leader?.name || 'Unknown'}</span>
              <span>${leader?.email || 'No email'}</span>
              ${leaderPhone}
              ${leaderProfile}
            </div>
            ${memberBlock}
          </div>
          <footer class="card__footer">
            <div class="card__meta">
              <span>Registered: ${created}</span>
            </div>
            <div class="card__actions">
              <label class="seat-field" for="${seatInputId}">
                <span>Seat / Room</span>
                <input type="text" class="seat-input ${team.attendance_marked ? 'seat-present' : ''}" id="${seatInputId}" data-team-id="${team.id}" value="${seatValueAttr}" placeholder="e.g. Lab-42">
              </label>
              <button type="button" class="button" data-action="mark" data-team-id="${team.id}">${markButtonLabel}</button>
              ${secondaryButton}
            </div>
          </footer>
        </li>
      `;
    });

    teamList.innerHTML = cards.join('');

    teamList.querySelectorAll('button[data-action="mark"]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        const teamId = event.currentTarget.dataset.teamId;
        const seatInput = teamList.querySelector(`.seat-input[data-team-id="${teamId}"]`);
        const seatValue = seatInput ? seatInput.value.trim() : '';
        await handleAttendance(teamId, true, seatValue);
      });
    });

    teamList.querySelectorAll('button[data-action="clear"]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        const teamId = event.currentTarget.dataset.teamId;
        await handleAttendance(teamId, false);
      });
    });
  }

  async function handleAttendance(teamId, present, seatNumber = '') {
    clearAlert();
    try {
      const response = await fetch(api('/api/admin/attendance'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': state.adminKey
        },
        body: JSON.stringify({ teamId, present, seatNumber })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to update attendance');
      }

      const message = present
        ? `Team marked present. Seat ${data.seatNumber || 'pending'} assigned.`
        : 'Attendance cleared for team.';
      showAlert(message, 'success');

      await loadView('teams');
    } catch (error) {
      console.error('Attendance update failed:', error);
      showAlert(error.message || 'Unable to update attendance.', 'error');
    }
  }

  async function exportCurrentView() {
    if (!state.adminKey) {
      showAlert('Unlock the dashboard before exporting data.', 'error');
      return;
    }

    clearAlert();

    try {
      const format = (document.getElementById('export-format') || {}).value || 'csv';
      const response = await fetch(api(`/api/admin/export?view=${state.view}&format=${encodeURIComponent(format)}`), {
        headers: {
          'x-admin-key': state.adminKey
        }
      });

      if (!response.ok) {
        let errorMessage = 'Unable to export registrations.';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody?.error || errorMessage;
        } catch (parseError) {
          // ignore parse failure and use default message
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `kickstart-${state.view}-export-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showAlert('CSV downloaded successfully.', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showAlert(error.message || 'Unable to download CSV.', 'error');
    }
  }

  async function submitTeamUp() {
    clearAlert();

    const name = teamUpName.value.trim();
    if (state.selectedParticipants.size < 2) {
      showAlert('Select at least two participants to form a team.', 'error');
      return;
    }

    if (!name) {
      showAlert('Name the new team before creating it.', 'error');
      return;
    }

    const participantIds = Array.from(state.selectedParticipants);
    if (participantIds.length > MAX_TEAM_SELECTION) {
      showAlert(`Select no more than ${MAX_TEAM_SELECTION} solo participants.`, 'error');
      return;
    }
    const leaderId = state.leaderParticipantId || participantIds[0];

    try {
      teamUpCreateButton.disabled = true;
      teamUpCreateButton.textContent = 'Creating…';

      const response = await fetch(api('/api/admin/team-up'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': state.adminKey
        },
        body: JSON.stringify({
          participantIds,
          teamName: name,
          leaderParticipantId: leaderId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to create team');
      }

      const newTeamId = data?.teamId || data?.newTeamId;
      showAlert('Team created successfully from the selected participants.', 'success');

      // Offer to mark the new team present and assign a seat immediately.
      try {
        if (newTeamId) {
          const markNow = window.confirm('Mark the new team present now? Click OK to mark present and assign a seat, Cancel to skip.');
          if (markNow) {
            const seat = window.prompt('Enter a seat/room for this team (leave blank for automatic assignment):', '');
            if (seat === null) {
              // user cancelled prompt; do nothing
            } else {
              await handleAttendance(newTeamId, true, seat ? seat.trim() : '');
            }
          }
        }
      } catch (err) {
        console.error('Auto-mark attendance failed:', err);
      }

      resetSelection();
      await loadView('individuals');
      await loadView('teams');
    } catch (error) {
      console.error('Team up failed:', error);
      showAlert(error.message || 'Unable to create team.', 'error');
    } finally {
      teamUpCreateButton.disabled = false;
      teamUpCreateButton.textContent = 'Create team from selection';
    }
  }

  authForm.addEventListener('submit', unlockDashboard);
  clearKeyButton.addEventListener('click', () => {
    localStorage.removeItem('kickstart-admin-key');
    adminKeyInput.value = '';
    state.adminKey = '';
    setDashboardEnabled(false);
    clearKeyButton.hidden = true;
    if (rememberKeyCheckbox) rememberKeyCheckbox.checked = false;
    if (adminKeyInfo) adminKeyInfo.textContent = '';
    showAlert('Stored key cleared.', 'info');
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      if (view !== state.view) {
        setView(view);
      }
    });
  });

  refreshButton.addEventListener('click', () => loadView(state.view));
  exportButton.addEventListener('click', exportCurrentView);
  teamUpName.addEventListener('input', updateSelectionUI);
  teamUpCreateButton.addEventListener('click', submitTeamUp);

  loadAdminKey();
  if (state.adminKey) {
    setDashboardEnabled(true);
    loadView(state.view);
  }
})();
