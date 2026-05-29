import { Router } from "express";
import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";
import { ollamaChat } from "../ai/ollama.js";
import { anthropicChat } from "../ai/anthropic.js";

const S = process.env.JWT_SECRET || "dev";
export const chatRouter = Router();

function gm(tier, pref) {
  if (pref) return pref.includes("claude") ? "anthropic" : "ollama";
  return tier === "pro" ? "anthropic" : "ollama";
}

function gn(tier) {
  return tier === "pro"
    ? (process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5")
    : tier === "basic"
    ? (process.env.OLLAMA_BASIC_MODEL || "llama3.1:70b")
    : (process.env.OLLAMA_FREE_MODEL || "llama3.1:8b");
}

chatRouter.post("/", async (req, res, n) => {
  try {
    const { message, model, chatId } = req.body;
    if (!message) return res.status(400).json({ ok: false, error: "Message required" });

    let user = { tier: "free", id: null, isAnon: true, questions_remaining: 999 };
    const a = req.headers.authorization;
    if (a) {
      try {
        const d = jwt.verify(a.replace("Bearer ", ""), S);
        const u = await pool.query("SELECT * FROM users WHERE id=$1", [d.userId]);
        if (u.rows[0]) {
          user = { ...u.rows[0], isAnon: false };
        }
      } catch {}
    }

    if (user.tier === "free" && !user.isAnon) {
      if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
        return res.status(429).json({ ok: false, error: "Free limit reached.", lockout: true });
      }
      if (user.questions_remaining <= 0) {
        const l = new Date(Date.now() + 7 * 24 * 3600000).toISOString();
        await pool.query("UPDATE users SET questions_remaining=0, lockout_until=$1 WHERE id=$2", [l, user.id]);
        return res.status(429).json({ ok: false, error: "Free limit reached. Upgrade to Basic.", lockout: true });
      }
    }

    const cid = chatId || uuid();
    const provider = gm(user.tier, model);
    const modelName = model || gn(user.tier);
    const sys = {
      role: "system",
      content: "You are Kutara AI. Always respond in the same language the user writes in. Be helpful, concise, accurate."
    };

    let msgs = [];
    if (chatId && !user.isAnon) {
      const ch = await pool.query("SELECT messages FROM chats WHERE id=$1 AND user_id=$2", [cid, user.id]);
      msgs = ch.rows[0]?.messages || [];
    }

    msgs = [...msgs, { role: "user", content: message }];
    const all = [sys, ...msgs];
    const resp = provider === "anthropic"
      ? await anthropicChat(modelName, all)
      : await ollamaChat(modelName, all);

    msgs.push({ role: "assistant", content: resp });

    if (!user.isAnon) {
      await pool.query(
        `INSERT INTO chats(id, user_id, title, messages)
         VALUES($1, $2, $3, $4)
         ON CONFLICT(id) DO UPDATE SET messages=$5, updated_at=NOW()`,
        [cid, user.id, message.slice(0, 80), JSON.stringify(msgs), JSON.stringify(msgs)]
      );
    }

    if (user.tier === "free" && !user.isAnon) {
      await pool.query("UPDATE users SET questions_remaining = questions_remaining - 1 WHERE id=$1", [user.id]);
      const q = await pool.query("SELECT questions_remaining FROM users WHERE id=$1", [user.id]);
      return res.json({
        ok: true, response: resp, chatId: cid,
        questionsRemaining: q.rows[0]?.questions_remaining || 0
      });
    }

    res.json({ ok: true, response: resp, chatId: cid });
  } catch (e) {
    n(e);
  }
});

chatRouter.get("/", async (req, res, n) => {
  try {
    const a = req.headers.authorization;
    if (!a) return res.json({ ok: true, chats: [] });
    const d = jwt.verify(a.replace("Bearer ", ""), S);
    const r = await pool.query(
      "SELECT id, title, created_at, updated_at FROM chats WHERE user_id=$1 ORDER BY updated_at DESC",
      [d.userId]
    );
    res.json({ ok: true, chats: r.rows });
  } catch {
    res.json({ ok: true, chats: [] });
  }
});

chatRouter.get("/:id", async (req, res, n) => {
  try {
    const r = await pool.query("SELECT * FROM chats WHERE id=$1", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "Chat not found" });
    res.json({ ok: true, chat: r.rows[0] });
  } catch (e) { n(e); }
});

chatRouter.patch("/:id", async (req, res, n) => {
  try {
    const a = req.headers.authorization;
    if (!a) return res.status(401).json({ ok: false, error: "Auth required" });
    const d = jwt.verify(a.replace("Bearer ", ""), S);
    const { title } = req.body;
    if (!title) return res.status(400).json({ ok: false, error: "Title required" });
    await pool.query("UPDATE chats SET title=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3", [title, req.params.id, d.userId]);
    res.json({ ok: true });
  } catch (e) { n(e); }
});

chatRouter.delete("/:id", async (req, res, n) => {
  try {
    await pool.query("DELETE FROM chats WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { n(e); }
});
