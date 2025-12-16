
// // // const express = require("express");
// // // const db = require("../config/db");
// // // const adminAuth = require("../middleware/adminAuth");

// // // const router = express.Router();

// // // /* =====================================================
// // //    GET ALL USERS (ADMIN PANEL)
// // // ===================================================== */
// // // router.get("/users", adminAuth, async (req, res) => {
// // //   try {
// // //     const [rows] = await db.query(`
// // //       SELECT id, name, email, invite_code, inviter_id, level, 
// // //       recharge_count, balance, is_admin, created_at 
// // //       FROM users ORDER BY id DESC
// // //     `);

// // //     res.json({ success: true, users: rows });
// // //   } catch (err) {
// // //     console.error(err);
// // //     res.status(500).json({ success: false, message: "Server error" });
// // //   }
// // // });

// // // /* =====================================================
// // //    CONFIRM / FAIL TRANSACTION (RECHARGE + WITHDRAW)
// // // ===================================================== */
// // // router.post("/transaction/confirm", adminAuth, async (req, res) => {
// // //   try {
// // //     const { transaction_id, status } = req.body;

// // //     if (!transaction_id || !status)
// // //       return res.status(400).json({ success: false, message: "Missing fields" });

// // //     const [[tx]] = await db.query(
// // //       "SELECT * FROM transactions WHERE transaction_id=?",
// // //       [transaction_id]
// // //     );

// // //     if (!tx)
// // //       return res.status(404).json({ success: false, message: "Transaction not found" });

// // //     /* ============================
// // //        CONFIRM RECHARGE
// // //     ============================ */
// // //     if (status === "confirmed" && tx.type === "recharge") {
// // //       // Add balance
// // //       await db.query(
// // //         "UPDATE users SET balance = balance + ?, recharge_count = recharge_count + 1 WHERE id=?",
// // //         [tx.amount, tx.user_id]
// // //       );

// // //       // Update level from recharge_count
// // //       const [[user]] = await db.query(
// // //         "SELECT recharge_count FROM users WHERE id=?",
// // //         [tx.user_id]
// // //       );

// // //       const rc = user.recharge_count;
// // //       let newLevel = 1;

// // //       if (rc >= 50) newLevel = 5;
// // //       else if (rc >= 30) newLevel = 4;
// // //       else if (rc >= 20) newLevel = 3;
// // //       else if (rc >= 10) newLevel = 2;

// // //       await db.query("UPDATE users SET level=? WHERE id=?", [
// // //         newLevel,
// // //         tx.user_id,
// // //       ]);
// // //     }

// // //     /* ============================
// // //        CONFIRM WITHDRAW
// // //     ============================ */
// // //     if (status === "confirmed" && tx.type === "withdrawal") {
// // //       const [[u]] = await db.query("SELECT balance FROM users WHERE id=?", [
// // //         tx.user_id,
// // //       ]);

// // //       if (u.balance < tx.amount)
// // //         return res.json({
// // //           success: false,
// // //           message: "User does not have enough balance",
// // //         });

// // //       await db.query(
// // //         "UPDATE users SET balance = balance - ? WHERE id=?",
// // //         [tx.amount, tx.user_id]
// // //       );
// // //     }

// // //     // Update transaction status
// // //     await db.query(
// // //       "UPDATE transactions SET status=? WHERE transaction_id=?",
// // //       [status, transaction_id]
// // //     );

// // //     res.json({ success: true, message: "Transaction updated" });

// // //   } catch (err) {
// // //     console.error(err);
// // //     res.status(500).json({ success: false, message: "Server error" });
// // //   }
// // // });

// // // /* =====================================================
// // //    PROMOTE / DEMOTE ADMIN
// // // ===================================================== */
// // // router.post("/user/:id/promote", adminAuth, async (req, res) => {
// // //   try {
// // //     const isAdmin = req.body.isAdmin ? 1 : 0;

// // //     await db.query(
// // //       "UPDATE users SET is_admin=? WHERE id=?",
// // //       [isAdmin, req.params.id]
// // //     );

// // //     res.json({ success: true, message: "Role updated" });
// // //   } catch (err) {
// // //     res.status(500).json({ success: false, message: "Server error" });
// // //   }
// // // });

// // // /* =====================================================
// // //    GET PENDING WITHDRAW REQUESTS
// // // ===================================================== */
// // // router.get("/withdraw/pending", adminAuth, async (req, res) => {
// // //   try {
// // //     const [rows] = await db.query(
// // //       "SELECT * FROM transactions WHERE type='withdrawal' AND status='pending'"
// // //     );

// // //     res.json({ success: true, data: rows });
// // //   } catch (err) {
// // //     res.json({ success: false, message: "Server error" });
// // //   }
// // // });

// // // /* =====================================================
// // //    APPROVE WITHDRAW
// // // ===================================================== */
// // // router.post("/withdraw/approve", adminAuth, async (req, res) => {
// // //   try {
// // //     const { id } = req.body;

// // //     const [[tx]] = await db.query("SELECT * FROM transactions WHERE id=?", [id]);

// // //     if (!tx)
// // //       return res.json({ success: false, message: "Request not found" });

// // //     await db.query(
// // //       "UPDATE users SET balance = balance - ? WHERE id=?",
// // //       [tx.amount, tx.user_id]
// // //     );

// // //     await db.query(
// // //       "UPDATE transactions SET status='confirmed' WHERE id=?",
// // //       [id]
// // //     );

// // //     res.json({ success: true, message: "Withdrawal Approved" });

// // //   } catch (err) {
// // //     res.json({ success: false, message: "Server error" });
// // //   }
// // // });

// // // /* =====================================================
// // //    REJECT WITHDRAW (Refund)
// // // ===================================================== */
// // // router.post("/withdraw/reject", adminAuth, async (req, res) => {
// // //   try {
// // //     const { id } = req.body;

// // //     const [[tx]] = await db.query("SELECT * FROM transactions WHERE id=?", [id]);

// // //     if (!tx)
// // //       return res.json({ success: false, message: "Request not found" });

// // //     await db.query(
// // //       "UPDATE users SET balance = balance + ? WHERE id=?",
// // //       [tx.amount, tx.user_id]
// // //     );

// // //     await db.query(
// // //       "UPDATE transactions SET status='failed' WHERE id=?",
// // //       [id]
// // //     );

// // //     res.json({ success: true, message: "Withdrawal Rejected" });

// // //   } catch (err) {
// // //     res.json({ success: false, message: "Server error" });
// // //   }
// // // });

// // // module.exports = router;



// const express = require("express");
// const db = require("../config/db");
// const adminAuth = require("../middleware/adminAuth");

// const router = express.Router();

// /* =====================================================
//       GET USERS (SEARCH + FILTER + PAGINATION)
// ===================================================== */
// router.get("/users", adminAuth, async (req, res) => {
//   try {
//     let {
//       page = 1,
//       limit = 20,
//       search = "",
//       is_admin,
//       level,
//       min_balance,
//       max_balance,
//     } = req.query;

//     page = parseInt(page);
//     limit = parseInt(limit);
//     const offset = (page - 1) * limit;

//     let where = "WHERE 1 ";
//     let params = [];

//     /* ========== SEARCH ========== */
//     if (search) {
//       where += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR invite_code LIKE ?) `;
//       params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
//     }

//     /* ========== FILTERING ========== */
//     if (is_admin === "0" || is_admin === "1") {
//       where += " AND is_admin = ? ";
//       params.push(is_admin);
//     }

//     if (level) {
//       where += " AND level = ? ";
//       params.push(level);
//     }

//     if (min_balance) {
//       where += " AND balance >= ? ";
//       params.push(min_balance);
//     }

//     if (max_balance) {
//       where += " AND balance <= ? ";
//       params.push(max_balance);
//     }

//     /* ========== GET USERS ========== */
//     const [rows] = await db.query(
//       `
//       SELECT id, name, email, phone, invite_code, inviter_id, level,
//              recharge_count, balance, is_admin, created_at
//       FROM users
//       ${where}
//       ORDER BY id DESC
//       LIMIT ? OFFSET ?
//     `,
//       [...params, limit, offset]
//     );

//     /* ========== COUNT TOTAL ========== */
//     const [[count]] = await db.query(
//       `SELECT COUNT(*) AS total FROM users ${where}`,
//       params
//     );

//     res.json({
//       success: true,
//       page,
//       limit,
//       total: count.total,
//       users: rows,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// /* =====================================================
//    DELETE USER
// ===================================================== */
// router.delete("/user/:id", adminAuth, async (req, res) => {
//   try {
//     const id = req.params.id;

//     await db.query("DELETE FROM users WHERE id=?", [id]);

//     res.json({ success: true, message: "User deleted successfully" });
//   } catch (err) {
//     res.json({ success: false, message: "Server error" });
//   }
// });

// /* =====================================================
//    CONFIRM / FAIL TRANSACTION
// ===================================================== */
// router.post("/transaction/confirm", adminAuth, async (req, res) => {
//   try {
//     const { transaction_id, status } = req.body;

//     if (!transaction_id || !status)
//       return res
//         .status(400)
//         .json({ success: false, message: "Missing fields" });

//     const [[tx]] = await db.query(
//       "SELECT * FROM transactions WHERE transaction_id=?",
//       [transaction_id]
//     );

//     if (!tx)
//       return res
//         .status(404)
//         .json({ success: false, message: "Transaction not found" });

//     /* ========== CONFIRM RECHARGE ========== */
//     if (status === "confirmed" && tx.type === "recharge") {
//       await db.query(
//         "UPDATE users SET balance = balance + ?, recharge_count = recharge_count + 1 WHERE id=?",
//         [tx.amount, tx.user_id]
//       );

//       const [[user]] = await db.query(
//         "SELECT recharge_count FROM users WHERE id=?",
//         [tx.user_id]
//       );

//       const rc = user.recharge_count;
//       let newLevel = 1;

//       if (rc >= 50) newLevel = 5;
//       else if (rc >= 30) newLevel = 4;
//       else if (rc >= 20) newLevel = 3;
//       else if (rc >= 10) newLevel = 2;

//       await db.query("UPDATE users SET level=? WHERE id=?", [
//         newLevel,
//         tx.user_id,
//       ]);
//     }

//     /* ========== CONFIRM WITHDRAW ========== */
//     if (status === "confirmed" && tx.type === "withdrawal") {
//       const [[u]] = await db.query("SELECT balance FROM users WHERE id=?", [
//         tx.user_id,
//       ]);

//       if (u.balance < tx.amount)
//         return res.json({
//           success: false,
//           message: "User does not have enough balance",
//         });

//       await db.query("UPDATE users SET balance = balance - ? WHERE id=?", [
//         tx.amount,
//         tx.user_id,
//       ]);
//     }

//     await db.query("UPDATE transactions SET status=? WHERE transaction_id=?", [
//       status,
//       transaction_id,
//     ]);

//     res.json({ success: true, message: "Transaction updated" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// /* =====================================================
//    PROMOTE / DEMOTE ADMIN
// ===================================================== */
// router.post("/user/:id/promote", adminAuth, async (req, res) => {
//   try {
//     const isAdmin = req.body.isAdmin ? 1 : 0;

//     await db.query("UPDATE users SET is_admin=? WHERE id=?", [
//       isAdmin,
//       req.params.id,
//     ]);

//     res.json({ success: true, message: "Role updated" });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// /* =====================================================
//       PENDING WITHDRAW REQUESTS
// ===================================================== */
// router.get("/withdraw/pending", adminAuth, async (req, res) => {
//   try {
//     const [rows] = await db.query(
//       "SELECT * FROM transactions WHERE type='withdrawal' AND status='pending'"
//     );

//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.json({ success: false, message: "Server error" });
//   }
// });

// /* =====================================================
//    APPROVE WITHDRAW
// ===================================================== */
// router.post("/withdraw/approve", adminAuth, async (req, res) => {
//   try {
//     const { id } = req.body;

//     const [[tx]] = await db.query("SELECT * FROM transactions WHERE id=?", [
//       id,
//     ]);

//     if (!tx) return res.json({ success: false, message: "Request not found" });

//     await db.query("UPDATE users SET balance = balance - ? WHERE id=?", [
//       tx.amount,
//       tx.user_id,
//     ]);

//     await db.query("UPDATE transactions SET status='confirmed' WHERE id=?", [
//       id,
//     ]);

//     res.json({ success: true, message: "Withdrawal Approved" });
//   } catch (err) {
//     res.json({ success: false, message: "Server error" });
//   }
// });

// /* =====================================================
//    REJECT WITHDRAW
// ===================================================== */
// router.post("/withdraw/reject", adminAuth, async (req, res) => {
//   try {
//     const { id } = req.body;

//     const [[tx]] = await db.query("SELECT * FROM transactions WHERE id=?", [
//       id,
//     ]);

//     if (!tx) return res.json({ success: false, message: "Request not found" });

//     await db.query("UPDATE users SET balance = balance + ? WHERE id=?", [
//       tx.amount,
//       tx.user_id,
//     ]);

//     await db.query("UPDATE transactions SET status='failed' WHERE id=?", [id]);

//     res.json({ success: true, message: "Withdrawal Rejected" });
//   } catch (err) {
//     res.json({ success: false, message: "Server error" });
//   }
// });

// /* =====================================================
//    ADMIN LOGOUT
// ===================================================== */
// router.get("/logout", adminAuth, (req, res) => {
//   res.json({ success: true, message: "Logged out successfully" });
// });




// /* =====================================================
//    GET ALL TRANSACTIONS (ADMIN PANEL)
// ===================================================== */
// /* =====================================================
//    GET ALL TRANSACTIONS (ADMIN PANEL)
// ===================================================== */
// router.get("/transactions", adminAuth, async (req, res) => {
//   try {
//     const { type = "" } = req.query;

//     let sql = `
//       SELECT 
//         t.id,
//         t.transaction_id,
//         t.user_id,
//         u.email,
//         u.phone,
//         t.type,
//         t.amount,
//         t.status,
//         t.created_at,
//         t.txid,
//         t.wallet_address
//       FROM transactions t
//       LEFT JOIN users u ON u.id = t.user_id
//     `;

//     let params = [];

//     if (type) {
//       sql += " WHERE t.type = ? ";
//       params.push(type);
//     }

//     sql += " ORDER BY t.id DESC LIMIT 200";

//     const [rows] = await db.query(sql, params);

//     res.json({
//       success: true,
//       transactions: rows
//     });
//   } catch (err) {
//     console.error("ADMIN TRANSACTIONS ERROR:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// // router.get("/transactions", adminAuth, async (req, res) => {
// //   try {
// //     const { type = "" } = req.query;

// //     let sql = `
// //       SELECT 
// //         t.id,
// //         t.transaction_id,
// //         t.user_id,
// //         u.email,
// //         t.type,
// //         t.amount,
// //         t.status,
// //         t.created_at
// //       FROM transactions t
// //       LEFT JOIN users u ON u.id = t.user_id
// //     `;

// //     let params = [];

// //     if (type) {
// //       sql += " WHERE t.type = ? ";
// //       params.push(type);
// //     }

// //     sql += " ORDER BY t.id DESC LIMIT 200";

// //     const [rows] = await db.query(sql, params);

// //     res.json({
// //       success: true,
// //       transactions: rows
// //     });
// //   } catch (err) {
// //     console.error("ADMIN TRANSACTIONS ERROR:", err);
// //     res.status(500).json({ success: false, message: "Server error" });
// //   }
// // });


// /* =====================================================
//    ADMIN ADD / DEDUCT BALANCE
// ===================================================== */
// router.post("/user/balance", adminAuth, async (req, res) => {
//   try {
//     const { user_id, action, amount } = req.body;

//     if (!user_id || !action || !amount)
//       return res.json({ success: false, message: "Missing fields" });

//     const amt = parseFloat(amount);
//     if (amt <= 0)
//       return res.json({ success: false, message: "Invalid amount" });

//     const [[user]] = await db.query(
//       "SELECT balance FROM users WHERE id=?",
//       [user_id]
//     );

//     if (!user)
//       return res.json({ success: false, message: "User not found" });

//     if (action === "add") {
//       await db.query(
//         "UPDATE users SET balance = balance + ? WHERE id=?",
//         [amt, user_id]
//       );
//     } 
//     else if (action === "deduct") {
//       if (user.balance < amt)
//         return res.json({
//           success: false,
//           message: "Insufficient balance"
//         });

//       await db.query(
//         "UPDATE users SET balance = balance - ? WHERE id=?",
//         [amt, user_id]
//       );
//     } 
//     else {
//       return res.json({ success: false, message: "Invalid action" });
//     }

//     // Optional: log admin transaction
//     await db.query(
//       `INSERT INTO transactions 
//        (transaction_id, user_id, type, amount, status)
//        VALUES (UUID(), ?, ?, ?, 'confirmed')`,
//       [user_id, action === "add" ? "admin_add" : "admin_deduct", amt]
//     );

//     res.json({ success: true, message: "Balance updated successfully" });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });



// module.exports = router;














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

    if (!user_id || !amount || !["add", "deduct"].includes(action))
      return res.json({ success: false, message: "Invalid data" });

    const [[user]] = await db.query(
      "SELECT balance FROM users WHERE id=?",
      [user_id]
    );
    if (!user)
      return res.json({ success: false, message: "User not found" });

    if (action === "deduct" && user.balance < amount)
      return res.json({
        success: false,
        message: "Insufficient user balance",
      });

    const newBalance =
      action === "add"
        ? user.balance + Number(amount)
        : user.balance - Number(amount);

    await db.query("UPDATE users SET balance=? WHERE id=?", [
      newBalance,
      user_id,
    ]);

    await db.query(
      `
      INSERT INTO transactions
      (transaction_id, user_id, type, amount, wallet_before, status)
      VALUES (?,?,?,?,?, 'confirmed')
      `,
      [
        "ADMIN-" + uuidv4(),
        user_id,
        action === "add" ? "admin_add" : "admin_deduct",
        amount,
        user.balance,
      ]
    );

    res.json({ success: true, message: "Balance updated successfully" });
  } catch (err) {
    console.error(err);
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





