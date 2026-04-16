(function () {
  const form = document.getElementById("forgotPasswordForm");
  const statusBox = document.getElementById("forgotPasswordStatus");

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `forgot-status ${type || ""}`.trim();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const credential = document.getElementById("forgotCredentialInput").value.trim();

    if (!credential) {
      showStatus("Enter your Email or Contact Number.", "error");
      return;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credential);
    const phoneDigits = credential.replace(/\D/g, "");
    const isPhone = /^\d{10}$/.test(phoneDigits);

    if (!isEmail && !isPhone) {
      showStatus("Enter a valid Email or 10-digit Contact Number.", "error");
      return;
    }

    showStatus("Sending reset link...", "pending");

    try {
      const response = await fetch("/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          credential: isPhone ? phoneDigits : credential
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showStatus(data.error || "Could not send reset link.", "error");
        return;
      }

      showStatus(data.message || "Reset link sent successfully.", "success");
    } catch (error) {
      showStatus("Something went wrong. Please try again.", "error");
    }
  });
})();
