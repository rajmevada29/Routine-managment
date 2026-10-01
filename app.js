/* =====================================================
   WINTER ARC TRACKER — Application Logic
   ===================================================== */

'use strict';

// ═══════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════

const DB_KEY   = 'winterArc_users';
const SESS_KEY = 'winterArc_session';

function getAllUsers()        { return JSON.parse(localStorage.getItem(DB_KEY)   || '{}'); }
function saveAllUsers(u)     { localStorage.setItem(DB_KEY, JSON.stringify(u)); }
function getSession()        { return JSON.parse(sessionStorage.getItem(SESS_KEY) || 'null'); }
function setSession(u)       { sessionStorage.setItem(SESS_KEY, JSON.stringify(u)); }
function clearSession()      { sessionStorage.removeItem(SESS_KEY); }

function getUserData(username) {
  return getAllUsers()[username]?.data || newUserData();
}
function saveUserData(data) {
  const users = getAllUsers();
  const username = getSession();
  if (!users[username]) return;
  users[username].data = data;
  saveAllUsers(users);
}
function newUserData() {
  return {
    habits:       [],   // [{id, name, emoji}]
    habitLog:     {},   // { "YYYY-MM": { habitId: { day: 'checked'|'missed' } } }
    sleepLog:     {},   // { "YYYY-MM": { day: hours } }
    monthlyGoals: {}    // { "YYYY-MM": { goal, achieved, improve } }
  };
}

// ═══════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════

let currentUser  = null;
let userData     = null;
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth();   // 0-based
let sleepModalDay = null;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ═══════════════════════════════════════════
// AUTH — PAGE SWITCHING
// ═══════════════════════════════════════════

function showPage(pageId) {
  document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(pageId);
  if (pg) pg.classList.add('active');
}

// ═══════════════════════════════════════════
// SIGN UP
// ═══════════════════════════════════════════

function handleSignup(e) {
  e.preventDefault();
  const name     = document.getElementById('su-name').value.trim();
  const username = document.getElementById('su-username').value.trim().toLowerCase();
  const email    = document.getElementById('su-email').value.trim().toLowerCase();
  const password = document.getElementById('su-password').value;
  const confirm  = document.getElementById('su-confirm').value;
  const errEl    = document.getElementById('signup-error');
  errEl.textContent = '';

  if (password !== confirm) {
    errEl.textContent = '❌ Passwords do not match.'; return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    errEl.textContent = '❌ Username: 3-20 chars, letters / numbers / underscore only.'; return;
  }

  const users = getAllUsers();
  if (users[username]) {
    errEl.textContent = '❌ Username already taken. Please choose another.'; return;
  }
  if (Object.values(users).some(u => u.email === email)) {
    errEl.textContent = '❌ An account with this email already exists.'; return;
  }

  users[username] = {
    name, username, email,
    passwordHash: simpleHash(password),
    createdAt: new Date().toISOString(),
    data: newUserData()
  };
  saveAllUsers(users);
  setSession(username);
  launchApp(username, users[username]);
}

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════

function handleLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('li-username').value.trim().toLowerCase();
  const password   = document.getElementById('li-password').value;
  const errEl      = document.getElementById('login-error');
  errEl.textContent = '';

  const users = getAllUsers();
  let foundUser = null, foundKey = null;
  for (const [key, user] of Object.entries(users)) {
    if (key === identifier || user.email === identifier) {
      foundUser = user; foundKey = key; break;
    }
  }

  if (!foundUser || foundUser.passwordHash !== simpleHash(password)) {
    errEl.textContent = '❌ Invalid username / email or password.'; return;
  }
  setSession(foundKey);
  launchApp(foundKey, foundUser);
}

function logout() {
  clearSession();
  currentUser = null;
  userData    = null;
  document.getElementById('app-section').style.display  = 'none';
  document.getElementById('auth-section').style.display = 'block';
  showPage('landing-page');
  document.getElementById('signup-form').reset();
  document.getElementById('login-form').reset();
  document.getElementById('signup-error').textContent = '';
  document.getElementById('login-error').textContent  = '';
}

// djb2-style hash — good enough for a local demo
function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h |= 0; }
  return h.toString(16);
}

// ═══════════════════════════════════════════
// LAUNCH APP
// ═══════════════════════════════════════════

function launchApp(username, userObj) {
  currentUser = username;
  userData    = getUserData(username);

  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display  = 'block';

  document.getElementById('nav-username').textContent =
    `👤 ${userObj.name || username}`;
  document.getElementById('user-greeting').textContent =
    `Welcome back, ${userObj.name || username}! ❄️`;

  buildYearDropdown();
  syncDropdowns();
  renderAll();
}

// ═══════════════════════════════════════════
// MONTH / YEAR DROPDOWNS
// ═══════════════════════════════════════════

function buildYearDropdown() {
  const sel = document.getElementById('sel-year');
  sel.innerHTML = '';
  const now  = new Date().getFullYear();
  // Range: 5 years back → 2 years forward (covers winter arc multi-year)
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
  updateMonthTags();
  renderHabitsTable();
  renderSleepTable();
  renderMonthlyGoals();
  renderMonthlySummary();
}

function updateMonthTags() {
  const tag = getMonthTag();
  document.getElementById('habits-month-label').textContent  = tag;
  document.getElementById('sleep-month-label').textContent   = tag;
  document.getElementById('monthly-month-label').textContent = tag;
  document.getElementById('summary-month-label').textContent = tag;
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

  // Header row
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

    // Sticky name cell
    const tdName  = document.createElement('td');
    const nameDiv = document.createElement('div');
    nameDiv.className = 'habit-name-cell';

    const nameSpan  = document.createElement('span');
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

    // Day cells
    if (!log[habit.id]) log[habit.id] = {};
    for (let d = 1; d <= days; d++) {
      const td  = document.createElement('td');
      td.className = 'day-cell' + (isThisMonth && d === todayDay ? ' today-col' : '');
      const st = log[habit.id][d] || '';
      if (st === 'checked') { td.classList.add('checked'); td.innerHTML = '<span class="cell-icon">✓</span>'; }
      if (st === 'missed')  { td.classList.add('missed');  td.innerHTML = '<span class="cell-icon">✕</span>'; }
      td.onclick = () => toggleHabitCell(habit.id, d, td);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  // Empty state
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
  saveUserData(userData);
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
  saveUserData(userData);
  closeModal('modal-add-habit');
  renderHabitsTable();
  renderMonthlySummary();
  showToast(`✓ "${name}" added!`);
}

function deleteHabit(habitId) {
  if (!confirm('Remove this habit and all its tracked data?')) return;
  userData.habits = userData.habits.filter(h => h.id !== habitId);
  for (const mk of Object.keys(userData.habitLog)) delete userData.habitLog[mk][habitId];
  saveUserData(userData);
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

  // Header
  const hdr = document.getElementById('sleep-header-row');
  hdr.innerHTML = '<th class="habit-name-col">Sleep / Days</th>';
  for (let d = 1; d <= days; d++) {
    const th = document.createElement('th');
    th.className = 'day-col' + (isThisMonth && d === todayDay ? ' today-head' : '');
    th.textContent = d;
    hdr.appendChild(th);
  }

  // Body — one row per hour bucket
  const tbody = document.getElementById('sleep-body');
  tbody.innerHTML = '';

  SLEEP_HOURS.forEach(hrs => {
    const tr = document.createElement('tr');

    // Label cell (sticky)
    const tdLabel = document.createElement('td');
    tdLabel.className = 'sleep-hr-label-cell';
    tdLabel.textContent = `${hrs} hrs`;
    tr.appendChild(tdLabel);

    for (let d = 1; d <= days; d++) {
      const td       = document.createElement('td');
      const loggedHr = log[d] || 0;
      td.className   = 'sleep-cell' + (isThisMonth && d === todayDay ? ' today-col' : '');

      // Fill this row's cell if logged hours === this row
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
    (current ? ` — currently logged: ${current} hrs` : '');

  // Highlight current selection in buttons
  document.querySelectorAll('.sleep-hr-btn:not(.btn-clear)').forEach(btn => {
    const hrs = parseInt(btn.textContent);
    btn.style.background = (hrs === current) ? 'var(--blue)' : '';
    btn.style.color = (hrs === current) ? 'white' : '';
    btn.style.borderColor = (hrs === current) ? 'var(--blue)' : '';
  });

  openModal('modal-sleep');
}

function setSleep(hrs) {
  const log = getSleepLog();
  if (hrs === 0) { delete log[sleepModalDay]; }
  else           { log[sleepModalDay] = hrs; }
  userData.sleepLog[getMonthKey()] = log;
  saveUserData(userData);
  closeModal('modal-sleep');
  renderSleepTable();
  if (hrs > 0) showToast(`😴 ${hrs} hrs logged for day ${sleepModalDay}`);
}

function renderSleepStats(log, daysInMonth) {
  const entries = Object.values(log).filter(v => v > 0);
  const avgBadge = document.getElementById('sleep-avg-badge');

  if (entries.length === 0) {
    document.getElementById('sleep-stats').innerHTML =
      '<p style="color:#bbb;font-size:0.84rem;">No sleep data logged yet — click any cell to log hours.</p>';
    avgBadge.textContent = '';
    return;
  }

  const total  = entries.reduce((s, v) => s + v, 0);
  const avg    = (total / entries.length).toFixed(1);
  const best   = Math.max(...entries);
  const worst  = Math.min(...entries);
  const ideal  = entries.filter(v => v >= 7).length;

  avgBadge.textContent = `Avg: ${avg} hrs`;

  document.getElementById('sleep-stats').innerHTML = `
    <div class="sleep-stat">
      <span class="stat-val">${avg}</span>
      <span class="stat-lbl">Avg Hours / Night</span>
    </div>
    <div class="sleep-stat">
      <span class="stat-val">${best}</span>
      <span class="stat-lbl">Best Night</span>
    </div>
    <div class="sleep-stat">
      <span class="stat-val">${worst}</span>
      <span class="stat-lbl">Worst Night</span>
    </div>
    <div class="sleep-stat">
      <span class="stat-val">${ideal}</span>
      <span class="stat-lbl">Nights ≥ 7 hrs</span>
    </div>
    <div class="sleep-stat">
      <span class="stat-val">${entries.length}/${daysInMonth}</span>
      <span class="stat-lbl">Days Logged</span>
    </div>
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

function saveMonthlyGoals() {
  const mk = getMonthKey();
  userData.monthlyGoals[mk] = {
    goal:     document.getElementById('monthly-goal').value,
    achieved: document.getElementById('monthly-achieved').value,
    improve:  document.getElementById('monthly-improve').value,
    savedAt:  new Date().toISOString()
  };
  saveUserData(userData);
  flashSaveMsg('monthly-save-msg', '✓ Goals saved for ' + getMonthTag() + '!');
}

// ═══════════════════════════════════════════
// MONTHLY HABIT SUMMARY
// ═══════════════════════════════════════════

function renderMonthlySummary() {
  const log          = getHabitLog();
  const daysInMonth  = getDaysInMonth(currentYear, currentMonth);
  const container    = document.getElementById('monthly-summary-content');

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
      <div class="sc-bar-wrap">
        <div class="sc-bar" style="width:${pct}%;background:${color};"></div>
      </div>
      <div class="sc-pct" style="color:${color}">${pct}% &nbsp;·&nbsp; ${checked}/${tracked} days</div>
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
  el.className  = 'toast';
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

// ═══════════════════════════════════════════
// INIT — restore session on page load
// ═══════════════════════════════════════════

(function init() {
  const sess = getSession();
  if (sess) {
    const users = getAllUsers();
    if (users[sess]) {
      launchApp(sess, users[sess]);
      return;
    }
  }
  document.getElementById('auth-section').style.display = 'block';
  showPage('landing-page');
})();
