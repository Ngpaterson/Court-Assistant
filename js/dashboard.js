// Load default view on page load
window.addEventListener("DOMContentLoaded", () => {
  loadView("schedule");
  displayUserName();
});

// Use Electron preload-exposed API
function openTranscript(proceedingId) {
  if (window.electronAPI && window.electronAPI.openTranscript) {
    window.electronAPI.openTranscript(proceedingId);
  } else {
    console.error("electronAPI not available");
  }
}
function loadView(viewName) {
  // Highlight selected menu item
  document.querySelectorAll("#menu li").forEach(li => {
    li.classList.remove("active");
  });

  const selected = [...document.querySelectorAll("#menu li")].find(li =>
    li.textContent.toLowerCase().includes(viewName)
  );
  if (selected) selected.classList.add("active");

  // Load the corresponding HTML view
  fetch(`components/${viewName}.html`)
    .then(response => response.text())
    .then(html => {
      document.getElementById("content-area").innerHTML = html;
      if (viewName === "schedule") {
         loadProceedings();
      }
    })
    .catch(err => {
      document.getElementById("content-area").innerHTML = "<p>⚠ Error loading content.</p>";
      console.error("View load error:", err);
    });
}

// Display logged-in user's name from session/localStorage
function displayUserName() {
  // Example: Set during login like:
  // localStorage.setItem("user_name", "MVE Didier");

  const name = localStorage.getItem("user_name") || "Clerk";
  document.getElementById("username").textContent = name;
}

// Optional: Language switching placeholder
function switchLang(lang) {
  alert(`Language switched to ${lang.toUpperCase()}`);
}

// Logout functionality
function logout() {
  showLogoutConfirmation();
}

// Custom confirmation dialog for logout
function showLogoutConfirmation() {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'logout-modal-overlay';
  
  // Create modal content
  overlay.innerHTML = `
    <div class="logout-modal-content">
      <div class="logout-modal-header">
        <h3>Confirm Logout</h3>
      </div>
      <div class="logout-modal-body">
        <p>Are you sure you want to logout?</p>
      </div>
      <div class="logout-modal-actions">
        <button class="logout-cancel-btn" onclick="closeLogoutModal()">Cancel</button>
        <button class="logout-confirm-btn" onclick="confirmLogout()">Logout</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Show modal with animation
  setTimeout(() => {
    overlay.classList.add('show');
  }, 10);
}

function closeLogoutModal() {
  const modal = document.querySelector('.logout-modal-overlay');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

function confirmLogout() {
  // Clear all stored user data
  localStorage.removeItem("user_name");
  localStorage.removeItem("matricule");
  localStorage.removeItem("temp_user_name");
  localStorage.removeItem("temp_matricule");
  localStorage.removeItem("temp_role");
  
  // Clear any other session data
  sessionStorage.clear();
  
  // Close modal and redirect directly
  closeLogoutModal();
  
  // Small delay to allow modal to close, then redirect
  setTimeout(() => {
    window.location.href = "login.html";
  }, 100);
}

async function openScheduleModal() {
  document.getElementById("scheduleModal").style.display = "flex";
  await populateJudgeDropdown(); // fetch and populate judges
}

async function populateJudgeDropdown() {
  try {
    const res = await fetch('http://localhost:5001/api/judges');
    const data = await res.json();

    const judgeSelect = document.getElementById("judgeDropdown");
    judgeSelect.innerHTML = ''; // Clear old options

    data.forEach(judge => {
      const option = document.createElement('option');
      option.value = judge.matricule;
      option.textContent = `${judge.name} (${judge.matricule})`;
      judgeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Failed to fetch judges:", error);
  }
}


function closeModal() {
  document.getElementById("scheduleModal").style.display = "none";
  document.getElementById("scheduleForm").reset();
  document.getElementById("plaintiffName").removeAttribute("readonly");
  document.getElementById("plaintiffTitle").disabled = false;
}

async function submitSchedule(event) {
  event.preventDefault();

  const caseType = document.getElementById("caseType").value;
  const plaintiffAppelation = document.getElementById("plaintiffAppelation").value;
  const plaintiffName = document.getElementById("plaintiffName").value;
  const defendantAppelation = document.getElementById("defendantAppelation").value;
  const defendantName = document.getElementById("defendantName").value;
  const judgeMatricule = document.getElementById("judgeDropdown").value;
  const charges = document.getElementById("charges").value;
  const scheduleDatetime = document.getElementById("scheduleDatetime").value;
  const caseNumber = document.getElementById("caseNumber").value;
  const clerkMatricule = localStorage.getItem("matricule"); // from login

  const scheduleData = {
    case_number: caseNumber,
    case_type: caseType,
    plaintiff_appelation: plaintiffAppelation,
    plaintiff_name: plaintiffName,
    defendant_appelation: defendantAppelation,
    defendant_name: defendantName,
    judge_matricule: judgeMatricule,
    charges: charges,
    schedule_datetime: scheduleDatetime,
    clerk_matricule: clerkMatricule
  };

  try {
    const res = await fetch("http://localhost:5001/api/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(scheduleData)
    });

    const data = await res.json();

    if (res.ok) {
      alert("Proceeding scheduled successfully!");
      document.getElementById("scheduleForm").reset();
      closeModal(); // Hide modal
      // Optional: reload or refresh list of proceedings
    } else {
      alert("❌ Error: " + data.error);
    }
  } catch (err) {
    console.error("Error scheduling proceeding:", err);
    alert("❌ Server error. Please try again.");
  }
}

// Search/filter function for cases
function filterCases() {
  const query = document.getElementById("search-case").value.toLowerCase().trim();
  const cards = document.querySelectorAll("#schedule-container .card");
  let visibleCount = 0;

  cards.forEach(card => {
    const caseNo = card.dataset.case ? card.dataset.case.toLowerCase() : '';
    const match = query === '' || caseNo.includes(query);
    card.style.display = match ? "block" : "none";
    if (match) visibleCount++;
  });

  // Update the case count display
  const caseCountElement = document.getElementById("case-count");
  if (caseCountElement) {
    caseCountElement.textContent = `${visibleCount} case${visibleCount !== 1 ? 's' : ''}`;
  }
}

async function loadProceedings() {
  const clerkMat = localStorage.getItem("matricule");
  try {
    const res = await fetch(
      `http://localhost:5001/api/proceedings?clerk_matricule=${clerkMat}`
    );
    const procs = await res.json();

    const container = document.getElementById("schedule-container");
    container.innerHTML = "";

    procs.forEach(p => {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.case = p.case_number;

      // format date/time
      const [date, time] = p.schedule_datetime.split("T");

      card.innerHTML = `
        <div class="card-title">Case No. ${p.case_number}</div>
        <div class="card-meta">
          ${p.plaintiff.appelation} ${p.plaintiff.name}
          vs ${p.defendant.appelation} ${p.defendant.name}
        </div>
        <div class="card-meta"><i class="fas fa-calendar"></i> ${date} | <i class="fas fa-clock"></i> ${time}</div>
        <div class="card-meta"><i class="fas fa-user-tie"></i> Judge: ${p.judge_name}</div>
        <div class="card-meta"><i class="fas fa-gavel"></i> Charges: ${p.charges}</div>
      `;

      card.addEventListener("click", () => {
        openTranscript(p.proceeding_id);
      });

      container.appendChild(card);
    });

    // update the case count badge
    const count = procs.length;
    document.getElementById("case-count").textContent =
      `${count} case${count !== 1 ? "s" : ""}`;

  } catch (err) {
    console.error("Failed to load proceedings:", err);
  }
}
