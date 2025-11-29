/**
 * SMART TEAM ASSISTANT - FINAL SUBMISSION BUILD
 * ----------------------------------------------
 * ✅ Slash Command (/task)
 * ✅ /task help — Help guide
 * ✅ /task summary — Total, Open, Overdue summary
 * ✅ /task stats — Priority analytics
 * ✅ Message Action “Create Task”
 * ✅ SQLite persistent DB
 * ✅ AI-powered priority detection
 */

const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const shortid = require("shortid");
const path = require("path");
const multer = require("multer");

const app = express();
const upload = multer();

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(upload.none());
app.use('/widget', express.static(path.join(__dirname, '..', 'widget')));
// --- Allow Zoho Widget Embedding ---
// --- Allow Zoho Cliq Widget Embedding ---
app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  next();
});


// ---------- SQLite DB ----------
const db = new sqlite3.Database(path.join(__dirname, "db.sqlite"));
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      assignee TEXT,
      due DATE,
      priority TEXT,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ---------- Helper Functions ----------
function detectPriority(title) {
  const lower = title.toLowerCase();
  if (
    lower.includes("urgent") ||
    lower.includes("fix") ||
    lower.includes("error") ||
    lower.includes("issue") ||
    lower.includes("critical")
  )
    return "High";
  if (
    lower.includes("update") ||
    lower.includes("review") ||
    lower.includes("add") ||
    lower.includes("design")
  )
    return "Medium";
  return "Low";
}

function addTask({ title, assignee, due, priority }, cb) {
  const id = shortid.generate();
  db.run(
    `INSERT INTO tasks (id, title, assignee, due, priority, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, title, assignee || "", due || "", priority || "Low", "open"],
    function (err) {
      cb(err, id);
    }
  );
}

// ---------- SLASH COMMAND (/task) ----------
app.post("/api/command/task", (req, res) => {
  const body = req.body || {};
  const text = (body.text || body.arguments || "").trim();
  console.log("COMMAND /task payload:", body);

  // Handle blank input
  if (!text) {
    return res.json({
      text:
        '⚠️ Please provide task details.\nUsage: `/task Title ; assignee:name ; due:YYYY-MM-DD`',
    });
  }

  // Handle /task help
  if (text.toLowerCase() === "help") {
    return res.json({
      text:
        "🧭 *Smart Team Assistant — Help Guide*\n" +
        "Here’s everything you can do:\n\n" +
        "• `/task Title ; assignee:name ; due:YYYY-MM-DD` → Create a new task\n" +
        "• `/task stats` → See task distribution by priority\n" +
        "• `/task summary` → Get total, open, and overdue counts\n" +
        "• Right-click message → Create Task\n" +
        "• Dashboard → Manage visually\n\n" +
        "💡 *Example:*\n`/task Fix payment bug ; assignee:Mani ; due:2025-12-01`",
    });
  }

  // Handle /task stats
  if (text.toLowerCase() === "stats") {
    db.all("SELECT priority, COUNT(*) AS count FROM tasks GROUP BY priority", (err, rows) => {
      if (err) return res.json({ text: "⚠️ Error fetching task stats." });
      if (!rows || !rows.length)
        return res.json({ text: "📊 No tasks yet." });

      const summary = rows.map((r) => `${r.priority}: ${r.count}`).join(" | ");
      res.json({ text: `📊 *Task Priority Stats* → ${summary}` });
    });
    return;
  }

  // Handle /task summary
  if (text.toLowerCase() === "summary") {
    db.all("SELECT * FROM tasks", (err, rows) => {
      if (err) return res.json({ text: "⚠️ Error reading task summary." });
      if (!rows.length)
        return res.json({ text: "📊 No tasks found yet." });

      const total = rows.length;
      const open = rows.filter((t) => t.status === "open").length;
      const today = new Date().toISOString().slice(0, 10);
      const overdue = rows.filter((t) => t.due && t.due < today).length;

      res.json({
        text:
          "📋 *Task Summary*\n" +
          `• Total Tasks: ${total}\n` +
          `• Open: ${open}\n` +
          `• Overdue: ${overdue}`,
      });
    });
    return;
  }

  // Handle task creation
  const parts = text.split(";").map((p) => p.trim()).filter(Boolean);
  const title = parts[0] || "Untitled Task";
  let assignee = "";
  let due = "";

  parts.slice(1).forEach((p) => {
    const lower = p.toLowerCase();
    if (lower.startsWith("assignee:")) assignee = p.split(":")[1]?.trim() || "";
    if (lower.startsWith("due:")) due = p.split(":")[1]?.trim() || "";
  });

  const priority = detectPriority(title);

  addTask({ title, assignee, due, priority }, (err, id) => {
    if (err) {
      console.error("Error creating task:", err);
      return res.json({ text: "⚠️ Error creating task." });
    }

    res.json({
      text:
        `✅ *Task Created!*\n🆔 ID: ${id}\n📝 ${title}\n👤 ${assignee || "—"}\n📅 ${due || "—"}\n⚡ Priority: ${priority}`,
    });
  });
});

// ---------- MESSAGE ACTION ----------
app.post("/api/message-action/create-task", async (req, res) => {
  try {
    const payload = req.body || {};
    console.log("MESSAGE ACTION payload:", JSON.stringify(payload).slice(0, 400));

    const messageText =
      payload.message ||
      payload.message_text ||
      (payload.messageObject && payload.messageObject.content) ||
      "Task from message";

    const userName =
      payload.user ||
      payload.user_name ||
      (payload.created_by && payload.created_by.name) ||
      "Unknown User";

    const priority = detectPriority(messageText);
    const createdAt = new Date().toLocaleString("en-IN", { hour12: true });

    addTask({ title: messageText, assignee: userName, due: "", priority }, (err, id) => {
      if (err) {
        console.error("Error creating task:", err);
        return res.json({ text: "⚠️ Could not create task from message." });
      }

      res.json({
        text:
          "✅ *Task Created from Message!*\n" +
          `📝 ${messageText}\n` +
          `🧑‍💻 Created by: ${userName}\n` +
          `🕒 ${createdAt}\n` +
          `⚡ Priority: ${priority}`,
      });
    });
  } catch (err) {
    console.error("MESSAGE ACTION ERROR:", err);
    res.json({ text: "⚠️ Internal error occurred." });
  }
});

// ---------- HEALTH CHECK ----------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Smart Team Assistant (Final Enhanced Build) running on port ${PORT}`)
);
