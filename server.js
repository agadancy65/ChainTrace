warning: in the working copy of 'db.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'server.js', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/db.js b/db.js[m
[1mindex 18a0b5c..e57149e 100644[m
[1m--- a/db.js[m
[1m+++ b/db.js[m
[36m@@ -20,7 +20,12 @@[m [mfunction readDb() {[m
 }[m
 [m
 function writeDb(db) {[m
[31m-  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));[m
[32m+[m[32m  const directory = path.dirname(DB_PATH);[m
[32m+[m[32m  fs.mkdirSync(directory, { recursive: true });[m
[32m+[m
[32m+[m[32m  const temporaryPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;[m
[32m+[m[32m  fs.writeFileSync(temporaryPath, JSON.stringify(db, null, 2), "utf-8");[m
[32m+[m[32m  fs.renameSync(temporaryPath, DB_PATH);[m
 }[m
 [m
 module.exports = { readDb, writeDb };[m
[1mdiff --git a/server.js b/server.js[m
[1mindex bd96c17..2cfd834 100644[m
[1m--- a/server.js[m
[1m+++ b/server.js[m
[36m@@ -5,6 +5,13 @@[m [mconst crypto = require("crypto");[m
 const fs = require("fs");[m
 const path = require("path");[m
 const { readDb, writeDb } = require("./db");[m
[32m+[m[32mconst ALLOWED_ACTIONS = new Set([[m
[32m+[m[32m  "Collected",[m
[32m+[m[32m  "Transferred",[m
[32m+[m[32m  "Viewed",[m
[32m+[m[32m  "Exported",[m
[32m+[m[32m  "Other",[m
[32m+[m[32m]);[m
 [m
 const app = express();[m
 const PORT = 8080; [m
[36m@@ -24,8 +31,22 @@[m [mfunction hashFile(filePath) {[m
   const fileBuffer = fs.readFileSync(filePath);[m
   return crypto.createHash("sha256").update(fileBuffer).digest("hex");[m
 }[m
[31m-function hashCustodyEntry({ action, actor, timestamp, previousHash }) {[m
[31m-  const payload = `${action}|${actor}|${timestamp}|${previousHash || ""}`;[m
[32m+[m[32mfunction hashCustodyEntry({[m
[32m+[m[32m  evidenceId,[m
[32m+[m[32m  action,[m
[32m+[m[32m  actor,[m
[32m+[m[32m  timestamp,[m
[32m+[m[32m  previousHash,[m
[32m+[m[32m}) {[m
[32m+[m[32m  const payload = JSON.stringify({[m
[32m+[m[32m    version: 1,[m
[32m+[m[32m    evidenceId,[m
[32m+[m[32m    action,[m
[32m+[m[32m    actor,[m
[32m+[m[32m    timestamp,[m
[32m+[m[32m    previousHash: previousHash ?? null,[m
[32m+[m[32m  });[m
[32m+[m
   return crypto.createHash("sha256").update(payload).digest("hex");[m
 }[m
 [m
[36m@@ -61,6 +82,7 @@[m [mapp.post("/evidence/upload", upload.single("file"), (req, res) => {[m
     const timestamp = uploadedAt;[m
     const previousHash = null;[m
     const entryHash = hashCustodyEntry({[m
[32m+[m[32m      evidenceId: id,[m
       action: "Collected",[m
       actor: collectedBy || "Unknown",[m
       timestamp,[m
[36m@@ -110,8 +132,14 @@[m [mapp.post("/evidence/:id/custody", (req, res) => {[m
     if (!db.evidence[id]) {[m
       return res.status(404).json({ message: "Evidence not found." });[m
     }[m
[31m-    if (!action || !actor || !String(actor).trim()) {[m
[31m-      return res.status(400).json({ message: "Both action and actor are required." });[m
[32m+[m
[32m+[m[32m    const actionText = typeof action === "string" ? action.trim() : "";[m
[32m+[m[32m    const actorText = typeof actor === "string" ? actor.trim() : "";[m
[32m+[m
[32m+[m[32m    if (!ALLOWED_ACTIONS.has(actionText) || !actorText) {[m
[32m+[m[32m      return res.status(400).json({[m
[32m+[m[32m        message: "A valid action and actor are required.",[m
[32m+[m[32m      });[m
     }[m
 [m
     const events = db.custody[id] || [];[m
[36m@@ -120,13 +148,21 @@[m [mapp.post("/evidence/:id/custody", (req, res) => {[m
     const timestamp = new Date().toISOString();[m
 [m
     const entryHash = hashCustodyEntry({[m
[31m-      action,[m
[31m-      actor: actor.trim(),[m
[32m+[m[32m      evidenceId: id,[m
[32m+[m[32m      action: actionText,[m
[32m+[m[32m      actor: actorText,[m
       timestamp,[m
       previousHash,[m
     });[m
 [m
[31m-    const newEvent = { action, actor: actor.trim(), timestamp, entryHash, previousHash };[m
[32m+[m[32m    const newEvent = {[m
[32m+[m[32m      action: actionText,[m
[32m+[m[32m      actor: actorText,[m
[32m+[m[32m      timestamp,[m
[32m+[m[32m      entryHash,[m
[32m+[m[32m      previousHash,[m
[32m+[m[32m    };[m
[32m+[m
     events.push(newEvent);[m
     db.custody[id] = events;[m
 [m
