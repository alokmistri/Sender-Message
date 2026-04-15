const walletLogoutBtn = document.getElementById("walletLogoutBtn");
const walletProfileImage = document.getElementById("walletProfileImage");
const walletUserName = document.getElementById("walletUserName");
const walletContact = document.getElementById("walletContact");
const walletEmail = document.getElementById("walletEmail");
const walletBalanceDisplay = document.getElementById("walletBalanceDisplay");
const walletBalanceHint = document.getElementById("walletBalanceHint");
const walletWarningBadge = document.getElementById("walletWarningBadge");
const walletStatusBox = document.getElementById("walletStatusBox");
const transactionsList = document.getElementById("transactionsList");
const customAmountForm = document.getElementById("customAmountForm");
const customAmountInput = document.getElementById("customAmountInput");
const walletLoadingState = document.getElementById("walletLoadingState");
const addMoneyButtons = document.querySelectorAll("[data-wallet-amount]");

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

const storedWalletUser = getStoredUser();
if (!storedWalletUser) {
  window.location.href = "/login.html";
} else {
  loadWalletPage();
}

walletLogoutBtn.addEventListener("click", () => {
  localStorage.removeItem("messageSystemUser");
  window.location.href = "/login.html";
});

for (const button of addMoneyButtons) {
  button.addEventListener("click", () => {
    startWalletPayment(Number(button.dataset.walletAmount));
  });
}

customAmountForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startWalletPayment(Number(customAmountInput.value));
});

async function loadWalletPage() {
  setWalletStatus("Loading wallet details...", "");

  try {
    const user = getStoredUser();
    const [walletResponse, transactionsResponse] = await Promise.all([
      fetch(`/wallet?email=${encodeURIComponent(user.email)}`),
      fetch(`/transactions?email=${encodeURIComponent(user.email)}`)
    ]);

    const walletData = await walletResponse.json();
    const transactionsData = await transactionsResponse.json();

    if (!walletResponse.ok) {
      throw new Error(walletData.error || "Could not load wallet.");
    }

    localStorage.setItem("messageSystemUser", JSON.stringify(walletData.user));
    renderWallet(walletData.user);
    renderTransactions(transactionsData.transactions || []);
    setWalletStatus("Wallet loaded successfully.");
  } catch (error) {
    setWalletStatus(error.message || "Could not load wallet.", "error");
  }
}

async function startWalletPayment(amount) {
  const user = getStoredUser();
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    setWalletStatus("Enter a valid amount to add money.", "error");
    return;
  }

  showWalletLoading(true);

  try {
    const response = await fetch("/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not create payment order.");
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
          const verifyResponse = await fetch("/verify-payment", {
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
            throw new Error(verifyData.error || "Payment verification failed.");
          }

          localStorage.setItem("messageSystemUser", JSON.stringify(verifyData.user));
          renderWallet(verifyData.user);
          customAmountInput.value = "";
          await refreshTransactions(verifyData.user.email);
          setWalletStatus(`INR ${amount} has been added to your wallet successfully.`, "success");
        } catch (error) {
          setWalletStatus(error.message, "error");
        } finally {
          showWalletLoading(false);
        }
      },
      modal: {
        ondismiss: () => {
          showWalletLoading(false);
        }
      }
    });

    checkout.open();
  } catch (error) {
    showWalletLoading(false);
    setWalletStatus(error.message, "error");
  }
}

async function refreshTransactions(email) {
  const response = await fetch(`/transactions?email=${encodeURIComponent(email)}`);
  const data = await response.json();
  renderTransactions(data.transactions || []);
}

function renderWallet(user) {
  walletProfileImage.src = user.profileImage || DEFAULT_PROFILE_IMAGE;
  walletUserName.textContent = user.name || "User";
  walletContact.textContent = user.contact || "-";
  walletEmail.textContent = user.email || "-";
  walletBalanceDisplay.textContent = `INR ${Number(user.walletBalance || 0)}`;

  const balance = Number(user.walletBalance || 0);
  if (balance < 10) {
    walletWarningBadge.classList.remove("hidden");
    walletBalanceHint.textContent = "Your wallet balance is low. Please recharge before sending new campaigns.";
  } else {
    walletWarningBadge.classList.add("hidden");
    walletBalanceHint.textContent = "Your wallet is ready for new campaigns.";
  }
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    transactionsList.innerHTML = `<div class="history-item empty-history">No transactions found yet.</div>`;
    return;
  }

  transactionsList.innerHTML = transactions
    .map((entry) => {
      const amountLabel = `${entry.type === "credit" ? "+" : "-"} INR ${entry.amount}`;
      const messageCount = entry.messageCount ? `<p>Message count: ${entry.messageCount}</p>` : "";
      return `
        <div class="history-item">
          <div>
            <strong>${capitalize(entry.type)}</strong>
            <p>${formatDate(entry.createdAt)}</p>
            ${messageCount}
          </div>
          <span class="history-amount ${entry.type}">${amountLabel}</span>
        </div>
      `;
    })
    .join("");
}

function showWalletLoading(isVisible) {
  walletLoadingState.classList.toggle("hidden", !isVisible);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("messageSystemUser") || "null");
  } catch (error) {
    return null;
  }
}

function setWalletStatus(message, type) {
  walletStatusBox.textContent = message;
  walletStatusBox.className = "status-box";
  if (type) {
    walletStatusBox.classList.add(type);
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("en-IN");
}

function capitalize(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
