const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const USERS_PATH = path.join(__dirname, "data", "users.json");
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = "12h"; // long enough to cover a full offline field session

function readUsers() {
  if (!fs.existsSync(USERS_PATH)) return [];
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
}

async function verifyLogin(username, password) {
  const users = readUsers();
  const user = users.find((u) => u.username === username);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { username: user.username, name: user.name };
}

function issueToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Login required." });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET); // fully local, no network needed
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired or invalid. Please log in again." });
  }
}

module.exports = { verifyLogin, issueToken, requireAuth };