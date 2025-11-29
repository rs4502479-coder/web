// // small helper for login/signup
// async function api(path, opts = {}) {
//   const res = await fetch(path, opts);
//   return res.json();
// }

// // Signup
// const btnSignup = document.getElementById("btnSignup");
// if (btnSignup)
//   btnSignup.onclick = async () => {
//     const name = document.getElementById("s_name").value;
//     const email = document.getElementById("s_email").value;
//     const password = document.getElementById("s_password").value;
//     const invite = document.getElementById("s_invite").value;
//     const r = await api("/api/auth/signup", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ name, email, password, invite_code: invite }),
//     });
//     if (r.token) {
//       localStorage.setItem("token", r.token);
//       document.getElementById("s_msg").innerText =
//         "Signup Sucessfully You Can Now LogIn .";
//     } else document.getElementById("s_msg").innerText = JSON.stringify(r);
//   };

// // Login
// const btnLogin = document.getElementById("btnLogin");
// if (btnLogin)
//   btnLogin.onclick = async () => {
//     const email = document.getElementById("l_email").value;
//     const password = document.getElementById("l_password").value;
//     const r = await api("/api/auth/login", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ email, password }),
//     });
//     if (r.token) {
//       localStorage.setItem("token", r.token);
//       document.getElementById("l_msg").innerText = "Logged in. Sucessfully.";
//     } else document.getElementById("l_msg").innerText = JSON.stringify(r);
//   };

// small helper for login/signup
async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  return res.json();
}



// ------------------- SIGNUP -----------------------
const btnSignup = document.getElementById("btnSignup");
if (btnSignup)
  btnSignup.onclick = async (e) => {
    e.preventDefault();

    const identifier = document.getElementById("s_id").value.trim(); // email OR phone
    const name = document.getElementById("s_name").value.trim();
    const password = document.getElementById("s_password").value.trim();
    const invite = document.getElementById("s_invite").value.trim();

    if (!identifier) {
      document.getElementById("s_msg").innerText = "Enter Email or Phone!";
      return;
    }

    const r = await api("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier,
        name,
        password,
        invite_code: invite,
      }),
    });

    if (r.token) {
      localStorage.setItem("token", r.token);
      document.getElementById("s_msg").innerText =
        "Signup Successful! You can login now.";
    } else {
      document.getElementById("s_msg").innerText = r.message || "Error";
    }
  };



// ------------------- LOGIN -----------------------
const btnLogin = document.getElementById("btnLogin");
if (btnLogin)
  btnLogin.onclick = async (e) => {
    e.preventDefault();

    const identifier = document.getElementById("l_id").value.trim(); // email OR phone
    const password = document.getElementById("l_password").value.trim();

    const r = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    if (r.token) {
      localStorage.setItem("token", r.token);
      document.getElementById("l_msg").innerText = "Logged in Successfully.";
      setTimeout(() => (window.location.href = "/dashboard.html"), 500);
    } else {
      document.getElementById("l_msg").innerText = r.message || "Error";
    }
  };
