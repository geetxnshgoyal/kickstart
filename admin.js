(function () {
  // ==== DOM ELEMENTS ====
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

  // ==== CONSTANTS ====
  const MAX_TEAM_SELECTION = 4;

  // ==== APP STATE ====
  const state = {
    adminKey: '',
    view: 'individuals',
    individuals: [],
    teams: [],
    selectedParticipants: new Set(),
    leaderParticipantId: null
  };

  // ==== UTILITIES ====
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : '';

  function api(path) {
    if (!path.startsWith('/')) path = `/${path}`;
    return `${API_BASE}${path}`;
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  // ==== ADMIN STATUS BAR ====
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
    } catch {
      adminStatusEl.style.display = 'block';
      adminStatusEl.textContent = 'Status unavailable';
      adminStatusEl.style.background = '#ffcc0022';
      adminStatusEl.style.color = '#ffcc00';
    }
  }

  // ==== CSS RULE FOR SEAT HIGHLIGHT ====
  const style = document.createElement('style');
  style.textContent = `.seat-present { background: #ffc0e4; border-radius: 4px; padding: 4px; }`;
  document.head.appendChild(style);

  // ==== ALERT SYSTEM ====
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

  // ==== ADMIN KEY STORAGE ====
  function saveAdminKey(key) {
    state.adminKey = key;
    if (rememberKeyCheckbox && rememberKeyCheckbox.checked) {
      localStorage.setItem('kickstart-admin-key', key);
      adminKeyInfo.textContent = 'Key saved to device.';
    } else {
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

  // ==== DASHBOARD CONTROL ====
  function setDashboardEnabled(enabled) {
    dashboard.classList.toggle('is-disabled', !enabled);
    dashboard.setAttribute('aria-disabled', String(!enabled));
  }

  async function unlockDashboard(event) {
    event.preventDefault();
    clearAlert();

    const key = adminKeyInput.value.trim();
    if (!key) {
      showAlert('Enter the admin access key to continue.', 'error');
      return;
    }

    saveAdminKey(key);
    setDashboardEnabled(true);
    showAlert('Dashboard unlocked.', 'success');
    await loadView(state.view);
  }

  // ==== SELECTION / TEAM-UP ====
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

  // ==== VIEW HANDLING ====
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
        headers: { 'x-admin-key': state.adminKey }
      });

      if (response.status === 401) {
        showAlert('Access denied: admin key rejected by server. Check or clear the saved key.', 'error');
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to fetch data');

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
      showAlert(error.message || 'Unable to load data.', 'error');
    }

    try { refreshAdminStatus(); } catch {}
  }

  // ==== RENDER FUNCTIONS ====
  function renderIndividuals() {
    state.selectedParticipants.clear();
    state.leaderParticipantId = null;

    if (!state.individuals.length) {
      individualList.innerHTML = '';
      emptyIndividual.hidden = false;
      updateSelectionUI();
      return;
    }

    emptyIndividual.hidden = true;
    individualList.innerHTML = state.individuals.map((item) => {
      let p = item?.participants?.[0] || item?.participant || item;
      if (!p?.id) return '';
      const pid = String(p.id);
      const phone = p.phone ? `<span>${p.phone}</span>` : '';
      const profile = p.profile ? `<a href="${p.profile}" target="_blank" rel="noopener">Profile ↗</a>` : '';

      return `
        <li class="card card--individual" data-participant-id="${escapeAttribute(pid)}">
          <div class="card__select">
            <input type="checkbox" class="select-participant" id="participant-${pid}" data-participant-id="${pid}">
            <label for="participant-${pid}">Select</label>
          </div>
          <div class="card__body">
            <h3>${escapeAttribute(p.name || 'Unnamed')}</h3>
            <p>${escapeAttribute(p.email || '')}</p>
            <div class="card__meta">${phone}${profile}</div>
            <span class="tag">Registered solo</span>
          </div>
          <div class="card__leader">
            <label><input type="radio" class="select-leader" name="team-leader" data-participant-id="${pid}" disabled> Lead</label>
          </div>
        </li>`;
    }).join('');

    individualList.querySelectorAll('.select-participant').forEach(cb => {
      cb.addEventListener('change', onParticipantToggle);
    });

    individualList.querySelectorAll('.select-leader').forEach(radio => {
      radio.addEventListener('change', () => {
        state.leaderParticipantId = String(radio.dataset.participantId);
        updateSelectionUI();
      });
    });

    updateSelectionUI();
  }

  function onParticipantToggle(e) {
    const id = e.currentTarget.dataset.participantId;
    if (e.currentTarget.checked) {
      if (state.selectedParticipants.size >= MAX_TEAM_SELECTION) {
        e.currentTarget.checked = false;
        showAlert(`You can only group up to ${MAX_TEAM_SELECTION} participants.`, 'error');
        return;
      }
      state.selectedParticipants.add(id);
      if (!state.leaderParticipantId) state.leaderParticipantId = id;
    } else {
      state.selectedParticipants.delete(id);
      if (state.leaderParticipantId === id) {
        const next = state.selectedParticipants.values().next().value;
        state.leaderParticipantId = next ?? null;
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
    teamList.innerHTML = state.teams.map(team => {
      const participants = Array.isArray(team.participants) ? team.participants : [];
      const leader = participants.find(p => p.role === 'leader') || participants[0];
      const others = participants.filter(p => p.id !== leader?.id);
      const seat = team.seat_number || '';
      const markLabel = team.attendance_marked ? 'Reassign seat' : 'Mark present';
      const clearBtn = team.attendance_marked
        ? `<button class="button button--ghost" data-action="clear" data-team-id="${team.id}">Clear attendance</button>`
        : '';

      return `
        <li class="card card--team" data-team-id="${team.id}">
          <header class="card__header">
            <h3>${team.name}</h3>
            <span class="tag">${team.source || 'Unknown'}</span>
          </header>
          <div class="card__body">
            <strong>Lead:</strong> ${leader?.name || 'Unknown'}
          </div>
          <footer class="card__footer">
            <label>Seat <input type="text" class="seat-input ${team.attendance_marked ? 'seat-present' : ''}" data-team-id="${team.id}" value="${escapeAttribute(seat)}"></label>
            <button class="button" data-action="mark" data-team-id="${team.id}">${markLabel}</button>
            ${clearBtn}
          </footer>
        </li>`;
    }).join('');

    teamList.querySelectorAll('button[data-action="mark"]').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.dataset.teamId;
        const seatInput = teamList.querySelector(`.seat-input[data-team-id="${id}"]`);
        await handleAttendance(id, true, seatInput?.value.trim() || '');
      });
    });

    teamList.querySelectorAll('button[data-action="clear"]').forEach(btn => {
      btn.addEventListener('click', async e => handleAttendance(e.currentTarget.dataset.teamId, false));
    });
  }

  // ==== ATTENDANCE ====
  async function handleAttendance(teamId, present, seatNumber = '') {
    clearAlert();
    try {
      const res = await fetch(api('/api/admin/attendance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': state.adminKey },
        body: JSON.stringify({ teamId, present, seatNumber })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to update attendance');
      showAlert(present ? `Team marked present (Seat ${data.seatNumber || 'pending'})` : 'Attendance cleared', 'success');
      await loadView('teams');
    } catch (err) {
      showAlert(err.message || 'Unable to update attendance.', 'error');
    }
  }

  // ==== EXPORT ====
  async function exportCurrentView() {
    if (!state.adminKey) return showAlert('Unlock the dashboard first.', 'error');
    clearAlert();
    try {
      const format = (document.getElementById('export-format') || {}).value || 'csv';
      const res = await fetch(api(`/api/admin/export?view=${state.view}&format=${encodeURIComponent(format)}`), {
        headers: { 'x-admin-key': state.adminKey }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kickstart-${state.view}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showAlert('CSV downloaded successfully.', 'success');
    } catch (err) {
      showAlert(err.message || 'Unable to download CSV.', 'error');
    }
  }

  // ==== TEAM CREATION ====
  async function submitTeamUp() {
    clearAlert();
    const name = teamUpName.value.trim();
    if (state.selectedParticipants.size < 2) return showAlert('Select at least two participants.', 'error');
    if (!name) return showAlert('Enter a team name.', 'error');
    const ids = [...state.selectedParticipants];
    if (ids.length > MAX_TEAM_SELECTION) return showAlert(`Max ${MAX_TEAM_SELECTION} participants.`, 'error');
    const leader = state.leaderParticipantId || ids[0];
    try {
      teamUpCreateButton.disabled = true;
      teamUpCreateButton.textContent = 'Creating…';
      const res = await fetch(api('/api/admin/team-up'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': state.adminKey },
        body: JSON.stringify({ participantIds: ids, teamName: name, leaderParticipantId: leader })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to create team');
      showAlert('Team created successfully.', 'success');
      resetSelection();
      await loadView('individuals');
      await loadView('teams');
    } catch (err) {
      showAlert(err.message || 'Unable to create team.', 'error');
    } finally {
      teamUpCreateButton.disabled = false;
      teamUpCreateButton.textContent = 'Create team from selection';
    }
  }

  // ==== EVENT LISTENERS ====
  authForm.addEventListener('submit', unlockDashboard);
  clearKeyButton.addEventListener('click', () => {
    localStorage.removeItem('kickstart-admin-key');
    adminKeyInput.value = '';
    state.adminKey = '';
    setDashboardEnabled(false);
    clearKeyButton.hidden = true;
    rememberKeyCheckbox.checked = false;
    adminKeyInfo.textContent = '';
    showAlert('Stored key cleared.', 'info');
  });

  tabs.forEach(tab => tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    if (view !== state.view) setView(view);
  }));

  refreshButton.addEventListener('click', () => loadView(state.view));
  exportButton.addEventListener('click', exportCurrentView);
  teamUpName.addEventListener('input', updateSelectionUI);
  teamUpCreateButton.addEventListener('click', submitTeamUp);

  // ==== INIT ====
  loadAdminKey();
  if (state.adminKey) {
    setDashboardEnabled(true);
    loadView(state.view);
  }
})();
