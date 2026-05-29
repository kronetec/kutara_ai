import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getMetrics } from "../middleware/metrics.js";

const S = process.env.JWT_SECRET || "dev";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../../.env");

export const adminRouter = Router();

function ra(req, res, n) {
  try {
    jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), S);
    n();
  } catch {
    res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

adminRouter.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    const t = jwt.sign({ userId: "admin", tier: "admin" }, S, { expiresIn: "12h" });
    return res.json({ ok: true, token: t });
  }
  res.status(401).json({ ok: false, error: "Invalid credentials" });
});

adminRouter.get("/users", ra, async (req, res, n) => {
  try {
    const r = await pool.query("SELECT id, email, name, tier, questions_remaining, created_at FROM users ORDER BY created_at DESC");
    res.json({ ok: true, users: r.rows });
  } catch (e) { n(e); }
});

adminRouter.post("/users/:id/reset", ra, async (req, res, n) => {
  try {
    await pool.query("UPDATE users SET questions_remaining=5, lockout_until=NULL WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { n(e); }
});

adminRouter.get("/system", ra, async (req, res, n) => {
  try {
    const u = await pool.query("SELECT COUNT(*) FROM users");
    const c = await pool.query("SELECT COUNT(*) FROM chats");
    const t = await pool.query("SELECT tier, COUNT(*)::int FROM users GROUP BY tier");
    const tiers = {};
    t.rows.forEach(r => { tiers[r.tier] = r.count; });
    res.json({ ok: true, system: { users: parseInt(u.rows[0].count), chats: parseInt(c.rows[0].count), tiers, version: "2.0.0" } });
  } catch (e) { n(e); }
});

adminRouter.get("/metrics", ra, getMetrics);

adminRouter.get("/config", ra, (req, res) => {
  const cfg = {
    stripe: {
      secretKey: maskValue(process.env.STRIPE_SECRET_KEY),
      webhookSecret: maskValue(process.env.STRIPE_WEBHOOK_SECRET),
      basicPriceId: process.env.STRIPE_BASIC_PRICE_ID || "",
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID || "",
      clientSecret: maskValue(process.env.PAYPAL_CLIENT_SECRET),
    },
  };
  res.json({ ok: true, config: cfg });
});

adminRouter.post("/config", ra, async (req, res) => {
  try {
    const { stripe, paypal } = req.body;
    let envContent = "";
    try {
      envContent = fs.readFileSync(ENV_PATH, "utf-8");
    } catch {
      envContent = "";
    }

    const updates = {};
    if (stripe) {
      if (stripe.secretKey) updates.STRIPE_SECRET_KEY = stripe.secretKey;
      if (stripe.webhookSecret) updates.STRIPE_WEBHOOK_SECRET = stripe.webhookSecret;
      if (stripe.basicPriceId) updates.STRIPE_BASIC_PRICE_ID = stripe.basicPriceId;
    }
    if (paypal) {
      if (paypal.clientId) updates.PAYPAL_CLIENT_ID = paypal.clientId;
      if (paypal.clientSecret) updates.PAYPAL_CLIENT_SECRET = paypal.clientSecret;
    }

    const lines = envContent.split("\n");
    const existingKeys = new Set();
    const newLines = lines.map(line => {
      const match = line.match(/^([A-Z_]+)=/);
      if (!match) return line;
      const key = match[1];
      existingKeys.add(key);
      if (updates[key] !== undefined) {
        return `${key}=${updates[key]}`;
      }
      return line;
    });

    for (const [key, value] of Object.entries(updates)) {
      if (!existingKeys.has(key)) {
        newLines.push(`${key}=${value}`);
      }
    }

    fs.writeFileSync(ENV_PATH, newLines.join("\n") + "\n");
    res.json({ ok: true, message: "Configuration saved. Restart API to apply." });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function maskValue(val) {
  if (!val || val.length < 8) return val || "";
  return val.slice(0, 4) + "..." + val.slice(-4);
}
