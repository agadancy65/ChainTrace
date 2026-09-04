require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { readLocalDb, writeLocalDb, syncNow } = require("./db");

const ALLOWED_ACTIONS = new Set(["Collected", "Transferred", "Viewed", "Exported", "Other"]);

const app = express();
const PORT = process.env.PORT || 8080;

const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

app.use(cors());
app.use(express.json());

let lastSync = { online: false, pushed: 0, pulled: 0, at: null };

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/sync/status", (req, res) => {
  res.json(lastSync);
});

function hashFile(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

function hashCustodyEntry({ evidenceId, action, actor, timestamp, previousHash }) {
  const payload = JSON.stringify({
    version: 1,
    evidenceId,
    action,
    actor,
    timestamp,
    previousHash: previousHash ?? null,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function generateId() {
  return crypto.randomBytes(8).toString("hex");
}

function publicEvidence(evidence) {
  const { storedPath, synced, ...safe } = evidence;
  return safe;
}

function checkCustodyChain(evidenceId, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: false, checkedEvents: 0, brokenAt: null, reason: "No custody events were found." };
  }
  let expectedPreviousHash = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.previousHash !== expectedPreviousHash) {
      return { valid: false, checkedEvents: index, brokenAt: index, reason: "This event does not point to the event before it." };
    }
    const expectedEntryHash = hashCustodyEntry({
      evidenceId,
      action: event.action,
      actor: event.actor,
      timestamp: event.timestamp,
      previousHash: expectedPreviousHash,
    });
    if (event.entryHash !== expectedEntryHash) {
      return { valid: false, checkedEvents: index, brokenAt: index, reason: "This custody event was changed after it was created." };
    }
    expectedPreviousHash = event.entryHash;
  }
  return { valid: true, checkedEvents: events.length, brokenAt: null, reason: null };
}

app.post("/evidence/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file was uploaded." });
    }

    const { collectedBy, description } = req.body;
    const hash = hashFile(req.file.path);
    const id = generateId();
    const uploadedAt = new Date().toISOString();

    const db = readLocalDb();

    db.evidence[id] = {
      id,
      filename: req.file.originalname,
      hash,
      collectedBy: collectedBy || "",
      description: description || "",
      uploadedAt,
      storedPath: req.file.path,
      synced: false,
    };

    const timestamp = uploadedAt;
    const previousHash = null;
    const entryHash = hashCustodyEntry({ evidenceId: id, action: "Collected", actor: collectedBy || "Unknown", timestamp, previousHash });

    db.custody[id] = [
      { action: "Collected", actor: collectedBy || "Unknown", timestamp, entryHash, previousHash, synced: false },
    ];

    writeLocalDb(db);
    res.status(201).json(publicEvidence(db.evidence[id]));
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Failed to process upload." });
  }
});

app.get("/evidence/:id/custody", (req, res) => {
  const { id } = req.params;
  const db = readLocalDb();
  if (!db.evidence[id]) return res.status(404).json({ message: "Evidence not found." });
  const events = db.custody[id] || [];
  res.json(events.map(({ synced, ...rest }) => rest));
});

app.post("/evidence/:id/custody", (req, res) => {
  try {
    const { id } = req.params;
    const { action, actor } = req.body;
    const db = readLocalDb();
    if (!db.evidence[id]) return res.status(404).json({ message: "Evidence not found." });

    const actionText = typeof action === "string" ? action.trim() : "";
    const actorText = typeof actor === "string" ? actor.trim() : "";
    if (!ALLOWED_ACTIONS.has(actionText) || !actorText) {
      return res.status(400).json({ message: "A valid action and actor are required." });
    }

    const events = db.custody[id] || [];
    const previousEntry = events[events.length - 1];
    const previousHash = previousEntry ? previousEntry.entryHash : null;
    const timestamp = new Date().toISOString();
    const entryHash = hashCustodyEntry({ evidenceId: id, action: actionText, actor: actorText, timestamp, previousHash });

    const newEvent = { action: actionText, actor: actorText, timestamp, entryHash, previousHash, synced: false };
    events.push(newEvent);
    db.custody[id] = events;
    db.evidence[id].synced = false; // touched again, worth re-checking on next sync

    writeLocalDb(db);
    const { synced, ...responseEvent } = newEvent;
    res.status(201).json(responseEvent);
  } catch (err) {
    console.error("Add custody event error:", err);
    res.status(500).json({ message: "Failed to add custody event." });
  }
});

app.get("/evidence", (req, res) => {
  const db = readLocalDb();
  res.json(Object.values(db.evidence).map(publicEvidence));
});

app.get("/evidence/:id", (req, res) => {
  const { id } = req.params;
  const db = readLocalDb();
  if (!db.evidence[id]) return res.status(404).json({ message: "Evidence not found." });
  res.json(publicEvidence(db.evidence[id]));
});

app.get("/evidence/:id/file", (req, res) => {
  const { id } = req.params;
  const db = readLocalDb();
  const record = db.evidence[id];
  if (!record) return res.status(404).json({ message: "Evidence not found." });
  if (!fs.existsSync(record.storedPath)) return res.status(404).json({ message: "Stored file is missing on disk." });
  res.download(record.storedPath, record.filename);
});

app.get("/evidence/:id/verify", (req, res) => {
  try {
    const { id } = req.params;
    const db = readLocalDb();
    const item = db.evidence[id];
    if (!item) return res.status(404).json({ message: "Evidence not found." });
    if (!fs.existsSync(item.storedPath)) return res.status(404).json({ message: "Original file is missing from storage." });

    const currentHash = hashFile(item.storedPath);
    const match = currentHash === item.hash;

    res.json({
      filename: item.filename,
      match,
      originalDate: item.uploadedAt,
      originalHash: item.hash,
      currentHash,
    });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ message: "Failed to verify evidence." });
  }
});

app.get("/evidence/:id/chain-check", (req, res) => {
  const { id } = req.params;
  const db = readLocalDb();
  if (!db.evidence[id]) return res.status(404).json({ message: "Evidence not found." });
  const events = db.custody[id] || [];
  const result = checkCustodyChain(id, events);
  res.json({ evidenceId: id, ...result });
});

async function runSyncLoop() {
  const result = await syncNow();
  lastSync = { ...result, at: new Date().toISOString() };
  if (result.online && (result.pushed > 0 || result.pulled > 0)) {
    console.log(`Synced: pushed ${result.pushed}, pulled ${result.pulled}`);
  } else if (!result.online) {
    console.log("Offline — will retry sync in 20s.");
  }
}

app.listen(PORT, () => {
  console.log(`ChainTrace backend running at http://localhost:${PORT}`);
  runSyncLoop();
  setInterval(runSyncLoop, 20000); // try syncing every 20 seconds
});
