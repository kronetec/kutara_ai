import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev";
const DOMAIN = process.env.DOMAIN || "https://kutara.org";

export const stripeRouter = Router();

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
}

function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    return jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET);
  } catch {
    return null;
  }
}

stripeRouter.post("/create-checkout-session", async (req, res, n) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const stripe = await getStripe();
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    const dbUser = await pool.query("SELECT * FROM users WHERE id=$1", [user.userId]);
    if (!dbUser.rows[0]) return res.status(404).json({ ok: false, error: "User not found" });

    const u = dbUser.rows[0];
    const basicPriceId = process.env.STRIPE_BASIC_PRICE_ID;

    let customerId = u.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: u.email,
        name: u.name || u.email,
        metadata: { userId: u.id },
      });
      customerId = customer.id;
      await pool.query("UPDATE users SET stripe_customer_id=$1 WHERE id=$2", [customerId, u.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: basicPriceId, quantity: 1 }],
      success_url: `${DOMAIN}?checkout=success`,
      cancel_url: `${DOMAIN}?checkout=cancel`,
      metadata: { userId: u.id },
    });

    res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e) {
    n(e);
  }
});

stripeRouter.post("/create-portal-session", async (req, res, n) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const stripe = await getStripe();
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    const dbUser = await pool.query("SELECT stripe_customer_id FROM users WHERE id=$1", [user.userId]);
    if (!dbUser.rows[0]?.stripe_customer_id) {
      return res.status(400).json({ ok: false, error: "No subscription found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser.rows[0].stripe_customer_id,
      return_url: DOMAIN,
    });

    res.json({ ok: true, url: session.url });
  } catch (e) {
    n(e);
  }
});

stripeRouter.post("/webhook", async (req, res) => {
  const stripe = await getStripe();
  if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    const raw = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(
      typeof raw === "string" ? raw : JSON.stringify(raw),
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ ok: false, error: "Invalid signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (!userId) {
          console.error("No userId in session metadata");
          break;
        }
        const subId = session.subscription;
        await pool.query(
          "UPDATE users SET tier='basic', stripe_subscription_id=$1 WHERE id=$2",
          [subId, userId]
        );
        console.log(`User ${userId} upgraded to basic (sub: ${subId})`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const status = sub.status;
        if (status === "past_due" || status === "canceled" || status === "incomplete_expired") {
          await pool.query(
            "UPDATE users SET tier='free' WHERE stripe_customer_id=$1 AND tier='basic'",
            [sub.customer]
          );
          console.log(`Customer ${sub.customer} downgraded to free (sub status: ${status})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await pool.query(
          "UPDATE users SET tier='free', stripe_subscription_id=NULL WHERE stripe_customer_id=$1",
          [sub.customer]
        );
        console.log(`Customer ${sub.customer} subscription deleted, downgraded to free`);
        break;
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error("Webhook handler error:", e);
    res.status(500).json({ ok: false, error: "Webhook handler failed" });
  }
});
