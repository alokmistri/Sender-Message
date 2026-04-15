const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmailInput = document.getElementById("adminEmailInput");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminLoginStatus = document.getElementById("adminLoginStatus");

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmailInput.value,
        password: adminPasswordInput.value
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to login as admin");
    }

    localStorage.setItem("messageSystemAdmin", JSON.stringify(data.admin));
    setAdminLoginStatus("Admin login successful.", "success");
    window.setTimeout(() => {
      window.location.href = "/admin-dashboard.html";
    }, 500);
  } catch (error) {
    setAdminLoginStatus(error.message, "error");
  }
});

setAdminLoginStatus("Use separate admin credentials to continue.");

function setAdminLoginStatus(message, type) {
  adminLoginStatus.textContent = message;
  adminLoginStatus.className = "status-box";
  if (type) {
    adminLoginStatus.classList.add(type);
  }
}
