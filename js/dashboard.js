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
      alert("✅ Proceeding scheduled successfully!");
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
        <div class="card-meta">📅 ${date} | 🕘 ${time}</div>
        <div class="card-meta">👨‍⚖️ Judge: ${p.judge_name}</div>
        <div class="card-meta">🏷️ Charges: ${p.charges}</div>
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
