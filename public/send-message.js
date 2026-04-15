const sendLogoutBtn = document.getElementById("sendLogoutBtn");
const sendMessageForm = document.getElementById("sendMessageForm");
const numbersFileInput = document.getElementById("numbersFileInput");
const messageModeSelect = document.getElementById("messageModeSelect");
const messageInput = document.getElementById("messageInput");
const aiTopicInput = document.getElementById("aiTopicInput");
const aiDateInput = document.getElementById("aiDateInput");
const aiVenueInput = document.getElementById("aiVenueInput");
const aiAdditionalInfoInput = document.getElementById("aiAdditionalInfoInput");
const generateAiMessageBtn = document.getElementById("generateAiMessageBtn");
const messageImageInput = document.getElementById("messageImageInput");
const totalNumbersCount = document.getElementById("totalNumbersCount");
const validNumbersCount = document.getElementById("validNumbersCount");
const invalidNumbersCount = document.getElementById("invalidNumbersCount");
const recipientCount = document.getElementById("recipientCount");
const costPerSms = document.getElementById("costPerSms");
const estimatedCost = document.getElementById("estimatedCost");
const sendStatusBox = document.getElementById("sendStatusBox");
const sendBalanceHint = document.getElementById("sendBalanceHint");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const validNumbersPreview = document.getElementById("validNumbersPreview");
const invalidNumbersPreview = document.getElementById("invalidNumbersPreview");
const messagePreview = document.getElementById("messagePreview");
const finalImagePreview = document.getElementById("finalImagePreview");
const finalCostPreview = document.getElementById("finalCostPreview");
const manualMessageSection = document.getElementById("manualMessageSection");
const aiMessageSection = document.getElementById("aiMessageSection");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const messageImagePreview = document.getElementById("messageImagePreview");
const messageImageLink = document.getElementById("messageImageLink");
const imageUploadState = document.getElementById("imageUploadState");
const messageLockState = document.getElementById("messageLockState");

const state = {
  validNumbers: [],
  invalidNumbers: [],
  totalCount: 0,
  imageUrl: "",
  aiMessageLocked: false
};

let currentUser = getStoredUser();

if (!currentUser) {
  window.location.href = "/login.html";
} else {
  updateBalanceState(currentUser);
  loadLatestSendUser();
}

numbersFileInput.addEventListener("change", handleNumbersFileChange);
messageModeSelect.addEventListener("change", handleMessageModeChange);
messageInput.addEventListener("input", refreshPreview);
generateAiMessageBtn.addEventListener("click", handleGenerateAiMessage);
messageImageInput.addEventListener("change", handleImageUpload);
sendMessageForm.addEventListener("submit", handleSendSubmit);

sendLogoutBtn.addEventListener("click", () => {
  localStorage.removeItem("messageSystemUser");
  window.location.href = "/login.html";
});

setSendStatus("Upload numbers, compose your message, and review the preview before sending.");
handleMessageModeChange();
refreshPreview();

async function handleNumbersFileChange() {
  const file = numbersFileInput.files[0];

  if (!file) {
    resetNumbersState();
    return;
  }

  try {
    const parsed = await parseNumbersFile(file);
    state.validNumbers = parsed.numbers || [];
    state.invalidNumbers = parsed.invalidNumbers || [];
    state.totalCount = Number(parsed.totalCount || 0);
    updateCounts();
    setSendStatus(`${state.validNumbers.length} valid numbers loaded from ${file.name}.`, "success");
  } catch (error) {
    resetNumbersState();
    setSendStatus(error.message, "error");
  }
}

function handleMessageModeChange() {
  const isAiMode = messageModeSelect.value === "ai";
  manualMessageSection.classList.toggle("hidden", isAiMode);
  aiMessageSection.classList.toggle("hidden", !isAiMode);

  if (!isAiMode) {
    state.aiMessageLocked = false;
    messageLockState.classList.add("hidden");
  }

  refreshPreview();
}

async function handleGenerateAiMessage() {
  try {
    setSendStatus("Generating AI message...", "");

    const response = await fetch("/api/messages/generate-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: aiTopicInput.value.trim(),
        date: aiDateInput.value.trim(),
        venue: aiVenueInput.value.trim(),
        additionalInfo: aiAdditionalInfoInput.value.trim()
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not generate AI message.");
    }

    messageInput.value = data.message || "";
    state.aiMessageLocked = true;
    messageLockState.classList.remove("hidden");
    refreshPreview();
    setSendStatus("AI message generated successfully.", "success");
  } catch (error) {
    setSendStatus(error.message, "error");
  }
}

async function handleImageUpload() {
  const file = messageImageInput.files?.[0];

  if (!file) {
    state.imageUrl = "";
    renderImagePreview();
    refreshPreview();
    return;
  }

  if (!/\.(jpg|jpeg|png)$/i.test(file.name)) {
    setSendStatus("Only JPG, JPEG, and PNG images are supported.", "error");
    return;
  }

  try {
    imageUploadState.classList.remove("hidden");
    const fileContentBase64 = await readFileAsBase64(file);
    const response = await fetch("/api/messages/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileContentBase64
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not upload image.");
    }

    state.imageUrl = data.imageUrl || "";
    renderImagePreview();
    refreshPreview();
    setSendStatus("Image uploaded successfully.", "success");
  } catch (error) {
    setSendStatus(error.message, "error");
  } finally {
    imageUploadState.classList.add("hidden");
  }
}

async function handleSendSubmit(event) {
  event.preventDefault();

  const finalMessage = getFinalMessage();
  if (!state.validNumbers.length) {
    setSendStatus("Upload a PDF or CSV with valid numbers first.", "error");
    return;
  }

  if (!finalMessage) {
    setSendStatus("Write a message or generate one with AI before sending.", "error");
    return;
  }

  try {
    const response = await fetch("/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentUser.email,
        fileName: numbersFileInput.files[0]?.name || "",
        numbers: state.validNumbers,
        message: messageInput.value.trim(),
        imageUrl: state.imageUrl
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not send SMS.");
    }

    currentUser = data.user;
    localStorage.setItem("messageSystemUser", JSON.stringify(data.user));
    sendMessageForm.reset();
    state.validNumbers = [];
    state.invalidNumbers = [];
    state.totalCount = 0;
    state.imageUrl = "";
    state.aiMessageLocked = false;
    handleMessageModeChange();
    updateCounts();
    renderImagePreview();
    refreshPreview();
    updateBalanceState(currentUser);
    setSendStatus(`${data.message} Job ID: ${data.job.jobId}`, "success");
  } catch (error) {
    setSendStatus(error.message, "error");
  }
}

async function loadLatestSendUser() {
  try {
    const response = await fetch(`/api/user?email=${encodeURIComponent(currentUser.email)}`);
    const data = await response.json();

    if (!response.ok) {
      return;
    }

    currentUser = data.user;
    localStorage.setItem("messageSystemUser", JSON.stringify(data.user));
    updateBalanceState(currentUser);
  } catch (error) {
    // Use current local data if refresh fails.
  }
}

async function parseNumbersFile(file) {
  const fileContentBase64 = await readFileAsBase64(file);
  const response = await fetch("/api/messages/parse-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileContentBase64
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not read uploaded file.");
  }

  return data;
}

function updateCounts() {
  const pricing = calculatePricing(state.validNumbers.length);
  totalNumbersCount.textContent = String(state.totalCount);
  validNumbersCount.textContent = String(state.validNumbers.length);
  invalidNumbersCount.textContent = String(state.invalidNumbers.length);
  recipientCount.textContent = String(state.validNumbers.length);
  costPerSms.textContent = `INR ${pricing.costPerSms.toFixed(2)}`;
  estimatedCost.textContent = `INR ${pricing.totalCost}`;
  finalCostPreview.textContent = `${state.validNumbers.length} messages x INR ${pricing.costPerSms.toFixed(2)} = INR ${pricing.totalCost}`;
  refreshPreview();
  updateBalanceState(currentUser);
}

function refreshPreview() {
  validNumbersPreview.textContent = state.validNumbers.length ? state.validNumbers.join(", ") : "No valid numbers loaded yet.";
  invalidNumbersPreview.textContent = state.invalidNumbers.length ? state.invalidNumbers.join(", ") : "No invalid numbers detected.";
  messagePreview.textContent = getFinalMessage() || "Your final message will appear here.";
  renderImagePreview();
}

function renderImagePreview() {
  if (!state.imageUrl) {
    imagePreviewWrap.classList.add("hidden");
    finalImagePreview.textContent = "No image uploaded yet.";
    return;
  }

  imagePreviewWrap.classList.remove("hidden");
  messageImagePreview.src = state.imageUrl;
  messageImageLink.href = state.imageUrl;
  finalImagePreview.innerHTML = `<a href="${state.imageUrl}" target="_blank" rel="noopener noreferrer"><img src="${state.imageUrl}" alt="Uploaded image preview" /></a>`;
}

function getFinalMessage() {
  const baseMessage = messageInput.value.trim();
  if (!baseMessage) {
    return "";
  }

  return state.imageUrl ? `${baseMessage}\n\nView Image: ${state.imageUrl}` : baseMessage;
}

function updateBalanceState(user) {
  const balance = Number(user?.walletBalance || 0);
  const pricing = calculatePricing(state.validNumbers.length);

  if (balance <= 0) {
    sendBalanceHint.textContent = "Wallet balance is zero. Please recharge before sending messages.";
    sendBalanceHint.classList.remove("hidden");
    sendMessageBtn.disabled = true;
    return;
  }

  if (pricing.totalCost > balance && pricing.totalCost > 0) {
    sendBalanceHint.textContent = `Insufficient balance. Need INR ${pricing.totalCost}, available INR ${balance}.`;
    sendBalanceHint.classList.remove("hidden");
    sendMessageBtn.disabled = true;
    return;
  }

  if (balance < 10) {
    sendBalanceHint.textContent = "Low balance warning: please recharge soon.";
    sendBalanceHint.classList.remove("hidden");
  } else {
    sendBalanceHint.classList.add("hidden");
    sendBalanceHint.textContent = "";
  }

  sendMessageBtn.disabled = false;
}

function calculatePricing(validCount) {
  const costPerSms = validCount > 50 ? 0.9 : 1;
  return {
    costPerSms,
    totalCost: Number((validCount * costPerSms).toFixed(2))
  };
}

function resetNumbersState() {
  state.validNumbers = [];
  state.invalidNumbers = [];
  state.totalCount = 0;
  updateCounts();
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
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function setSendStatus(message, type) {
  sendStatusBox.textContent = message;
  sendStatusBox.className = "status-box";
  if (type) {
    sendStatusBox.classList.add(type);
  }
}
