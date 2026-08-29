const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return { evidence: {}, custody: {} };
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  if (!raw.trim()) {
    return { evidence: {}, custody: {} };
  }
  const parsed = JSON.parse(raw);
  
  return {
    evidence: parsed.evidence || {},
    custody: parsed.custody || {},
  };
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = { readDb, writeDb };
