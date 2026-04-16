(function () {
  const admin = JSON.parse(localStorage.getItem("quicksendAdmin") || "null");
  if (!admin || !admin.email) {
    window.location.href = "/admin-login.html";
    return;
  }

  const form = document.getElementById("adminAdForm");
  const statusBox = document.getElementById("adminAdStatus");
  const removeButton = document.getElementById("removeAdButton");
  const slotInput = document.getElementById("adminAdSlotInput");

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `admin-status ${type || ""}`.trim();
  }

  function setPreview(ad) {
    const image = document.getElementById("adminAdPreviewImage");
    const text = document.getElementById("adminAdPreviewText");
    const link = document.getElementById("adminAdPreviewLink");
    image.src = ad && ad.imageUrl ? ad.imageUrl : "/quicksend-logo.svg";
    text.textContent = ad && ad.adText ? ad.adText : "No advertisement saved yet.";
    link.href = ad && ad.adLink ? ad.adLink : "#";
    link.textContent = ad && ad.adLink ? ad.adLink : "Preview Link";
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

  async function loadCurrentAd() {
    try {
      const response = await fetch(`/api/admin/advertisement?email=${encodeURIComponent(admin.email)}&slot=${encodeURIComponent(slotInput.value)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load advertisement.");
      }

      if (data.ad) {
        document.getElementById("adminAdTextInput").value = data.ad.adText || "";
        document.getElementById("adminAdLinkInput").value = data.ad.adLink || "";
      }
      setPreview(data.ad);
    } catch (error) {
      showStatus(error.message || "Could not load advertisement.", "error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("Saving advertisement...", "pending");

    try {
      const file = document.getElementById("adminAdImageInput").files[0];
      const payload = {
        adminEmail: admin.email,
        slot: slotInput.value,
        adText: document.getElementById("adminAdTextInput").value.trim(),
        adLink: document.getElementById("adminAdLinkInput").value.trim()
      };

      if (file) {
        payload.fileName = file.name;
        payload.fileContentBase64 = await fileToBase64(file);
      }

      const response = await fetch("/api/admin/advertisement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save advertisement.");
      }

      setPreview(data.ad);
      document.getElementById("adminAdImageInput").value = "";
      showStatus(data.message || "Advertisement updated successfully.", "success");
    } catch (error) {
      showStatus(error.message || "Could not save advertisement.", "error");
    }
  });

  removeButton.addEventListener("click", async () => {
    showStatus("Removing advertisement...", "pending");

    try {
      const response = await fetch("/api/admin/advertisement/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: admin.email,
          slot: slotInput.value
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not remove advertisement.");
      }

      document.getElementById("adminAdTextInput").value = "";
      document.getElementById("adminAdLinkInput").value = "";
      document.getElementById("adminAdImageInput").value = "";
      setPreview(null);
      showStatus(data.message || "Advertisement removed successfully.", "success");
    } catch (error) {
      showStatus(error.message || "Could not remove advertisement.", "error");
    }
  });

  slotInput.addEventListener("change", () => {
    document.getElementById("adminAdTextInput").value = "";
    document.getElementById("adminAdLinkInput").value = "";
    document.getElementById("adminAdImageInput").value = "";
    loadCurrentAd();
  });

  loadCurrentAd();
})();
