// // const express = require("express");
// // const router = express.Router();
// // const auth = require("../middleware/auth");
// // const db = require("../db");

// // // ===============================
// // // USER MAKES A WITHDRAW REQUEST
// // // ===============================
// // router.post("/request", auth, async (req, res) => {
// //   try {
// //     const user_id = req.user.id;
// //     const { amount, wallet } = req.body;

// //     if (!amount || !wallet)
// //       return res.json({ success: false, message: "All fields required" });

// //     if (amount < 2)
// //       return res.json({
// //         success: false,
// //         message: "Minimum withdrawal is 2 USDT",
// //       });

// //     // USER BALANCE CHECK
// //     const [user] = await db.query("SELECT balance FROM users WHERE id=?", [
// //       user_id,
// //     ]);

// //     if (!user || user.balance < amount) {
// //       return res.json({ success: false, message: "Insufficient balance" });
// //     }

// //     // Deduct balance
// //     await db.query("UPDATE users SET balance = balance - ? WHERE id=?", [
// //       amount,
// //       user_id,
// //     ]);

// //     // Save transaction with status PENDING
// //     await db.query(
// //       `INSERT INTO transactions (transaction_id, user_id, type, amount, status, metadata)
// //        VALUES (UUID(), ?, 'withdrawal', ?, 'pending', ?)`,
// //       [user_id, amount, wallet]
// //     );

// //     return res.json({ success: true, message: "Withdrawal request submitted" });
// //   } catch (err) {
// //     console.log(err);
// //     return res.json({ success: false, message: "Server error" });
// //   }
// // });

// // module.exports = router;






// // // withdraw.js
// const express = require("express");
// const router = express.Router();
// const { auth } = require("../middleware/auth");
// const db = require("../config/db");

// // ===============================
// // USER CREATES WITHDRAW REQUEST
// // ===============================
// router.post("/request", auth, async (req, res) => {
//   try {
//     const user_id = req.userId; // ✅ FIXED
//     const { amount, wallet } = req.body;

//     if (!amount || !wallet)
//       return res.json({ success: false, message: "All fields required" });

//     if (amount < 2)
//       return res.json({
//         success: false,
//         message: "Minimum withdrawal is 2 USDT",
//       });

//     const [rows] = await db.query(
//       "SELECT balance FROM users WHERE id = ?",
//       [user_id]
//     );

//     if (!rows.length)
//       return res.json({ success: false, message: "User not found" });

//     if (rows[0].balance < amount)
//       return res.json({
//         success: false,
//         message: "Insufficient balance",
//       });

//     // Deduct balance
//     await db.query(
//       "UPDATE users SET balance = balance - ? WHERE id = ?",
//       [amount, user_id]
//     );

//     // Save transaction
//     await db.query(
//       `INSERT INTO transactions (transaction_id, user_id, type, amount, status, metadata)
//        VALUES (?, ?, 'withdrawal', ?, 'pending', ?)`,
//       [
//         "TX-" + Date.now(),
//         user_id,
//         amount,
//         JSON.stringify({ wallet }),
//       ]
//     );

//     return res.json({
//       success: true,
//       message: "Withdrawal request submitted",
//     });
//   } catch (err) {
//     console.error("WITHDRAW ERROR:", err);
//     return res.json({ success: false, message: "Server error" });
//   }
// });

// module.exports = router;
















const express = require("express");
const db = require("../config/db");
// const userAuth = require("../middleware/userAuth");
const userAuth = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

/* =====================================================
   USER WITHDRAW REQUEST
===================================================== */
router.post("/request", userAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, wallet } = req.body;

    if (!amount || !wallet)
      return res.json({ success: false, message: "Missing fields" });

    if (amount < 2)
      return res.json({
        success: false,
        message: "Minimum withdrawal is 2 USDT",
      });

    const [[user]] = await db.query(
      "SELECT balance FROM users WHERE id=?",
      [userId]
    );

    if (!user || user.balance < amount)
      return res.json({
        success: false,
        message: "Insufficient balance",
      });

    // 🔒 HOLD BALANCE (NOT DEDUCT YET)
    await db.query(
      `
      INSERT INTO transactions
      (transaction_id, user_id, type, amount, wallet_address, wallet_before, status)
      VALUES (?,?,?,?,?,?, 'pending')
      `,
      [
        "WD-" + uuidv4(),
        userId,
        "withdrawal",
        amount,
        wallet,
        user.balance,
      ]
    );

    res.json({
      success: true,
      message: "Withdrawal request submitted successfully",
    });
  } catch (err) {
    console.error("WITHDRAW ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;


