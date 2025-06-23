const { ipcRenderer } = require("electron");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const matricule = document.getElementById("matricule").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("error");
  
  
  errorEl.textContent = "";

  if (!matricule || !password) {
    errorEl.textContent = "Please enter both matricule and password.";
    return;
  }

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

    // Success: redirect based on role
    if (result.role === "clerk" || result.role === "judge") {
      localStorage.setItem("user_name", result.user.name);
      localStorage.setItem("matricule", result.user.matricule);
      localStorage.setItem("role", result.role);

      // Let Electron handle the redirection
      ipcRenderer.send("login-success", {
        role: result.role,
        name: result.user.name,
        matricule: matricule
      });
    } else {
      errorEl.textContent = "Unknown role. Contact admin.";
    }
    
  } catch (error) {
    console.error("Login error:", error);
    errorEl.textContent = "Unable to connect to server.";
  }
  
});



