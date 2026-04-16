(function () {
  const user = JSON.parse(localStorage.getItem("quicksendUser") || "null");
  if (!user || !user.email) {
    window.location.href = "/login.html";
    return;
  }

  const state = {
    numbers: [],
    invalidNumbers: [],
    totalCount: 0,
    imageUrl: ""
  };

  const statusBox = document.getElementById("smsStatus");

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `sms-status ${type || ""}`.trim();
  }

  function fileToBase64(file) {
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

  function calculateCost(validCount) {
    const costPerSms = validCount > 50 ? 0.9 : 1;
    return { costPerSms, totalCost: Number((validCount * costPerSms).toFixed(2)) };
  }

  function currentMessage() {
    return document.getElementById("smsMessageInput").value.trim();
  }

  function renderPreview() {
    const validCount = state.numbers.length;
    const pricing = calculateCost(validCount);
    document.getElementById("smsTotalCount").textContent = `Total: ${state.totalCount}`;
    document.getElementById("smsValidCount").textContent = `Valid: ${validCount}`;
    document.getElementById("smsInvalidCount").textContent = `Invalid: ${state.invalidNumbers.length}`;
    document.getElementById("smsCostText").textContent = `${validCount} × INR ${pricing.costPerSms.toFixed(2).replace(/\.00$/, "")} = INR ${pricing.totalCost}`;
    document.getElementById("smsPreviewNumbers").textContent = validCount ? state.numbers.join(", ") : "No valid numbers yet.";
    document.getElementById("smsPreviewMessage").textContent = currentMessage() || "Your message preview will appear here.";
    const imageLink = document.getElementById("smsPreviewImageLink");
    if (state.imageUrl) {
      imageLink.href = state.imageUrl;
      imageLink.classList.remove("is-hidden");
    } else {
      imageLink.classList.add("is-hidden");
      imageLink.href = "#";
    }
  }

  async function loadSmsAd() {
    try {
      const response = await fetch("/api/ads/active?slot=sms");
      const data = await response.json();
      if (!response.ok || !data.ad || !data.ad.imageUrl) return;
      document.getElementById("smsInlineAdImage").src = data.ad.imageUrl;
      document.getElementById("smsInlineAdText").textContent = data.ad.adText || "Promotion";
      document.getElementById("smsInlineAdLink").href = data.ad.adLink || "#";
      document.getElementById("smsInlineAdCard").classList.remove("is-hidden");
    } catch (error) {}
  }

  document.getElementById("smsModeSelect").addEventListener("change", (event) => {
    const isAi = event.target.value === "ai";
    document.getElementById("smsManualSection").classList.toggle("is-hidden", isAi);
    document.getElementById("smsAiSection").classList.toggle("is-hidden", !isAi);
  });

  document.getElementById("smsMessageInput").addEventListener("input", renderPreview);

  document.getElementById("smsFileInput").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    showStatus("Reading numbers file...", "pending");
    try {
      const fileContentBase64 = await fileToBase64(file);
      const response = await fetch("/api/messages/parse-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileContentBase64 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not parse uploaded file.");
      state.numbers = data.numbers || [];
      state.invalidNumbers = data.invalidNumbers || [];
      state.totalCount = data.totalCount || 0;
      renderPreview();
      showStatus("Numbers loaded successfully.", "success");
    } catch (error) {
      showStatus(error.message || "Could not parse uploaded file.", "error");
    }
  });

  document.getElementById("smsGenerateAiButton").addEventListener("click", async () => {
    showStatus("Generating message...", "pending");
    try {
      const response = await fetch("/api/messages/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: document.getElementById("smsAiTopic").value.trim(),
          date: document.getElementById("smsAiDate").value.trim(),
          venue: document.getElementById("smsAiVenue").value.trim(),
          additionalInfo: document.getElementById("smsAiAdditionalInfo").value.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate message.");
      document.getElementById("smsMessageInput").value = data.message || "";
      document.getElementById("smsModeSelect").value = "manual";
      document.getElementById("smsManualSection").classList.remove("is-hidden");
      document.getElementById("smsAiSection").classList.add("is-hidden");
      renderPreview();
      showStatus("AI message ready.", "success");
    } catch (error) {
      showStatus(error.message || "Could not generate message.", "error");
    }
  });

  document.getElementById("smsImageInput").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    showStatus("Uploading image...", "pending");
    try {
      const fileContentBase64 = await fileToBase64(file);
      const response = await fetch("/api/messages/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileContentBase64 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not upload image.");
      state.imageUrl = data.imageUrl || "";
      document.getElementById("smsImageUrlText").textContent = state.imageUrl || "No image uploaded.";
      renderPreview();
      showStatus("Image uploaded successfully.", "success");
    } catch (error) {
      showStatus(error.message || "Could not upload image.", "error");
    }
  });

  document.getElementById("smsSendButton").addEventListener("click", async () => {
    const message = currentMessage();
    if (!state.numbers.length) {
      showStatus("Upload valid numbers first.", "error");
      return;
    }
    if (!message) {
      showStatus("Write your message first.", "error");
      return;
    }
    showStatus("Sending messages...", "pending");
    try {
      const response = await fetch("/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          fileName: "campaign-upload",
          numbers: state.numbers,
          message,
          imageUrl: state.imageUrl
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send messages.");
      if (data.user) {
        localStorage.setItem("quicksendUser", JSON.stringify(data.user));
      }
      showStatus(data.message || "Messages sent successfully.", "success");
    } catch (error) {
      showStatus(error.message || "Could not send messages.", "error");
    }
  });

  renderPreview();
  loadSmsAd();
})();
