const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { readDb, writeDb } = require("./db");

const app = express();
const PORT = 8080; 

const UPLOAD_DIR = path.join(__dirname, "uploads");
const upload = multer({ dest: UPLOAD_DIR });

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Computes the SHA-256 hash of a file's bytes on disk.
function hashFile(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}
function hashCustodyEntry({ action, actor, timestamp, previousHash }) {
  const payload = `${action}|${actor}|${timestamp}|${previousHash || ""}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function generateId() {
  return crypto.randomBytes(8).toString("hex");
}

// POST /evidence/upload — hashes the file and creates the "Collected" custody event
app.post("/evidence/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file was uploaded." });
    }

    const { collectedBy, description } = req.body;
    const hash = hashFile(req.file.path);
    const id = generateId();
    const uploadedAt = new Date().toISOString();

    const db = readDb();

    db.evidence[id] = {
      id,
      filename: req.file.originalname,
      hash,
      collectedBy: collectedBy || "",
      description: description || "",
      uploadedAt,
      storedPath: req.file.path, 
    };

    // First custody event: collection itself.
    const timestamp = uploadedAt;
    const previousHash = null;
    const entryHash = hashCustodyEntry({
      action: "Collected",
      actor: collectedBy || "Unknown",
      timestamp,
      previousHash,
    });

    db.custody[id] = [
      {
        action: "Collected",
        actor: collectedBy || "Unknown",
        timestamp,
        entryHash,
        previousHash,
      },
    ];

    writeDb(db);

    res.status(201).json(db.evidence[id]);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Failed to process upload." });
  }
});

// GET /evidence/:id/custody — returns the custody timeline for one item
app.get("/evidence/:id/custody", (req, res) => {
  const { id } = req.params;
  const db = readDb();

  if (!db.evidence[id]) {
    return res.status(404).json({ message: "Evidence not found." });
  }

  const events = db.custody[id] || [];
  res.json(events);
});

// POST /evidence/:id/custody — appends a new custody event
app.post("/evidence/:id/custody", (req, res) => {
  try {
    const { id } = req.params;
    const { action, actor } = req.body;

    const db = readDb();

    if (!db.evidence[id]) {
      return res.status(404).json({ message: "Evidence not found." });
    }
    if (!action || !actor || !String(actor).trim()) {
      return res.status(400).json({ message: "Both action and actor are required." });
    }

    const events = db.custody[id] || [];
    const previousEntry = events[events.length - 1];
    const previousHash = previousEntry ? previousEntry.entryHash : null;
    const timestamp = new Date().toISOString();

    const entryHash = hashCustodyEntry({
      action,
      actor: actor.trim(),
      timestamp,
      previousHash,
    });

    const newEvent = { action, actor: actor.trim(), timestamp, entryHash, previousHash };
    events.push(newEvent);
    db.custody[id] = events;

    writeDb(db);

    res.status(201).json(newEvent);
  } catch (err) {
    console.error("Add custody event error:", err);
    res.status(500).json({ message: "Failed to add custody event." });
  }
});

// GET /evidence — returns all evidence records for the dashboard table
app.get("/evidence", (req, res) => {
  const db = readDb();
  const items = Object.values(db.evidence);
  res.json(items);
});

// GET /evidence/:id — returns one evidence record, for the custody page header
app.get("/evidence/:id", (req, res) => {
  const { id } = req.params;
  const db = readDb();

  if (!db.evidence[id]) {
    return res.status(404).json({ message: "Evidence not found." });
  }

  res.json(db.evidence[id]);
});

app.listen(PORT, () => {
  console.log(`ChainTrace backend running at http://localhost:${PORT}`);
});
