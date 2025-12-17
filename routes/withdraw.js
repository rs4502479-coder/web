
// routes/withdraw.js
const express = require("express");
const db = require("../config/db");
const { auth } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

/* ===============================
   USER WITHDRAW REQUEST
================================ */
router.post("/request", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { amount, wallet } = req.body;

    if (!amount || !wallet) {
      return res.json({ success: false, message: "All fields required" });
    }

    if (amount < 2) {
      return res.json({
        success: false,
        message: "Minimum withdrawal is 2 USDT",
      });
    }

    const [[user]] = await db.query(
      "SELECT balance FROM users WHERE id = ?",
      [userId]
    );

    if (!user || Number(user.balance) < Number(amount)) {
      return res.json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // ❌ balance abhi deduct mat karo (admin approve karega)

    await db.query(
      `
      INSERT INTO transactions
      (transaction_id, user_id, type, amount, wallet_address, status)
      VALUES (?, ?, 'withdrawal', ?, ?, 'pending')
      `,
      [
        "WD-" + uuidv4(),
        userId,
        amount,
        wallet
      ]
    );

    res.json({
      success: true,
      message: "Withdrawal request submitted",
    });

  } catch (err) {
    console.error("WITHDRAW ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
