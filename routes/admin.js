


const express = require("express");
const db = require("../config/db");
const adminAuth = require("../middleware/adminAuth");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

/* =====================================================
   GET USERS (ADMIN PANEL)
===================================================== */
router.get("/users", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;

    let where = "WHERE 1 ";
    let params = [];

    if (search) {
      where += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [users] = await db.query(
      `
      SELECT id, name, email, phone, balance, is_admin
      FROM users
      ${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), Number(offset)]
    );

    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================
   ADMIN ADD / DEDUCT BALANCE
===================================================== */
router.post("/user/balance", adminAuth, async (req, res) => {
  try {
    const { user_id, action, amount } = req.body;

    if (!user_id || !amount || !["add", "deduct"].includes(action)) {
      return res.json({ success: false, message: "Invalid data" });
    }

    const [[user]] = await db.query(
      "SELECT balance FROM users WHERE id=?",
      [user_id]
    );

    if (!user)
      return res.json({ success: false, message: "User not found" });

    if (action === "deduct" && user.balance < amount)
      return res.json({ success: false, message: "Insufficient user balance" });

    const newBalance =
      action === "add"
        ? Number(user.balance) + Number(amount)
        : Number(user.balance) - Number(amount);

    // ✅ UPDATE USER
    await db.query(
      "UPDATE users SET balance=? WHERE id=?",
      [newBalance, user_id]
    );

    // ✅ TRANSACTION HISTORY
    await db.query(
      `INSERT INTO transactions
       (transaction_id, user_id, type, amount, wallet_before, status)
       VALUES (?,?,?,?,?, 'confirmed')`,
      [
        "ADMIN-" + uuidv4(),
        user_id,
        action === "add" ? "admin_add" : "admin_deduct",
        amount,
        user.balance
      ]
    );

    res.json({ success: true, message: "Balance updated successfully" });
  } catch (err) {
    console.error("ADMIN BALANCE ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


/* =====================================================
   GET TRANSACTIONS (TXID + WALLET ADDRESS)
===================================================== */
router.get("/transactions", adminAuth, async (req, res) => {
  try {
    const { type = "" } = req.query;

    let sql = `
      SELECT 
        t.id,
        t.transaction_id,
        t.user_id,
        u.email,
        u.phone,
        t.type,
        t.txid,
        t.wallet_address,
        t.amount,
        t.status,
        t.created_at
      FROM transactions t
      JOIN users u ON u.id = t.user_id
    `;

    let params = [];
    if (type) {
      sql += " WHERE t.type=? ";
      params.push(type);
    }

    sql += " ORDER BY t.id DESC LIMIT 200";

    const [rows] = await db.query(sql, params);

    res.json({ success: true, transactions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =====================================================
   CONFIRM / REJECT TRANSACTION
===================================================== */
router.post("/transaction/confirm", adminAuth, async (req, res) => {
  try {
    const { transaction_id, status } = req.body;

    const [[tx]] = await db.query(
      "SELECT * FROM transactions WHERE transaction_id=?",
      [transaction_id]
    );
    if (!tx)
      return res.json({ success: false, message: "Transaction not found" });

    if (status === "confirmed" && tx.type === "recharge") {
      await db.query(
        "UPDATE users SET balance = balance + ?, recharge_count = recharge_count + 1 WHERE id=?",
        [tx.amount, tx.user_id]
      );
    }

    if (status === "confirmed" && tx.type === "withdrawal") {
      const [[u]] = await db.query(
        "SELECT balance FROM users WHERE id=?",
        [tx.user_id]
      );

      if (u.balance < tx.amount)
        return res.json({
          success: false,
          message: "Insufficient balance",
        });

      await db.query(
        "UPDATE users SET balance = balance - ? WHERE id=?",
        [tx.amount, tx.user_id]
      );
    }

    await db.query(
      "UPDATE transactions SET status=? WHERE transaction_id=?",
      [status, transaction_id]
    );

    res.json({ success: true, message: "Transaction updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;






