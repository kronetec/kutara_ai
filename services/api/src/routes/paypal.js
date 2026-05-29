import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev";
const DOMAIN = process.env.DOMAIN || "https://kutara.org";
const isDemo = !process.env.PAYPAL_CLIENT_ID;

export const paypalRouter = Router();

function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    return jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET);
  } catch { return null; }
}

async function getPayPalToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return null;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const r = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const d = await r.json();
  return d.access_token || null;
}

paypalRouter.get("/demo-status", (req, res) => {
  res.json({ ok: true, demo: isDemo });
});

paypalRouter.post("/create-subscription", async (req, res, n) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    if (isDemo) {
      await pool.query("UPDATE users SET tier='basic' WHERE id=$1", [user.userId]);
      return res.json({
        ok: true, demo: true, redirectUrl: `${DOMAIN}?checkout=success&demo=1`,
        message: "DEMO MODE: Upgraded to Basic (no payment)"
      });
    }

    const token = await getPayPalToken();
    if (!token) return res.status(500).json({ ok: false, error: "PayPal not configured" });

    const planId = process.env.PAYPAL_PLAN_ID;
    if (!planId) return res.status(500).json({ ok: false, error: "PayPal plan ID not configured" });

    const r = await fetch("https://api-m.sandbox.paypal.com/v1/billing/subscriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        application_context: {
          return_url: `${DOMAIN}?checkout=success`,
          cancel_url: `${DOMAIN}?checkout=cancel`,
        },
      }),
    });
    const d = await r.json();
    const link = d.links?.find(l => l.rel === "approve")?.href;
    if (!link) return res.status(500).json({ ok: false, error: "Failed to create PayPal subscription" });
    res.json({ ok: true, url: link, demo: false });
  } catch (e) { n(e); }
});

paypalRouter.post("/cancel-subscription", async (req, res, n) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    if (isDemo) {
      await pool.query("UPDATE users SET tier='free' WHERE id=$1", [user.userId]);
      return res.json({ ok: true, demo: true, message: "DEMO MODE: Downgraded to Free" });
    }

    const dbUser = await pool.query("SELECT paypal_subscription_id FROM users WHERE id=$1", [user.userId]);
    const subId = dbUser.rows[0]?.paypal_subscription_id;
    if (!subId) return res.status(400).json({ ok: false, error: "No active subscription" });

    const token = await getPayPalToken();
    await fetch(`https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Cancelled by user" }),
    });
    await pool.query("UPDATE users SET tier='free', paypal_subscription_id=NULL WHERE id=$1", [user.userId]);
    res.json({ ok: true });
  } catch (e) { n(e); }
});
