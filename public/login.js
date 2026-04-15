const loginForm = document.getElementById("loginForm");
const loginContactInput = document.getElementById("loginContactInput");
const loginEmailInput = document.getElementById("loginEmailInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const loginStatusBox = document.getElementById("loginStatusBox");

if (loginForm) {
  loginForm.addEventListener("submit", handleLoginSubmit);
  loginContactInput.addEventListener("input", keepOnlyDigits);
  setLoginStatus("Enter your phone number, Gmail, and password to continue.");
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const payload = {
    phone: loginContactInput.value.trim(),
    email: loginEmailInput.value.trim(),
    password: loginPasswordInput.value
  };

  const validationError = validateLoginForm(payload);
  if (validationError) {
    setLoginStatus(validationError, "error");
    return;
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Please check your credentials");
    }

    localStorage.setItem("messageSystemUser", JSON.stringify(data.user));
    setLoginStatus(`Login successful. Welcome back, ${data.user.name}.`, "success");
    window.setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 700);
  } catch (error) {
    setLoginStatus(error.message || "Please check your credentials", "error");
  }
}

function keepOnlyDigits() {
  loginContactInput.value = loginContactInput.value.replace(/\D/g, "").slice(0, 10);
}

function validateLoginForm(payload) {
  if (!payload.phone || !payload.email || !payload.password) {
    return "All fields are required.";
  }

  if (!/^\d{10}$/.test(payload.phone)) {
    return "Contact number must be exactly 10 digits.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "Enter a valid email address.";
  }

  return "";
}

function setLoginStatus(message, type) {
  loginStatusBox.textContent = message;
  loginStatusBox.className = "status-box";

  if (type) {
    loginStatusBox.classList.add(type);
  }
}
