/* =====================================================
   WINTER ARC TRACKER — Firebase App Logic
   =====================================================
   Uses Firebase Auth (Email/Password) + Firestore
   for cross-device cloud sync.
   ===================================================== */

'use strict';

// ═══════════════════════════════════════════
// FIREBASE CONFIGURATION
// ═══════════════════════════════════════════
// Replace these values with YOUR Firebase project config.
// Get them from: Firebase Console → Project Settings → General → Your apps → Web app

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ═══════════════════════════════════════════
// INIT FIREBASE
// ═══════════════════════════════════════════

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// Enable offline persistence (data works even without internet)
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence: Multiple tabs open, only works in one.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence: Browser does not support it.');
  }
});

// ═══════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════

let currentUser   = null;  // Firebase auth user
let userProfile   = null;  // { name, username, email }
let userData      = null;  // { habits, habitLog, sleepLog, monthlyGoals }
let currentYear   = new Date().getFullYear();
let currentMonth  = new Date().getMonth();
let sleepModalDay = null;
let saveTimer     = null;  // Debounce timer for auto-save

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ═══════════════════════════════════════════
// LOADING OVERLAY
// ═══════════════════════════════════════════

function showLoading(msg) {
  const overlay = document.getElementById('loading-overlay');
  const text = document.getElementById('loading-text');
  if (msg) text.textContent = msg;
  overlay.classList.remove('hide');
  overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.add('hide');
  setTimeout(() => { overlay.style.display = 'none'; }, 400);
}

// ═══════════════════════════════════════════
// AUTH STATE LISTENER (runs on page load)
// ═══════════════════════════════════════════

auth.onAuthStateChanged(async (user) => {
  if (user) {
    showLoading('Loading your data...');
    currentUser = user;
    try {
      await loadUserProfile();
      await loadUserData();
      launchApp();
    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Error loading data. Please try again.');
      logout();
    }
  } else {
    currentUser = null;
    userProfile = null;
    userData    = null;
    document.getElementById('app-section').style.display  = 'none';
    document.getElementById('auth-section').style.display = 'block';
    showPage('landing-page');
    hideLoading();
  }
});

// ═══════════════════════════════════════════
// AUTH PAGES
// ═══════════════════════════════════════════

function showPage(pageId) {
  document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(pageId);
  if (pg) pg.classList.add('active');
}

// ═══════════════════════════════════════════
// SIGN UP (Firebase Auth + Firestore profile)
// ═══════════════════════════════════════════

async function handleSignup(e) {
  e.preventDefault();
  const name     = document.getElementById('su-name').value.trim();
  const username = document.getElementById('su-username').value.trim().toLowerCase();
  const email    = document.getElementById('su-email').value.trim().toLowerCase();
  const password = document.getElementById('su-password').value;
  const confirm  = document.getElementById('su-confirm').value;
  const errEl    = document.getElementById('signup-error');
  const btn      = document.getElementById('signup-btn');

  errEl.textContent = '';

  if (password !== confirm) {
    errEl.textContent = '❌ Passwords do not match.'; return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    errEl.textContent = '❌ Username: 3-20 chars, letters/numbers/underscore only.'; return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    // Check if username is taken
    const usernameDoc = await db.collection('usernames').doc(username).get();
    if (usernameDoc.exists) {
      errEl.textContent = '❌ Username already taken. Please choose another.';
      btn.disabled = false;
      btn.textContent = 'Create Account';
      return;
    }

    // Create auth user
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;

    // Save profile to Firestore
    await db.collection('users').doc(uid).set({
      name,
      username,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Reserve username (for uniqueness check)
    await db.collection('usernames').doc(username).set({ uid });

    // Initialize empty user data
    await db.collection('users').doc(uid).collection('data').doc('tracker').set(newUserData());

    showLoading('Setting up your account...');
    // Auth state listener will handle the rest
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    errEl.textContent = '❌ ' + firebaseErrorMsg(err);
  }
}

// ═══════════════════════════════════════════
// LOGIN (Firebase Auth — email or username)
// ═══════════════════════════════════════════

async function handleLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('li-username').value.trim().toLowerCase();
  const password   = document.getElementById('li-password').value;
  const errEl      = document.getElementById('login-error');
  const btn        = document.getElementById('login-btn');

  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    let email = identifier;

    // If identifier doesn't look like an email, treat it as a username
    if (!identifier.includes('@')) {
      const usernameDoc = await db.collection('usernames').doc(identifier).get();
      if (!usernameDoc.exists) {
        errEl.textContent = '❌ Username not found.';
        btn.disabled = false;
        btn.textContent = 'Sign In';
        return;
      }
      // Look up the user's email from their profile
      const uid = usernameDoc.data().uid;
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        errEl.textContent = '❌ Account data not found.';
        btn.disabled = false;
        btn.textContent = 'Sign In';
        return;
      }
      email = userDoc.data().email;
    }

    await auth.signInWithEmailAndPassword(email, password);
    showLoading('Signing in...');
    // Auth state listener handles the rest
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Sign In';
    errEl.textContent = '❌ ' + firebaseErrorMsg(err);
  }
}

// ═══════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════

async function logout() {
  showLoading('Signing out...');
  try {
    await auth.signOut();
  } catch (err) {
    console.error('Logout error:', err);
  }
  // Auth state listener handles UI reset
  document.getElementById('signup-form')?.reset();
  document.getElementById('login-form')?.reset();
  document.getElementById('signup-error').textContent = '';
  document.getElementById('login-error').textContent  = '';
  const signupBtn = document.getElementById('signup-btn');
  const loginBtn  = document.getElementById('login-btn');
  if (signupBtn) { signupBtn.disabled = false; signupBtn.textContent = 'Create Account'; }
  if (loginBtn)  { loginBtn.disabled = false;  loginBtn.textContent = 'Sign In'; }
}

// ═══════════════════════════════════════════
// FIREBASE ERROR MESSAGES (human-readable)
// ═══════════════════════════════════════════

function firebaseErrorMsg(err) {
  const map = {
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/invalid-email':          'Invalid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Invalid email or password.',
    'auth/too-many-requests':      'Too many failed attempts. Please wait and try again.',
    'auth/network-request-failed': 'Network error. Please check your internet.',
  };
  return map[err.code] || err.message || 'Something went wrong. Please try again.';
}

// ═══════════════════════════════════════════
// DATA: Load & Save from Firestore
// ═══════════════════════════════════════════

function newUserData() {
  return {
    habits:       [],
    habitLog:     {},
    sleepLog:     {},
    monthlyGoals: {}
  };
}

async function loadUserProfile() {
  const doc = await db.collection('users').doc(currentUser.uid).get();
  userProfile = doc.exists ? doc.data() : { name: '', username: '', email: currentUser.email };
}

async function loadUserData() {
  const doc = await db.collection('users').doc(currentUser.uid).collection('data').doc('tracker').get();
  userData = doc.exists ? doc.data() : newUserData();

  // Ensure all fields exist (in case of partial data)
  if (!userData.habits)       userData.habits       = [];
  if (!userData.habitLog)     userData.habitLog     = {};
  if (!userData.sleepLog)     userData.sleepLog     = {};
  if (!userData.monthlyGoals) userData.monthlyGoals = {};
}

// Debounced save — waits 800ms after last change, then saves to Firestore
function saveUserData() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!currentUser || !userData) return;
    try {
      await db.collection('users').doc(currentUser.uid)
        .collection('data').doc('tracker')
        .set(userData, { merge: true });
    } catch (err) {
      console.error('Save error:', err);
      showToast('⚠️ Error saving data. Will retry...');
    }
  }, 800);
}

// Force immediate save (for explicit Save buttons)
async function saveUserDataNow() {
  clearTimeout(saveTimer);
  if (!currentUser || !userData) return;
  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('data').doc('tracker')
      .set(userData, { merge: true });
  } catch (err) {
    console.error('Save error:', err);
    showToast('⚠️ Error saving data.');
  }
}

// ═══════════════════════════════════════════
// LAUNCH APP (after auth + data loaded)
// ═══════════════════════════════════════════

function launchApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display  = 'block';

  const displayName = userProfile.name || userProfile.username || 'User';
  document.getElementById('nav-username').textContent   = `👤 ${displayName}`;
  document.getElementById('user-greeting').textContent  = `Welcome back, ${displayName}! ❄️`;

  buildYearDropdown();
  syncDropdowns();
  renderAll();
  hideLoading();
}

// ═══════════════════════════════════════════
// MONTH / YEAR DROPDOWNS
// ═══════════════════════════════════════════

function buildYearDropdown() {
  const sel = document.getElementById('sel-year');
  sel.innerHTML = '';
  const now = new Date().getFullYear();
  for (let y = now - 5; y <= now + 2; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  }
}

function syncDropdowns() {
  document.getElementById('sel-month').value = currentMonth;
  document.getElementById('sel-year').value  = currentYear;
}

function onMonthChange() {
  currentMonth = parseInt(document.getElementById('sel-month').value, 10);
  currentYear  = parseInt(document.getElementById('sel-year').value,  10);
  renderAll();
}

function getMonthKey() {
  return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
}

function getMonthTag() {
  return `${MONTH_NAMES[currentMonth]} ${currentYear}`;
}

// ═══════════════════════════════════════════
// RENDER ALL
// ═══════════════════════════════════════════

function renderAll() {
  const tag = getMonthTag();
  document.getElementById('habits-month-label').textContent  = tag;
  document.getElementById('sleep-month-label').textContent   = tag;
  document.getElementById('monthly-month-label').textContent = tag;
  document.getElementById('summary-month-label').textContent = tag;

  renderHabitsTable();
  renderSleepTable();
  renderMonthlyGoals();
  renderMonthlySummary();
}

// ═══════════════════════════════════════════
// HABITS TRACKER
// ═══════════════════════════════════════════

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

function getHabitLog() {
  const mk = getMonthKey();
  if (!userData.habitLog[mk]) userData.habitLog[mk] = {};
  return userData.habitLog[mk];
}

function renderHabitsTable() {
  const days        = getDaysInMonth(currentYear, currentMonth);
  const today       = new Date();
  const isThisMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const todayDay    = today.getDate();

  // Header
  const hdr = document.getElementById('habits-header-row');
  hdr.innerHTML = '<th class="habit-name-col">HABITS / DAYS</th>';
  for (let d = 1; d <= days; d++) {
    const th = document.createElement('th');
    th.className = 'day-col' + (isThisMonth && d === todayDay ? ' today-head' : '');
    th.textContent = d;
    hdr.appendChild(th);
  }

  // Body
  const tbody = document.getElementById('habits-body');
  tbody.innerHTML = '';
  const log = getHabitLog();

  userData.habits.forEach(habit => {
    const tr = document.createElement('tr');

    const tdName  = document.createElement('td');
    const nameDiv = document.createElement('div');
    nameDiv.className = 'habit-name-cell';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'habit-name-text';
    nameSpan.textContent = `${habit.emoji ? habit.emoji + ' ' : ''}${habit.name}`;
    nameSpan.title = habit.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-del-habit';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Remove habit';
    delBtn.onclick = () => deleteHabit(habit.id);

    nameDiv.appendChild(nameSpan);
    nameDiv.appendChild(delBtn);
    tdName.appendChild(nameDiv);
    tr.appendChild(tdName);

    if (!log[habit.id]) log[habit.id] = {};
    for (let d = 1; d <= days; d++) {
      const td = document.createElement('td');
      td.className = 'day-cell' + (isThisMonth && d === todayDay ? ' today-col' : '');
      const st = log[habit.id][d] || '';
      if (st === 'checked') { td.classList.add('checked'); td.innerHTML = '<span class="cell-icon">✓</span>'; }
      if (st === 'missed')  { td.classList.add('missed');  td.innerHTML = '<span class="cell-icon">✕</span>'; }
      td.onclick = () => toggleHabitCell(habit.id, d, td);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  if (userData.habits.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = days + 1;
    td.style.cssText = 'padding:32px; text-align:center; color:#bbb; font-size:0.9rem;';
    td.textContent = '✦ No habits added yet — click "+ Add Habit" above!';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

function toggleHabitCell(habitId, day, cell) {
  const log = getHabitLog();
  if (!log[habitId]) log[habitId] = {};
  const cur  = log[habitId][day] || '';
  const next = cur === '' ? 'checked' : cur === 'checked' ? 'missed' : '';
  log[habitId][day] = next;

  cell.className = cell.className.replace(/\b(checked|missed)\b/g, '').trim();
  cell.innerHTML  = '';
  if (next === 'checked') { cell.classList.add('checked'); cell.innerHTML = '<span class="cell-icon">✓</span>'; }
  if (next === 'missed')  { cell.classList.add('missed');  cell.innerHTML = '<span class="cell-icon">✕</span>'; }

  userData.habitLog[getMonthKey()] = log;
  saveUserData(); // debounced
  renderMonthlySummary();
}

function openAddHabit() {
  document.getElementById('new-habit-name').value  = '';
  document.getElementById('new-habit-emoji').value = '';
  openModal('modal-add-habit');
  setTimeout(() => document.getElementById('new-habit-name').focus(), 80);
}

function addHabit() {
  const name  = document.getElementById('new-habit-name').value.trim();
  const emoji = document.getElementById('new-habit-emoji').value.trim();
  if (!name) { showToast('Please enter a habit name!'); return; }
  if (userData.habits.length >= 15) { showToast('Maximum 15 habits allowed.'); return; }

  userData.habits.push({ id: 'h_' + Date.now(), name, emoji: emoji || '' });
  saveUserData();
  closeModal('modal-add-habit');
  renderHabitsTable();
  renderMonthlySummary();
  showToast(`✓ "${name}" added!`);
}

function deleteHabit(habitId) {
  if (!confirm('Remove this habit and all its tracked data?')) return;
  userData.habits = userData.habits.filter(h => h.id !== habitId);
  for (const mk of Object.keys(userData.habitLog)) delete userData.habitLog[mk][habitId];
  saveUserData();
  renderHabitsTable();
  renderMonthlySummary();
  showToast('Habit removed.');
}

// ═══════════════════════════════════════════
// SLEEP TRACKER
// ═══════════════════════════════════════════

const SLEEP_HOURS = [10, 9, 8, 7, 6, 5, 4];

function getSleepLog() {
  const mk = getMonthKey();
  if (!userData.sleepLog[mk]) userData.sleepLog[mk] = {};
  return userData.sleepLog[mk];
}

function renderSleepTable() {
  const days        = getDaysInMonth(currentYear, currentMonth);
  const today       = new Date();
  const isThisMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const todayDay    = today.getDate();
  const log         = getSleepLog();

  const hdr = document.getElementById('sleep-header-row');
  hdr.innerHTML = '<th class="habit-name-col">Sleep / Days</th>';
  for (let d = 1; d <= days; d++) {
    const th = document.createElement('th');
    th.className = 'day-col' + (isThisMonth && d === todayDay ? ' today-head' : '');
    th.textContent = d;
    hdr.appendChild(th);
  }

  const tbody = document.getElementById('sleep-body');
  tbody.innerHTML = '';

  SLEEP_HOURS.forEach(hrs => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.className = 'sleep-hr-label-cell';
    tdLabel.textContent = `${hrs} hrs`;
    tr.appendChild(tdLabel);

    for (let d = 1; d <= days; d++) {
      const td       = document.createElement('td');
      const loggedHr = log[d] || 0;
      td.className   = 'sleep-cell' + (isThisMonth && d === todayDay ? ' today-col' : '');
      if (loggedHr === hrs) {
        td.classList.add(`active-${hrs}`);
        td.innerHTML = '<span class="dot"></span>';
      }
      td.onclick = () => openSleepModal(d);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  renderSleepStats(log, days);
}

function openSleepModal(day) {
  sleepModalDay = day;
  const log = getSleepLog();
  const current = log[day] || 0;
  const suffix  = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
  document.getElementById('sleep-modal-day').textContent =
    `${MONTH_NAMES[currentMonth]} ${day}${suffix}, ${currentYear}` +
    (current ? ` — currently: ${current} hrs` : '');

  document.querySelectorAll('.sleep-hr-btn:not(.btn-clear)').forEach(btn => {
    const hrs = parseInt(btn.textContent);
    btn.style.background  = (hrs === current) ? 'var(--blue)' : '';
    btn.style.color       = (hrs === current) ? 'white' : '';
    btn.style.borderColor = (hrs === current) ? 'var(--blue)' : '';
  });

  openModal('modal-sleep');
}

function setSleep(hrs) {
  const log = getSleepLog();
  if (hrs === 0) { delete log[sleepModalDay]; }
  else           { log[sleepModalDay] = hrs; }
  userData.sleepLog[getMonthKey()] = log;
  saveUserData();
  closeModal('modal-sleep');
  renderSleepTable();
  if (hrs > 0) showToast(`😴 ${hrs} hrs logged for day ${sleepModalDay}`);
}

function renderSleepStats(log, daysInMonth) {
  const entries  = Object.values(log).filter(v => v > 0);
  const avgBadge = document.getElementById('sleep-avg-badge');

  if (entries.length === 0) {
    document.getElementById('sleep-stats').innerHTML =
      '<p style="color:#bbb;font-size:0.84rem;">No sleep data logged yet — click any cell to log hours.</p>';
    avgBadge.textContent = '';
    return;
  }

  const avg   = (entries.reduce((s, v) => s + v, 0) / entries.length).toFixed(1);
  const best  = Math.max(...entries);
  const worst = Math.min(...entries);
  const ideal = entries.filter(v => v >= 7).length;

  avgBadge.textContent = `Avg: ${avg} hrs`;

  document.getElementById('sleep-stats').innerHTML = `
    <div class="sleep-stat"><span class="stat-val">${avg}</span><span class="stat-lbl">Avg Hours / Night</span></div>
    <div class="sleep-stat"><span class="stat-val">${best}</span><span class="stat-lbl">Best Night</span></div>
    <div class="sleep-stat"><span class="stat-val">${worst}</span><span class="stat-lbl">Worst Night</span></div>
    <div class="sleep-stat"><span class="stat-val">${ideal}</span><span class="stat-lbl">Nights ≥ 7 hrs</span></div>
    <div class="sleep-stat"><span class="stat-val">${entries.length}/${daysInMonth}</span><span class="stat-lbl">Days Logged</span></div>
  `;
}

// ═══════════════════════════════════════════
// MONTHLY GOALS
// ═══════════════════════════════════════════

function renderMonthlyGoals() {
  const mk   = getMonthKey();
  const data = userData.monthlyGoals[mk] || {};
  document.getElementById('monthly-goal').value     = data.goal     || '';
  document.getElementById('monthly-achieved').value = data.achieved || '';
  document.getElementById('monthly-improve').value  = data.improve  || '';
}

async function saveMonthlyGoals() {
  const mk = getMonthKey();
  userData.monthlyGoals[mk] = {
    goal:     document.getElementById('monthly-goal').value,
    achieved: document.getElementById('monthly-achieved').value,
    improve:  document.getElementById('monthly-improve').value,
    savedAt:  new Date().toISOString()
  };
  await saveUserDataNow();
  flashSaveMsg('monthly-save-msg', '✓ Goals saved to cloud for ' + getMonthTag() + '!');
}

// ═══════════════════════════════════════════
// MONTHLY SUMMARY
// ═══════════════════════════════════════════

function renderMonthlySummary() {
  const log         = getHabitLog();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const container   = document.getElementById('monthly-summary-content');

  if (userData.habits.length === 0) {
    container.innerHTML = '<p style="color:#bbb;font-size:0.84rem;">Add habits to see your monthly completion summary here.</p>';
    return;
  }

  const today       = new Date();
  const isThisMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const tracked     = isThisMonth ? today.getDate() : daysInMonth;

  container.innerHTML = '';
  userData.habits.forEach(habit => {
    const hLog   = log[habit.id] || {};
    let checked  = 0;
    for (let d = 1; d <= tracked; d++) {
      if (hLog[d] === 'checked') checked++;
    }
    const pct   = tracked > 0 ? Math.round((checked / tracked) * 100) : 0;
    const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';

    const card = document.createElement('div');
    card.className = 'summary-card';
    card.innerHTML = `
      <div class="sc-name">${habit.emoji ? habit.emoji + ' ' : ''}${habit.name}</div>
      <div class="sc-bar-wrap"><div class="sc-bar" style="width:${pct}%;background:${color};"></div></div>
      <div class="sc-pct" style="color:${color}">${pct}% · ${checked}/${tracked} days</div>
    `;
    container.appendChild(card);
  });
}

// ═══════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ═══════════════════════════════════════════
// TOAST / SAVE MSG
// ═══════════════════════════════════════════

function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className   = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function flashSaveMsg(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2800);
}
