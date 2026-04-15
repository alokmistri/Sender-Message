const logoutBtn = document.getElementById("logoutBtn");
const dashboardGreeting = document.getElementById("dashboardGreeting");
const dashboardSubtext = document.getElementById("dashboardSubtext");
const dashboardName = document.getElementById("dashboardName");
const dashboardUserId = document.getElementById("dashboardUserId");
const dashboardContact = document.getElementById("dashboardContact");
const dashboardEmail = document.getElementById("dashboardEmail");
const dashboardBalance = document.getElementById("dashboardBalance");
const dashboardDob = document.getElementById("dashboardDob");
const dashboardBusinessName = document.getElementById("dashboardBusinessName");
const dashboardBusinessType = document.getElementById("dashboardBusinessType");
const dashboardProfileImage = document.getElementById("dashboardProfileImage");
const dashboardStatus = document.getElementById("dashboardStatus");
const walletButtons = document.querySelectorAll("[data-amount]");
const walletHistoryList = document.getElementById("walletHistoryList");
const messageHistoryList = document.getElementById("messageHistoryList");
const profileForm = document.getElementById("profileForm");
const profileImageInput = document.getElementById("profileImageInput");
const walletCardBtn = document.getElementById("walletCardBtn");
const walletModal = document.getElementById("walletModal");
const closeWalletModalBtn = document.getElementById("closeWalletModalBtn");
const toggleEditProfileBtn = document.getElementById("toggleEditProfileBtn");
const cancelEditProfileBtn = document.getElementById("cancelEditProfileBtn");
const dobInput = document.getElementById("dobInput");
const businessNameInput = document.getElementById("businessNameInput");
const businessTypeInput = document.getElementById("businessTypeInput");

const DEFAULT_PROFILE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7b61ff" />
          <stop offset="100%" stop-color="#29c4ff" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="34" fill="url(#g)" />
      <circle cx="80" cy="62" r="28" fill="rgba(255,255,255,0.94)" />
      <path d="M34 132c8-25 28-38 46-38s38 13 46 38" fill="rgba(255,255,255,0.94)" />
    </svg>
  `);

const rawUser = localStorage.getItem("messageSystemUser");

if (!rawUser) {
  window.location.href = "/login.html";
} else {
  initializeDashboard();
}

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("messageSystemUser");
  window.location.href = "/login.html";
});

walletCardBtn.addEventListener("click", () => {
  window.location.href = "/wallet.html";
});

if (closeWalletModalBtn && walletModal) {
  closeWalletModalBtn.addEventListener("click", closeWalletModal);
  walletModal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-wallet")) {
      closeWalletModal();
    }
  });
}

toggleEditProfileBtn.addEventListener("click", () => {
  profileForm.classList.remove("hidden");
});

cancelEditProfileBtn.addEventListener("click", () => {
  profileForm.classList.add("hidden");
  populateProfileForm(getStoredUser());
});

profileForm.addEventListener("submit", handleProfileUpdate);
profileImageInput.addEventListener("change", handleImageUpload);

for (const button of walletButtons) {
  button.addEventListener("click", async () => {
    const user = getStoredUser();
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    try {
      const amount = Number(button.dataset.amount);
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not start payment");
      }

      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "QuickSend",
        description: `Add INR ${amount} to wallet`,
        order_id: data.orderId,
        prefill: {
          name: data.user.name,
          email: data.user.email,
          contact: data.user.contact
        },
        theme: {
          color: "#695cff"
        },
        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: data.user.email,
                amount,
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature
              })
            });

            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok) {
              throw new Error(verifyData.error || "Payment verification failed");
            }

            localStorage.setItem("messageSystemUser", JSON.stringify(verifyData.user));
            renderDashboard(verifyData.user);
            populateProfileForm(verifyData.user);
            await loadHistory(verifyData.user.email);
            closeWalletModal();
            setDashboardStatus(`Wallet updated. Added INR ${amount}.`, "success");
          } catch (error) {
            setDashboardStatus(error.message, "error");
          }
        }
      });

      checkout.open();
    } catch (error) {
      setDashboardStatus(error.message, "error");
    }
  });
}

async function initializeDashboard() {
  setDashboardStatus("Loading your dashboard...", "");

  try {
    const user = getStoredUser();
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    const response = await fetch(`/dashboard?email=${encodeURIComponent(user.email)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load dashboard");
    }

    localStorage.setItem("messageSystemUser", JSON.stringify(data.user));
    renderDashboard(data.user);
    populateProfileForm(data.user);
    await loadHistory(data.user.email);
    setDashboardStatus("Dashboard loaded successfully.");
  } catch (error) {
    setDashboardStatus(error.message || "Could not load dashboard.", "error");
  }
}

async function handleProfileUpdate(event) {
  event.preventDefault();

  const user = getStoredUser();
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  try {
    const response = await fetch("/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        dob: dobInput.value,
        businessName: businessNameInput.value.trim(),
        businessType: businessTypeInput.value.trim()
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not update profile.");
    }

    localStorage.setItem("messageSystemUser", JSON.stringify(data.user));
    renderDashboard(data.user);
    populateProfileForm(data.user);
    profileForm.classList.add("hidden");
    setDashboardStatus("Profile updated successfully.", "success");
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  const user = getStoredUser();
  if (!file || !user) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setDashboardStatus("Please upload a valid image file.", "error");
    return;
  }

  try {
    setDashboardStatus("Uploading profile image...", "");
    const fileContentBase64 = await readFileAsBase64(file);

    const response = await fetch("/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        fileName: file.name,
        fileContentBase64
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not upload image.");
    }

    localStorage.setItem("messageSystemUser", JSON.stringify(data.user));
    renderDashboard(data.user);
    populateProfileForm(data.user);
    setDashboardStatus("Profile image updated successfully.", "success");
  } catch (error) {
    setDashboardStatus(error.message, "error");
  } finally {
    profileImageInput.value = "";
  }
}

async function loadHistory(email) {
  const [walletResponse, messageResponse] = await Promise.all([
    fetch(`/api/wallet/history?email=${encodeURIComponent(email)}`),
    fetch(`/api/messages/history?email=${encodeURIComponent(email)}`)
  ]);

  const walletData = await walletResponse.json();
  const messageData = await messageResponse.json();

  renderWalletHistory(walletData.transactions || []);
  renderMessageHistory(messageData.jobs || []);
}

function renderWalletHistory(transactions) {
  if (!transactions.length) {
    walletHistoryList.innerHTML = `<div class="history-item empty-history">No wallet transactions yet.</div>`;
    return;
  }

  walletHistoryList.innerHTML = transactions
    .map((entry) => {
      const sign = entry.type === "credit" ? "+" : "-";
      const source = entry.source === "razorpay" ? "Razorpay" : "Messages";
      return `
        <div class="history-item">
          <div>
            <strong>${source}</strong>
            <p>${formatDate(entry.createdAt)}</p>
          </div>
          <span class="history-amount ${entry.type}">${sign} INR ${entry.amount}</span>
        </div>
      `;
    })
    .join("");
}

function renderMessageHistory(jobs) {
  if (!jobs.length) {
    messageHistoryList.innerHTML = `<div class="history-item empty-history">No message jobs yet.</div>`;
    return;
  }

  messageHistoryList.innerHTML = jobs
    .map((job) => {
      const preview = String(job.message || "").slice(0, 80);
      return `
        <div class="history-item history-job">
          <div>
            <strong>${job.jobId}</strong>
            <p>${job.recipientCount} recipients | ${job.fileName || "Uploaded file"}</p>
            <p>${preview}${job.message && job.message.length > 80 ? "..." : ""}</p>
          </div>
          <span class="history-status">${job.status}</span>
        </div>
      `;
    })
    .join("");
}

function renderDashboard(user) {
  dashboardGreeting.textContent = `Welcome, ${user.name || "User"}`;
  dashboardSubtext.textContent = "Manage your profile, wallet, and service selection from one place.";
  dashboardName.textContent = user.name || "-";
  dashboardUserId.textContent = user.userId || "-";
  dashboardContact.textContent = user.contact || "-";
  dashboardEmail.textContent = user.email || "-";
  dashboardBalance.textContent = `INR ${Number(user.walletBalance || 0)}`;
  dashboardDob.textContent = user.dob ? formatDateOnly(user.dob) : "Not added";
  dashboardBusinessName.textContent = user.businessName || "Not added";
  dashboardBusinessType.textContent = user.businessType || "Not added";
  dashboardProfileImage.src = user.profileImage || DEFAULT_PROFILE_IMAGE;
}

function populateProfileForm(user) {
  if (!user) return;
  dobInput.value = user.dob ? String(user.dob).slice(0, 10) : "";
  businessNameInput.value = user.businessName || "";
  businessTypeInput.value = user.businessType || "";
}

function openWalletModal() {
  walletModal.classList.remove("hidden");
  walletModal.setAttribute("aria-hidden", "false");
}

function closeWalletModal() {
  walletModal.classList.add("hidden");
  walletModal.setAttribute("aria-hidden", "true");
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("messageSystemUser") || "null");
  } catch (error) {
    return null;
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("en-IN");
}

function formatDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-IN");
}

function setDashboardStatus(message, type) {
  dashboardStatus.textContent = message;
  dashboardStatus.className = "status-box";
  if (type) {
    dashboardStatus.classList.add(type);
  }
}
