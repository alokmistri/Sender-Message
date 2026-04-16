(function () {
  const form = document.getElementById("loginForm");
  const statusBox = document.getElementById("loginStatus");

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `login-status ${type || ""}`.trim();
  }

  function sanitizePhone(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 10);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      contact: sanitizePhone(document.getElementById("loginContactInput").value),
      email: document.getElementById("loginEmailInput").value.trim(),
      password: document.getElementById("loginPasswordInput").value
    };

    if (!payload.contact || !payload.email || !payload.password) {
      showStatus("Please fill all fields.", "error");
      return;
    }

    if (!/^\d{10}$/.test(payload.contact)) {
      showStatus("Contact number must be 10 digits.", "error");
      return;
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);
    if (!emailValid) {
      showStatus("Please enter a valid email.", "error");
      return;
    }

    showStatus("Checking your account...", "pending");

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        showStatus(data.error || "Please check your credentials", "error");
        return;
      }

      if (data.user) {
        localStorage.setItem("quicksendUser", JSON.stringify(data.user));
      }

      showStatus(data.message || "Login successful", "success");

      window.setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 1000);
    } catch (error) {
      showStatus("Something went wrong. Please try again.", "error");
    }
  });
})();
