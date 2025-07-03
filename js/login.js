const { ipcRenderer } = require("electron");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const matricule = document.getElementById("matricule").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("error");
  const loginBtn = document.getElementById("loginBtn");
  
  errorEl.textContent = "";

  if (!matricule || !password) {
    errorEl.textContent = "Please enter both matricule and password.";
    return;
  }

  // Add loading state to button
  loginBtn.classList.add("btn-loading");
  loginBtn.textContent = "Logging in...";
  loginBtn.disabled = true;

  try {
    const response = await fetch("http://localhost:5001/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ matricule, password })
    });

    const result = await response.json();

    if (!result.success) {
      errorEl.textContent = result.message || "Login failed. Try again.";
      return;
    }

    // Success: proceed to facial recognition
    if (result.role === "clerk" || result.role === "judge") {
      // Store temporary user data for facial recognition
      localStorage.setItem("temp_user_name", result.user.name);
      localStorage.setItem("temp_matricule", result.user.matricule);
      localStorage.setItem("temp_role", result.role);

      // Redirect to facial recognition page
      window.location.href = `face-auth.html?matricule=${encodeURIComponent(result.user.matricule)}&name=${encodeURIComponent(result.user.name)}&role=${encodeURIComponent(result.role)}`;
    } else {
      errorEl.textContent = "Unknown role. Contact admin.";
    }
    
  } catch (error) {
    console.error("Login error:", error);
    errorEl.textContent = "Unable to connect to server.";
  } finally {
    // Remove loading state from button
    loginBtn.classList.remove("btn-loading");
    loginBtn.textContent = "Login";
    loginBtn.disabled = false;
  }
  
});



