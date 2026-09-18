// demo-tamper.js
// Demonstration tool. Deliberately alters a stored evidence file so the
// integrity check can be shown detecting it. Not part of the running app,
// and not reachable from the web interface.

const fs = require("fs");
const { readLocalDb } = require("./db");

const id = process.argv[2];

if (!id) {
  console.log("Usage: node demo-tamper.js <evidenceId>");
  process.exit(1);
}

const db = readLocalDb();
const record = db.evidence[id];

if (!record) {
  console.log(`No evidence found with id ${id}`);
  process.exit(1);
}

if (!fs.existsSync(record.storedPath)) {
  console.log(`Stored file is missing: ${record.storedPath}`);
  process.exit(1);
}

const buffer = fs.readFileSync(record.storedPath);
console.log(`File: ${record.filename}`);
console.log(`Size before: ${buffer.length} bytes`);

buffer[0] = buffer[0] ^ 1; // flip a single bit in the very first byte

fs.writeFileSync(record.storedPath, buffer);

console.log(`Size after:  ${buffer.length} bytes`);
console.log("One single bit has been changed. The file is the same size.");
console.log("Run Verify Integrity now.");