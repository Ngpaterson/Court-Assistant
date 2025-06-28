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
      document.getElementById("content-area").innerHTML = `
        <div class="error-container">
          <div class="error-message">
            <i data-lucide="alert-triangle"></i>
            <span>Error loading content. Please try again.</span>
          </div>
        </div>
      `;
      console.error("View load error:", err);
      // Re-initialize icons after dynamic content load
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
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
  const modal = document.getElementById("scheduleModal");
  const form = document.getElementById("scheduleForm");
  const modalTitle = modal.querySelector("h3");
  
  // Hide modal
  modal.style.display = "none";
  
  // Reset form
  form.reset();
  
  // Clear edit-specific attributes
  delete form.dataset.proceedingId;
  delete form.dataset.isEdit;
  
  // Reset modal title
  modalTitle.textContent = "Schedule a Proceeding";
  
  // Reset any field states
  document.getElementById("plaintiffName").removeAttribute("readonly");
  const plaintiffTitle = document.getElementById("plaintiffTitle");
  if (plaintiffTitle) {
    plaintiffTitle.disabled = false;
  }
}

async function submitSchedule(event) {
  event.preventDefault();

  const form = document.getElementById("scheduleForm");
  const isEdit = form.dataset.isEdit === "true";
  const proceedingId = form.dataset.proceedingId;

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
    let res;
    if (isEdit) {
      // Update existing proceeding
      res = await fetch(`http://localhost:5001/api/proceedings/${proceedingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(scheduleData)
      });
    } else {
      // Create new proceeding
      res = await fetch("http://localhost:5001/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(scheduleData)
      });
    }

    const data = await res.json();

    if (res.ok) {
      const message = isEdit ? "Proceeding updated successfully!" : "Proceeding scheduled successfully!";
      showNotification(message, "success");
      closeModal(); // Hide modal and reset form
      loadProceedings(); // Reload the proceedings list
    } else {
      showNotification("Error: " + data.error, "error");
    }
  } catch (err) {
    console.error("Error submitting proceeding:", err);
    showNotification("Server error. Please try again.", "error");
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
        <div class="card-header">
          <div class="card-title">Case No. ${p.case_number}</div>
          <div class="card-actions">
            <button class="action-btn edit-btn" onclick="event.stopPropagation(); editProceeding('${p.proceeding_id}')" title="Edit Proceeding">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="action-btn delete-btn" onclick="event.stopPropagation(); deleteProceeding('${p.proceeding_id}', '${p.case_number}')" title="Delete Proceeding">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
        <div class="card-meta">
          ${p.plaintiff.appelation} ${p.plaintiff.name}
          vs ${p.defendant.appelation} ${p.defendant.name}
        </div>
        <div class="card-meta">
          <i data-lucide="calendar"></i>
          <span>${date}</span>
          <i data-lucide="clock" style="margin-left: 1rem;"></i>
          <span>${time}</span>
        </div>
        <div class="card-meta">
          <i data-lucide="user-check"></i>
          <span>Judge: ${p.judge_name}</span>
        </div>
        <div class="card-meta">
          <i data-lucide="tag"></i>
          <span>Charges: ${p.charges}</span>
        </div>
      `;

      card.addEventListener("click", () => {
        openTranscript(p.proceeding_id);
      });

      container.appendChild(card);
    });

    // Re-initialize Lucide icons after dynamic content
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // update the case count badge
    const count = procs.length;
    document.getElementById("case-count").textContent =
      `${count} case${count !== 1 ? "s" : ""}`;

  } catch (err) {
    console.error("Failed to load proceedings:", err);
  }
}

// Logout Modal Functions
function openLogoutModal() {
  document.getElementById("logoutModal").style.display = "flex";
  // Re-initialize icons in modal
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function closeLogoutModal() {
  document.getElementById("logoutModal").style.display = "none";
}

function confirmLogout() {
  try {
    // Close the modal immediately
    closeLogoutModal();
    
    // Clear all stored user data
    localStorage.removeItem("user_name");
    localStorage.removeItem("matricule");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_id");
    
    // Clear any session storage
    sessionStorage.clear();
    
    // Navigate immediately without showing success message
    // Try Electron API first
    if (window.electronAPI && window.electronAPI.navigateToLogin) {
      console.log("Using Electron navigation to login");
      window.electronAPI.navigateToLogin();
    } else {
      console.log("Using fallback navigation to login");
      // Fallback navigation for web/testing
      setTimeout(() => {
        window.location.href = "login.html";
      }, 100);
    }
    
  } catch (error) {
    console.error("Error during logout:", error);
    showNotification("Error during logout. Please try again.", "error");
  }
}

// Close modal when clicking outside of it
window.addEventListener("click", (event) => {
  const logoutModal = document.getElementById("logoutModal");
  const deleteModal = document.getElementById("deleteConfirmModal");
  
  if (event.target === logoutModal) {
    closeLogoutModal();
  }
  
  if (event.target === deleteModal) {
    closeDeleteModal();
  }
});

// Utility function for better notifications
function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  
  const icon = type === "success" ? "check-circle" : 
               type === "error" ? "x-circle" : 
               "info";
               
  notification.innerHTML = `
    <div class="notification-content">
      <i data-lucide="${icon}"></i>
      <span>${message}</span>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Initialize icon
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  // Show notification
  setTimeout(() => notification.classList.add("show"), 100);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => document.body.removeChild(notification), 300);
  }, 3000);
}

// Edit proceeding functionality
async function editProceeding(proceedingId) {
  try {
    // First fetch the proceeding details
    const res = await fetch(`http://localhost:5001/api/proceedings/${proceedingId}`);
    const proceeding = await res.json();
    
    if (!res.ok) {
      showNotification("Error fetching proceeding details", "error");
      return;
    }
    
    // Populate the schedule form with existing data
    document.getElementById("caseNumber").value = proceeding.case_number;
    document.getElementById("caseType").value = proceeding.case_type;
    document.getElementById("plaintiffAppelation").value = proceeding.plaintiff.appelation;
    document.getElementById("plaintiffName").value = proceeding.plaintiff.name;
    document.getElementById("defendantAppelation").value = proceeding.defendant.appelation;
    document.getElementById("defendantName").value = proceeding.defendant.name;
    document.getElementById("charges").value = proceeding.charges;
    document.getElementById("judgeDropdown").value = proceeding.judge_matricule;
    
    // Format datetime for input field
    const [date] = proceeding.schedule_datetime.split("T");
    document.getElementById("scheduleDatetime").value = date;
    
    // Change modal title and form behavior
    const modal = document.getElementById("scheduleModal");
    const modalTitle = modal.querySelector("h3");
    modalTitle.textContent = "Edit Proceeding";
    
    // Store proceeding ID for update
    const form = document.getElementById("scheduleForm");
    form.dataset.proceedingId = proceedingId;
    form.dataset.isEdit = "true";
    
    // Open modal and populate judges
    await populateJudgeDropdown();
    modal.style.display = "flex";
    
  } catch (error) {
    console.error("Error editing proceeding:", error);
    showNotification("Error loading proceeding for editing", "error");
  }
}

// Delete proceeding functionality
function deleteProceeding(proceedingId, caseNumber) {
  // Create and show confirmation modal
  const confirmModal = document.createElement("div");
  confirmModal.className = "modal-overlay";
  confirmModal.id = "deleteConfirmModal";
  
  confirmModal.innerHTML = `
    <div class="modal-content delete-modal-content">
      <div class="delete-modal-header">
        <div class="delete-modal-icon-container">
          <i data-lucide="trash-2" class="delete-modal-icon"></i>
        </div>
        <h3>Delete Proceeding</h3>
        <p class="delete-modal-subtitle">Are you sure you want to delete this proceeding?</p>
      </div>
      <div class="delete-modal-body">
        <div class="delete-warning">
          <i data-lucide="alert-triangle" class="warning-icon"></i>
          <span>Case No. <strong>${caseNumber}</strong> will be permanently deleted</span>
        </div>
        <div class="delete-warning">
          <i data-lucide="alert-circle" class="warning-icon"></i>
          <span>This action cannot be undone</span>
        </div>
      </div>
      <div class="modal-actions delete-modal-actions">
        <button type="button" class="btn-secondary" onclick="closeDeleteModal()">
          <i data-lucide="x"></i>
          <span>Cancel</span>
        </button>
        <button type="button" class="btn-danger" onclick="confirmDelete('${proceedingId}', '${caseNumber}')">
          <i data-lucide="trash-2"></i>
          <span>Delete</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(confirmModal);
  
  // Initialize icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  // Show modal
  confirmModal.style.display = "flex";
}

function closeDeleteModal() {
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) {
    modal.style.display = "none";
    document.body.removeChild(modal);
  }
}

async function confirmDelete(proceedingId, caseNumber) {
  try {
    const res = await fetch(`http://localhost:5001/api/proceedings/${proceedingId}`, {
      method: "DELETE"
    });
    
    if (res.ok) {
      showNotification(`Case ${caseNumber} deleted successfully`, "success");
      closeDeleteModal();
      // Reload proceedings to update the display
      loadProceedings();
    } else {
      const data = await res.json();
      showNotification(`Error deleting proceeding: ${data.error}`, "error");
    }
  } catch (error) {
    console.error("Error deleting proceeding:", error);
    showNotification("Server error. Please try again.", "error");
  }
}
