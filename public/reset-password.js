(function () {
  const form = document.getElementById("resetPasswordForm");
  const statusBox = document.getElementById("resetPasswordStatus");
  const token = window.location.pathname.split("/").pop();

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `reset-status ${type || ""}`.trim();
  }

  function validatePassword(password) {
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (!/\d/.test(password)) {
      return "Password must include at least 1 number.";
    }

    if (!/[!@#$%^&*()+=\[{\]};:'",.<>/?\\|`~]/.test(password)) {
      return "Password must include at least 1 special character.";
    }

    if (/[_-]/.test(password)) {
      return "Password cannot contain _ or -.";
    }

    return "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = document.getElementById("resetPasswordInput").value;
    const confirmPassword = document.getElementById("resetConfirmPasswordInput").value;

    if (!password || !confirmPassword) {
      showStatus("Please fill all fields.", "error");
      return;
    }

    const validationMessage = validatePassword(password);
    if (validationMessage) {
      showStatus(validationMessage, "error");
      return;
    }

    if (password !== confirmPassword) {
      showStatus("Confirm password must match the new password.", "error");
      return;
    }

    showStatus("Updating password...", "pending");

    try {
      const response = await fetch(`/reset-password/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password,
          confirmPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showStatus(data.error || "Link expired or invalid", "error");
        return;
      }

      showStatus(data.message || "Password updated successfully", "success");

      window.setTimeout(() => {
        window.location.href = "/login.html";
      }, 1400);
    } catch (error) {
      showStatus("Something went wrong. Please try again.", "error");
    }
  });
})();
