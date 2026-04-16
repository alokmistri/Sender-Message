(function () {
  const user = JSON.parse(localStorage.getItem("quicksendUser") || "null");
  if (!user || !user.email) {
    window.location.href = "/login.html";
    return;
  }

  const statusBox = document.getElementById("walletStatus");
  const balanceText = document.getElementById("walletBalanceText");
  const lowBalanceHint = document.getElementById("walletLowBalanceHint");
  const transactionsList = document.getElementById("walletTransactionsList");

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `wallet-status ${type || ""}`.trim();
  }

  function updateStoredUser(nextUser) {
    localStorage.setItem("quicksendUser", JSON.stringify(nextUser));
  }

  function renderWallet(userData) {
    document.getElementById("walletAvatar").src = userData.profileImage || "/quicksend-logo.svg";
    document.getElementById("walletName").textContent = userData.name || "User";
    const balance = Number(userData.walletBalance || 0);
    balanceText.textContent = `INR ${balance.toFixed(2).replace(/\.00$/, "")}`;
    lowBalanceHint.textContent = balance < 10 ? "Low balance. Please recharge soon." : "";
  }

  function renderTransactions(items) {
    if (!items.length) {
      transactionsList.innerHTML = '<div class="wallet-transaction-empty">No transactions yet.</div>';
      return;
    }

    transactionsList.innerHTML = items
      .map((item) => {
        const typeLabel = item.type === "credit" ? "Credit" : "Debit";
        const extra = item.type === "debit" && item.messageCount ? `${item.messageCount} messages` : "Wallet update";
        return `
          <article class="wallet-transaction-item">
            <div>
              <strong>${typeLabel}</strong>
              <p>${extra}</p>
            </div>
            <div class="wallet-transaction-meta">
              <strong>INR ${Number(item.amount || 0).toFixed(2).replace(/\.00$/, "")}</strong>
              <span>${new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadWallet() {
    showStatus("Loading wallet...", "pending");
    try {
      const [walletResponse, transactionsResponse] = await Promise.all([
        fetch(`/wallet?email=${encodeURIComponent(user.email)}`),
        fetch(`/transactions?email=${encodeURIComponent(user.email)}`)
      ]);
      const walletData = await walletResponse.json();
      const transactionsData = await transactionsResponse.json();
      if (!walletResponse.ok) throw new Error(walletData.error || "Could not load wallet.");
      if (!transactionsResponse.ok) throw new Error(transactionsData.error || "Could not load transactions.");

      updateStoredUser(walletData.user);
      renderWallet(walletData.user);
      renderTransactions(transactionsData.transactions || []);
      showStatus("Wallet ready.", "success");
    } catch (error) {
      showStatus(error.message || "Could not load wallet.", "error");
    }
  }

  async function loadWalletAd() {
    try {
      const response = await fetch("/api/ads/active?slot=wallet");
      const data = await response.json();
      if (!response.ok || !data.ad || !data.ad.imageUrl) return;
      document.getElementById("walletAdImage").src = data.ad.imageUrl;
      document.getElementById("walletAdText").textContent = data.ad.adText || "Wallet promotion";
      document.getElementById("walletAdLink").href = data.ad.adLink || "#";
      document.getElementById("walletAdCard").classList.remove("is-hidden");
    } catch (error) {}
  }

  async function startPayment(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      showStatus("Enter a valid amount.", "error");
      return;
    }

    showStatus("Opening payment...", "pending");

    try {
      const orderResponse = await fetch("/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, amount })
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error || "Could not create payment order.");

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "QuickSend",
        description: "Wallet Recharge",
        order_id: orderData.orderId,
        handler: async function (payment) {
          try {
            const verifyResponse = await fetch("/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: user.email,
                amount,
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature
              })
            });
            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verifyData.error || "Payment verification failed.");
            updateStoredUser(verifyData.user);
            renderWallet(verifyData.user);
            await loadWallet();
            showStatus(verifyData.message || "Wallet updated successfully.", "success");
          } catch (error) {
            showStatus(error.message || "Payment verification failed.", "error");
          }
        },
        prefill: {
          name: user.name || "",
          email: user.email || "",
          contact: user.contact || ""
        },
        theme: { color: "#ff6b86" }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      showStatus(error.message || "Could not start payment.", "error");
    }
  }

  document.querySelectorAll(".wallet-amount-btn").forEach((button) => {
    button.addEventListener("click", () => startPayment(Number(button.dataset.amount)));
  });

  document.getElementById("walletCustomPay").addEventListener("click", () => {
    startPayment(Number(document.getElementById("walletCustomAmount").value));
  });

  loadWallet();
  loadWalletAd();
})();
