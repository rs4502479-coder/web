# MyPayApp — Full Backend (Node/Express + MySQL) + Simple Frontend

This project is a ready-to-run full-stack example implementing your requirements: MySQL backend, signup/login, invite codes, transactions (recharge/withdraw/bonus), daily task with 12-hour cooldown, level-up system, admin endpoints, and a simple HTML/CSS/JS frontend (user + admin dashboards).

---

## Project structure

```
mypayapp/
├─ package.json
├─ .env.example
├─ README.md
├─ sql/
│  └─ schema.sql
├─ server.js
├─ config/
│  └─ db.js
├─ middleware/
│  └─ auth.js
├─ routes/
│  ├─ auth.js
│  ├─ transactions.js
│  ├─ tasks.js
│  └─ admin.js
├─ public/
│  ├─ index.html          # signup/login page
│  ├─ dashboard.html      # user dashboard (after login)
│  ├─ admin.html          # simple admin panel
│  └─ assets/
│     ├─ app.js
│     └─ styles.css
```

---

Below are all files. Create the directory and paste the files accordingly.

---

## package.json

```json
{
  "name": "mypayapp",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.0",
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.0",
    "mysql2": "^3.2.0",
    "uuid": "^9.0.0"
  }
}
```

---

## .env.example

```
PORT=3000
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=
DATABASE_NAME=mypayapp
JWT_SECRET=change_this_secret
NEW_USER_BONUS=120
REFERRAL_BONUS=10
DAILY_BASE=25
DAILY_PCT=0.02
```

---

## sql/schema.sql

```sql
CREATE DATABASE IF NOT EXISTS mypayapp;
USE mypayapp;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150) UNIQUE,
    password_hash VARCHAR(255),
    invite_code VARCHAR(30) UNIQUE,
    inviter_id INT,
    level INT DEFAULT 1,
    recharge_count INT DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(80) UNIQUE,
    user_id INT,
    type ENUM('recharge','withdrawal','bonus') NOT NULL,
    amount DECIMAL(12,2),
    status ENUM('pending','confirmed','failed') DEFAULT 'pending',
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    task_name VARCHAR(80),
    completed_at TIMESTAMP,
    reward DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inviter_id INT,
    invitee_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## config/db.js

```js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || 'localhost',
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'mypayapp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
```

---

## middleware/auth.js

```js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

async function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'No token' });
  const token = h.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.isAdmin = decoded.isAdmin || false;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admins only' });
  next();
}

module.exports = { auth, adminOnly };
```

---

## routes/auth.js

```js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const NEW_USER_BONUS = parseFloat(process.env.NEW_USER_BONUS || '120');
const REFERRAL_BONUS = parseFloat(process.env.REFERRAL_BONUS || '10');

function genInvite() {
  return 'INV-' + Math.random().toString(36).substr(2,6).toUpperCase();
}

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, invite_code } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email+password required' });

    const [ex] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (ex.length) return res.status(400).json({ error: 'Email exists' });

    const hash = await bcrypt.hash(password, 10);

    let inviter_id = null;
    if (invite_code) {
      const [r] = await db.query('SELECT id FROM users WHERE invite_code = ?', [invite_code]);
      if (r.length) inviter_id = r[0].id;
    }

    let code = genInvite();
    let [c] = await db.query('SELECT id FROM users WHERE invite_code = ?', [code]);
    while (c.length) {
      code = genInvite();
      [c] = await db.query('SELECT id FROM users WHERE invite_code = ?', [code]);
    }

    const [ins] = await db.query(
      'INSERT INTO users (name,email,password_hash,invite_code,inviter_id,balance) VALUES (?,?,?,?,?,?)',
      [name,email,hash,code,inviter_id,NEW_USER_BONUS]
    );
    const userId = ins.insertId;

    // record signup bonus
    await db.query('INSERT INTO transactions (transaction_id,user_id,type,amount,status,metadata) VALUES (?,?,?,?,?,?)',
      ['TX-'+uuidv4(), userId, 'bonus', NEW_USER_BONUS, 'confirmed', JSON.stringify({reason:'signup'})]
    );

    if (inviter_id) {
      await db.query('UPDATE users SET balance = balance + ? WHERE id = ?', [REFERRAL_BONUS, inviter_id]);
      await db.query('INSERT INTO transactions (transaction_id,user_id,type,amount,status,metadata) VALUES (?,?,?,?,?,?)',
        ['TX-'+uuidv4(), inviter_id, 'bonus', REFERRAL_BONUS, 'confirmed', JSON.stringify({reason:'referral', invitee:userId})]
      );
      await db.query('INSERT INTO invites (inviter_id, invitee_id) VALUES (?,?)', [inviter_id, userId]);
    }

    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, invite_code: code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [r] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!r.length) return res.status(400).json({ error: 'Invalid' });
    const u = r[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid' });
    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

---

## routes/tasks.js

```js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const DAILY_BASE = parseFloat(process.env.DAILY_BASE || '25');
const DAILY_PCT = parseFloat(process.env.DAILY_PCT || '0.02');
const DAILY_REWARD = +(DAILY_BASE * DAILY_PCT).toFixed(2);

router.post('/complete', auth, async (req, res) => {
  const userId = req.userId;
  try {
    const [last] = await db.query('SELECT completed_at FROM tasks WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1', [userId]);
    if (last.length) {
      const lastTime = new Date(last[0].completed_at).getTime();
      const diff = Date.now() - lastTime;
      if (diff < 12 * 60 * 60 * 1000) {
        return res.status(400).json({ error: 'Task cooldown (12 hours)' });
      }
    }

    await db.query('INSERT INTO tasks (user_id, task_name, completed_at, reward) VALUES (?,?,NOW(),?)', [userId, 'daily_task', DAILY_REWARD]);
    await db.query('UPDATE users SET balance = balance + ? WHERE id = ?', [DAILY_REWARD, userId]);
    await db.query('INSERT INTO transactions (transaction_id,user_id,type,amount,status,metadata) VALUES (?,?,?,?,?,?)',
      ['TX-'+uuidv4(), userId, 'bonus', DAILY_REWARD, 'confirmed', JSON.stringify({source:'daily_task'})]
    );

    res.json({ ok: true, reward: DAILY_REWARD });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

---

## routes/transactions.js

```js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// create recharge -> pending until admin/webhook confirms
router.post('/recharge', auth, async (req, res) => {
  const userId = req.userId;
  const { amount, metadata } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const txid = 'TX-R-' + uuidv4();
    await db.query('INSERT INTO transactions (transaction_id,user_id,type,amount,status,metadata) VALUES (?,?,?,?,?,?)',
      [txid, userId, 'recharge', amount, 'pending', JSON.stringify(metadata || {})]
    );
    res.json({ ok: true, transaction_id: txid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// create withdraw request
router.post('/withdraw', auth, async (req, res) => {
  const userId = req.userId;
  const { amount, account_info } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  try {
    // check balance
    const [u] = await db.query('SELECT balance FROM users WHERE id = ?', [userId]);
    if (!u.length) return res.status(400).json({ error: 'User not found' });
    if (parseFloat(u[0].balance) < parseFloat(amount)) return res.status(400).json({ error: 'Insufficient balance' });

    const txid = 'TX-W-' + uuidv4();
    await db.query('INSERT INTO transactions (transaction_id,user_id,type,amount,status,metadata) VALUES (?,?,?,?,?,?)',
      [txid, userId, 'withdrawal', amount, 'pending', JSON.stringify({account_info})]
    );
    res.json({ ok: true, transaction_id: txid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

---

## routes/admin.js

```js
const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Basic admin: for demo we protect by checking a special header token on JWT (in real world implement roles)
// For convenience we use an 'isAdmin' flag on token; to create admin, you can manually set isAdmin in token when testing.

// list users
router.get('/users', auth, async (req, res) => {
  try {
    // simple admin gate: only allow if token had isAdmin true
    if (!req.isAdmin) return res.status(403).json({ error: 'Admins only' });
    const [r] = await db.query('SELECT id,name,email,invite_code,inviter_id,level,recharge_count,balance,created_at FROM users');
    res.json({ users: r });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// confirm transaction (admin/webhook)
router.post('/transaction/confirm', auth, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admins only' });
  const { transaction_id, status } = req.body; // status: confirmed/failed
  if (!transaction_id || !status) return res.status(400).json({ error: 'Bad request' });
  try {
    const [t] = await db.query('SELECT * FROM transactions WHERE transaction_id = ?', [transaction_id]);
    if (!t.length) return res.status(404).json({ error: 'Tx not found' });
    const tx = t[0];

    if (tx.status === status) return res.json({ ok: true });

    if (status === 'confirmed') {
      if (tx.type === 'recharge') {
        // atomic-ish: update transactions then user
        await db.query('UPDATE users SET balance = balance + ?, recharge_count = recharge_count + 1 WHERE id = ?', [tx.amount, tx.user_id]);
        // update level
        const [u] = await db.query('SELECT recharge_count FROM users WHERE id = ?', [tx.user_id]);
        const rc = u[0].recharge_count;
        let newLevel = 1;
        if (rc >= 50) newLevel = 5;
        else if (rc >= 30) newLevel = 4;
        else if (rc >= 20) newLevel = 3;
        else if (rc >= 10) newLevel = 2;
        await db.query('UPDATE users SET level = ? WHERE id = ?', [newLevel, tx.user_id]);
      } else if (tx.type === 'withdrawal') {
        // deduct balance only when confirmed
        await db.query('UPDATE users SET balance = balance - ? WHERE id = ?', [tx.amount, tx.user_id]);
      }
    }

    await db.query('UPDATE transactions SET status = ? WHERE transaction_id = ?', [status, transaction_id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
```

---

## server.js

```js
const express = require('express');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const txRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(express.json());

app.use('/', express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/transactions', txRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server running on port', PORT));
```

---

## public/assets/styles.css

```css
body{font-family: Arial, Helvetica, sans-serif; max-width:900px;margin:20px auto;padding:10px}
input,button,select{padding:8px;margin:6px 0;width:100%;box-sizing:border-box}
.container{background:#fff;padding:12px;border-radius:6px;box-shadow: 0 2px 6px rgba(0,0,0,0.08)}
header{display:flex;justify-content:space-between;align-items:center}
nav a{margin-right:10px}
.card{border:1px solid #eee;padding:10px;margin:10px 0}
.small{font-size:0.9rem;color:#666}

/* simple responsive */
@media(min-width:700px){input,button{width:50%}}
```

---

## public/index.html (signup + login)

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>MyPayApp - Login / Signup</title>
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body class="container">
  <header>
    <h2>MyPayApp</h2>
    <nav><a href="/dashboard.html">Dashboard</a> | <a href="/admin.html">Admin</a></nav>
  </header>

  <div class="card">
    <h3>Signup</h3>
    <input id="s_name" placeholder="Name">
    <input id="s_email" placeholder="Email">
    <input id="s_password" placeholder="Password" type="password">
    <input id="s_invite" placeholder="Invite code (optional)">
    <button id="btnSignup">Sign up</button>
    <div id="s_msg" class="small"></div>
  </div>

  <div class="card">
    <h3>Login</h3>
    <input id="l_email" placeholder="Email">
    <input id="l_password" placeholder="Password" type="password">
    <button id="btnLogin">Login</button>
    <div id="l_msg" class="small"></div>
  </div>

  <script src="/assets/app.js"></script>
</body>
</html>
```

---

## public/dashboard.html (simple client-side dashboard)

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dashboard</title>
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body class="container">
  <header><h2>Dashboard</h2><a href="/">Back</a></header>
  <div id="content"></div>
  <script src="/assets/app.js"></script>
  <script>
    (async ()=>{
      const token = localStorage.getItem('token');
      const content = document.getElementById('content');
      if (!token) { content.innerHTML = '<p>Please login on <a href="/">home</a></p>'; return; }
      // fetch user basic info
      try {
        // simple: show actions
        content.innerHTML = `
          <div class='card'>
            <button id='daily'>Complete Daily Task</button>
            <button id='recharge'>Create Recharge (test)</button>
            <button id='withdraw'>Create Withdraw (test)</button>
            <pre id='out'></pre>
          </div>
        `;
        document.getElementById('daily').onclick = async ()=>{
          const r = await fetch('/api/tasks/complete',{method:'POST', headers:{'Authorization': 'Bearer '+token}});
          document.getElementById('out').innerText = JSON.stringify(await r.json(),null,2);
        };
        document.getElementById('recharge').onclick = async ()=>{
          const a = prompt('Amount to recharge (test)');
          const r = await fetch('/api/transactions/recharge',{method:'POST', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}, body: JSON.stringify({amount: parseFloat(a)})});
          document.getElementById('out').innerText = JSON.stringify(await r.json(),null,2);
        };
        document.getElementById('withdraw').onclick = async ()=>{
          const a = prompt('Amount to withdraw (test)');
          const r = await fetch('/api/transactions/withdraw',{method:'POST', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}, body: JSON.stringify({amount: parseFloat(a)})});
          document.getElementById('out').innerText = JSON.stringify(await r.json(),null,2);
        };
      } catch(e) { content.innerText = 'Error'; }
    })();
  </script>
</body>
</html>
```

---

## public/admin.html (very basic admin client)

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Admin Panel</title>
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body class="container">
  <h2>Admin Panel (simple)</h2>
  <p>To use admin, login normally then set token in localStorage as an admin token. (For demo create a token that has isAdmin true.)</p>
  <div class='card'>
    <button id='listUsers'>List Users</button>
    <input id='txid' placeholder='Transaction ID to confirm'>
    <select id='txstatus'><option value='confirmed'>confirmed</option><option value='failed'>failed</option></select>
    <button id='confirmTx'>Confirm Tx</button>
    <pre id='out'></pre>
  </div>
  <script>
    document.getElementById('listUsers').onclick = async ()=>{
      const token = localStorage.getItem('token');
      const r = await fetch('/api/admin/users',{headers:{'Authorization':'Bearer '+token}});
      document.getElementById('out').innerText = JSON.stringify(await r.json(),null,2);
    };
    document.getElementById('confirmTx').onclick = async ()=>{
      const txid = document.getElementById('txid').value;
      const status = document.getElementById('txstatus').value;
      const token = localStorage.getItem('token');
      const r = await fetch('/api/admin/transaction/confirm',{method:'POST', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}, body: JSON.stringify({transaction_id:txid, status})});
      document.getElementById('out').innerText = JSON.stringify(await r.json(),null,2);
    };
  </script>
</body>
</html>
```

---

## public/assets/app.js

```js
// small helper for login/signup
async function api(path, opts={}){
  const res = await fetch(path, opts);
  return res.json();
}

// Signup
const btnSignup = document.getElementById('btnSignup');
if (btnSignup) btnSignup.onclick = async ()=>{
  const name = document.getElementById('s_name').value;
  const email = document.getElementById('s_email').value;
  const password = document.getElementById('s_password').value;
  const invite = document.getElementById('s_invite').value;
  const r = await api('/api/auth/signup', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name,email,password,invite_code:invite})});
  if (r.token) { localStorage.setItem('token', r.token); document.getElementById('s_msg').innerText = 'Signed up. Token saved.' }
  else document.getElementById('s_msg').innerText = JSON.stringify(r);
};

// Login
const btnLogin = document.getElementById('btnLogin');
if (btnLogin) btnLogin.onclick = async ()=>{
  const email = document.getElementById('l_email').value;
  const password = document.getElementById('l_password').value;
  const r = await api('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,password})});
  if (r.token) { localStorage.setItem('token', r.token); document.getElementById('l_msg').innerText = 'Logged in. Token saved.' }
  else document.getElementById('l_msg').innerText = JSON.stringify(r);
};
```

---

## README.md (quick run)

```md
# MyPayApp

1. Install dependencies: `npm install`
2. Create a .env (copy .env.example) and set DB credentials.
3. Run SQL in `sql/schema.sql` to create DB and tables, or let your app connect to an existing DB.
4. Start server: `npm start` (or `npm run dev` with nodemon).
5. Open http://localhost:3000

Notes:
- This is a demo starter. For production: add validation, CSRF protection, real RBAC, HTTPS, rate-limiting, and DB transactions for atomic updates.
- To create an admin token for testing, you can generate a JWT with payload `{id: <userId>, isAdmin: true}` signed with your JWT_SECRET.
```

---

## Final notes

This canvas contains the full backend + frontend starter. Copy files into your project and run. If you want, I can now:

- Provide a ready-to-download ZIP of the project,
- Convert the backend to use an ORM (Sequelize/Prisma), or
- Implement email verification / password reset / KYC flows.

Tell me which next step you want and I will continue.
