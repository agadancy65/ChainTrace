const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const USERS_PATH = path.join(__dirname, "data", "users.json");

// Demo investigator accounts 
const accounts = [
  { username: "officer joseph", name: "Officer Joseph", password: "12345" },
  { username: "officer dauda", name: "Officer Dauda", password: "12345" },
  { username: "officer agada", name: "Officer Agada", password: "12345" },
  { username: "officer elizabeth", name: "Officer Elizabeth", password: "12345" },
];

async function seed() {
  const users = [];
  for (const acc of accounts) {
    const passwordHash = await bcrypt.hash(acc.password, 10);
    users.push({ username: acc.username, name: acc.name, passwordHash });
  }
  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
  console.log(`Created ${users.length} investigator account(s) in data/users.json`);
}

seed();