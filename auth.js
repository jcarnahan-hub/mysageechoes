// ── SAGEECHOES: Auth ──

let currentUser = null;

function getCurrentUser() {
  return currentUser;
}

function initAuth() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      if (user) {
        hideSignInScreen();
        updateUserBadge(user);
        resolve(user);
      } else {
        showSignInScreen();
        resolve(null);
      }
    });
  });
}

function showSignInScreen() {
  let screen = document.getElementById('signin-screen');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'signin-screen';
    screen.style.cssText = `
      position: fixed; inset: 0; z-index: 9000;
      background: var(--bg-primary);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 20px; padding: 40px 20px;
      font-family: var(--font-body);
    `;
    screen.innerHTML = `
      <img src="icon.png" style="width:80px;border-radius:18px;">
      <h1 style="font-family:var(--font-heading);color:var(--accent-gold);
        font-size:1.8rem;font-weight:600;margin:0;">SageEchoes</h1>
      <p style="color:var(--text-secondary);margin:0;text-align:center;max-width:280px;">
        Sign in to sync your library across devices
      </p>
      <button id="googleSignInBtn" style="
        display:flex;align-items:center;gap:12px;
        background:var(--bg-card);color:var(--text-primary);
        border:1px solid var(--border);border-radius:24px;
        padding:12px 24px;font-size:0.95rem;font-family:var(--font-body);
        cursor:pointer;transition:box-shadow 0.2s;font-weight:500;
      ">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
        </svg>
        Sign in with Google
      </button>
      <p style="color:var(--text-muted);font-size:0.78rem;text-align:center;max-width:260px;">
        Your library stays private and is only accessible to you
      </p>
    `;
    document.body.appendChild(screen);

    document.getElementById('googleSignInBtn').addEventListener('click', signInWithGoogle);
  } else {
    screen.style.display = 'flex';
  }
}

function hideSignInScreen() {
  const screen = document.getElementById('signin-screen');
  if (screen) screen.style.display = 'none';
}

function updateUserBadge(user) {
  let badge = document.getElementById('user-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'user-badge';
    badge.style.cssText = `
      display:flex;align-items:center;gap:8px;cursor:pointer;
      flex-shrink:0;
    `;
    badge.title = 'Click to sign out';
    badge.addEventListener('click', () => {
      if (confirm(`Sign out of ${user.displayName || user.email}?`)) signOut();
    });

    const headerRight = document.querySelector('.header-top > div');
    if (headerRight) headerRight.prepend(badge);
  }

  const avatar = user.photoURL
    ? `<img src="${user.photoURL}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
    : `<div style="width:28px;height:28px;border-radius:50%;background:var(--accent-gold);
        display:flex;align-items:center;justify-content:center;
        color:var(--bg-primary);font-size:0.75rem;font-weight:600;">
        ${(user.displayName || user.email || '?')[0].toUpperCase()}
      </div>`;

  badge.innerHTML = avatar;
}

async function signInWithGoogle() {
  const btn = document.getElementById('googleSignInBtn');
  if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (err) {
    console.error('Sign-in error:', err);
    if (btn) {
      btn.innerHTML = 'Sign in with Google';
      btn.disabled = false;
    }
  }
}

async function signOut() {
  await auth.signOut();
  currentUser = null;
  const badge = document.getElementById('user-badge');
  if (badge) badge.remove();
  showSignInScreen();
}
