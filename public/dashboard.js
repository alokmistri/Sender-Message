(function () {
  const user = JSON.parse(localStorage.getItem("quicksendUser") || "null");
  if (!user || !user.email) {
    window.location.href = "/login.html";
    return;
  }

  const statusBox = document.getElementById("dashboardStatus");
  const avatar = document.getElementById("dashboardAvatar");
  const fileInput = document.getElementById("profileImageInput");
  const modal = document.getElementById("dashboardEditModal");
  const editForm = document.getElementById("editProfileForm");

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `dashboard-status ${type || ""}`.trim();
  }

  function updateStoredUser(nextUser) {
    localStorage.setItem("quicksendUser", JSON.stringify(nextUser));
  }

  function populateUser(currentUser) {
    document.getElementById("dashboardName").textContent = currentUser.name || "QuickSend User";
    document.getElementById("dashboardContact").textContent = currentUser.contact ? `+91 ${currentUser.contact}` : "Not available";
    document.getElementById("dashboardEmail").textContent = currentUser.email || "Not available";
    document.getElementById("dashboardWallet").textContent = `INR ${Number(currentUser.walletBalance || 0).toFixed(2).replace(/\.00$/, "")}`;
    document.getElementById("dashboardBusinessName").textContent = currentUser.businessName || "Not set";
    document.getElementById("dashboardBusinessType").textContent = currentUser.businessType || "Not set";
    document.getElementById("dashboardDob").textContent = currentUser.dob || "Not set";
    avatar.src = currentUser.profileImage || "/quicksend-logo.svg";
    document.getElementById("editDobInput").value = currentUser.dob || "";
    document.getElementById("editBusinessNameInput").value = currentUser.businessName || "";
    document.getElementById("editBusinessTypeInput").value = currentUser.businessType || "";
  }

  async function loadDashboard() {
    showStatus("Loading dashboard...", "pending");
    try {
      const response = await fetch(`/dashboard?email=${encodeURIComponent(user.email)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load dashboard.");
      }

      updateStoredUser(data.user);
      populateUser(data.user);
      showStatus("Dashboard ready.", "success");
    } catch (error) {
      showStatus(error.message || "Could not load dashboard.", "error");
    }
  }

  async function loadActiveAd() {
    try {
      const response = await fetch("/api/ads/active?slot=dashboard");
      const data = await response.json();
      if (!response.ok || !data.ad || !data.ad.imageUrl) {
        return;
      }

      const adCard = document.getElementById("dashboardAdCard");
      const adImage = document.getElementById("dashboardAdImage");
      const adText = document.getElementById("dashboardAdText");
      const adLink = document.getElementById("dashboardAdLink");

      adImage.src = data.ad.imageUrl;
      adText.textContent = data.ad.adText || "Featured from QuickSend";
      adLink.href = data.ad.adLink || "#";
      adCard.classList.remove("is-hidden");
    } catch (error) {
      // keep dashboard clean if ad load fails
    }
  }

  function openModal() {
    modal.classList.remove("is-hidden");
  }

  function closeModal() {
    modal.classList.add("is-hidden");
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.split(",").pop() || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  document.getElementById("editDetailsButton").addEventListener("click", openModal);
  document.getElementById("closeEditModal").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    showStatus("Saving profile...", "pending");

    try {
      const response = await fetch("/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          dob: document.getElementById("editDobInput").value,
          businessName: document.getElementById("editBusinessNameInput").value.trim(),
          businessType: document.getElementById("editBusinessTypeInput").value.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update profile.");
      }

      updateStoredUser(data.user);
      populateUser(data.user);
      closeModal();
      showStatus(data.message || "Profile updated successfully.", "success");
    } catch (error) {
      showStatus(error.message || "Could not update profile.", "error");
    }
  });

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    showStatus("Uploading image...", "pending");

    try {
      const fileContentBase64 = await fileToBase64(file);
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

      updateStoredUser(data.user);
      populateUser(data.user);
      showStatus(data.message || "Profile image updated successfully.", "success");
    } catch (error) {
      showStatus(error.message || "Could not upload image.", "error");
    } finally {
      fileInput.value = "";
    }
  });

  document.getElementById("walletCard").addEventListener("click", () => {
    window.location.href = "/wallet.html";
  });

  document.getElementById("selectServiceButton").addEventListener("click", () => {
    window.location.href = "/service-page.html";
  });

  loadDashboard();
  loadActiveAd();
})();
