const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminGreeting = document.getElementById("adminGreeting");
const metricUsers = document.getElementById("metricUsers");
const metricCredits = document.getElementById("metricCredits");
const metricRevenue = document.getElementById("metricRevenue");
const metricProviderCost = document.getElementById("metricProviderCost");
const metricProfit = document.getElementById("metricProfit");
const metricJobs = document.getElementById("metricJobs");
const adminStatus = document.getElementById("adminStatus");
const adminPaymentsList = document.getElementById("adminPaymentsList");
const adminMessagesList = document.getElementById("adminMessagesList");

const admin = getAdmin();

if (!admin) {
  window.location.href = "/admin-login.html";
} else {
  adminGreeting.textContent = `Welcome, ${admin.email}`;
  loadAdminSummary();
}

adminLogoutBtn.addEventListener("click", () => {
  localStorage.removeItem("messageSystemAdmin");
  window.location.href = "/admin-login.html";
});

async function loadAdminSummary() {
  try {
    const response = await fetch(`/api/admin/summary?email=${encodeURIComponent(admin.email)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not load admin dashboard");
    }

    metricUsers.textContent = String(data.summary.usersCount || 0);
    metricCredits.textContent = `INR ${Number(data.summary.totalCredits || 0)}`;
    metricRevenue.textContent = `INR ${Number(data.summary.totalDebits || 0)}`;
    metricProviderCost.textContent = `INR ${Number(data.summary.providerCost || 0)}`;
    metricProfit.textContent = `INR ${Number(data.summary.grossProfit || 0)}`;
    metricJobs.textContent = String(data.summary.messageCount || 0);

    renderPayments(data.recentPayments || []);
    renderMessages(data.recentMessages || []);
    setAdminStatus("Admin dashboard loaded successfully.");
  } catch (error) {
    setAdminStatus(error.message, "error");
  }
}

function renderPayments(payments) {
  if (!payments.length) {
    adminPaymentsList.innerHTML = `<div class="history-item empty-history">No payments yet.</div>`;
    return;
  }

  adminPaymentsList.innerHTML = payments
    .map((payment) => `
      <div class="history-item">
        <div>
          <strong>${payment.userEmail}</strong>
          <p>${formatDate(payment.createdAt)}</p>
          <p>${payment.paymentId}</p>
        </div>
        <span class="history-amount credit">+ INR ${payment.amount}</span>
      </div>
    `)
    .join("");
}

function renderMessages(messages) {
  if (!messages.length) {
    adminMessagesList.innerHTML = `<div class="history-item empty-history">No messages yet.</div>`;
    return;
  }

  adminMessagesList.innerHTML = messages
    .map((job) => `
      <div class="history-item history-job">
        <div>
          <strong>${job.jobId}</strong>
          <p>${job.userEmail}</p>
          <p>${job.recipientCount} recipients | ${formatDate(job.createdAt)}</p>
        </div>
        <span class="history-status">${job.status}</span>
      </div>
    `)
    .join("");
}

function getAdmin() {
  try {
    return JSON.parse(localStorage.getItem("messageSystemAdmin") || "null");
  } catch (error) {
    return null;
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-IN");
}

function setAdminStatus(message, type) {
  adminStatus.textContent = message;
  adminStatus.className = "status-box";
  if (type) {
    adminStatus.classList.add(type);
  }
}
