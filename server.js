require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const pdfParse = require("pdf-parse");
const { MongoClient } = require("mongodb");
const Razorpay = require("razorpay");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "message_system";
const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_PASS = process.env.EMAIL_PASS || "";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@messageflow.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";

const signupSessions = new Map();

let usersCollection;
let messageJobsCollection;
let walletTransactionsCollection;
let advertisementsCollection;
let emailTransporter;
let razorpayClient;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return serveFile(res, path.join(PUBLIC_DIR, "index.html"));
  }

  if (req.method === "GET" && url.pathname === "/home") {
    return serveFile(res, path.join(PUBLIC_DIR, "home.html"));
  }

  if (req.method === "GET" && url.pathname === "/onboarding") {
    return serveFile(res, path.join(PUBLIC_DIR, "onboarding.html"));
  }

  if (req.method === "GET" && url.pathname === "/about") {
    return serveFile(res, path.join(PUBLIC_DIR, "about.html"));
  }

  if (req.method === "GET" && url.pathname === "/support") {
    return serveFile(res, path.join(PUBLIC_DIR, "support.html"));
  }

  if (req.method === "GET" && url.pathname === "/terms") {
    return serveFile(res, path.join(PUBLIC_DIR, "terms.html"));
  }

  if (req.method === "GET" && url.pathname === "/why") {
    return serveFile(res, path.join(PUBLIC_DIR, "why.html"));
  }

  if (req.method === "GET" && url.pathname === "/dashboard" && !url.searchParams.has("email")) {
    return serveFile(res, path.join(PUBLIC_DIR, "dashboard.html"));
  }

  if (req.method === "GET" && /^\/reset-password\/[^/]+$/.test(url.pathname)) {
    return serveFile(res, path.join(PUBLIC_DIR, "reset-password.html"));
  }

  if (
    req.method === "GET" &&
    (url.pathname.endsWith(".html") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".jpeg") ||
      url.pathname.endsWith(".webp") ||
      url.pathname.endsWith(".svg"))
  ) {
    return serveFile(res, resolvePublicPath(url.pathname));
  }

  if (req.method === "POST" && url.pathname === "/api/signup/request-otp") {
    return handleSignupRequestOtp(req, res);
  }

  if (req.method === "POST" && url.pathname === "/register") {
    return handleRegister(req, res);
  }

  if (req.method === "POST" && url.pathname === "/login") {
    return handleLogin(req, res);
  }

  if (req.method === "POST" && url.pathname === "/forgot-password") {
    return handleForgotPassword(req, res, req.headers.host);
  }

  if (req.method === "POST" && url.pathname === "/create-order") {
    return handleCreatePaymentOrder(req, res);
  }

  if (req.method === "POST" && url.pathname === "/verify-payment") {
    return handleVerifyPayment(req, res);
  }

  if (req.method === "POST" && url.pathname === "/deduct-balance") {
    return handleDeductBalance(req, res);
  }

  if (req.method === "POST" && /^\/reset-password\/[^/]+$/.test(url.pathname)) {
    return handleResetPassword(req, res, url.pathname.split("/").pop());
  }

  if (req.method === "POST" && url.pathname === "/api/signup/verify-otp") {
    return handleSignupVerifyOtp(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    return handleLogin(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    return handleAdminLogin(req, res);
  }

  if (req.method === "GET" && url.pathname === "/dashboard") {
    return handleGetDashboard(req, res, url);
  }

  if (req.method === "GET" && url.pathname === "/wallet" && url.searchParams.has("email")) {
    return handleGetWallet(req, res, url);
  }

  if (req.method === "GET" && url.pathname === "/transactions") {
    return handleGetTransactions(req, res, url);
  }

  if (req.method === "GET" && url.pathname === "/api/user") {
    return handleGetUser(req, res, url);
  }

  if (req.method === "POST" && url.pathname === "/update-profile") {
    return handleUpdateProfile(req, res);
  }

  if (req.method === "POST" && url.pathname === "/upload-image") {
    return handleUploadImage(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/admin/summary") {
    return handleAdminSummary(req, res, url);
  }

  if (req.method === "GET" && url.pathname === "/api/admin/advertisement") {
    return handleAdminAdvertisement(req, res, url);
  }

  if (req.method === "POST" && url.pathname === "/api/admin/advertisement") {
    return handleSaveAdminAdvertisement(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/admin/advertisement/remove") {
    return handleRemoveAdminAdvertisement(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/wallet/history") {
    return handleGetWalletHistory(req, res, url);
  }

  if (req.method === "GET" && url.pathname === "/api/messages/history") {
    return handleGetMessageHistory(req, res, url);
  }

  if (req.method === "POST" && url.pathname === "/api/wallet/add") {
    return handleAddWalletBalance(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/payments/config") {
    return sendJson(res, 200, { keyId: RAZORPAY_KEY_ID });
  }

  if (req.method === "POST" && url.pathname === "/api/payments/create-order") {
    return handleCreatePaymentOrder(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/payments/verify") {
    return handleVerifyPayment(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/messages/send") {
    return handleSendMessages(req, res);
  }

  if (req.method === "POST" && url.pathname === "/send-sms") {
    return handleSendMessages(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/messages/parse-file") {
    return handleParseNumbersFile(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/messages/generate-ai") {
    return handleGenerateAiMessage(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/messages/upload-image") {
    return handleUploadMessageImage(req, res, req.headers.host);
  }

  if (req.method === "GET" && url.pathname === "/api/ads/active") {
    return handleGetActiveAdvertisement(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      mongoConfigured: Boolean(MONGODB_URI),
      emailConfigured: Boolean(EMAIL_USER && EMAIL_PASS),
      razorpayConfigured: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)
    });
  }

  sendJson(res, 404, { error: "Not found" });
});

start();

async function start() {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    await connectMongo();
    setupTransporter();
    setupRazorpay();
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Message system running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

async function connectMongo() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);
  usersCollection = db.collection("users");
  messageJobsCollection = db.collection("message_jobs");
  walletTransactionsCollection = db.collection("wallet_transactions");
  advertisementsCollection = db.collection("advertisements");
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await usersCollection.createIndex({ contact: 1 }, { unique: true });
}

function setupTransporter() {
  if (!EMAIL_USER || !EMAIL_PASS) {
    emailTransporter = null;
    return;
  }

  emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
}

function setupRazorpay() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    razorpayClient = null;
    return;
  }

  razorpayClient = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });
}

async function handleSignupRequestOtp(req, res) {
  try {
    const body = await readJsonBody(req);
    const name = sanitizeName(body.name);
    const contact = sanitizeContact(body.contact);
    const email = sanitizeEmail(body.email);
    const password = sanitizeRegistrationPassword(body.password);

    if (!name.valid) return sendJson(res, 400, { error: name.message });
    if (!contact.valid) return sendJson(res, 400, { error: contact.message });
    if (!email.valid) return sendJson(res, 400, { error: email.message });
    if (!password.valid) return sendJson(res, 400, { error: password.message });

    const existingUser = await usersCollection.findOne({
      $or: [{ email: email.value }, { contact: contact.value }]
    });
    if (existingUser) {
      return sendJson(res, 409, { error: "User already exists with this phone or email. Please login instead." });
    }

    const otp = generateOtp();
    const requestId = crypto.randomUUID();

    signupSessions.set(requestId, {
      name: name.value,
      contact: contact.value,
      email: email.value,
      password: password.value,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    await sendOtpEmail(email.value, otp, "Signup verification OTP");

    sendJson(res, 200, {
      message: `OTP sent successfully to ${email.value}`,
      requestId,
      demoOtp: otp
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Invalid signup request" });
  }
}

async function handleRegister(req, res) {
  try {
    const body = await readJsonBody(req);
    const name = sanitizeName(body.name);
    const contact = sanitizeContact(body.phone || body.contact);
    const email = sanitizeEmail(body.email);
    const password = sanitizeRegistrationPassword(body.password);
    const confirmPassword = String(body.confirmPassword || "");

    if (!name.valid) return sendJson(res, 400, { error: name.message });
    if (!contact.valid) return sendJson(res, 400, { error: contact.message });
    if (!email.valid) return sendJson(res, 400, { error: email.message });
    if (!password.valid) return sendJson(res, 400, { error: password.message });

    if (password.value !== confirmPassword) {
      return sendJson(res, 400, { error: "Confirm password must match the new password." });
    }

    const existingUser = await usersCollection.findOne({
      $or: [{ email: email.value }, { contact: contact.value }]
    });

    if (existingUser) {
      if (existingUser.contact === contact.value) {
        return sendJson(res, 409, { error: "Phone number already exists. Please login instead." });
      }

      return sendJson(res, 409, { error: "Email already exists. Please login instead." });
    }

    const now = new Date().toISOString();
    const user = {
      userId: buildUserId(),
      name: name.value,
      contact: contact.value,
      email: email.value,
      passwordHash: await bcrypt.hash(password.value, 10),
      walletBalance: 0,
      createdAt: now,
      updatedAt: now
    };

    await usersCollection.insertOne(user);

    sendJson(res, 201, {
      message: "Signup completed successfully.",
      user: publicUser(user)
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return sendJson(res, 409, { error: "Phone or email already exists. Please login instead." });
    }

    sendJson(res, 400, { error: error.message || "Could not create account." });
  }
}

async function handleSignupVerifyOtp(req, res) {
  try {
    const body = await readJsonBody(req);
    const requestId = String(body.requestId || "");
    const otp = String(body.otp || "").trim();

    if (!requestId || !otp) {
      return sendJson(res, 400, { error: "Request ID and OTP are required" });
    }

    const session = signupSessions.get(requestId);
    if (!session) {
      return sendJson(res, 404, { error: "Signup session not found or expired" });
    }

    if (Date.now() > session.expiresAt) {
      signupSessions.delete(requestId);
      return sendJson(res, 410, { error: "OTP expired. Please request a new one." });
    }

    if (session.otp !== otp) {
      return sendJson(res, 401, { error: "Incorrect OTP" });
    }

    const now = new Date().toISOString();
    const user = {
      userId: buildUserId(),
      name: session.name,
      contact: session.contact,
      email: session.email,
      passwordHash: await bcrypt.hash(session.password, 10),
      walletBalance: 0,
      createdAt: now,
      updatedAt: now
    };

    await usersCollection.insertOne(user);
    signupSessions.delete(requestId);

    sendJson(res, 201, {
      message: "Signup completed successfully",
      user: publicUser(user)
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return sendJson(res, 409, { error: "User already exists. Please login instead." });
    }
    sendJson(res, 400, { error: error.message || "Could not complete signup" });
  }
}

async function handleLogin(req, res) {
  try {
    const body = await readJsonBody(req);
    const contact = sanitizeContact(body.phone || body.contact);
    const email = sanitizeEmail(body.email);
    const password = sanitizeLoginPassword(body.password);

    if (!contact.valid) return sendJson(res, 400, { error: "Please check your credentials" });
    if (!email.valid) return sendJson(res, 400, { error: "Please check your credentials" });
    if (!password.valid) return sendJson(res, 400, { error: "Please check your credentials" });

    const user = await usersCollection.findOne({
      contact: contact.value,
      email: email.value
    });
    if (!user) {
      return sendJson(res, 401, { error: "Please check your credentials" });
    }

    const passwordMatches = await bcrypt.compare(password.value, user.passwordHash);
    if (!passwordMatches) {
      return sendJson(res, 401, { error: "Please check your credentials" });
    }

    sendJson(res, 200, {
      message: "Login successful",
      user: publicUser(user)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Please check your credentials" });
  }
}

async function handleAdminLogin(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return sendJson(res, 400, { error: "Admin email and password are required." });
    }

    if (email !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
      return sendJson(res, 401, { error: "Invalid admin credentials." });
    }

    sendJson(res, 200, {
      message: "Admin login successful",
      admin: {
        email: ADMIN_EMAIL,
        role: "admin"
      }
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Invalid admin login request" });
  }
}

async function handleAdminSummary(req, res, url) {
  try {
    const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
    if (email !== ADMIN_EMAIL.toLowerCase()) {
      return sendJson(res, 401, { error: "Unauthorized admin access." });
    }

    const [usersCount, messageCount, transactionDocs, recentPayments, recentMessages] = await Promise.all([
      usersCollection.countDocuments(),
      messageJobsCollection.countDocuments(),
      walletTransactionsCollection.find({}).toArray(),
      walletTransactionsCollection
        .find({ source: "razorpay" })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
      messageJobsCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .project({
          _id: 0,
          jobId: 1,
          userEmail: 1,
          recipientCount: 1,
          status: 1,
          createdAt: 1
        })
        .toArray()
    ]);

    const totalCredits = transactionDocs
      .filter((entry) => entry.type === "credit")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const totalDebits = transactionDocs
      .filter((entry) => entry.type === "debit")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const providerCost = totalDebits * 0.25;
    const grossProfit = totalDebits * 0.75;

    sendJson(res, 200, {
      summary: {
        usersCount,
        messageCount,
        totalCredits,
        totalDebits,
        providerCost,
        grossProfit
      },
      recentPayments: recentPayments.map((entry) => ({
        userEmail: entry.userEmail,
        amount: entry.amount,
        createdAt: entry.createdAt,
        paymentId: entry.razorpayPaymentId || "-"
      })),
      recentMessages
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load admin summary." });
  }
}

async function handleAdminAdvertisement(req, res, url) {
  try {
    const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
    const slot = sanitizeAdSlot(url.searchParams.get("slot"));
    if (email !== ADMIN_EMAIL.toLowerCase()) {
      return sendJson(res, 401, { error: "Unauthorized admin access." });
    }

    const ad = await advertisementsCollection.findOne({ slot });
    sendJson(res, 200, { ad: publicAdvertisement(ad) });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load advertisement." });
  }
}

async function handleSaveAdminAdvertisement(req, res) {
  try {
    const body = await readJsonBody(req);
    const adminEmail = String(body.adminEmail || "").trim().toLowerCase();
    const slot = sanitizeAdSlot(body.slot);
    const adText = sanitizeOptionalText(body.adText, 180);
    const adLink = sanitizeOptionalLink(body.adLink);
    const fileName = String(body.fileName || "").trim();
    const fileContentBase64 = String(body.fileContentBase64 || "").trim();

    if (adminEmail !== ADMIN_EMAIL.toLowerCase()) {
      return sendJson(res, 401, { error: "Unauthorized admin access." });
    }

    const existingAd = await advertisementsCollection.findOne({ slot });
    let imageUrl = existingAd?.imageUrl || "";

    if (fileName && fileContentBase64) {
      imageUrl = saveUploadedImage(fileName, fileContentBase64);
    }

    const now = new Date().toISOString();
    const update = {
      slot,
      adText,
      adLink,
      imageUrl,
      isActive: true,
      updatedAt: now
    };

    if (!existingAd) {
      update.createdAt = now;
    }

    const result = await advertisementsCollection.findOneAndUpdate(
      { slot },
      { $set: update },
      { upsert: true, returnDocument: "after" }
    );

    sendJson(res, 200, {
      message: "Advertisement updated successfully.",
      ad: publicAdvertisement(result)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not save advertisement." });
  }
}

async function handleRemoveAdminAdvertisement(req, res) {
  try {
    const body = await readJsonBody(req);
    const adminEmail = String(body.adminEmail || "").trim().toLowerCase();
    const slot = sanitizeAdSlot(body.slot);

    if (adminEmail !== ADMIN_EMAIL.toLowerCase()) {
      return sendJson(res, 401, { error: "Unauthorized admin access." });
    }

    const result = await advertisementsCollection.findOneAndUpdate(
      { slot },
      {
        $set: {
          isActive: false,
          updatedAt: new Date().toISOString()
        }
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return sendJson(res, 404, { error: "No advertisement found to remove." });
    }

    sendJson(res, 200, {
      message: "Advertisement removed successfully.",
      ad: publicAdvertisement(result)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not remove advertisement." });
  }
}

async function handleGetDashboard(req, res, url) {
  try {
    const email = sanitizeEmail(url.searchParams.get("email"));
    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    const user = await usersCollection.findOne({ email: email.value });
    if (!user) {
      return sendJson(res, 404, { error: "User not found." });
    }

    sendJson(res, 200, { user: publicUser(user) });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load dashboard." });
  }
}

async function handleGetActiveAdvertisement(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const slot = sanitizeAdSlot(url.searchParams.get("slot"));
    const ad = await advertisementsCollection.findOne({ slot, isActive: true });
    sendJson(res, 200, { ad: publicAdvertisement(ad) });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load advertisement." });
  }
}

async function handleGetWallet(req, res, url) {
  try {
    const email = sanitizeEmail(url.searchParams.get("email"));
    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    const user = await usersCollection.findOne({ email: email.value });
    if (!user) {
      return sendJson(res, 404, { error: "User not found." });
    }

    sendJson(res, 200, {
      user: publicUser(user),
      walletBalance: Number(user.walletBalance || 0)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load wallet." });
  }
}

async function handleGetTransactions(req, res, url) {
  try {
    const email = sanitizeEmail(url.searchParams.get("email"));
    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    const transactions = await walletTransactionsCollection
      .find({ userEmail: email.value })
      .sort({ createdAt: -1 })
      .limit(20)
      .project({
        _id: 0,
        type: 1,
        amount: 1,
        messageCount: 1,
        createdAt: 1
      })
      .toArray();

    sendJson(res, 200, { transactions });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load transactions." });
  }
}

async function handleGetUser(req, res, url) {
  try {
    const email = sanitizeEmail(url.searchParams.get("email"));
    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    const user = await usersCollection.findOne({ email: email.value });
    if (!user) {
      return sendJson(res, 404, { error: "User not found." });
    }

    sendJson(res, 200, { user: publicUser(user) });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load user" });
  }
}

async function handleGetWalletHistory(req, res, url) {
  try {
    const email = sanitizeEmail(url.searchParams.get("email"));
    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    const transactions = await walletTransactionsCollection
      .find({ userEmail: email.value })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    sendJson(res, 200, { transactions });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load wallet history." });
  }
}

async function handleGetMessageHistory(req, res, url) {
  try {
    const email = sanitizeEmail(url.searchParams.get("email"));
    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    const jobs = await messageJobsCollection
      .find({ userEmail: email.value })
      .sort({ createdAt: -1 })
      .limit(20)
      .project({
        _id: 0,
        jobId: 1,
        fileName: 1,
        message: 1,
        recipientCount: 1,
        status: 1,
        createdAt: 1
      })
      .toArray();

    sendJson(res, 200, { jobs });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not load message history." });
  }
}

async function handleAddWalletBalance(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = sanitizeEmail(body.email);
    const amount = Number(body.amount);

    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendJson(res, 400, { error: "Enter a valid amount." });
    }

    const result = await usersCollection.findOneAndUpdate(
      { email: email.value },
      {
        $inc: { walletBalance: amount },
        $set: { updatedAt: new Date().toISOString() }
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return sendJson(res, 404, { error: "User not found." });
    }

    sendJson(res, 200, {
      message: "Wallet updated successfully",
      user: publicUser(result)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not update wallet" });
  }
}

async function handleUpdateProfile(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = sanitizeEmail(body.email);
    const dob = sanitizeDateValue(body.dob);
    const businessName = sanitizeOptionalText(body.businessName, 80);
    const businessType = sanitizeOptionalText(body.businessType, 80);

    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    const updatedUser = await usersCollection.findOneAndUpdate(
      { email: email.value },
      {
        $set: {
          dob,
          businessName,
          businessType,
          updatedAt: new Date().toISOString()
        }
      },
      { returnDocument: "after" }
    );

    if (!updatedUser) {
      return sendJson(res, 404, { error: "User not found." });
    }

    sendJson(res, 200, {
      message: "Profile updated successfully.",
      user: publicUser(updatedUser)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not update profile." });
  }
}

async function handleUploadImage(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = sanitizeEmail(body.email);
    const fileName = String(body.fileName || "").trim();
    const fileContentBase64 = String(body.fileContentBase64 || "").trim();

    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    if (!fileName || !fileContentBase64) {
      return sendJson(res, 400, { error: "Image file is required." });
    }

    const profileImage = saveUploadedImage(fileName, fileContentBase64);
    const updatedUser = await usersCollection.findOneAndUpdate(
      { email: email.value },
      {
        $set: {
          profileImage,
          updatedAt: new Date().toISOString()
        }
      },
      { returnDocument: "after" }
    );

    if (!updatedUser) {
      return sendJson(res, 404, { error: "User not found." });
    }

    sendJson(res, 200, {
      message: "Profile image updated successfully.",
      user: publicUser(updatedUser)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not upload profile image." });
  }
}

async function handleCreatePaymentOrder(req, res) {
  try {
    if (!razorpayClient) {
      return sendJson(res, 500, { error: "Razorpay is not configured." });
    }

    const body = await readJsonBody(req);
    const email = sanitizeEmail(body.email);
    const amount = Number(body.amount);

    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendJson(res, 400, { error: "Enter a valid payment amount." });
    }

    const user = await usersCollection.findOne({ email: email.value });
    if (!user) {
      return sendJson(res, 404, { error: "User not found." });
    }

    const order = await razorpayClient.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `wallet_${Date.now()}`,
      notes: {
        userEmail: user.email,
        userId: user.userId,
        walletAmount: String(amount)
      }
    });

    sendJson(res, 200, {
      keyId: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      user: publicUser(user)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not create payment order." });
  }
}

async function handleVerifyPayment(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = sanitizeEmail(body.email);
    const amount = Number(body.amount);
    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");

    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendJson(res, 400, { error: "Enter a valid payment amount." });
    }

    if (!orderId || !paymentId || !signature) {
      return sendJson(res, 400, { error: "Payment verification fields are required." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expectedSignature !== signature) {
      return sendJson(res, 401, { error: "Payment signature verification failed." });
    }

    const updatedUser = await usersCollection.findOneAndUpdate(
      { email: email.value },
      {
        $inc: { walletBalance: amount },
        $set: { updatedAt: new Date().toISOString() }
      },
      { returnDocument: "after" }
    );

    if (!updatedUser) {
      return sendJson(res, 404, { error: "User not found." });
    }

    await walletTransactionsCollection.insertOne({
      userEmail: email.value,
      userId: updatedUser.userId,
      type: "credit",
      amount,
      source: "razorpay",
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      messageCount: 0,
      createdAt: new Date().toISOString()
    });

    await sendWalletCreditEmail(updatedUser.email, amount);

    sendJson(res, 200, {
      message: "Payment verified and wallet credited successfully.",
      user: publicUser(updatedUser)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not verify payment." });
  }
}

async function handleDeductBalance(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = sanitizeEmail(body.email);
    const amount = Number(body.amount);
    const messageCount = Number(body.messageCount || amount);

    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return sendJson(res, 400, { error: "Enter a valid amount to deduct." });
    }

    const user = await usersCollection.findOne({ email: email.value });
    if (!user) {
      return sendJson(res, 404, { error: "User not found." });
    }

    if (Number(user.walletBalance || 0) < amount) {
      return sendJson(res, 400, { error: "Insufficient wallet balance." });
    }

    const updatedUser = await usersCollection.findOneAndUpdate(
      { email: email.value },
      {
        $inc: { walletBalance: -amount },
        $set: { updatedAt: new Date().toISOString() }
      },
      { returnDocument: "after" }
    );

    await walletTransactionsCollection.insertOne({
      userEmail: email.value,
      userId: updatedUser.userId,
      type: "debit",
      amount,
      source: "messages",
      messageCount,
      createdAt: new Date().toISOString()
    });

    await maybeSendLowBalanceEmail(updatedUser);

    sendJson(res, 200, {
      message: "Balance deducted successfully.",
      user: publicUser(updatedUser)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not deduct balance." });
  }
}

async function handleSendMessages(req, res) {
  try {
    const body = await readJsonBody(req);
    const email = sanitizeEmail(body.email);
    const message = String(body.message || "").trim();
    const fileName = String(body.fileName || "").trim();
    const uploadedNumbers = Array.isArray(body.numbers) ? body.numbers : [];
    const imageUrl = String(body.imageUrl || "").trim();
    const parsedNumbers = normalizeRecipientNumbers(uploadedNumbers);
    const numbers = parsedNumbers.validNumbers;

    if (!email.valid) {
      return sendJson(res, 400, { error: email.message });
    }

    if (!message) {
      return sendJson(res, 400, { error: "Message is required." });
    }

    if (!numbers.length) {
      return sendJson(res, 400, { error: "Upload a CSV or PDF containing numbers in the format +91 1234567890." });
    }

    const user = await usersCollection.findOne({ email: email.value });
    if (!user) {
      return sendJson(res, 404, { error: "User not found." });
    }

    const pricing = calculateSmsCost(numbers.length);
    const finalMessage = imageUrl ? `${message}\n\nView Image: ${imageUrl}` : message;
    const currentBalance = Number(user.walletBalance || 0);

    if (currentBalance < pricing.totalCost) {
      return sendJson(res, 400, {
        error: `Insufficient wallet balance. Required INR ${pricing.totalCost}, available INR ${currentBalance}.`
      });
    }

    const sendResults = await sendSmsBatch(numbers, finalMessage);

    const job = {
      jobId: `MSG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      userEmail: user.email,
      userId: user.userId,
      fileName,
      message: finalMessage,
      imageUrl,
      recipients: numbers,
      recipientCount: numbers.length,
      invalidNumbers: parsedNumbers.invalidNumbers,
      duplicateCount: parsedNumbers.duplicateCount,
      costPerSms: pricing.costPerSms,
      totalCost: pricing.totalCost,
      status: "sent_demo",
      deliverySummary: sendResults.summary,
      createdAt: new Date().toISOString()
    };

    await messageJobsCollection.insertOne(job);
    const updatedUser = await usersCollection.findOneAndUpdate(
      { email: user.email },
      {
        $inc: { walletBalance: -pricing.totalCost },
        $set: { updatedAt: new Date().toISOString() }
      },
      { returnDocument: "after" }
    );

    await walletTransactionsCollection.insertOne({
      userEmail: user.email,
      userId: user.userId,
      type: "debit",
      amount: pricing.totalCost,
      source: "messages",
      referenceId: job.jobId,
      messageCount: numbers.length,
      createdAt: new Date().toISOString()
    });

    await maybeSendLowBalanceEmail(updatedUser);

    sendJson(res, 200, {
      message: `Processed ${numbers.length} messages successfully.`,
      job: {
        jobId: job.jobId,
        recipientCount: job.recipientCount,
        status: job.status,
        totalCost: pricing.totalCost,
        costPerSms: pricing.costPerSms
      },
      user: publicUser(updatedUser)
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not queue messages" });
  }
}

async function handleParseNumbersFile(req, res) {
  try {
    const body = await readJsonBody(req);
    const fileName = String(body.fileName || "").trim();
    const fileContentBase64 = String(body.fileContentBase64 || "").trim();

    if (!fileName || !fileContentBase64) {
      return sendJson(res, 400, { error: "File name and file content are required." });
    }

    const extension = path.extname(fileName).toLowerCase();
    const buffer = Buffer.from(fileContentBase64, "base64");
    let text = "";

    if (extension === ".csv") {
      text = buffer.toString("utf8");
    } else if (extension === ".pdf") {
      const parsed = await pdfParse(buffer);
      text = parsed.text || "";
    } else {
      return sendJson(res, 400, { error: "Only CSV and PDF files are supported." });
    }

    const parsed = normalizeRecipientNumbers(extractNumberCandidates(text));

    sendJson(res, 200, {
      numbers: parsed.validNumbers,
      totalCount: parsed.totalCount,
      validCount: parsed.validNumbers.length,
      invalidCount: parsed.invalidNumbers.length,
      invalidNumbers: parsed.invalidNumbers,
      duplicateCount: parsed.duplicateCount
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not parse uploaded file." });
  }
}

async function handleGenerateAiMessage(req, res) {
  try {
    const body = await readJsonBody(req);
    const topic = sanitizeOptionalText(body.topic, 120);
    const date = sanitizeOptionalText(body.date, 60);
    const venue = sanitizeOptionalText(body.venue, 120);
    const additionalInfo = sanitizeOptionalText(body.additionalInfo, 300);

    if (!topic) {
      return sendJson(res, 400, { error: "Topic is required to generate a message." });
    }

    if (!OPENROUTER_API_KEY) {
      const fallbackMessage = buildFallbackAiMessage({ topic, date, venue, additionalInfo });
      return sendJson(res, 200, { message: fallbackMessage, source: "fallback" });
    }

    const prompt = [
      "Write a concise promotional SMS in plain text for an Indian audience.",
      `Topic: ${topic || "Not provided"}`,
      `Date: ${date || "Not provided"}`,
      `Venue: ${venue || "Not provided"}`,
      `Additional Info: ${additionalInfo || "Not provided"}`,
      "Keep it under 320 characters, friendly, and ready to send."
    ].join("\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!response.ok || !content) {
      const fallbackMessage = buildFallbackAiMessage({ topic, date, venue, additionalInfo });
      return sendJson(res, 200, { message: fallbackMessage, source: "fallback" });
    }

    sendJson(res, 200, {
      message: content.slice(0, 320),
      source: "ai"
    });
  } catch (error) {
    const fallbackMessage = buildFallbackAiMessage({
      topic: "",
      date: "",
      venue: "",
      additionalInfo: ""
    });
    sendJson(res, 200, { message: fallbackMessage, source: "fallback" });
  }
}

async function handleUploadMessageImage(req, res, host) {
  try {
    const body = await readJsonBody(req);
    const fileName = String(body.fileName || "").trim();
    const fileContentBase64 = String(body.fileContentBase64 || "").trim();

    if (!fileName || !fileContentBase64) {
      return sendJson(res, 400, { error: "Image file is required." });
    }

    const extension = path.extname(fileName).toLowerCase();
    const allowedExtensions = new Set([".png", ".jpg", ".jpeg"]);
    if (!allowedExtensions.has(extension)) {
      return sendJson(res, 400, { error: "Only JPG, JPEG, and PNG images are supported." });
    }

    const buffer = Buffer.from(fileContentBase64, "base64");
    const safeName = `message-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buffer);

    const appBaseUrl = (process.env.APP_BASE_URL || `http://${host || `localhost:${PORT}`}`).replace(/\/$/, "");
    const imageUrl = `${appBaseUrl}/uploads/${safeName}`;

    sendJson(res, 200, { imageUrl });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not upload message image." });
  }
}

async function handleForgotPassword(req, res, host) {
  try {
    const body = await readJsonBody(req);
    const credential = String(body.credential || "").trim();

    if (!credential) {
      return sendJson(res, 400, { error: "Enter your Email or Contact Number." });
    }

    const email = sanitizeEmail(credential);
    const contact = sanitizeContact(credential);
    if (!email.valid && !contact.valid) {
      return sendJson(res, 400, { error: "Enter a valid Email or 10-digit Contact Number." });
    }

    const filters = [];
    if (email.valid) filters.push({ email: email.value });
    if (contact.valid) filters.push({ contact: contact.value });

    const user = await usersCollection.findOne({ $or: filters });
    if (!user) {
      return sendJson(res, 404, { error: "Wrong Email or Contact Number" });
    }

    const resetToken = crypto.randomBytes(24).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          resetToken,
          resetTokenExpiry,
          updatedAt: new Date().toISOString()
        }
      }
    );

    const appBaseUrl = (process.env.APP_BASE_URL || `http://${host || `localhost:${PORT}`}`).replace(/\/$/, "");
    const resetLink = `${appBaseUrl}/reset-password/${resetToken}`;

    await sendResetPasswordEmail(user.email, resetLink);

    sendJson(res, 200, {
      message: `Reset link sent successfully to ${user.email}.`
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Could not send reset link." });
  }
}

async function handleResetPassword(req, res, token) {
  try {
    const body = await readJsonBody(req);
    const password = sanitizeRegistrationPassword(body.password);
    const confirmPassword = String(body.confirmPassword || "");

    if (!token) {
      return sendJson(res, 400, { error: "Link expired or invalid" });
    }

    if (!password.valid) {
      return sendJson(res, 400, { error: password.message });
    }

    if (password.value !== confirmPassword) {
      return sendJson(res, 400, { error: "Confirm password must match the new password." });
    }

    const user = await usersCollection.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date().toISOString() }
    });

    if (!user) {
      return sendJson(res, 400, { error: "Link expired or invalid" });
    }

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: await bcrypt.hash(password.value, 10),
          updatedAt: new Date().toISOString()
        },
        $unset: {
          resetToken: "",
          resetTokenExpiry: ""
        }
      }
    );

    sendJson(res, 200, { message: "Password updated successfully" });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Link expired or invalid" });
  }
}

async function sendOtpEmail(to, otp, subject) {
  if (!emailTransporter) {
    return;
  }

  await emailTransporter.sendMail({
    from: EMAIL_USER,
    to,
    subject,
    text: `Your OTP is ${otp}. It will expire in a few minutes.`
  });
}

async function sendResetPasswordEmail(to, resetLink) {
  if (!emailTransporter) {
    return;
  }

  await emailTransporter.sendMail({
    from: EMAIL_USER,
    to,
    subject: "Reset Your Password",
    text: `Click below link to reset your password:\n\n${resetLink}`
  });
}

async function sendWalletCreditEmail(to, amount) {
  if (!emailTransporter) {
    return;
  }

  await emailTransporter.sendMail({
    from: EMAIL_USER,
    to,
    subject: "Wallet Recharge Successful",
    text: `INR ${amount} has been added to your wallet successfully.`
  });
}

async function maybeSendLowBalanceEmail(user) {
  if (!emailTransporter) {
    return;
  }

  if (Number(user.walletBalance || 0) >= 10) {
    return;
  }

  await emailTransporter.sendMail({
    from: EMAIL_USER,
    to: user.email,
    subject: "Low Wallet Balance Alert",
    text: "Your wallet balance is low. Please recharge."
  });
}

function publicUser(user) {
  return {
    userId: user.userId,
    name: user.name,
    contact: user.contact,
    email: user.email,
    dob: user.dob || "",
    businessName: user.businessName || "",
    businessType: user.businessType || "",
    profileImage: user.profileImage || "",
    walletBalance: Number(user.walletBalance || 0),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function publicAdvertisement(ad) {
  if (!ad) {
    return null;
  }

  return {
    slot: ad.slot || "dashboard",
    adText: ad.adText || "",
    adLink: ad.adLink || "",
    imageUrl: ad.imageUrl || "",
    isActive: Boolean(ad.isActive),
    updatedAt: ad.updatedAt || "",
    createdAt: ad.createdAt || ""
  };
}

function buildUserId() {
  return `USR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sanitizeName(rawValue) {
  const value = String(rawValue || "").trim().replace(/\s+/g, " ");
  if (!value) return { valid: false, message: "Name is required" };
  if (value.length < 2) return { valid: false, message: "Enter a valid full name" };
  return { valid: true, value };
}

function sanitizeContact(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return { valid: false, message: "Mobile number is required" };
  const normalized = value.replace(/\D/g, "");
  const isValid = /^\d{10}$/.test(normalized);
  return isValid ? { valid: true, value: normalized } : { valid: false, message: "Contact number must be exactly 10 digits." };
}

function sanitizeRecipientNumber(rawValue) {
  const value = String(rawValue || "").trim();
  const compactValue = value.replace(/\s+/g, "");
  const isValid = /^\+91\d{10}$/.test(compactValue);
  return isValid
    ? { valid: true, value: compactValue }
    : { valid: false, message: "Recipient number must be in the format +919876543210" };
}

function extractNumberCandidates(text) {
  return String(text || "").match(/\+91[\s-]?\d{10}\b|(?:^|[\s,;])\d{10}\b/gm) || [];
}

function normalizeRecipientNumbers(values) {
  const uniqueNumbers = new Set();
  const invalidNumbers = [];
  let totalCount = 0;
  let duplicateCount = 0;

  for (const rawValue of values) {
    const cleaned = String(rawValue || "").trim().replace(/^[,;\s]+/, "");
    if (!cleaned) {
      continue;
    }

    totalCount += 1;
    const normalized = cleaned.replace(/[\s-]+/g, "");
    const entry = sanitizeRecipientNumber(normalized);

    if (!entry.valid) {
      invalidNumbers.push(cleaned);
      continue;
    }

    if (uniqueNumbers.has(entry.value)) {
      duplicateCount += 1;
      continue;
    }

    uniqueNumbers.add(entry.value);
  }

  return {
    totalCount,
    validNumbers: [...uniqueNumbers],
    invalidNumbers,
    duplicateCount
  };
}

function calculateSmsCost(validNumberCount) {
  const costPerSms = validNumberCount > 50 ? 0.9 : 1;
  return {
    costPerSms,
    totalCost: Number((validNumberCount * costPerSms).toFixed(2))
  };
}

function buildFallbackAiMessage({ topic, date, venue, additionalInfo }) {
  const segments = [`QuickSend update: ${topic || "event details coming soon"}.`];

  if (date) {
    segments.push(`Date: ${date}.`);
  }

  if (venue) {
    segments.push(`Venue: ${venue}.`);
  }

  if (additionalInfo) {
    segments.push(`${additionalInfo}.`);
  }

  return segments.join(" ").replace(/\s+/g, " ").trim().slice(0, 320);
}

async function sendSmsBatch(numbers, message) {
  const results = [];

  for (const number of numbers) {
    results.push({
      number,
      status: "sent_demo",
      messageLength: message.length
    });
  }

  return {
    results,
    summary: {
      total: numbers.length,
      sent: numbers.length,
      failed: 0
    }
  };
}

function sanitizeEmail(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  if (!value) return { valid: false, message: "Email is required" };
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return isValid ? { valid: true, value } : { valid: false, message: "Enter a valid email address." };
}

function sanitizeRegistrationPassword(rawValue) {
  const value = String(rawValue || "");
  if (!value) return { valid: false, message: "Password is required." };
  if (value.length < 8) return { valid: false, message: "Password must be at least 8 characters." };
  if (/[_-]/.test(value)) {
    return { valid: false, message: "Password cannot contain underscore (_) or hyphen (-)." };
  }
  if (!/\d/.test(value) || !/[^\w\s]/.test(value)) {
    return { valid: false, message: "Password must include at least one number and one special character." };
  }
  return { valid: true, value };
}

function sanitizeDateValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function sanitizeOptionalText(rawValue, maxLength) {
  return String(rawValue || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function sanitizeOptionalLink(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol) ? parsed.toString() : "";
  } catch (error) {
    return "";
  }
}

function sanitizeAdSlot(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  const allowedSlots = new Set(["dashboard", "wallet", "services", "sms"]);
  return allowedSlots.has(value) ? value : "dashboard";
}

function sanitizeLoginPassword(rawValue) {
  const value = String(rawValue || "");
  if (!value) return { valid: false, message: "Password is required." };
  return { valid: true, value };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function serveFile(res, filePath) {
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  fs.readFile(normalizedPath, (error, content) => {
    if (error) {
      return sendJson(res, 404, { error: "File not found" });
    }
    res.writeHead(200, { "Content-Type": getContentType(normalizedPath) });
    res.end(content);
  });
}

function resolvePublicPath(urlPathname) {
  const relativePath = String(urlPathname || "").replace(/^\/+/, "");
  return path.join(PUBLIC_DIR, relativePath);
}

function saveUploadedImage(fileName, fileContentBase64) {
  const extension = path.extname(fileName).toLowerCase();
  const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  if (!allowedExtensions.has(extension)) {
    throw new Error("Only PNG, JPG, JPEG, and WEBP images are supported.");
  }

  const buffer = Buffer.from(fileContentBase64, "base64");
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`;
  const destinationPath = path.join(UPLOADS_DIR, safeName);
  fs.writeFileSync(destinationPath, buffer);
  return `/uploads/${safeName}`;
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  };
  return contentTypes[extension] || "text/plain; charset=utf-8";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
