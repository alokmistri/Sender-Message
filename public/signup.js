(function () {
  const form = document.getElementById("signupForm");
  const statusBox = document.getElementById("signupStatus");

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `signup-status ${type || ""}`.trim();
  }

  function sanitizePhone(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 10);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      name: document.getElementById("nameInput").value.trim(),
      contact: sanitizePhone(document.getElementById("contactInput").value),
      email: document.getElementById("emailInput").value.trim(),
      password: document.getElementById("passwordInput").value,
      confirmPassword: document.getElementById("confirmPasswordInput").value
    };

    if (!payload.name || !payload.contact || !payload.email || !payload.password || !payload.confirmPassword) {
      showStatus("Please fill all fields.", "error");
      return;
    }

    if (!/^\d{10}$/.test(payload.contact)) {
      showStatus("Phone number must be exactly 10 digits.", "error");
      return;
    }

    if (payload.password !== payload.confirmPassword) {
      showStatus("Confirm password must match password.", "error");
      return;
    }

    showStatus("Creating your account...", "pending");

    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        showStatus(data.error || "Could not create account.", "error");
        return;
      }

      showStatus(data.message || "Signup completed successfully.", "success");

      window.setTimeout(() => {
        window.location.href = "/login.html";
      }, 1200);
    } catch (error) {
      showStatus("Something went wrong. Please try again.", "error");
    }
  });
})();
