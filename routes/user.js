
// routes/user.js
const express = require("express");
const db = require("../config/db");
const { auth } = require("../middleware/auth");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");


// ================= USER PROFILE ==================
router.get("/profile", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, invite_code, inviter_id, level, recharge_count, balance, created_at, is_admin FROM users WHERE id = ?",
      [req.userId]
    );

    if (!rows.length)
      return res.status(404).json({ success: false, message: "User not found" });

    const u = rows[0];

    res.json({
      success: true,
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        invite_code: u.invite_code,
        inviter_id: u.inviter_id,
        level: u.level,
        recharge_count: u.recharge_count,
        balance: parseFloat(u.balance),
        is_admin: !!u.is_admin,
        created_at: u.created_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error" });
  }
});


// ============== BALANCE =================
router.get("/balance", auth, async (req, res) => {
  try {
    const [[user]] = await db.query("SELECT balance FROM users WHERE id=?", [
      req.userId,
    ]);

    return res.json({
      success: true,
      balance: parseFloat(user.balance),
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error" });
  }
});


// ============= LAST TRANSACTIONS ====================
router.get("/transactions/last", auth, async (req, res) => {
  try {
    const user = req.userId;

    const [lastRe] = await db.query(
      "SELECT amount, created_at FROM transactions WHERE user_id=? AND type='recharge' ORDER BY id DESC LIMIT 1",
      [user]
    );

    const [lastW] = await db.query(
      "SELECT amount, created_at FROM transactions WHERE user_id=? AND type='withdrawal' ORDER BY id DESC LIMIT 1",
      [user]
    );

    res.json({
      success: true,
      lastDeposit: lastRe.length
        ? { amount: parseFloat(lastRe[0].amount), date: lastRe[0].created_at }
        : { amount: 0, date: null },
      lastWithdraw: lastW.length
        ? { amount: parseFloat(lastW[0].amount), date: lastW[0].created_at }
        : { amount: 0, date: null },
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});


// ============= TRANSACTION HISTORY ====================
router.get("/transactions/history", auth, async (req, res) => {
  try {
    const userId = req.userId;

    const page = Math.max(1, parseInt(req.query.page || 1));
    const limit = Math.min(100, parseInt(req.query.limit || 20));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT transaction_id, type, amount, status, metadata, created_at 
       FROM transactions 
       WHERE user_id = ? 
       ORDER BY id DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    res.json({ success: true, page, limit, data: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});


// =============== UPDATE USER ==================
router.post("/update", auth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) return res.json({ success: false, message: "Name required" });

    await db.query("UPDATE users SET name=? WHERE id=?", [name, req.userId]);

    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
});


// =============== BUY TASK ==================
router.post("/buy-task", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const amount = parseFloat(req.body.amount);

    if (!amount || amount <= 0)
      return res.json({ success: false, message: "Invalid amount" });

    const [[user]] = await db.query("SELECT balance FROM users WHERE id=?", [
      userId,
    ]);

    if (user.balance < amount)
      return res.json({ success: false, message: "Insufficient balance" });

    await db.query("UPDATE users SET balance = balance - ? WHERE id=?", [
      amount,
      userId,
    ]);

    await db.query(
      "INSERT INTO user_tasks (user_id, amount, last_claim) VALUES (?,?,NULL)",
      [userId, amount]
    );

    await db.query(
      `INSERT INTO transactions (transaction_id,user_id,type,amount,status,metadata) 
       VALUES (?,?,?,?,?,?)`,
      [
        "TX-" + uuidv4(),
        userId,
        "withdrawal",
        amount,
        "confirmed",
        JSON.stringify({ reason: "task_purchase" }),
      ]
    );

    res.json({ success: true, message: "Task purchased successfully" });
  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
});



// =====================================================================
// ⭐ FINAL FIXED — GET TASK STATUS (NO DUPLICATE, 100% CLEAN)
// =====================================================================
router.get("/tasks/status", auth, async (req, res) => {
  try {
    const userId = req.userId;

    const [rows] = await db.query(
      `SELECT 
         ut.id,
         ut.user_id,
         ut.amount,
         ut.last_claim,
         ut.created_at,
         p.daily_reward
       FROM user_tasks ut
       LEFT JOIN plans p ON p.amount = ut.amount
       WHERE ut.user_id = ?
       ORDER BY ut.id DESC
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) return res.json({ success: true, activePlan: null });

    const t = rows[0];

    return res.json({
      success: true,
      activePlan: {
        id: t.id,
        user_id: t.user_id,
        amount: Number(t.amount),
        daily_reward: Number(t.daily_reward) || 0,
        last_claim: t.last_claim,
        created_at: t.created_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});


// =====================================================================
// ⭐ FINAL FIXED — CLAIM TASK (NO DUPLICATE, 100% CORRECT)
// =====================================================================
router.post("/tasks/claim", auth, async (req, res) => {
  try {
    const userId = req.userId;

    const [[task]] = await db.query(
      `SELECT 
         ut.id,
         ut.last_claim,
         p.daily_reward
       FROM user_tasks ut
       LEFT JOIN plans p ON p.amount = ut.amount
       WHERE ut.user_id = ?
       ORDER BY ut.id DESC
       LIMIT 1`,
      [userId]
    );

    if (!task)
      return res.json({ success: false, message: "No active task found" });

    const reward = Number(task.daily_reward) || 0;

    const today = new Date().toISOString().split("T")[0];
    const last = task.last_claim
      ? new Date(task.last_claim).toISOString().split("T")[0]
      : null;

    if (last === today)
      return res.json({ success: false, message: "Already claimed today" });

    await db.query("UPDATE user_tasks SET last_claim = NOW() WHERE id=?", [
      task.id,
    ]);

    await db.query("UPDATE users SET balance = balance + ? WHERE id=?", [
      reward,
      userId,
    ]);

    res.json({ success: true, reward });
  } catch (err) {
    console.error("CLAIM ERR:", err);
    res.json({ success: false });
  }
});


// ===================== TEAM API ============================
router.get("/team", auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const levels = [];

    const commissionRates = {
      1: 10,
      2: 5,
      3: 2,
    };

    for (let level = 1; level <= 3; level++) {
      const users = await db.query(
        `WITH RECURSIVE team AS (
                    SELECT id, inviter_id, 1 AS level
                    FROM users WHERE inviter_id = ?
                    UNION ALL
                    SELECT u.id, u.inviter_id, t.level + 1
                    FROM users u
                    JOIN team t ON u.inviter_id = t.id
                )
                SELECT * FROM team WHERE level = ?`,
        [userId, level]
      );

      const valid = users.filter((u) => u.active_plan !== null).length;

      const totalIncome = await db.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM transactions
                 WHERE user_id IN (SELECT id FROM users WHERE inviter_id = ?)
                 AND type='bonus'`,
        [userId]
      );

      levels.push({
        level,
        commission: commissionRates[level],
        register: users.length,
        valid: valid,
        income: totalIncome[0].total,
      });
    }

    const summary = {
      team_size: levels.reduce((a, b) => a + b.register, 0),
      team_recharge: 0,
      team_withdraw: 0,
      new_team: 0,
      first_recharge: 0,
      first_withdraw: 0,
    };

    return res.json({
      success: true,
      levels,
      summary,
    });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Server error" });
  }
});

// ===================== CLAIM DAILY TASK =====================
router.post("/claim-task", auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const [u] = await db.query(`SELECT last_task_date FROM users WHERE id=?`, [
      userId,
    ]);

    const today = new Date().toISOString().split("T")[0];

    if (u.last_task_date === today) {
      return res.json({
        success: false,
        message: "Task already completed today",
      });
    }

    await db.query(
      `UPDATE users SET 
                balance = balance + 0.10,
                last_task_date = ?
             WHERE id=?`,
      [today, userId]
    );

    await db.query(
      `INSERT INTO tasks (user_id, task_name, reward, completed_at)
             VALUES (?,?,?,NOW())`,
      [userId, "Daily Team Task", 0.1]
    );

    return res.json({ success: true, message: "Task reward added +$0.10" });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Server error" });
  }
});

// ===================== RECHARGE PURCHASE =====================
router.post("/buy-recharge", auth, async (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;

  try {
    // Create recharge order
    await db.query(
      `INSERT INTO recharge_orders (user_id, amount) VALUES (?,?)`,
      [userId, amount]
    );

    return res.json({
      success: true,
      message: `Recharge order created: $${amount}`,
    });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Server error" });
  }
});


module.exports = router;


