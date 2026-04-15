const authForm = document.getElementById("authForm");
const nameInput = document.getElementById("nameInput");
const contactInput = document.getElementById("contactInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const statusBox = document.getElementById("statusBox");

if (authForm) {
  authForm.addEventListener("submit", handleSignupSubmit);
  contactInput.addEventListener("input", keepOnlyDigits);
  restoreInitialStatus();
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  localStorage.removeItem("messageSystemUser");

  const payload = {
    name: nameInput.value.trim(),
    phone: contactInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value,
    confirmPassword: confirmPasswordInput.value
  };

  const validationError = validateSignupForm(payload);
  if (validationError) {
    setStatus(validationError, "error");
    return;
  }

  try {
    setStatus("Creating your account...", "");

    const response = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not create your account.");
    }

    localStorage.setItem("messageSystemUser", JSON.stringify(data.user));
    authForm.reset();
    setStatus("Account created successfully. Redirecting to your dashboard...", "success");

    window.setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 800);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function keepOnlyDigits() {
  contactInput.value = contactInput.value.replace(/\D/g, "").slice(0, 10);
}

function validateSignupForm(payload) {
  if (!payload.name) {
    return "Full name is required.";
  }

  if (payload.name.length < 2) {
    return "Enter a valid full name.";
  }

  if (!/^\d{10}$/.test(payload.phone)) {
    return "Contact number must be exactly 10 digits.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "Enter a valid email address.";
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

function restoreInitialStatus() {
  setStatus("Use your name, 10-digit mobile number, Gmail, and a strong password to create your QuickSend account.");
}

function setStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = "status-box";

  if (type) {
    statusBox.classList.add(type);
  }
}
