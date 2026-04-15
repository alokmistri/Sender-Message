const forgotForm = document.getElementById("forgotForm");
const forgotCredentialInput = document.getElementById("forgotCredentialInput");
const forgotStatusBox = document.getElementById("forgotStatusBox");

if (forgotForm) {
  forgotForm.addEventListener("submit", handleForgotPasswordSubmit);
  setForgotStatus("Enter your registered Gmail or 10-digit contact number to receive a password reset link.");
}

async function handleForgotPasswordSubmit(event) {
  event.preventDefault();

  const credential = forgotCredentialInput.value.trim();
  const validationError = validateCredential(credential);
  if (validationError) {
    setForgotStatus(validationError, "error");
    return;
  }

  try {
    const response = await fetch("/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not send reset link.");
    }

    forgotForm.reset();
    setForgotStatus(data.message, "success");
  } catch (error) {
    setForgotStatus(error.message, "error");
  }
}

function validateCredential(value) {
  if (!value) {
    return "Enter your Email or Contact Number.";
  }

  const isPhone = /^\d{10}$/.test(value);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  if (!isPhone && !isEmail) {
    return "Enter a valid Email or 10-digit Contact Number.";
  }

  return "";
}

function setForgotStatus(message, type) {
  forgotStatusBox.textContent = message;
  forgotStatusBox.className = "status-box";

  if (type) {
    forgotStatusBox.classList.add(type);
  }
}
