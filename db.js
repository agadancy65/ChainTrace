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
  const directory = path.dirname(DB_PATH);
  fs.mkdirSync(directory, { recursive: true });

  const temporaryPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(db, null, 2), "utf-8");
  fs.renameSync(temporaryPath, DB_PATH);
}

module.exports = { readDb, writeDb };
