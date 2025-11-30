const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

module.exports = async function (req, res, next) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) return res.status(401).json({ success: false, message: "No token" });

  // token might be "Bearer <token>" or just the token
  const token = header.includes(" ") ? header.split(" ")[1] : header;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // simple check that token includes isAdmin flag OR check users table later
    if (!decoded || !decoded.isAdmin) {
      return res.status(403).json({ success: false, message: "Not an admin" });
    }
    req.userId = decoded.id;
    req.isAdmin = true;
    next();
  } catch (err) {
    console.error("adminAuth error:", err);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
