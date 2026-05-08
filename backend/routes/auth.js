const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const twilio = require("twilio");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10);

const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10 && digits.length <= 15) return `+${digits}`;
  return "";
};

const createOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const toClientUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role.toLowerCase(),
  rewardPoints: user.rewardPoints,
});

const sendSmsOtp = async (phone, otp) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Twilio is not configured");
    }
    return { sid: "dev-mode", delivered: false };
  }

  const client = twilio(accountSid, authToken);
  const message = await client.messages.create({
    body: `Your CitiFix OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    from: fromPhone,
    to: phone,
  });

  return { sid: message.sid, delivered: true };
};

const issueToken = (user) => jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

const TEST_ACCOUNTS = [
  "+916295286325",   // SUPERADMIN (original)
  "+919907519760",   // CITIZEN    (original)
  "+919073568772",   // CITIZEN    (original)
  "+918902304960",   // SUBADMIN   (original)
  // ── Demo accounts (OTP: 123456) ──
  "+910000000001",   // SUPERADMIN (demo)
  "+910000000002",   // SUBADMIN   (demo)
  "+910000000003",   // CITIZEN 1  (demo)
  "+910000000004",   // CITIZEN 2  (demo)
  "+910000000005",   // CITIZEN 3  (demo)
  "+910000000006",   // CITIZEN 4  (demo)
  "+910000000007",   // CITIZEN 5  (demo)
  "+910000000008",   // CITIZEN 6  (demo)
  "+910000000009",   // CITIZEN 7  (demo)
  "+910000000010",   // CITIZEN 8  (demo)
  "+910000000011",   // CITIZEN 9  (demo)
  "+910000000012",   // CITIZEN 10 (demo)
  "+910000000013",   // CITIZEN 11 (demo)
];
const TEST_OTP = "123456";

const consumeValidOtp = async (phone, otp, purpose) => {
  if (TEST_ACCOUNTS.includes(phone) && otp === TEST_OTP) {
    return { id: "test", phone, otpCode: otp, purpose, used: true };
  }

  const otpRecord = await prisma.otpRequest.findFirst({
    where: {
      phone,
      purpose,
      otpCode: otp,
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    return null;
  }

  await prisma.otpRequest.update({
    where: { id: otpRecord.id },
    data: { used: true },
  });

  return otpRecord;
};

router.post("/request-otp", async (req, res) => {
  try {
    const { phone, purpose } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const otpPurpose = String(purpose || "LOGIN").toUpperCase();

    if (!normalizedPhone) {
      return res.status(400).json({ error: "A valid phone number is required" });
    }

    if (!["LOGIN", "REGISTER"].includes(otpPurpose)) {
      return res.status(400).json({ error: "Invalid OTP purpose" });
    }

    if (TEST_ACCOUNTS.includes(normalizedPhone)) {
      return res.json({
        message: "Test account logic applied (OTP bypassed)",
        phone: normalizedPhone,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      });
    }

    const otp = createOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.otpRequest.create({
      data: {
        phone: normalizedPhone,
        otpCode: otp,
        purpose: otpPurpose,
        expiresAt,
      },
    });

    const smsResult = await sendSmsOtp(normalizedPhone, otp);

    res.json({
      message: "OTP sent successfully",
      phone: normalizedPhone,
      expiresAt,
      ...(smsResult.delivered ? {} : { devOtp: otp }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send OTP" });
  }
});

router.post("/login/verify", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || !otp) {
      return res.status(400).json({ error: "Phone and OTP are required" });
    }

    const otpRecord = await consumeValidOtp(normalizedPhone, String(otp).trim(), "LOGIN");
    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found. Please create an account.",
        registrationRequired: true,
        phone: normalizedPhone,
      });
    }

    const token = issueToken(user);

    res.json({
      message: "Login successful",
      token,
      user: toClientUser(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, role, otp } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!name || !normalizedPhone || !otp) {
      return res.status(400).json({ error: "Name, phone, and OTP are required" });
    }

    const otpRecord = await consumeValidOtp(normalizedPhone, String(otp).trim(), "REGISTER");
    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Phone number is already registered" });
    }

    const createdRole = String(role || "citizen").toUpperCase() === "ADMIN" ? "ADMIN" : "CITIZEN";

    const user = await prisma.user.create({
      data: {
        name,
        email: email || null,
        phone: normalizedPhone,
        role: createdRole,
      },
    });

    const token = issueToken(user);

    res.status(201).json({
      message: "User registered successfully",
      user: toClientUser(user),
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: toClientUser(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
