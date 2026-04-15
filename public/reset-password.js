const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordInput = document.getElementById("resetPasswordInput");
const resetConfirmPasswordInput = document.getElementById("resetConfirmPasswordInput");
const resetStatusBox = document.getElementById("resetStatusBox");
const resetToken = window.location.pathname.split("/").pop();

if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", handleResetPasswordSubmit);
  setResetStatus("Enter your new password and confirm it to finish resetting your account.");
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();

  const payload = {
    password: resetPasswordInput.value,
    confirmPassword: resetConfirmPasswordInput.value
  };

  const validationError = validateResetPassword(payload);
  if (validationError) {
    setResetStatus(validationError, "error");
    return;
  }

  if (!resetToken || resetToken === "reset-password.html") {
    setResetStatus("Link expired or invalid", "error");
    return;
  }

  try {
    const response = await fetch(`/reset-password/${encodeURIComponent(resetToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Link expired or invalid");
    }

    resetPasswordForm.reset();
    setResetStatus("Password updated successfully", "success");
    window.setTimeout(() => {
      window.location.href = "/login.html";
    }, 1200);
  } catch (error) {
    setResetStatus(error.message, "error");
  }
}

function validateResetPassword(payload) {
  if (!payload.password || !payload.confirmPassword) {
    return "All fields are required.";
  }

  if (payload.password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (/[_-]/.test(payload.password)) {
    return "Password cannot contain underscore (_) or hyphen (-).";
  }

  if (!/\d/.test(payload.password) || !/[^\w\s]/.test(payload.password)) {
    return "Password must include at least one number and one special character.";
  }

  if (payload.password !== payload.confirmPassword) {
    return "Confirm password must match the new password.";
  }

  return "";
}

function setResetStatus(message, type) {
  resetStatusBox.textContent = message;
  resetStatusBox.className = "status-box";

  if (type) {
    resetStatusBox.classList.add(type);
  }
}
