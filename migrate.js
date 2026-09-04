require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not set. Check your .env file.");
}

const OLD_DB_PATH = path.join(__dirname, "data", "db.json");

async function migrate() {
  if (!fs.existsSync(OLD_DB_PATH)) {
    console.log("No old data/db.json found — nothing to migrate.");
    return;
  }

  const oldData = JSON.parse(fs.readFileSync(OLD_DB_PATH, "utf-8"));
  const evidenceEntries = Object.values(oldData.evidence || {});

  if (evidenceEntries.length === 0) {
    console.log("Old db.json has no evidence records — nothing to migrate.");
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("chaintrace");

  let migratedCount = 0;
  let skippedCount = 0;

  for (const evidence of evidenceEntries) {
    const { storedPath, ...rest } = evidence;

    if (!storedPath || !fs.existsSync(storedPath)) {
      console.log(`Skipping "${evidence.filename}" (id: ${evidence.id}) — file missing on disk.`);
      skippedCount += 1;
      continue;
    }

    const fileData = fs.readFileSync(storedPath);

    await db.collection("evidence").insertOne({
      ...rest,
      fileData,
      mimeType: "application/octet-stream",
    });

    const custodyEvents = oldData.custody?.[evidence.id] || [];
    for (const event of custodyEvents) {
      await db.collection("custody").insertOne({
        evidenceId: evidence.id,
        ...event,
      });
    }

    console.log(`Migrated "${evidence.filename}" (id: ${evidence.id}) with ${custodyEvents.length} custody event(s).`);
    migratedCount += 1;
  }

  await client.close();
  console.log(`\nDone. Migrated: ${migratedCount}. Skipped (missing file): ${skippedCount}.`);
  console.log("Note: migrated custody chains may show as \"broken\" under Check Chain Integrity — the hash formula changed after these were created. This is expected, not real tampering.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});