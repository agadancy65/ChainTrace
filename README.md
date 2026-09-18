# ChainTrace

ChainTrace is a digital evidence integrity system built for the NITDA hackathon (Track 5, custody and integrity track). It lets an officer upload a piece of digital evidence, fingerprints it with a hash, tracks every custody event that happens to it afterward, and lets anyone verify at any point whether the file still matches what was originally collected.

The core idea: a system that proves evidence has not been changed, rather than one that just claims it hasn't.

## What it actually does

- **Upload evidence.** An investigator uploads a file, enters a collector name, and the system generates a SHA256 hash (a fingerprint) of the file at that moment.
- **Custody trail.** Every time evidence changes hands (transferred, viewed, exported), that event gets logged with a timestamp, an actor name, and a hash that links back to the previous entry, forming a chain.
- **Verify integrity.** At any point, you can re-hash the stored file and compare it to the original fingerprint. If even one bit has changed, the hashes will not match and the system flags it in red.
- **Chain integrity check.** Separately from the file itself, the custody chain can be checked to confirm no entry has been removed or reordered.
- **Offline handling.** If the network drops mid upload, the app queues the action locally and retries syncing to MongoDB Atlas every twenty seconds until it succeeds.

## Before you run it

You will need:

- Node.js installed (check with `node -v` in your terminal)
- A MongoDB Atlas connection string (or your own local MongoDB if that is what you configured)
- The project's environment variables set up, typically in a `.env` file, holding at minimum the database connection string and whatever JWT secret the auth system uses

Do not commit your `.env` file or your Atlas connection string to GitHub. If you already have a `.gitignore`, confirm `.env` is listed in it before pushing.

## Steps to run it

1. Clone or open the project folder in your terminal.
2. Run `npm install` to pull in all dependencies. Do this first, every time you pull new code, since a missing dependency is the most common reason the app fails to start.
3. Confirm your `.env` file exists and has the correct values. If the app cannot reach the database, it usually fails silently or throws a connection error in the terminal at startup, not later.
4. Run `npm start` to launch the server.
5. Open the app in your browser at whatever local address the terminal prints, commonly `http://localhost:3000` unless it was configured differently.
6. You will land on the login screen. Log in with a valid investigator account. If you do not have one yet, check whether there is a seed script or a signup flow, since this project does not currently support anonymous access.

## How to walk through it once it's running

- Go to Upload, pick a file, enter a collector name, and submit. You should see a green banner confirming the evidence was fingerprinted, along with its hash.
- Go to the Evidence List to see it appear in the dashboard.
- Click into an evidence item to open its Custody Trail. From there you can add a custody event (Transferred, Viewed, Exported, Other) and run Verify Integrity or Check Chain Integrity.

## The demo tools

Two scripts exist outside the running app, meant only for recording the demo video, not for production use:

- **`demo-tamper.js`** deliberately flips one bit in a stored evidence file so you can show Verify Integrity catching it. Run it from the project root with `node demo-tamper.js <evidenceId>`. It is terminal only and cannot be triggered from the web app, which is intentional. An app that shipped a tamper button reachable from the browser would be a real security flaw.
- **`demo-reset.js`** clears the local `data/db.json` file and the `uploads/` folder. It does not touch MongoDB Atlas, so anything already synced will reappear within about twenty seconds. Because of that, it is not very useful as a full reset. For rehearsal, it is simpler to just upload a fresh, distinctly named test file each time rather than trying to wipe everything.

## What not to do

- Do not use real personal data, real names, or real account numbers anywhere in this project, including in demo files. The hackathon rules require synthetic or properly anonymized data only, and everything used for testing and recording should stay that way.
- Do not build a tamper or reset feature into the actual web app or expose either script as an API endpoint. They exist only as local terminal tools.
- Do not commit `.env`, API keys, or your Atlas connection string to GitHub.
- Do not skip `npm install` after pulling new code, even if the app ran fine before. A missing dependency is the most common startup failure.

## Known limitations

This project is a hackathon prototype, not a finished product. Some honest limitations worth knowing: 

- It proves that a file has changed since collection. It does not prevent someone from changing the original file before it is ever uploaded.
- Uploads are currently capped at a set file size (confirm the exact limit in the code before quoting it anywhere, since this may have changed since it was last documented).
- Offline support means the app queues actions locally and retries every twenty seconds. It does not mean the app functions fully offline for extended periods without eventually needing a connection to sync.
- There is no built in way to revoke or rotate investigator accounts from within the app itself yet.
