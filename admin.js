// =============================
//  ADMIN DASHBOARD SCRIPT (FIXED)
// =============================

document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ admin.js loaded and DOM ready");

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

  // ==== ADMIN KEY LOGIN LOGIC ====
  const correctKey = "test123"; // 🔑 Replace this with your real admin key
  const savedKey = localStorage.getItem("adminKey");

  // Auto-login if saved key is valid
  if (savedKey === correctKey) {
    unlockDashboard();
    adminKeyInfo.textContent = "🔓 Logged in using saved key.";
  }

  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const enteredKey = adminKeyInput.value.trim();

    if (enteredKey === correctKey) {
      if (rememberKeyCheckbox.checked) {
        localStorage.setItem("adminKey", enteredKey);
      }
      unlockDashboard();
      showAlert("✅ Dashboard unlocked successfully!");
    } else {
      showAlert("❌ Invalid access key. Try again.");
    }
  });

  clearKeyButton.addEventListener("click", () => {
    localStorage.removeItem("adminKey");
    adminKeyInput.value = "";
    adminKeyInfo.textContent = "🗑️ Saved key cleared.";
  });

  // ==== FUNCTION DEFINITIONS ====
  function unlockDashboard() {
    dashboard.classList.remove("is-disabled");
    dashboard.removeAttribute("aria-disabled");
    authForm.style.display = "none";
    adminAlert.hidden = false;
    adminAlert.textContent = "Welcome, Organizer 👋";
  }

  function showAlert(message) {
    adminAlert.hidden = false;
    adminAlert.textContent = message;
  }

  // ==== PLACEHOLDER LISTENERS (optional, extend later) ====
  refreshButton?.addEventListener("click", () => {
    viewStatus.textContent = "Refreshing data...";
    setTimeout(() => (viewStatus.textContent = "Data refreshed ✅"), 1000);
  });

  exportButton?.addEventListener("click", () => {
    viewStatus.textContent = "Preparing export...";
    setTimeout(() => (viewStatus.textContent = "Export complete ✅"), 1000);
  });

  tabs?.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const targetView = tab.dataset.view;
      document.querySelectorAll(".admin-view").forEach(v => {
        v.classList.toggle("is-hidden", v.dataset.view !== targetView);
      });
    });
  });

  console.log("✅ Admin login logic initialized");
});
