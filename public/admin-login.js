(function () {
  const form = document.getElementById("adminLoginForm");
  const statusBox = document.getElementById("adminLoginStatus");

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `admin-status ${type || ""}`.trim();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("adminEmailInput").value.trim();
    const password = document.getElementById("adminPasswordInput").value;

    if (!email || !password) {
      showStatus("Enter admin email and password.", "error");
      return;
    }

    showStatus("Signing in...", "pending");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Invalid admin credentials.");
      }

      localStorage.setItem("quicksendAdmin", JSON.stringify(data.admin));
      window.location.href = "/admin-ads.html";
    } catch (error) {
      showStatus(error.message || "Invalid admin credentials.", "error");
    }
  });
})();
