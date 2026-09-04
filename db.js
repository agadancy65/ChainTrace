require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const LOCAL_DB_PATH = path.join(__dirname, "data", "db.json");
const uri = process.env.MONGODB_URI;

let mongoClient = null;
let mongoDb = null;

// --- Local storage (always available, this is the source of truth on this device) ---

function readLocalDb() {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    return { evidence: {}, custody: {} };
  }
  const raw = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
  if (!raw.trim()) return { evidence: {}, custody: {} };
  const parsed = JSON.parse(raw);
  return {
    evidence: parsed.evidence || {},
    custody: parsed.custody || {},
  };
}

function writeLocalDb(db) {
  fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
}

// --- Mongo connection (best-effort — never throws if offline) ---

async function tryConnectMongo() {
  if (!uri) return null;

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
      await mongoClient.connect();
    }
    // Actually verify the connection works right now, not just that connect()
    // resolved at some point in the past — this is what catches "went offline
    // after connecting" instead of silently reusing a dead connection.
    const testDb = mongoClient.db("chaintrace");
    await testDb.command({ ping: 1 });
    mongoDb = testDb;
    return mongoDb;
  } catch (err) {
    mongoClient = null;
    mongoDb = null;
    return null;
  }
}

// --- Background sync: push local unsynced records up, pull remote-only records down ---

async function syncNow() {
  const database = await tryConnectMongo();
  if (!database) {
    return { online: false, pushed: 0, pulled: 0 };
  }

  try {
    const localDb = readLocalDb();
    let pushed = 0;
    let pulled = 0;

    // Push: any local evidence not yet synced
    for (const id of Object.keys(localDb.evidence)) {
      const evidence = localDb.evidence[id];
      if (evidence.synced) continue;

      if (!evidence.storedPath || !fs.existsSync(evidence.storedPath)) {
        continue; // file missing locally, skip until it exists
      }

      const fileData = fs.readFileSync(evidence.storedPath);
      const { storedPath, synced, ...rest } = evidence;

      await database.collection("evidence").updateOne(
        { id },
        { $set: { ...rest, fileData, mimeType: evidence.mimeType || "application/octet-stream" } },
        { upsert: true }
      );

      evidence.synced = true;
      pushed += 1;

      const events = localDb.custody[id] || [];
      for (const event of events) {
        if (event.synced) continue;
        await database.collection("custody").updateOne(
          { evidenceId: id, entryHash: event.entryHash },
          { $set: { evidenceId: id, ...event } },
          { upsert: true }
        );
        event.synced = true;
      }
    }

    // Pull: any remote evidence this device doesn't have locally yet
    const remoteEvidence = await database.collection("evidence").find({}).toArray();
    for (const remote of remoteEvidence) {
      if (localDb.evidence[remote.id]) continue;

      const localUploadDir = path.join(__dirname, "uploads");
      fs.mkdirSync(localUploadDir, { recursive: true });
      const localPath = path.join(localUploadDir, `${remote.id}_${remote.filename}`);
      fs.writeFileSync(localPath, remote.fileData.buffer ?? remote.fileData);

      localDb.evidence[remote.id] = {
        id: remote.id,
        filename: remote.filename,
        hash: remote.hash,
        collectedBy: remote.collectedBy,
        description: remote.description,
        uploadedAt: remote.uploadedAt,
        storedPath: localPath,
        synced: true,
      };

      const remoteCustody = await database
        .collection("custody")
        .find({ evidenceId: remote.id })
        .toArray();

      localDb.custody[remote.id] = remoteCustody.map((e) => ({
        action: e.action,
        actor: e.actor,
        timestamp: e.timestamp,
        entryHash: e.entryHash,
        previousHash: e.previousHash,
        synced: true,
      }));

      pulled += 1;
    }

    writeLocalDb(localDb);
    return { online: true, pushed, pulled };
  } catch (err) {
    // Went offline mid-sync, or a real Mongo error — either way, don't crash,
    // don't dump a stack trace, just report offline and let the next cycle retry.
    mongoClient = null;
    mongoDb = null;
    return { online: false, pushed: 0, pulled: 0 };
  }
}

module.exports = { readLocalDb, writeLocalDb, syncNow, tryConnectMongo };