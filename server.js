const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;
const HUB_JWT_SECRET = process.env.HUB_JWT_SECRET || '';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new PgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'tcc-payroll-hub-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true
  }
}));

// ─── HUB SSO: Auto-login via JWT token from TCC Hub ──────────────────────────
app.use(async (req, res, next) => {
  if (req.session && req.session.user) return next();
  const token = req.query.hub_token
    || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7) : null);
  if (!token || !HUB_JWT_SECRET) return next();
  try {
    const decoded = jwt.verify(token, HUB_JWT_SECRET);
    const hubUsername = decoded.username.toLowerCase();
    const hubRole = decoded.role;
    const hubCenter = decoded.center;
    const result = await pool.query('SELECT * FROM users WHERE LOWER(username) = $1', [hubUsername]);
    let user = result.rows[0];
    if (!user && hubCenter && hubCenter !== 'all') {
      const centerMap = { 'peace': 'Peace Boulevard', 'niles': 'Niles', 'montessori': 'Montessori' };
      const mappedCenter = centerMap[hubCenter] || hubCenter;
      const dirResult = await pool.query("SELECT * FROM users WHERE role = 'director' AND center = $1 LIMIT 1", [mappedCenter]);
      user = dirResult.rows[0];
    }
    if (!user && hubRole === 'owner') {
      const ownerResult = await pool.query("SELECT * FROM users WHERE role = 'owner' LIMIT 1");
      user = ownerResult.rows[0];
    }
    if (!user && (hubRole === 'hr' || hubRole === 'payroll')) {
      const roleResult = await pool.query("SELECT * FROM users WHERE role = $1 LIMIT 1", [hubRole]);
      user = roleResult.rows[0];
    }
    if (user) {
      req.session.user = {
        id: user.id, username: user.username, full_name: user.full_name,
        role: user.role, center: user.center
      };
    }
  } catch (e) { }
  next();
});

const upload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

// ========================
// DATABASE INITIALIZATION
// ========================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(200) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('owner','payroll','hr','director')),
      center VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      center VARCHAR(100) NOT NULL,
      classroom VARCHAR(200),
      position VARCHAR(100) DEFAULT 'Assistant',
      year_hired INTEGER NOT NULL,
      start_date DATE,
      scheduled_times VARCHAR(100),
      is_full_time BOOLEAN DEFAULT TRUE,
      weekly_hours NUMERIC(5,2) DEFAULT 40,
      hourly_rate NUMERIC(8,2),
      is_active BOOLEAN DEFAULT TRUE,
      is_admin BOOLEAN DEFAULT FALSE,
      pto_carryover_hours NUMERIC(6,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS time_off_entries (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      entry_date DATE NOT NULL,
      entry_type VARCHAR(1) NOT NULL CHECK (entry_type IN ('P','U')),
      entered_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(employee_id, entry_date)
    );
    CREATE TABLE IF NOT EXISTS pay_increase_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      requested_by INTEGER REFERENCES users(id),
      reason_category VARCHAR(100) NOT NULL,
      reason_detail TEXT,
      current_rate NUMERIC(8,2),
      proposed_rate NUMERIC(8,2),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
      reviewed_by INTEGER REFERENCES users(id),
      review_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      doc_type VARCHAR(100) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_data BYTEA,
      notes TEXT,
      uploaded_by INTEGER REFERENCES users(id),
      affects_pay_period VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS timecard_imports (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      import_date DATE NOT NULL,
      raw_data JSONB,
      total_hours NUMERIC(6,2),
      regular_hours NUMERIC(6,2),
      overtime_hours NUMERIC(6,2),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS daily_hours (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      work_date DATE NOT NULL,
      hours_worked NUMERIC(5,2) DEFAULT 0,
      source VARCHAR(50) DEFAULT 'import',
      source_center VARCHAR(100) DEFAULT 'default',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(employee_id, work_date, source_center)
    );
    CREATE TABLE IF NOT EXISTS staffing_plan (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      center VARCHAR(100) NOT NULL,
      classroom VARCHAR(200) NOT NULL,
      role_in_room VARCHAR(100),
      orientation_date DATE, cpr_first_aid_date DATE, health_safety_abc_date DATE,
      health_safety_refresher DATE, ccbc_consent_date DATE, fingerprinting_date DATE,
      date_eligible DATE, abuse_neglect_statement DATE, last_evaluation DATE,
      date_promoted_lead DATE, date_assigned_room DATE,
      education TEXT, semester_hours TEXT, infant_toddler_training TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payroll_periods (
      id SERIAL PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      pay_date DATE NOT NULL,
      center VARCHAR(100) NOT NULL,
      status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open','director_submitted','processing','closed')),
      timecards_uploaded BOOLEAN DEFAULT FALSE,
      timecards_signed_by VARCHAR(200), timecards_signed_at TIMESTAMP,
      timeoff_approved BOOLEAN DEFAULT FALSE,
      timeoff_signed_by VARCHAR(200), timeoff_signed_at TIMESTAMP,
      director_closed BOOLEAN DEFAULT FALSE,
      director_closed_by VARCHAR(200), director_closed_at TIMESTAMP,
      payroll_closed BOOLEAN DEFAULT FALSE,
      payroll_closed_by VARCHAR(200), payroll_closed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(period_start, period_end, center)
    );
    CREATE TABLE IF NOT EXISTS payroll_signatures (
      id SERIAL PRIMARY KEY,
      period_start DATE NOT NULL, period_end DATE NOT NULL,
      center VARCHAR(100), action_type VARCHAR(50) NOT NULL,
      signed_by_user_id INTEGER REFERENCES users(id),
      signed_by_name VARCHAR(200) NOT NULL,
      signature_text VARCHAR(500), statement TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Migrations - safe ADD COLUMN IF NOT EXISTS
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS pto_carryover_hours NUMERIC(6,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS terminated_date DATE`);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS termination_reason TEXT`);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS terminated_by VARCHAR(200)`);
  await pool.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS timeoff_submitted BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS timeoff_submitted_by VARCHAR(200)`);
  await pool.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS timeoff_submitted_at TIMESTAMP`);
  await pool.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS payroll_accessed_at TIMESTAMP`);
  await pool.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS change_request_pending BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS change_request_reason TEXT`);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS pto_hours_used_qb NUMERIC(8,2) DEFAULT 0`);
  // payroll_center: which center's payroll report this employee belongs to (may differ from staffing plan center)
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS payroll_center VARCHAR(100)`);
  // daily_hours: add source_center for cross-center hour tracking
  await pool.query(`ALTER TABLE daily_hours ADD COLUMN IF NOT EXISTS source_center VARCHAR(100) DEFAULT 'default'`);
  // Backfill any NULL source_center values
  await pool.query(`UPDATE daily_hours SET source_center = 'default' WHERE source_center IS NULL`);
  // Migrate unique constraint: old was (employee_id, work_date), new includes source_center
  try {
    await pool.query(`ALTER TABLE daily_hours DROP CONSTRAINT IF EXISTS daily_hours_employee_id_work_date_key`);
  } catch(e) { console.log('Drop old constraint:', e.message); }
  try {
    await pool.query(`DROP INDEX IF EXISTS daily_hours_emp_date_center`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS daily_hours_emp_date_center ON daily_hours (employee_id, work_date, source_center)`);
  } catch(e) { console.log('Create new index:', e.message); }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS timeoff_change_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      entry_date DATE NOT NULL,
      requested_type VARCHAR(1),
      requested_by INTEGER REFERENCES users(id),
      requested_by_name VARCHAR(200),
      reason TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      reviewed_by VARCHAR(200),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Payroll report archives table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payroll_report_archives (
      id SERIAL PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      pay_date DATE,
      period_label VARCHAR(200),
      report_data JSONB NOT NULL,
      pdf_data BYTEA,
      generated_by VARCHAR(200),
      generated_by_user_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(period_start, period_end)
    )
  `);
  await pool.query(`ALTER TABLE payroll_report_archives ADD COLUMN IF NOT EXISTS pdf_data BYTEA`);

  // ─── NEW: Staffing plan migrations for cross-center subs & external persons ───
  // external_name: for therapists/volunteers not on the employee roster (employee_id will be NULL)
  await pool.query(`ALTER TABLE staffing_plan ADD COLUMN IF NOT EXISTS external_name VARCHAR(200)`);
  // source_center: when set, indicates this is a cross-center sub reference (live lookup from home center)
  await pool.query(`ALTER TABLE staffing_plan ADD COLUMN IF NOT EXISTS source_center VARCHAR(100)`);
  // source_employee_id: the employee_id to look up compliance from at the source center
  // (same as employee_id, but makes intent clear; we use employee_id for the FK)
  // external_start_date: start date for volunteers/therapists (not linked to employee record)
  await pool.query(`ALTER TABLE staffing_plan ADD COLUMN IF NOT EXISTS external_start_date DATE`);
  // entry_type: 'staff' (default), 'sub' (cross-center), 'external' (therapist/volunteer)
  await pool.query(`ALTER TABLE staffing_plan ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20) DEFAULT 'staff'`);
  // updated_at: tracks the last time any change was made to a staffing plan entry
  await pool.query(`ALTER TABLE staffing_plan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
  // Backfill: any rows where updated_at is NULL get set to created_at
  await pool.query(`UPDATE staffing_plan SET updated_at = created_at WHERE updated_at IS NULL`);

  // Upload log: track every CSV import for audit trail
  await pool.query(`CREATE TABLE IF NOT EXISTS upload_log (
    id SERIAL PRIMARY KEY,
    center VARCHAR(100),
    period_start DATE, period_end DATE,
    upload_type VARCHAR(50) DEFAULT 'timecard',
    filename VARCHAR(500),
    uploaded_by VARCHAR(200),
    uploaded_by_user_id INTEGER,
    total_rows INTEGER DEFAULT 0,
    matched_rows INTEGER DEFAULT 0,
    unmatched_rows INTEGER DEFAULT 0,
    unmatched_names TEXT,
    saved_days INTEGER DEFAULT 0,
    notes TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW()
  )`);

  const userCount = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(userCount.rows[0].count) === 0) {
    const hash = await bcrypt.hash('tcc2026', 10);
    await pool.query(`
      INSERT INTO users (username, password_hash, full_name, role, center) VALUES
      ('mary', $1, 'Mary Wardlaw', 'owner', NULL),
      ('jared', $1, 'Jared Simkins', 'payroll', NULL),
      ('amy', $1, 'Amy Gutierrez', 'hr', NULL),
      ('gabby', $1, 'Gabby Fountain', 'director', 'Peace Boulevard'),
      ('kirsten', $1, 'Kirsten', 'director', 'Niles'),
      ('shari', $1, 'Shari', 'director', 'Montessori')
    `, [hash]);
  }

  console.log('Database initialized');
}

// ========================
// AUTH MIDDLEWARE
// ========================
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Access denied' });
    next();
  };
}
function canSeePayRate(user) {
  return ['owner', 'payroll', 'hr'].includes(user.role);
}

// ========================
// PTO CALCULATION HELPERS
// ========================
function getTenureBonusDays(yearHired, isFullTime, isAdmin, weeklyHours) {
  const currentYear = new Date().getFullYear();
  const yearsEmployed = currentYear - yearHired;
  let additionalDays = 0;
  if (isFullTime && weeklyHours >= 35) {
    if (yearsEmployed >= 5 || isAdmin) {
      const effectiveYears = Math.max(yearsEmployed, 5);
      additionalDays = effectiveYears + 6;
    } else if (yearsEmployed >= 1) {
      additionalDays = yearsEmployed;
    }
  }
  const hoursPerDay = weeklyHours >= 40 ? 8 : (weeklyHours / 5);
  return { additionalDays, additionalHours: additionalDays * hoursPerDay, hoursPerDay, yearsEmployed };
}

function calculatePTOAllowance(yearHired, isFullTime, isAdmin, weeklyHours) {
  const tenure = getTenureBonusDays(yearHired, isFullTime, isAdmin, weeklyHours);
  return {
    baseDays: 10, baseHours: 80,
    additionalDays: tenure.additionalDays, additionalHours: tenure.additionalHours,
    totalMaxDays: 10 + tenure.additionalDays, totalMaxHours: 80 + tenure.additionalHours,
    hoursPerDay: tenure.hoursPerDay, yearsEmployed: tenure.yearsEmployed, carryoverCap: 80
  };
}

async function calculateActualPTO(empId, yearHired, isFullTime, isAdmin, weeklyHours, carryoverHours) {
  const currentYear = new Date().getFullYear();
  const tenure = getTenureBonusDays(yearHired, isFullTime, isAdmin, weeklyHours);
  const hoursPerDay = tenure.hoursPerDay;
  const hoursResult = await pool.query(
    `SELECT COALESCE(SUM(hours_worked), 0) as total_hours FROM daily_hours WHERE employee_id = $1 AND EXTRACT(YEAR FROM work_date) = $2`,
    [empId, currentYear]
  );
  const totalHoursWorked = parseFloat(hoursResult.rows[0].total_hours);
  const rawAccruedHours = totalHoursWorked / 20;
  const accruedHours = Math.min(rawAccruedHours, 80);
  const tenureBonusHours = tenure.additionalHours;
  const carryover = Math.min(parseFloat(carryoverHours) || 0, 80);
  const totalAvailableHours = carryover + accruedHours + tenureBonusHours;
  const totalAvailableDays = totalAvailableHours / hoursPerDay;
  const qbUsed = parseFloat(carryoverHours === undefined ? 0 :
    (await pool.query('SELECT pto_hours_used_qb FROM employees WHERE id = $1', [empId])).rows[0]?.pto_hours_used_qb || 0);
  
  // Crossover-period PTO: P-marked time_off_entries from Jan 1 through Jan 8 of the current year
  // were paid out on a pay period that started in the prior year (Dec 24 - Jan 8),
  // so they weren't captured by QB payroll imports targeting 2026 pay dates.
  // Add them to the hoursUsed count so they're reflected in the PTO summary.
  const crossoverEnd = `${currentYear}-01-08`;
  const crossoverStart = `${currentYear}-01-01`;
  const crossoverResult = await pool.query(
    `SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'P' AND entry_date >= $2 AND entry_date <= $3`,
    [empId, crossoverStart, crossoverEnd]
  );
  const crossoverDays = parseInt(crossoverResult.rows[0].count) || 0;
  const crossoverHours = crossoverDays * hoursPerDay;
  
  const hoursUsed = qbUsed + crossoverHours;
  const daysUsed = Math.round(hoursUsed / hoursPerDay * 10) / 10;
  const remainingHours = totalAvailableHours - hoursUsed;
  const remainingDays = remainingHours / hoursPerDay;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const unpaidResult = await pool.query(
    `SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'U' AND entry_date >= $2`,
    [empId, sixMonthsAgo.toISOString().split('T')[0]]
  );
  const unpaidLast6Months = parseInt(unpaidResult.rows[0].count);
  return {
    totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
    accruedHours: Math.round(accruedHours * 100) / 100,
    accruedDays: Math.round((accruedHours / hoursPerDay) * 100) / 100,
    accrualRate: '1hr per 20hrs worked', accrualCap: 80,
    tenureBonusDays: tenure.additionalDays,
    tenureBonusHours: Math.round(tenureBonusHours * 100) / 100,
    yearsEmployed: tenure.yearsEmployed,
    carryoverHours: carryover, carryoverDays: Math.round((carryover / hoursPerDay) * 100) / 100,
    totalAvailableHours: Math.round(totalAvailableHours * 100) / 100,
    totalAvailableDays: Math.round(totalAvailableDays * 100) / 100,
    daysUsed, hoursUsed: Math.round(hoursUsed * 100) / 100,
    qbHoursUsed: Math.round(qbUsed * 100) / 100,
    crossoverHoursUsed: Math.round(crossoverHours * 100) / 100,
    crossoverDaysUsed: crossoverDays,
    remainingHours: Math.round(remainingHours * 100) / 100,
    remainingDays: Math.round(remainingDays * 100) / 100,
    unpaidLast6Months, unpaidWarning: unpaidLast6Months > 5,
    hoursPerDay, isFullTime,
  };
}

function getPayPeriod(date) {
  const d = date || new Date();
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  let start, end, payDate;
  if (day >= 9 && day <= 23) {
    start = new Date(year, month, 9);
    end = new Date(year, month, 23);
    let nextMonth = month + 1; let payYear = year;
    if (nextMonth > 11) { nextMonth = 0; payYear++; }
    payDate = new Date(payYear, nextMonth, 1);
  } else {
    if (day >= 24) {
      start = new Date(year, month, 24);
      let nextMonth = month + 1; let endYear = year;
      if (nextMonth > 11) { nextMonth = 0; endYear++; }
      end = new Date(endYear, nextMonth, 8);
      payDate = new Date(endYear, nextMonth, 15);
    } else {
      let prevMonth = month - 1; let startYear = year;
      if (prevMonth < 0) { prevMonth = 11; startYear--; }
      start = new Date(startYear, prevMonth, 24);
      end = new Date(year, month, 8);
      payDate = new Date(year, month, 15);
    }
  }
  const payDay = payDate.getDay();
  if (payDay === 6) payDate.setDate(payDate.getDate() - 1);
  if (payDay === 0) payDate.setDate(payDate.getDate() + 1);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    payDate: payDate.toISOString().split('T')[0],
    label: `${start.toLocaleDateString('en-US', {month:'short',day:'numeric'})} - ${end.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}`
  };
}

function getMonToSunWeeks(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const weeks = [];
  let monday = new Date(start);
  const startDay = monday.getDay();
  const daysToMonday = startDay === 0 ? 6 : startDay - 1;
  monday.setDate(monday.getDate() - daysToMonday);
  while (monday <= end) {
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    weeks.push({ monday: monday.toISOString().split('T')[0], sunday: sunday.toISOString().split('T')[0] });
    monday = new Date(monday); monday.setDate(monday.getDate() + 7);
  }
  return weeks;
}

function getSunSatWeeks(startDate, endDate) {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const weeks = [];
  let sunday = new Date(start);
  const startDay = sunday.getDay();
  sunday.setDate(sunday.getDate() - startDay);
  while (sunday <= end) {
    const saturday = new Date(sunday);
    saturday.setDate(saturday.getDate() + 6);
    weeks.push({ sunday: sunday.toISOString().split('T')[0], saturday: saturday.toISOString().split('T')[0] });
    sunday = new Date(sunday); sunday.setDate(sunday.getDate() + 7);
  }
  return weeks;
}

// ========================
// API ROUTES
// ========================

// Auth
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role, center: user.center };
    res.json({ user: req.session.user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: req.session.user });
});

// Pay period info
app.get('/api/pay-period', requireAuth, (req, res) => {
  const dateStr = req.query.date;
  const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  res.json(getPayPeriod(date));
});

const ADMIN_HIDDEN_FROM_HR = ['wardlaw_jay','wardlaw_mary','swem_kirsten','wardlaw_kelsey','wardlaw_jared','phillips_shari','fountain_gabrielle'];
function shouldHideFromUser(emp, user) {
  if (user.role === 'owner' || user.role === 'payroll') return false;
  const empKey = `${emp.last_name.toLowerCase()}_${emp.first_name.toLowerCase()}`;
  if (user.role === 'hr') {
    if (empKey.includes('gutierrez') && empKey.includes('amy')) return false;
    return ADMIN_HIDDEN_FROM_HR.some(h => empKey.startsWith(h.split('_')[0]) && empKey.includes(h.split('_')[1]));
  }
  return false;
}

// Employees
app.get('/api/employees', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    let query = 'SELECT * FROM employees WHERE is_active = TRUE ORDER BY last_name, first_name';
    let params = [];
    if (user.role === 'director') {
      query = 'SELECT * FROM employees WHERE is_active = TRUE AND COALESCE(payroll_center, center) = $1 ORDER BY last_name, first_name';
      params = [user.center];
    }
    const result = await pool.query(query, params);
    let employees = result.rows;
    employees = employees.filter(e => !shouldHideFromUser(e, user));
    if (user.username !== 'mary' && user.username !== 'jared') {
      employees = employees.filter(e => {
        const ln = (e.last_name || '').toLowerCase();
        const fn = (e.first_name || '').toLowerCase();
        if (ln === 'wardlaw' && (fn.startsWith('mary') || fn.startsWith('jay'))) return false;
        return true;
      });
    }
    if (!canSeePayRate(user)) {
      employees = employees.map(e => { const { hourly_rate, ...rest } = e; return rest; });
    }
    employees = employees.map(e => ({
      ...e,
      pto: calculatePTOAllowance(e.year_hired, e.is_full_time, e.is_admin, parseFloat(e.weekly_hours) || 40)
    }));
    res.json(employees);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const { first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin } = req.body;
    const result = await pool.query(
      `INSERT INTO employees (first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time || true, weekly_hours || 40, hourly_rate, is_admin || false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/employees/:id', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const { first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin, is_active, pto_carryover_hours, payroll_center } = req.body;
    const result = await pool.query(
      `UPDATE employees SET first_name=$1, last_name=$2, center=$3, classroom=$4, position=$5, year_hired=$6, start_date=$7, scheduled_times=$8, is_full_time=$9, weekly_hours=$10, hourly_rate=$11, is_admin=$12, is_active=$13, pto_carryover_hours=COALESCE($14, pto_carryover_hours), payroll_center=$16
       WHERE id=$15 RETURNING *`,
      [first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin, is_active, pto_carryover_hours, req.params.id, payroll_center || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees/:id/carryover', requireRole('owner', 'payroll', 'hr'), async (req, res) => {
  try {
    const { carryover_hours } = req.body;
    const result = await pool.query(
      `UPDATE employees SET pto_carryover_hours = $1 WHERE id = $2 RETURNING id, first_name, last_name, pto_carryover_hours`,
      [parseFloat(carryover_hours) || 0, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees/:id/terminate', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const { terminated_date, termination_reason } = req.body;
    const user = req.session.user;
    const result = await pool.query(
      `UPDATE employees SET is_active = FALSE, terminated_date = $1, termination_reason = $2, terminated_by = $3 WHERE id = $4 RETURNING *`,
      [terminated_date, termination_reason, user.full_name, req.params.id]
    );
    await pool.query('DELETE FROM staffing_plan WHERE employee_id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees/:id/reinstate', requireRole('owner', 'hr'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE employees SET is_active = TRUE, terminated_date = NULL, termination_reason = NULL, terminated_by = NULL WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/employees/archive', requireRole('owner', 'payroll', 'hr'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, COALESCE((SELECT SUM(dh.hours_worked) FROM daily_hours dh WHERE dh.employee_id = e.id AND EXTRACT(YEAR FROM dh.work_date) = EXTRACT(YEAR FROM NOW())), 0) as ytd_hours
       FROM employees e WHERE e.is_active = FALSE ORDER BY e.terminated_date DESC NULLS LAST, e.last_name`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/employees/:id/detail', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const emp = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (emp.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    let employee = emp.rows[0];
    if (user.role === 'director' && employee.center !== user.center) return res.status(403).json({ error: 'Access denied' });
    if (shouldHideFromUser(employee, user)) return res.status(403).json({ error: 'Access denied' });
    if (!canSeePayRate(user)) delete employee.hourly_rate;
    employee.pto = await calculateActualPTO(employee.id, employee.year_hired, employee.is_full_time, employee.is_admin, parseFloat(employee.weekly_hours) || 40, employee.pto_carryover_hours || 0);
    const year = new Date().getFullYear();
    const entries = await pool.query(`SELECT * FROM time_off_entries WHERE employee_id = $1 AND EXTRACT(YEAR FROM entry_date) = $2 ORDER BY entry_date`, [req.params.id, year]);
    employee.timeOffEntries = entries.rows;
    const increases = await pool.query(`SELECT pir.*, u.full_name as requested_by_name FROM pay_increase_requests pir LEFT JOIN users u ON pir.requested_by = u.id WHERE pir.employee_id = $1 ORDER BY pir.created_at DESC`, [req.params.id]);
    if (canSeePayRate(user)) employee.payIncreaseHistory = increases.rows;
    const docs = await pool.query(`SELECT id, doc_type, file_name, notes, affects_pay_period, created_at FROM documents WHERE employee_id = $1 ORDER BY created_at DESC`, [req.params.id]);
    employee.documents = docs.rows;
    res.json(employee);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Time off entries
app.get('/api/time-off', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const { month, year, center } = req.query;
    let query = `SELECT toe.*, e.first_name, e.last_name, e.center, e.classroom FROM time_off_entries toe JOIN employees e ON toe.employee_id = e.id WHERE EXTRACT(MONTH FROM toe.entry_date) = $1 AND EXTRACT(YEAR FROM toe.entry_date) = $2`;
    let params = [month || new Date().getMonth() + 1, year || new Date().getFullYear()];
    if (user.role === 'director') { query += ' AND COALESCE(e.payroll_center, e.center) = $3'; params.push(user.center); }
    else if (center) { query += ' AND COALESCE(e.payroll_center, e.center) = $3'; params.push(center); }
    query += ' ORDER BY e.last_name, e.first_name, toe.entry_date';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/time-off', requireAuth, async (req, res) => {
  try {
    const { employee_id, entry_date, entry_type, notes } = req.body;
    const user = req.session.user;
    if (user.role === 'director') {
      // Check if the pay period containing this entry has been signed off and locked
      const entryPP = getPayPeriod(new Date(entry_date + 'T12:00:00'));
      const ppStatus = await pool.query(
        `SELECT timeoff_submitted, payroll_closed, payroll_accessed_at FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND center = $3`,
        [entryPP.start, entryPP.end, user.center]
      );
      if (ppStatus.rows.length > 0) {
        const status = ppStatus.rows[0];
        // Only block if payroll is fully closed, OR if it's been signed off AND payroll has been accessed (locked by Jared)
        if (status.payroll_closed) {
          return res.status(403).json({ error: 'past_period', message: 'This pay period has been closed by payroll. Submit a change request.' });
        }
        if (status.timeoff_submitted && status.payroll_accessed_at) {
          return res.status(403).json({ error: 'locked', message: 'Payroll processing has begun for this period. Submit a change request.' });
        }
      }
    }
    const result = await pool.query(
      `INSERT INTO time_off_entries (employee_id, entry_date, entry_type, entered_by, notes) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (employee_id, entry_date) DO UPDATE SET entry_type = $3, notes = $5, entered_by = $4 RETURNING *`,
      [employee_id, entry_date, entry_type, req.session.user.id, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/time-off/:id', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role === 'director') {
      const entry = await pool.query('SELECT entry_date FROM time_off_entries WHERE id = $1', [req.params.id]);
      if (entry.rows.length > 0) {
        const entryDate = entry.rows[0].entry_date;
        const entryPP = getPayPeriod(new Date(entryDate));
        const ppStatus = await pool.query(
          `SELECT timeoff_submitted, payroll_closed, payroll_accessed_at FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND center = $3`,
          [entryPP.start, entryPP.end, req.session.user.center]
        );
        if (ppStatus.rows.length > 0) {
          const status = ppStatus.rows[0];
          if (status.payroll_closed) {
            return res.status(403).json({ error: 'past_period', message: 'This pay period has been closed by payroll.' });
          }
          if (status.timeoff_submitted && status.payroll_accessed_at) {
            return res.status(403).json({ error: 'locked', message: 'Payroll processing has begun for this period.' });
          }
        }
      }
    }
    await pool.query('DELETE FROM time_off_entries WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Time off change requests
app.post('/api/timeoff-change-request', requireAuth, async (req, res) => {
  try {
    const { employee_id, entry_date, requested_type, reason } = req.body;
    const user = req.session.user;
    await pool.query(`INSERT INTO timeoff_change_requests (employee_id, entry_date, requested_type, requested_by, requested_by_name, reason) VALUES ($1, $2, $3, $4, $5, $6)`,
      [employee_id, entry_date, requested_type, user.id, user.full_name, reason]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/timeoff-change-requests', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT cr.*, e.first_name, e.last_name, e.center FROM timeoff_change_requests cr JOIN employees e ON cr.employee_id = e.id WHERE cr.status = 'pending' ORDER BY cr.created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/timeoff-change-requests/:id/approve', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const cr = await pool.query('SELECT * FROM timeoff_change_requests WHERE id = $1', [req.params.id]);
    if (cr.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = cr.rows[0];
    if (r.requested_type) {
      await pool.query(`INSERT INTO time_off_entries (employee_id, entry_date, entry_type, entered_by, notes) VALUES ($1, $2, $3, $4, 'Approved change request')
         ON CONFLICT (employee_id, entry_date) DO UPDATE SET entry_type = $3, notes = 'Approved change request'`,
        [r.employee_id, r.entry_date, r.requested_type, req.session.user.id]);
    } else {
      await pool.query('DELETE FROM time_off_entries WHERE employee_id = $1 AND entry_date = $2', [r.employee_id, r.entry_date]);
    }
    await pool.query(`UPDATE timeoff_change_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`, [req.session.user.full_name, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/timeoff-change-requests/:id/deny', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    await pool.query(`UPDATE timeoff_change_requests SET status = 'denied', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`, [req.session.user.full_name, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// QuickBooks payroll summary upload
app.post('/api/import-qb-payroll', requireRole('owner', 'payroll'), upload.single('file'), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.read(req.file.buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    // Debug: capture what was actually read
    const debugInfo = {
      sheetNames: wb.SheetNames,
      totalRows: data.length,
      sampleRows: data.slice(0, 15).map((r, i) => ({ row: i, cols: r.slice(0, 6) })),
      filename: req.file?.originalname || 'unknown'
    };
    
    // Types to skip — these are regular payroll, not PTO
    const skipTypes = new Set([
      'Gross','Regular Pay','Overtime Pay','Adjusted gross','Pretax deductions',
      'Health Insurance','Salary','Bonus','Net Pay','Total','Check Amount',
      'Tax','Federal','State','Social Security','Medicare',
      'Employee Tax','Employer Tax','Deduction','Contribution','Reimbursement',
      'Direct Deposit','Wage','Hourly','',
      // Common lowercase/variations
      'gross','regular pay','overtime pay','salary','bonus','net pay'
    ]);
    
    let currentName = null;
    const ptoPaid = {};
    let dateRange = '';
    const parseLog = []; // track what we found for debugging
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      const col0 = String(row[0] || '').trim();
      const col1 = String(row[1] || '').trim();
      const col2 = parseFloat(row[2]) || 0;
      const col3 = parseFloat(row[3]) || 0;
      
      // Detect date range (various QB formats)
      if (col0.startsWith('From ') || col0.match(/\d{1,2}\/\d{1,2}\/\d{2,4}\s*(to|-|through)\s*\d{1,2}\/\d{1,2}\/\d{2,4}/i)) {
        dateRange = col0;
      }
      
      // Detect employee name: "Last, First" pattern where next column says Gross or is empty
      if (col0 && col0.includes(',') && !col0.startsWith('From') && !col0.startsWith('Total')) {
        // Could be a name if followed by Gross or if it looks like "LastName, FirstName"
        const nameParts = col0.split(',');
        if (nameParts.length >= 2 && nameParts[0].trim().length > 0 && nameParts[1].trim().length > 0) {
          if (col1 === 'Gross' || col1 === '' || col1 === 'Total') {
            currentName = col0;
            parseLog.push({ row: i, action: 'name', name: currentName });
            continue;
          }
        }
      }
      
      // If we have a current employee, check for PTO-type pay items
      if (currentName && col1) {
        const payType = col1.toLowerCase();
        const isSkipType = skipTypes.has(col1) || skipTypes.has(payType) || 
          payType.includes('tax') || payType.includes('deduction') || 
          payType.includes('deposit') || payType.includes('insurance') ||
          payType.includes('contribution') || payType.includes('garnish') ||
          payType.includes('withhold') || payType.includes('reimburs');
        
        if (!isSkipType && (col2 > 0 || col3 > 0)) {
          const hours = col2 > 0 ? col2 : col3;
          if (!ptoPaid[currentName]) ptoPaid[currentName] = { hours: 0, types: [] };
          ptoPaid[currentName].hours += hours;
          ptoPaid[currentName].types.push({ type: col1, hours });
          parseLog.push({ row: i, action: 'pto', name: currentName, type: col1, hours });
        }
      }
    }
    
    // Sanity check: remove anyone with >200 hours (probably misparse)
    for (const name of Object.keys(ptoPaid)) { if (ptoPaid[name].hours > 200) delete ptoPaid[name]; }
    
    let matched = 0;
    const results = [];
    for (const [name, info] of Object.entries(ptoPaid)) {
      const hours = info.hours;
      const parts = name.split(',').map(s => s.trim());
      if (parts.length < 2) continue;
      const last = parts[0]; const first = parts[1].split(' ')[0];
      const emp = await pool.query(
        `SELECT id, first_name, last_name, pto_hours_used_qb FROM employees WHERE (LOWER(last_name) = LOWER($1) OR LOWER($1) LIKE '%' || LOWER(last_name) || '%') AND LOWER(first_name) LIKE LOWER($2) || '%' AND is_active = TRUE LIMIT 1`,
        [last, first]);
      if (emp.rows.length > 0) {
        const e = emp.rows[0];
        const newTotal = parseFloat(e.pto_hours_used_qb || 0) + hours;
        await pool.query('UPDATE employees SET pto_hours_used_qb = $1 WHERE id = $2', [newTotal, e.id]);
        results.push({ name: `${e.last_name}, ${e.first_name}`, hours, types: info.types, newTotal });
        matched++;
      } else { results.push({ name, hours, types: info.types, newTotal: null, error: 'Not found' }); }
    }
    // Log the upload
    try {
      await pool.query(
        `INSERT INTO upload_log (center, upload_type, filename, uploaded_by, uploaded_by_user_id, total_rows, matched_rows, notes)
         VALUES ('All', 'qb-payroll', $1, $2, $3, $4, $5, $6)`,
        [req.file?.originalname, req.session.user.full_name, req.session.user.id, data.length, matched,
         JSON.stringify({ dateRange, parseLog: parseLog.slice(0, 30), totalPTOEmployees: Object.keys(ptoPaid).length })]
      );
    } catch(logErr) { console.error('Upload log error:', logErr.message); }
    
    res.json({ 
      dateRange, totalEmployeesWithPTO: Object.keys(ptoPaid).length, matched, results,
      debug: { totalRows: data.length, sampleRows: debugInfo.sampleRows, parseLog: parseLog.slice(0, 20) }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pay increase requests
app.get('/api/pay-increases', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const result = await pool.query(`SELECT pir.*, e.first_name, e.last_name, e.center, u.full_name as requested_by_name, rv.full_name as reviewed_by_name FROM pay_increase_requests pir JOIN employees e ON pir.employee_id = e.id LEFT JOIN users u ON pir.requested_by = u.id LEFT JOIN users rv ON pir.reviewed_by = rv.id ORDER BY pir.status = 'pending' DESC, pir.created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/pay-increases', requireRole('owner', 'hr'), async (req, res) => {
  try {
    const { employee_id, reason_category, reason_detail, current_rate, proposed_rate } = req.body;
    const result = await pool.query(
      `INSERT INTO pay_increase_requests (employee_id, requested_by, reason_category, reason_detail, current_rate, proposed_rate) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [employee_id, req.session.user.id, reason_category, reason_detail, current_rate, proposed_rate]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/pay-increases/:id', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { status, review_notes } = req.body;
    const result = await pool.query(`UPDATE pay_increase_requests SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4 RETURNING *`,
      [status, review_notes, req.session.user.id, req.params.id]);
    if (status === 'approved') {
      const req2 = result.rows[0];
      await pool.query('UPDATE employees SET hourly_rate = $1 WHERE id = $2', [req2.proposed_rate, req2.employee_id]);
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Document uploads
app.post('/api/documents', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { employee_id, doc_type, notes, affects_pay_period } = req.body;
    const fileData = fs.readFileSync(req.file.path);
    const result = await pool.query(
      `INSERT INTO documents (employee_id, doc_type, file_name, file_data, notes, uploaded_by, affects_pay_period)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, doc_type, file_name, notes, affects_pay_period, created_at`,
      [employee_id, doc_type, req.file.originalname, fileData, notes, req.session.user.id, affects_pay_period]);
    fs.unlinkSync(req.file.path);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/documents/:id/download', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT file_name, file_data FROM documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Disposition', `attachment; filename="${result.rows[0].file_name}"`);
    res.send(result.rows[0].file_data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Parse "X hrs Y min" to decimal hours
function parseHoursMinutes(str) {
  if (!str) return 0;
  const m = str.match(/(\d+)\s*hrs?\s*(\d+)\s*min/i);
  if (m) return parseInt(m[1]) + parseInt(m[2]) / 60;
  // Also handle plain "X min" (no hours)
  const minOnly = str.match(/(\d+)\s*min/i);
  if (minOnly) return parseInt(minOnly[1]) / 60;
  // Also handle plain "X hrs" (no minutes)
  const hrsOnly = str.match(/(\d+)\s*hrs?/i);
  if (hrsOnly) return parseInt(hrsOnly[1]);
  return 0;
}
// Backwards-compatible alias
function parseBillableHours(str) { return parseHoursMinutes(str); }

// CSV Timecard import — Billable hours = actual payable hours
// Cross-center support: if a name doesn't match the uploading center, check other centers
app.post('/api/import-timecard', requireRole('owner', 'payroll', 'director'), upload.single('file'), async (req, res) => {
  try {
    const results = [];
    let fileContent = fs.readFileSync(req.file.path, 'utf8');
    if (fileContent.charCodeAt(0) === 0xFEFF) fileContent = fileContent.substring(1);
    fs.writeFileSync(req.file.path, fileContent, 'utf8');
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path).pipe(csv())
        .on('data', (data) => {
          const clean = {};
          for (const [k, v] of Object.entries(data)) clean[k.replace(/^\uFEFF/, '').trim()] = v;
          results.push(clean);
        })
        .on('end', resolve).on('error', reject);
    });
    fs.unlinkSync(req.file.path);
    let matched = 0, unmatched = 0, totalRows = 0;
    const unmatchedNames = new Set();
    const crossCenterStaff = []; // staff found at OTHER centers
    const dailySummary = {};
    const crossCenterHours = {}; // keyed by empId, holds pending hours from other centers
    for (const row of results) {
      const lastName = (row['Last Name'] || '').trim();
      const firstName = (row['First Name'] || '').trim();
      const dateStr = (row['Date'] || '').trim();
      const billable = (row['Billable'] || '').trim();
      if (!lastName || !dateStr) continue;
      totalRows++;
      const hours = parseBillableHours(billable);
      const dateParts = dateStr.split('/');
      if (dateParts.length !== 3) continue;
      const isoDate = `${dateParts[2]}-${dateParts[0].padStart(2,'0')}-${dateParts[1].padStart(2,'0')}`;
      // Try to match to any active employee (not just this center)
      const emp = await pool.query(
        `SELECT id, first_name, last_name, center, COALESCE(payroll_center, center) as payroll_center FROM employees WHERE (LOWER(last_name) = LOWER($1) OR LOWER($1) LIKE '%' || LOWER(last_name) || '%' OR LOWER(last_name) LIKE '%' || LOWER($1) || '%') AND (LOWER(first_name) = LOWER($2) OR LOWER(first_name) LIKE LOWER($2) || '%') AND is_active = TRUE LIMIT 1`,
        [lastName, firstName]);
      if (emp.rows.length > 0) {
        const empId = emp.rows[0].id;
        const key = `${empId}-${isoDate}`;
        dailySummary[key] = (dailySummary[key] || 0) + hours;
        matched++;
      } else { unmatched++; unmatchedNames.add(`${lastName}, ${firstName}`); }
    }
    let savedDays = 0;
    // Determine uploading center for source tracking
    const uploadCenter = req.body?.center || req.session.user.center || 'Unknown';
    console.log('[TIMECARD IMPORT] uploadCenter:', uploadCenter, '| req.body.center:', req.body?.center, '| session.center:', req.session.user.center, '| user:', req.session.user.username);
    
    // Collect all employee IDs and dates from this upload
    const empDates = new Set();
    const empIds = new Set();
    for (const key of Object.keys(dailySummary)) {
      const firstDash = key.indexOf('-');
      empIds.add(parseInt(key.substring(0, firstDash)));
      empDates.add(key);
    }
    
    // Delete ALL old rows for these employees/dates that came from this same center OR from 'default'/'Unknown'
    // This ensures a clean slate — re-uploading the same center's CSV replaces, not accumulates
    for (const [key, hours] of Object.entries(dailySummary)) {
      const firstDash = key.indexOf('-');
      const eid = parseInt(key.substring(0, firstDash));
      const dt = key.substring(firstDash + 1);
      await pool.query(
        `DELETE FROM daily_hours WHERE employee_id = $1 AND work_date = $2 AND (source_center IN ($3, 'default', 'Unknown') OR source_center IS NULL)`,
        [eid, dt, uploadCenter]);
    }
    
    // Now insert fresh rows — no conflict possible since we just deleted
    for (const [key, hours] of Object.entries(dailySummary)) {
      const firstDash = key.indexOf('-');
      const eid = parseInt(key.substring(0, firstDash));
      const dt = key.substring(firstDash + 1);
      await pool.query(
        `INSERT INTO daily_hours (employee_id, work_date, hours_worked, source, source_center) VALUES ($1, $2, $3, 'import', $4)`,
        [eid, dt, Math.round(hours * 100) / 100, uploadCenter]);
      savedDays++;
    }
    console.log('[TIMECARD IMPORT] savedDays:', savedDays, '| uploadCenter:', uploadCenter);
    const preview = results.slice(0, 40).map(r => ({
      name: `${(r['Last Name']||'').trim()}, ${(r['First Name']||'').trim()}`,
      date: (r['Date']||'').trim(), times: (r['Times']||'').trim().replace(/\n/g, ' | '),
      breaks: (r['Breaks']||'').trim(), billable: (r['Billable']||'').trim(),
      hours: parseBillableHours((r['Billable']||'').trim()).toFixed(2)
    }));
    // Log every upload for audit trail
    const currentPP = getPayPeriod(new Date());
    try {
      await pool.query(
        `INSERT INTO upload_log (center, period_start, period_end, upload_type, filename, uploaded_by, uploaded_by_user_id, total_rows, matched_rows, unmatched_rows, unmatched_names, saved_days)
         VALUES ($1,$2,$3,'timecard',$4,$5,$6,$7,$8,$9,$10,$11)`,
        [uploadCenter, currentPP.start, currentPP.end, req.file?.originalname || 'unknown', req.session.user.full_name, req.session.user.id, totalRows, matched, unmatched, [...unmatchedNames].join(', '), savedDays]
      );
    } catch(logErr) { console.error('Upload log error:', logErr.message); }
    res.json({
      imported: totalRows, matched, unmatched,
      unmatchedNames: [...unmatchedNames], savedDays, preview,
      payPeriod: currentPP
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Daily hours for OT tracking (per-employee)
app.get('/api/overtime/:employeeId', requireAuth, async (req, res) => {
  try {
    const payPeriod = getPayPeriod(req.query.date ? new Date(req.query.date + 'T12:00:00') : new Date());
    const weeks = getMonToSunWeeks(payPeriod.start, payPeriod.end);
    const allDates = [];
    weeks.forEach(w => {
      for (let d = new Date(w.monday); d <= new Date(w.sunday); d.setDate(d.getDate() + 1))
        allDates.push(d.toISOString().split('T')[0]);
    });
    if (allDates.length === 0) return res.json({ weeks: [], payPeriod });
    const hours = await pool.query(`SELECT work_date, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date = ANY($2) ORDER BY work_date`, [req.params.employeeId, allDates]);
    const hoursMap = {};
    hours.rows.forEach(h => { hoursMap[h.work_date.toISOString().split('T')[0]] = parseFloat(h.hours_worked); });
    const weekDetails = weeks.map(w => {
      let totalHours = 0;
      const days = [];
      for (let d = new Date(w.monday); d <= new Date(w.sunday); d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split('T')[0];
        const h = hoursMap[ds] || 0;
        totalHours += h;
        const inPayPeriod = ds >= payPeriod.start && ds <= payPeriod.end;
        days.push({ date: ds, hours: h, inPayPeriod, dayName: d.toLocaleDateString('en-US', { weekday: 'short' }) });
      }
      return { ...w, days, totalHours, regularHours: Math.min(totalHours, 40), overtimeHours: Math.max(0, totalHours - 40) };
    });
    res.json({ weeks: weekDetails, payPeriod });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Overtime View (all employees)
app.get('/api/overtime-view', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const pp = getPayPeriod(req.query.date ? new Date(req.query.date + 'T12:00:00') : new Date());
    const centerFilter = req.query.center || null;
    const weeks = getMonToSunWeeks(pp.start, pp.end);
    const allDates = [];
    weeks.forEach(w => {
      for (let d = new Date(w.monday); d <= new Date(w.sunday); d.setDate(d.getDate() + 1))
        allDates.push(d.toISOString().split('T')[0]);
    });
    if (allDates.length === 0) return res.json({ employees: [], payPeriod: pp, weeks });
    let empQuery = 'SELECT id, first_name, last_name, COALESCE(payroll_center, center) as center, position FROM employees WHERE is_active = TRUE';
    let empParams = [];
    if (centerFilter) { empQuery += ' AND COALESCE(payroll_center, center) = $1'; empParams.push(centerFilter); }
    empQuery += ' ORDER BY COALESCE(payroll_center, center), last_name, first_name';
    const empsResult = await pool.query(empQuery, empParams);
    const empIds = empsResult.rows.map(e => e.id);
    if (empIds.length === 0) return res.json({ employees: [], payPeriod: pp, weeks });
    const hoursResult = await pool.query(
      `SELECT employee_id, work_date, hours_worked FROM daily_hours WHERE employee_id = ANY($1) AND work_date = ANY($2)`,
      [empIds, allDates]
    );
    const hoursLookup = {};
    hoursResult.rows.forEach(h => {
      const eid = h.employee_id;
      const ds = h.work_date.toISOString().split('T')[0];
      if (!hoursLookup[eid]) hoursLookup[eid] = {};
      hoursLookup[eid][ds] = parseFloat(h.hours_worked);
    });
    const employeeData = [];
    for (const emp of empsResult.rows) {
      const empHours = hoursLookup[emp.id] || {};
      let totalInPeriod = 0, totalOT = 0;
      const weekBreakdown = [];
      for (const w of weeks) {
        let weekTotal = 0, weekInPeriod = 0;
        const days = [];
        for (let d = new Date(w.monday); d <= new Date(w.sunday); d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          const h = empHours[ds] || 0;
          weekTotal += h;
          const inPP = ds >= pp.start && ds <= pp.end;
          if (inPP) weekInPeriod += h;
          days.push({ date: ds, hours: h, inPayPeriod: inPP, dayName: d.toLocaleDateString('en-US', { weekday: 'short' }) });
        }
        const weekOT = Math.max(0, weekTotal - 40);
        totalInPeriod += weekInPeriod;
        totalOT += weekOT;
        weekBreakdown.push({ monday: w.monday, sunday: w.sunday, days, weekTotal, weekInPeriod, regularHours: Math.min(weekTotal, 40), overtimeHours: weekOT });
      }
      const hasAnyHours = Object.keys(empHours).length > 0;
      employeeData.push({
        id: emp.id, first_name: emp.first_name, last_name: emp.last_name,
        center: emp.center, position: emp.position, weeks: weekBreakdown,
        inPeriodHours: Math.round(totalInPeriod * 100) / 100,
        totalOT: Math.round(totalOT * 100) / 100, hasOT: totalOT > 0, hasHours: hasAnyHours
      });
    }
    res.json({ employees: employeeData, payPeriod: pp, weeks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================
// STAFFING PLAN
// ========================
app.get('/api/staffing-plan', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    let query = `SELECT sp.*, e.first_name, e.last_name, e.start_date as emp_start_date, e.scheduled_times as emp_schedule, e.center as emp_home_center
      FROM staffing_plan sp LEFT JOIN employees e ON sp.employee_id = e.id
      ORDER BY sp.center, sp.classroom, CASE sp.role_in_room WHEN 'Co-Lead' THEN 1 WHEN 'Lead' THEN 2 WHEN 'Assistant' THEN 3 WHEN 'Caregiver' THEN 4 WHEN 'Floater' THEN 5 ELSE 6 END`;
    let params = [];
    if (user.role === 'director') {
      query = `SELECT sp.*, e.first_name, e.last_name, e.start_date as emp_start_date, e.scheduled_times as emp_schedule, e.center as emp_home_center
        FROM staffing_plan sp LEFT JOIN employees e ON sp.employee_id = e.id
        WHERE sp.center = $1
        ORDER BY sp.classroom, CASE sp.role_in_room WHEN 'Co-Lead' THEN 1 WHEN 'Lead' THEN 2 WHEN 'Assistant' THEN 3 WHEN 'Caregiver' THEN 4 WHEN 'Floater' THEN 5 ELSE 6 END`;
      params = [user.center];
    }
    const result = await pool.query(query, params);

    // For cross-center subs (entry_type='sub'), do live lookup of compliance from home center
    const enriched = [];
    for (const row of result.rows) {
      if (row.entry_type === 'sub' && row.source_center && row.employee_id) {
        // Live lookup: find the home center staffing_plan entry for this employee
        const homeEntry = await pool.query(
          `SELECT orientation_date, cpr_first_aid_date, health_safety_abc_date, health_safety_refresher,
                  ccbc_consent_date, fingerprinting_date, date_eligible, abuse_neglect_statement,
                  last_evaluation, date_promoted_lead, date_assigned_room, education, semester_hours, infant_toddler_training
           FROM staffing_plan WHERE employee_id = $1 AND center = $2 AND (entry_type IS NULL OR entry_type = 'staff') LIMIT 1`,
          [row.employee_id, row.source_center]
        );
        if (homeEntry.rows.length > 0) {
          const h = homeEntry.rows[0];
          // Overlay home center compliance data onto the sub entry
          row.orientation_date = h.orientation_date;
          row.cpr_first_aid_date = h.cpr_first_aid_date;
          row.health_safety_abc_date = h.health_safety_abc_date;
          row.health_safety_refresher = h.health_safety_refresher;
          row.ccbc_consent_date = h.ccbc_consent_date;
          row.fingerprinting_date = h.fingerprinting_date;
          row.date_eligible = h.date_eligible;
          row.abuse_neglect_statement = h.abuse_neglect_statement;
          row.last_evaluation = h.last_evaluation;
          row.date_promoted_lead = h.date_promoted_lead;
          row.date_assigned_room = h.date_assigned_room;
          row.education = h.education;
          row.semester_hours = h.semester_hours;
          row.infant_toddler_training = h.infant_toddler_training;
        }
      }
      // For external entries, use external_name as first_name/last_name
      if (row.entry_type === 'external' && !row.employee_id && row.external_name) {
        const parts = row.external_name.split(' ');
        row.first_name = parts[0] || '';
        row.last_name = parts.slice(1).join(' ') || '';
        row.emp_start_date = row.external_start_date;
      }
      enriched.push(row);
    }

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/staffing-plan', requireRole('owner', 'hr', 'director'), async (req, res) => {
  try {
    const d = req.body;
    const result = await pool.query(
      `INSERT INTO staffing_plan (employee_id, center, classroom, role_in_room, orientation_date, cpr_first_aid_date, health_safety_abc_date, health_safety_refresher, ccbc_consent_date, fingerprinting_date, date_eligible, abuse_neglect_statement, last_evaluation, date_promoted_lead, date_assigned_room, education, semester_hours, infant_toddler_training, external_name, source_center, external_start_date, entry_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [d.employee_id || null, d.center, d.classroom, d.role_in_room, d.orientation_date, d.cpr_first_aid_date, d.health_safety_abc_date, d.health_safety_refresher, d.ccbc_consent_date, d.fingerprinting_date, d.date_eligible, d.abuse_neglect_statement, d.last_evaluation, d.date_promoted_lead, d.date_assigned_room, d.education, d.semester_hours, d.infant_toddler_training, d.external_name || null, d.source_center || null, d.external_start_date || null, d.entry_type || 'staff']);
    if (d.employee_id && d.entry_type !== 'sub') await pool.query('UPDATE employees SET classroom = $1, position = $2 WHERE id = $3', [d.classroom, d.role_in_room, d.employee_id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/staffing-plan/:id', requireRole('owner', 'hr', 'director'), async (req, res) => {
  try {
    const d = req.body;
    const result = await pool.query(
      `UPDATE staffing_plan SET employee_id=$1, center=$2, classroom=$3, role_in_room=$4, orientation_date=$5, cpr_first_aid_date=$6, health_safety_abc_date=$7, health_safety_refresher=$8, ccbc_consent_date=$9, fingerprinting_date=$10, date_eligible=$11, abuse_neglect_statement=$12, last_evaluation=$13, date_promoted_lead=$14, date_assigned_room=$15, education=$16, semester_hours=$17, infant_toddler_training=$18, external_name=$19, source_center=$20, external_start_date=$21, entry_type=$22, updated_at=NOW() WHERE id=$23 RETURNING *`,
      [d.employee_id || null, d.center, d.classroom, d.role_in_room, d.orientation_date, d.cpr_first_aid_date, d.health_safety_abc_date, d.health_safety_refresher, d.ccbc_consent_date, d.fingerprinting_date, d.date_eligible, d.abuse_neglect_statement, d.last_evaluation, d.date_promoted_lead, d.date_assigned_room, d.education, d.semester_hours, d.infant_toddler_training, d.external_name || null, d.source_center || null, d.external_start_date || null, d.entry_type || 'staff', req.params.id]);
    if (d.employee_id && d.entry_type !== 'sub') await pool.query('UPDATE employees SET classroom = $1, position = $2 WHERE id = $3', [d.classroom, d.role_in_room, d.employee_id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/staffing-plan/:id', requireRole('owner', 'hr', 'director'), async (req, res) => {
  try {
    await pool.query('DELETE FROM staffing_plan WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NEW: Get employees from OTHER centers for cross-center sub pull ─────────
app.get('/api/staffing-plan/available-subs/:center', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const targetCenter = decodeURIComponent(req.params.center);
    // Get all active employees NOT from the target center
    const emps = await pool.query(
      `SELECT e.id, e.first_name, e.last_name, e.center, e.position, e.start_date, e.scheduled_times,
              e.classroom
       FROM employees e
       WHERE e.is_active = TRUE AND e.center != $1
       ORDER BY e.center, e.last_name, e.first_name`,
      [targetCenter]
    );

    // Check which ones already have a sub entry at the target center
    const existingSubs = await pool.query(
      `SELECT employee_id FROM staffing_plan WHERE center = $1 AND entry_type = 'sub'`,
      [targetCenter]
    );
    const existingIds = new Set(existingSubs.rows.map(r => r.employee_id));

    const available = emps.rows.map(e => ({
      ...e,
      already_added: existingIds.has(e.id)
    }));

    res.json(available);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NEW: Pull a sub from another center (creates sub entry with live lookup) ──
app.post('/api/staffing-plan/pull-sub', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const { employee_id, target_center, classroom } = req.body;

    // Get the employee's home center
    const emp = await pool.query('SELECT id, first_name, last_name, center FROM employees WHERE id = $1', [employee_id]);
    if (emp.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const homeCenter = emp.rows[0].center;

    if (homeCenter === target_center) return res.status(400).json({ error: 'Employee already belongs to this center' });

    // Check if already added as sub at target center
    const existing = await pool.query(
      `SELECT id FROM staffing_plan WHERE employee_id = $1 AND center = $2 AND entry_type = 'sub'`,
      [employee_id, target_center]
    );
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Employee is already listed as a sub at this center' });

    // Create sub entry — compliance dates will be looked up live from home center
    const result = await pool.query(
      `INSERT INTO staffing_plan (employee_id, center, classroom, role_in_room, source_center, entry_type)
       VALUES ($1, $2, $3, 'Sub', $4, 'sub') RETURNING *`,
      [employee_id, target_center, classroom || 'Subs from other centers', homeCenter]
    );

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NEW: Add external person (therapist/volunteer) ──────────────────────────
app.post('/api/staffing-plan/add-external', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const { external_name, center, classroom, role_in_room, fingerprinting_date, date_eligible, abuse_neglect_statement, external_start_date } = req.body;

    if (!external_name || !external_name.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      `INSERT INTO staffing_plan (employee_id, center, classroom, role_in_room, external_name, entry_type,
       fingerprinting_date, date_eligible, abuse_neglect_statement, external_start_date)
       VALUES (NULL, $1, $2, $3, $4, 'external', $5, $6, $7, $8) RETURNING *`,
      [center, classroom, role_in_room || '', external_name.trim(), fingerprinting_date || null, date_eligible || null, abuse_neglect_statement || null, external_start_date || null]
    );

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── UPDATE: Printable staffing plan — handle subs (live lookup) and externals ──
app.get('/api/staffing-plan/print/:center', requireAuth, async (req, res) => {
  try {
    const center = decodeURIComponent(req.params.center);
    const spData = await pool.query(
      `SELECT sp.*, e.first_name, e.last_name, e.start_date as emp_start_date, e.scheduled_times as emp_schedule, e.center as emp_home_center
       FROM staffing_plan sp LEFT JOIN employees e ON sp.employee_id = e.id
       WHERE sp.center = $1
       ORDER BY sp.classroom, CASE sp.role_in_room WHEN 'Co-Lead' THEN 1 WHEN 'Lead' THEN 2 WHEN 'Assistant' THEN 3 WHEN 'Caregiver' THEN 4 WHEN 'Floater' THEN 5 ELSE 6 END`,
      [center]);

    // Enrich sub entries with live compliance data
    for (const row of spData.rows) {
      if (row.entry_type === 'sub' && row.source_center && row.employee_id) {
        const homeEntry = await pool.query(
          `SELECT orientation_date, cpr_first_aid_date, health_safety_abc_date, health_safety_refresher,
                  ccbc_consent_date, fingerprinting_date, date_eligible, abuse_neglect_statement,
                  last_evaluation, date_promoted_lead, date_assigned_room, education, semester_hours, infant_toddler_training
           FROM staffing_plan WHERE employee_id = $1 AND center = $2 AND (entry_type IS NULL OR entry_type = 'staff') LIMIT 1`,
          [row.employee_id, row.source_center]
        );
        if (homeEntry.rows.length > 0) {
          const h = homeEntry.rows[0];
          Object.assign(row, h);
        }
      }
      if (row.entry_type === 'external' && !row.employee_id && row.external_name) {
        const parts = row.external_name.split(' ');
        row.first_name = parts[0] || '';
        row.last_name = parts.slice(1).join(' ') || '';
        row.emp_start_date = row.external_start_date;
      }
    }

    const seen = new Set();
    const rows = spData.rows.filter(r => {
      // For externals, use id as key (no employee_id)
      const key = r.employee_id ? `emp-${r.employee_id}-${r.entry_type || 'staff'}` : `sp-${r.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const sig = await pool.query("SELECT value, updated_at FROM app_settings WHERE key = 'owner_signature'");
    const sigData = sig.rows[0];
    const licenseNum = center === 'Montessori' ? 'DC110278344' : 'DC110415511';
    const centerFull = center === 'Montessori' ? 'Montessori Children\'s Center' : `The Children's Center - ${center}`;
    function fd(d) { if (!d) return ''; const s = typeof d === 'string' ? d : d.toISOString ? d.toISOString() : String(d); const m = s.match(/(\d{4})-(\d{2})-(\d{2})/); return m ? parseInt(m[2])+'/'+parseInt(m[3])+'/'+m[1].slice(2) : ''; }
    const classrooms = {};
    rows.forEach(r => { if (!classrooms[r.classroom]) classrooms[r.classroom] = []; classrooms[r.classroom].push(r); });
    
    // Use center-specific template to determine which classrooms to show and their order
    // These MUST match the classroom names used in index.html (PEACE_CLASSROOMS, NILES_CLASSROOMS, MCC_CLASSROOMS)
    const peaceTemplate = ['Infants - Caterpillars','Infants/Toddlers - Butterflies','Toddlers - Dolphins','Toddlers - Kangas','Toddlers - Lions','Montessori Infants','Twos - Bears','Twos/Threes - Tigers','GSRP - Penguins','GSRP - Dinos','Threes/Fours Flamingos'];
    const nilesTemplate = ['Infants/Ones','Ones/Twos','Strong Beginnings - Threes','GSRP - 1 (4-Day)','GSRP - 2 (4-Day)','Toddler','Multi-Age - Miss Judy'];
    const montessoriTemplate = ['Toddlers - Purple','Pre-Primary - Yellow','Primary - Red','GSRP - Orange','GSRP - Blue','GSRP - Pink'];
    const centerRooms = center === 'Niles' ? nilesTemplate : center === 'Montessori' ? montessoriTemplate : peaceTemplate;
    const bottomSections = ['Admin / Office / Food Prep', 'Floaters', 'Subs from other centers', 'Therapist / Unsupervised Volunteers', 'Supervised Volunteers'];
    
    // Show ALL template classrooms (even empty) + any non-template classrooms that have actual staff
    const templateSet = new Set([...centerRooms, ...bottomSections]);
    const extraClassrooms = Object.keys(classrooms).filter(c => !templateSet.has(c));
    const orderedClassrooms = [...centerRooms, ...bottomSections, ...extraClassrooms];
    
    // Compute most recent update date for this center's staffing plan
    let lastUpdated = null;
    spData.rows.forEach(r => {
      if (r.updated_at) {
        const d = new Date(r.updated_at);
        if (!lastUpdated || d > lastUpdated) lastUpdated = d;
      }
    });
    const lastUpdatedStr = lastUpdated ? lastUpdated.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    
    // Date next to signature must reflect when the report is being printed (licensing requirement)
    const todayStr = new Date().toLocaleDateString();
    
    let tableRows = '';
    for (const cls of orderedClassrooms) {
      const staff = classrooms[cls] || [];
      tableRows += `<tr class="section"><td colspan="19">${cls}</td></tr>`;
      staff.forEach(s => {
        const nameDisplay = (s.first_name||'')+' '+(s.last_name||'');
        const homeTag = s.entry_type === 'sub' && s.source_center ? ` <span style="font-size:5pt;color:#888">(${s.source_center})</span>` : '';
        const extTag = s.entry_type === 'external' ? ` <span style="font-size:5pt;color:#888">(ext)</span>` : '';
        tableRows += `<tr><td>${s.role_in_room||''}</td><td class="name">${nameDisplay}${homeTag}${extTag}</td><td>${fd(s.emp_start_date)}</td><td>${s.emp_schedule||''}</td><td>${fd(s.orientation_date)}</td><td>${fd(s.cpr_first_aid_date)}</td><td>${fd(s.health_safety_abc_date)}</td><td>${fd(s.health_safety_refresher)}</td><td>${fd(s.ccbc_consent_date)}</td><td>${fd(s.fingerprinting_date)}</td><td>${fd(s.date_eligible)}</td><td>${fd(s.abuse_neglect_statement)}</td><td>${fd(s.last_evaluation)}</td><td>${fd(s.date_promoted_lead)}</td><td>${fd(s.date_assigned_room)}</td><td>${s.education||''}</td><td>${s.semester_hours||''}</td><td>${s.infant_toddler_training||''}</td></tr>`;
      });
    }
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Staffing Plan — ${centerFull}</title><style>@page{size:landscape;margin:0.3in}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#1B2A4A}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #C8963E}.header h1{font-size:11pt;font-weight:700}.header .sub{font-size:7pt;color:#666}.header .sig{text-align:right}.header .sig img{height:25px}table{width:100%;border-collapse:collapse;font-size:6.5pt}th{background:#1B2A4A;color:white;padding:2px 3px;text-align:left;font-weight:600;font-size:6pt;white-space:nowrap}td{padding:2px 3px;border-bottom:0.5px solid #ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px}td.name{font-weight:600;max-width:100px}tr.section td{background:#1B2A4A;color:white;font-weight:700;font-size:7pt;padding:3px 5px}tr:nth-child(even):not(.section){background:#f8f9fa}.resp-row{font-size:5.5pt;color:#888;margin-bottom:2px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="header"><div><h1>Staffing Plan</h1><div class="sub">${centerFull} · License #${licenseNum}</div><div class="sub">All Staff and Unsupervised Volunteers · Plan last updated: ${lastUpdatedStr}</div></div><div class="sig"><div class="sub">Mary Wardlaw, Licensee</div>${sigData?.value ? `<img src="${sigData.value}"><div class="sub">${todayStr}</div>` : ''}</div></div><div class="resp-row">Responsible: Program Director completes Name, Start Date, Schedule, Evaluations, Promoted, Room Assigned · Amy (Dir. Professional Development) completes Orientation, CPR, H&S, CCBC, Fingerprint, Eligible, Abuse/Neglect, Education, Hours, I/T Training</div><table><thead><tr><th>Role</th><th>Name</th><th>Start</th><th>Schedule</th><th>Orient.</th><th>CPR/FA</th><th>H&S ABC</th><th>H&S Ref.</th><th>CCBC</th><th>Fingerpr.</th><th>Eligible</th><th>Abuse/Neg.</th><th>Last Eval</th><th>Promoted</th><th>Room Asgn</th><th>Education</th><th>Hrs/CEUs</th><th>I/T Training</th></tr></thead><tbody>${tableRows}</tbody></table><div style="margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #ccc;padding-top:8px"><div style="flex:1"><div style="font-size:7pt;font-weight:600;color:#666;margin-bottom:2px">Licensee Signature:</div>${sigData?.value ? '<img src="' + sigData.value + '" style="height:30px;margin-bottom:2px"><br><span style="font-size:6pt;color:#999">Digital signature on file</span>' : '<div style="border-bottom:1px solid #333;width:250px;height:25px;margin-bottom:2px"></div><span style="font-size:6pt;color:#999">Sign here</span>'}</div><div style="text-align:center;flex:1"><div style="font-size:7pt;font-weight:600">Mary Wardlaw, Licensee</div></div><div style="text-align:right;flex:1"><div style="font-size:7pt;font-weight:600;color:#666;margin-bottom:2px">Date:</div>${sigData?.value ? '<span style="font-size:8pt">' + todayStr + '</span>' : '<div style="border-bottom:1px solid #333;width:150px;height:20px;display:inline-block"></div>'}</div></div><script>window.onload=function(){window.print()}</script></body></html>`;
    res.send(html);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Signature storage
app.post('/api/settings/signature', requireRole('owner'), async (req, res) => {
  try {
    const { signature_data } = req.body;
    await pool.query(`INSERT INTO app_settings (key, value, updated_at) VALUES ('owner_signature', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [signature_data]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/settings/signature', requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT value, updated_at FROM app_settings WHERE key = 'owner_signature'");
    res.json(result.rows[0] || { value: null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Change password
app.post('/api/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.user.id]);
    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.session.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================
// PAYROLL PERIOD WORKFLOW
// ========================
app.get('/api/payroll-period-status', requireAuth, async (req, res) => {
  try {
    const pp = getPayPeriod(req.query.date ? new Date(req.query.date + 'T12:00:00') : new Date());
    const user = req.session.user;
    const centers = user.role === 'director' ? [user.center] : ['Peace Boulevard', 'Niles', 'Montessori'];
    const results = {};
    for (const center of centers) {
      await pool.query(`INSERT INTO payroll_periods (period_start, period_end, pay_date, center) VALUES ($1, $2, $3, $4) ON CONFLICT (period_start, period_end, center) DO NOTHING`, [pp.start, pp.end, pp.payDate, center]);
      const r = await pool.query('SELECT * FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND center = $3', [pp.start, pp.end, center]);
      results[center] = r.rows[0];
    }
    const sigs = await pool.query('SELECT * FROM payroll_signatures WHERE period_start = $1 AND period_end = $2 ORDER BY created_at', [pp.start, pp.end]);
    res.json({ payPeriod: pp, periods: results, signatures: sigs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/sign-timecards', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center, signature_name } = req.body;
    const user = req.session.user;
    await pool.query(`UPDATE payroll_periods SET timecards_uploaded = TRUE, timecards_signed_by = $1, timecards_signed_at = NOW() WHERE period_start = $2 AND period_end = $3 AND center = $4`, [signature_name, period_start, period_end, center]);
    await pool.query(`INSERT INTO payroll_signatures (period_start, period_end, center, action_type, signed_by_user_id, signed_by_name, signature_text, statement) VALUES ($1, $2, $3, 'timecards_verified', $4, $5, $6, 'I verify that the uploaded timecards have been reviewed and are accurate.')`, [period_start, period_end, center, user.id, user.full_name, signature_name]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/submit-timeoff', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center } = req.body;
    const user = req.session.user;
    await pool.query(`INSERT INTO payroll_periods (period_start, period_end, pay_date, center) VALUES ($1, $2, $2, $3) ON CONFLICT (period_start, period_end, center) DO NOTHING`, [period_start, period_end, center]);
    await pool.query(`UPDATE payroll_periods SET timeoff_submitted = TRUE, timeoff_submitted_by = $1, timeoff_submitted_at = NOW(), change_request_pending = FALSE WHERE period_start = $2 AND period_end = $3 AND center = $4`, [user.full_name, period_start, period_end, center]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/unsubmit-timeoff', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center } = req.body;
    const pp = await pool.query(`SELECT payroll_accessed_at, payroll_closed FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND center = $3`, [period_start, period_end, center]);
    if (pp.rows.length > 0 && pp.rows[0].payroll_accessed_at) return res.status(403).json({ error: 'locked', message: 'Payroll processing has already begun. Submit a change request for Jared to approve.' });
    await pool.query(`UPDATE payroll_periods SET timeoff_submitted = FALSE, timeoff_submitted_by = NULL, timeoff_submitted_at = NULL WHERE period_start = $1 AND period_end = $2 AND center = $3`, [period_start, period_end, center]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Force-unlock: owner/payroll only — clears ALL signoff fields including payroll_accessed_at
// Used when a director accidentally signs off too early or in the wrong period
app.post('/api/payroll-workflow/force-unlock-timeoff', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { period_start, period_end, center } = req.body;
    await pool.query(
      `UPDATE payroll_periods SET 
        timeoff_submitted = FALSE, timeoff_submitted_by = NULL, timeoff_submitted_at = NULL,
        timeoff_approved = FALSE, timeoff_signed_by = NULL, timeoff_signed_at = NULL,
        change_request_pending = FALSE, change_request_reason = NULL,
        payroll_accessed_at = NULL
       WHERE period_start = $1 AND period_end = $2 AND center = $3`,
      [period_start, period_end, center]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Force-unlock timecards: owner/payroll only — clears timecard signoff AND deletes imported hours for the period
app.post('/api/payroll-workflow/force-unlock-timecards', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { period_start, period_end, center, clear_hours } = req.body;
    // Reset the timecard workflow flags
    await pool.query(
      `UPDATE payroll_periods SET 
        timecards_uploaded = FALSE, timecards_signed_by = NULL, timecards_signed_at = NULL,
        director_closed = FALSE, director_closed_by = NULL, director_closed_at = NULL,
        payroll_accessed_at = NULL
       WHERE period_start = $1 AND period_end = $2 AND center = $3`,
      [period_start, period_end, center]
    );
    // Optionally clear the imported daily_hours so they can be re-uploaded
    if (clear_hours) {
      const empIds = await pool.query(
        `SELECT id FROM employees WHERE COALESCE(payroll_center, center) = $1 AND is_active = TRUE`, [center]);
      const ids = empIds.rows.map(r => r.id);
      if (ids.length > 0) {
        await pool.query(
          `DELETE FROM daily_hours WHERE employee_id = ANY($1) AND work_date >= $2 AND work_date <= $3 AND source = 'import' AND source_center IN ($4, 'default', 'Unknown')`,
          [ids, period_start, period_end, center]
        );
      }
    }
    res.json({ ok: true, hoursCleared: !!clear_hours });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload log: retrieve history of CSV uploads for a center/period
app.get('/api/upload-log', requireRole('owner', 'payroll', 'hr'), async (req, res) => {
  try {
    const { center, period_start, period_end } = req.query;
    let query = 'SELECT * FROM upload_log ORDER BY uploaded_at DESC LIMIT 50';
    let params = [];
    if (center && period_start && period_end) {
      query = 'SELECT * FROM upload_log WHERE center = $1 AND period_start = $2 AND period_end = $3 ORDER BY uploaded_at DESC';
      params = [center, period_start, period_end];
    } else if (center) {
      query = 'SELECT * FROM upload_log WHERE center = $1 ORDER BY uploaded_at DESC LIMIT 20';
      params = [center];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Debug: see all daily_hours rows for an employee (owner/payroll only)
app.get('/api/debug/daily-hours/:employeeId', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const rows = await pool.query(
      `SELECT dh.*, e.first_name, e.last_name, e.center, e.payroll_center 
       FROM daily_hours dh JOIN employees e ON e.id = dh.employee_id 
       WHERE dh.employee_id = $1 ORDER BY dh.work_date, dh.source_center`,
      [req.params.employeeId]);
    res.json({ employeeId: req.params.employeeId, totalRows: rows.rows.length, rows: rows.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/request-timeoff-change', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center, reason } = req.body;
    const user = req.session.user;
    await pool.query(`UPDATE payroll_periods SET change_request_pending = TRUE, change_request_reason = $1 WHERE period_start = $2 AND period_end = $3 AND center = $4`, [user.full_name + ': ' + reason, period_start, period_end, center]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/approve-timeoff-change', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { period_start, period_end, center } = req.body;
    await pool.query(`UPDATE payroll_periods SET timeoff_submitted = FALSE, change_request_pending = FALSE, change_request_reason = NULL, payroll_accessed_at = NULL WHERE period_start = $1 AND period_end = $2 AND center = $3`, [period_start, period_end, center]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/deny-timeoff-change', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { period_start, period_end, center } = req.body;
    await pool.query(`UPDATE payroll_periods SET change_request_pending = FALSE, change_request_reason = NULL WHERE period_start = $1 AND period_end = $2 AND center = $3`, [period_start, period_end, center]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/mark-accessed', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { period_start, period_end, center } = req.body;
    await pool.query(`UPDATE payroll_periods SET payroll_accessed_at = COALESCE(payroll_accessed_at, NOW()) WHERE period_start = $1 AND period_end = $2 AND center = $3`, [period_start, period_end, center]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/sign-timeoff', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center, signature_name } = req.body;
    const user = req.session.user;
    await pool.query(`UPDATE payroll_periods SET timeoff_approved = TRUE, timeoff_signed_by = $1, timeoff_signed_at = NOW() WHERE period_start = $2 AND period_end = $3 AND center = $4`, [signature_name, period_start, period_end, center]);
    await pool.query(`INSERT INTO payroll_signatures (period_start, period_end, center, action_type, signed_by_user_id, signed_by_name, signature_text, statement) VALUES ($1, $2, $3, 'timeoff_verified', $4, $5, $6, 'I verify that all paid and unpaid time off entries for this pay period are accurate.')`, [period_start, period_end, center, user.id, user.full_name, signature_name]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/director-close', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center, signature_name } = req.body;
    const user = req.session.user;
    await pool.query(`UPDATE payroll_periods SET director_closed = TRUE, director_closed_by = $1, director_closed_at = NOW(), status = 'director_submitted' WHERE period_start = $2 AND period_end = $3 AND center = $4`, [signature_name, period_start, period_end, center]);
    await pool.query(`INSERT INTO payroll_signatures (period_start, period_end, center, action_type, signed_by_user_id, signed_by_name, signature_text, statement) VALUES ($1, $2, $3, 'director_closeout', $4, $5, $6, 'I certify that all payroll information for this pay period has been reviewed, verified, and submitted for processing.')`, [period_start, period_end, center, user.id, user.full_name, signature_name]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-workflow/payroll-close', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { period_start, period_end, signature_name } = req.body;
    const user = req.session.user;
    await pool.query(`UPDATE payroll_periods SET payroll_closed = TRUE, payroll_closed_by = $1, payroll_closed_at = NOW(), status = 'closed' WHERE period_start = $2 AND period_end = $3`, [signature_name, period_start, period_end]);
    for (const center of ['Peace Boulevard', 'Niles', 'Montessori']) {
      await pool.query(`INSERT INTO payroll_signatures (period_start, period_end, center, action_type, signed_by_user_id, signed_by_name, signature_text, statement) VALUES ($1, $2, $3, 'payroll_processed', $4, $5, $6, 'Payroll has been processed for this pay period.')`, [period_start, period_end, center, user.id, user.full_name, signature_name]);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================
// PAYROLL REPORT
// ========================
app.get('/api/payroll-report', requireRole('owner', 'payroll', 'hr'), async (req, res) => {
  try {
    const pp = getPayPeriod(req.query.date ? new Date(req.query.date + 'T12:00:00') : new Date());
    const center = req.query.center;
    let empQuery, empParams;
    if (center) {
      empQuery = `SELECT e.*, COALESCE(e.payroll_center, e.center) as effective_payroll_center FROM employees e WHERE (e.is_active = TRUE OR EXISTS (SELECT 1 FROM daily_hours dh WHERE dh.employee_id = e.id AND dh.work_date >= $2 AND dh.work_date <= $3)) AND COALESCE(e.payroll_center, e.center) = $1 ORDER BY e.last_name, e.first_name`;
      empParams = [center, pp.start, pp.end];
    } else {
      empQuery = `SELECT e.*, COALESCE(e.payroll_center, e.center) as effective_payroll_center FROM employees e WHERE (e.is_active = TRUE OR EXISTS (SELECT 1 FROM daily_hours dh WHERE dh.employee_id = e.id AND dh.work_date >= $1 AND dh.work_date <= $2)) ORDER BY COALESCE(e.payroll_center, e.center), e.last_name, e.first_name`;
      empParams = [pp.start, pp.end];
    }
    const empsResult = await pool.query(empQuery, empParams);
    let empRows = empsResult.rows.filter(e => !shouldHideFromUser(e, req.session.user));
    const report = [];
    for (const emp of empRows) {
      const sunSatWeeks = getSunSatWeeks(pp.start, pp.end);
      const allDates = new Set();
      sunSatWeeks.forEach(w => {
        for (let d = new Date(w.sunday + 'T12:00:00'); d <= new Date(w.saturday + 'T12:00:00'); d.setDate(d.getDate() + 1))
          allDates.add(d.toISOString().split('T')[0]);
      });
      const allHours = await pool.query(`SELECT work_date, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date = ANY($2)`, [emp.id, [...allDates]]);
      const hoursMap = {};
      allHours.rows.forEach(h => { hoursMap[h.work_date.toISOString().split('T')[0]] = parseFloat(h.hours_worked); });
      let totalHours = 0;
      const weekDetails = [];
      for (const w of sunSatWeeks) {
        let weekTotal = 0, weekInPeriod = 0;
        const days = [];
        for (let d = new Date(w.sunday + 'T12:00:00'); d <= new Date(w.saturday + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          const h = hoursMap[ds] || 0;
          weekTotal += h;
          const inPeriod = ds >= pp.start && ds <= pp.end;
          if (inPeriod) weekInPeriod += h;
          days.push({ date: ds, hours: h, inPeriod });
        }
        const weekOT = Math.max(0, weekTotal - 40);
        const weekReg = weekTotal - weekOT;
        weekDetails.push({ ...w, days, weekTotal, weekOT, weekReg, weekInPeriod });
        totalHours += weekInPeriod;
      }
      let periodRegular = 0, periodOT = 0;
      for (const w of weekDetails) {
        if (w.weekTotal <= 40) { periodRegular += w.weekInPeriod; }
        else {
          let inPeriodAfter40 = 0, runningTotal = 0;
          for (const day of w.days) {
            runningTotal += day.hours;
            if (day.inPeriod && runningTotal > 40) inPeriodAfter40 += Math.min(day.hours, runningTotal - 40);
          }
          periodOT += inPeriodAfter40;
          periodRegular += (w.weekInPeriod - inPeriodAfter40);
        }
      }
      const pto = await pool.query(`SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'P' AND entry_date >= $2 AND entry_date <= $3`, [emp.id, pp.start, pp.end]);
      const ptoDays = parseInt(pto.rows[0].count);
      const unpaid = await pool.query(`SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'U' AND entry_date >= $2 AND entry_date <= $3`, [emp.id, pp.start, pp.end]);
      const unpaidDays = parseInt(unpaid.rows[0].count);
      const increases = await pool.query(`SELECT * FROM pay_increase_requests WHERE employee_id = $1 AND status = 'approved' AND reviewed_at >= $2 AND reviewed_at <= $3`, [emp.id, pp.start + 'T00:00:00', pp.end + 'T23:59:59']);
      report.push({
        id: emp.id, first_name: emp.first_name, last_name: emp.last_name,
        center: emp.effective_payroll_center || emp.center, position: emp.position, hourly_rate: emp.hourly_rate,
        is_full_time: emp.is_full_time,
        totalHours: Math.round(totalHours * 100) / 100,
        regularHours: Math.round(periodRegular * 100) / 100,
        overtimeHours: Math.round(periodOT * 100) / 100,
        ptoDays, unpaidDays, payIncreases: increases.rows, weekDetails
      });
    }
    const termResult = await pool.query(
      `SELECT * FROM employees WHERE is_active = FALSE AND terminated_date IS NOT NULL AND terminated_date >= $1 ORDER BY terminated_date DESC`,
      [pp.start]
    );
    const terminations = termResult.rows.map(t => ({
      id: t.id, first_name: t.first_name, last_name: t.last_name,
      center: t.center, position: t.position,
      terminated_date: t.terminated_date, termination_reason: t.termination_reason,
      terminated_by: t.terminated_by, termination_payroll_count: 0
    }));
    res.json({ payPeriod: pp, report, terminations });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================
// PAYROLL REPORT PDF GENERATION
// ========================
async function generatePayrollPDF(pp, report, terminations, newHireW4s) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const navy = '#1B2A4A';
    const gold = '#C8963E';
    const gray = '#5A6270';
    const lightGray = '#F0F2F5';
    const danger = '#C0392B';
    const success = '#2E7D4F';
    const pageW = 612 - 80;
    doc.rect(0, 0, 612, 70).fill(navy);
    doc.fill('#FFFFFF').fontSize(18).font('Helvetica-Bold').text('TCC Payroll Report', 40, 20);
    doc.fontSize(11).font('Helvetica').text(`Pay Period: ${pp.label}`, 40, 42);
    doc.text(`Pay Date: ${new Date(pp.payDate + 'T12:00:00').toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'})}`, 40, 55, { continued: false });
    doc.fill(gold).fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, 400, 25, { align: 'right', width: 172 });
    doc.text('The Children\'s Center', 400, 38, { align: 'right', width: 172 });
    doc.y = 85;
    function drawTable(headers, rows, colWidths, opts = {}) {
      const startY = doc.y;
      const rowH = 18;
      const headerH = 22;
      let y = startY;
      const neededH = headerH + (rows.length * rowH) + 10;
      if (y + neededH > 720) { doc.addPage(); y = 40; }
      doc.rect(40, y, pageW, headerH).fill(navy);
      let x = 40;
      headers.forEach((h, i) => {
        doc.fill('#FFFFFF').fontSize(8).font('Helvetica-Bold')
          .text(h, x + 4, y + 6, { width: colWidths[i] - 8, align: opts.aligns?.[i] || 'left' });
        x += colWidths[i];
      });
      y += headerH;
      rows.forEach((row, ri) => {
        if (y + rowH > 730) { doc.addPage(); y = 40; }
        const bg = row._bg || (ri % 2 === 0 ? '#FFFFFF' : lightGray);
        doc.rect(40, y, pageW, rowH).fill(bg);
        x = 40;
        row.cells.forEach((cell, ci) => {
          const color = cell.color || navy;
          const font = cell.bold ? 'Helvetica-Bold' : 'Helvetica';
          doc.fill(color).fontSize(9).font(font)
            .text(String(cell.text || ''), x + 4, y + 5, { width: colWidths[ci] - 8, align: opts.aligns?.[ci] || 'left' });
          x += colWidths[ci];
        });
        y += rowH;
      });
      doc.y = y + 6;
    }
    function sectionHeader(title, color) {
      if (doc.y > 680) doc.addPage();
      doc.y += 8;
      doc.rect(40, doc.y, pageW, 2).fill(color || gold);
      doc.y += 6;
      doc.fill(color || navy).fontSize(13).font('Helvetica-Bold').text(title, 40, doc.y);
      doc.y += 20;
    }
    const allIncreases = [];
    report.forEach(e => {
      if (e.payIncreases && e.payIncreases.length > 0) {
        e.payIncreases.forEach(pi => allIncreases.push({ ...pi, empName: `${e.last_name}, ${e.first_name}`, center: e.center }));
      }
    });
    if (allIncreases.length > 0) {
      sectionHeader('Pay Increases This Period');
      const piRows = allIncreases.map(pi => ({
        cells: [
          { text: pi.empName, bold: true },
          { text: pi.center },
          { text: '$' + parseFloat(pi.current_rate).toFixed(2) },
          { text: '$' + parseFloat(pi.proposed_rate).toFixed(2), color: success, bold: true },
          { text: pi.reviewed_at ? new Date(pi.reviewed_at).toLocaleDateString() : '' }
        ]
      }));
      drawTable(['Employee', 'Center', 'Previous Rate', 'New Rate', 'Effective'], piRows, [160, 110, 90, 90, 82]);
    }
    if (newHireW4s && newHireW4s.length > 0) {
      sectionHeader('New Employees This Period');
      const neRows = newHireW4s.map(e => ({
        cells: [
          { text: `${e.last_name}, ${e.first_name}`, bold: true },
          { text: e.center },
          { text: e.position || '' },
          { text: e.start_date ? new Date(e.start_date).toLocaleDateString() : '' },
          { text: e.hourly_rate ? '$' + parseFloat(e.hourly_rate).toFixed(2) : '' },
          { text: e.hasW4 ? 'See attached' : 'Missing' }
        ]
      }));
      drawTable(['Name', 'Center', 'Position', 'Start Date', 'Rate', 'W-4'], neRows, [140, 100, 80, 80, 70, 62]);
    }
    if (terminations && terminations.length > 0) {
      sectionHeader('Terminations — Action Required', danger);
      doc.fill(gray).fontSize(9).font('Helvetica')
        .text('Verify these employees have been terminated in QuickBooks.', 40, doc.y);
      doc.y += 14;
      const tRows = terminations.map(t => ({
        cells: [
          { text: `${t.last_name}, ${t.first_name}`, bold: true },
          { text: t.center },
          { text: t.terminated_date ? new Date(t.terminated_date).toLocaleDateString() : '' },
          { text: t.termination_reason || '' },
          { text: t.terminated_by || '' }
        ]
      }));
      drawTable(['Name', 'Center', 'Last Day', 'Reason', 'Terminated By'], tRows, [140, 100, 80, 130, 82]);
    }
    const byCenter = {};
    report.forEach(r => { if (!byCenter[r.center]) byCenter[r.center] = []; byCenter[r.center].push(r); });
    for (const [ctr, emps] of Object.entries(byCenter)) {
      sectionHeader(ctr);
      emps.sort((a,b) => a.last_name.localeCompare(b.last_name));
      let ctrReg = 0, ctrOT = 0, ctrTotal = 0;
      const hRows = emps.map(e => {
        ctrReg += e.regularHours; ctrOT += e.overtimeHours; ctrTotal += e.totalHours;
        const hasOT = e.overtimeHours > 0;
        const hasPTO = e.ptoDays > 0;
        return {
          _bg: hasPTO ? '#EBF4FF' : undefined,
          cells: [
            { text: `${e.last_name}, ${e.first_name}`, bold: true },
            { text: e.regularHours.toFixed(2) },
            { text: hasOT ? e.overtimeHours.toFixed(2) : '—', color: hasOT ? danger : gray },
            { text: e.totalHours.toFixed(2), bold: true },
            { text: hasPTO ? (e.ptoDays * 8).toFixed(2) : '—', color: hasPTO ? '#2471A3' : gray },
            { text: e.unpaidDays > 0 ? e.unpaidDays + 'd' : '—' }
          ]
        };
      });
      hRows.push({
        _bg: navy,
        cells: [
          { text: `TOTAL — ${ctr}`, bold: true, color: '#FFFFFF' },
          { text: ctrReg.toFixed(2), color: '#FFFFFF', bold: true },
          { text: ctrOT.toFixed(2), color: '#FFFFFF', bold: true },
          { text: ctrTotal.toFixed(2), color: '#FFFFFF', bold: true },
          { text: '', color: '#FFFFFF' },
          { text: '', color: '#FFFFFF' }
        ]
      });
      drawTable(['Name', 'Reg Hrs', 'OT Hrs', 'Total Hrs', 'PTO Hrs', 'Unpaid'], hRows, [160, 75, 75, 80, 75, 67], { aligns: ['left', 'right', 'right', 'right', 'right', 'right'] });
    }
    if (newHireW4s && newHireW4s.length > 0) {
      for (const emp of newHireW4s) {
        if (emp.w4Data && emp.w4Data.length > 0) {
          doc.addPage();
          doc.rect(0, 0, 612, 40).fill(navy);
          doc.fill('#FFFFFF').fontSize(12).font('Helvetica-Bold')
            .text(`W-4 — ${emp.first_name} ${emp.last_name}`, 40, 12);
          doc.fill(gold).fontSize(9).font('Helvetica')
            .text(`${emp.center} · Start Date: ${emp.start_date ? new Date(emp.start_date).toLocaleDateString() : ''}`, 40, 28);
          try {
            const imgBuffer = Buffer.from(emp.w4Data);
            const isJpeg = imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8;
            const isPng = imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50;
            if (isJpeg || isPng) {
              doc.image(imgBuffer, 40, 50, { fit: [pageW, 680], align: 'center' });
            } else {
              doc.fill(gray).fontSize(11).font('Helvetica')
                .text('W-4 document attached (non-image format — see original file in Document Center)', 40, 60);
            }
          } catch(imgErr) {
            doc.fill(gray).fontSize(11).font('Helvetica')
              .text('W-4 document could not be rendered. See Document Center for the original file.', 40, 60);
          }
        }
      }
    }
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fill(gray).fontSize(7).font('Helvetica')
        .text(`TCC Payroll Report · ${pp.label} · Page ${i + 1} of ${totalPages}`, 40, 750, { align: 'center', width: pageW });
    }
    doc.end();
  });
}

app.get('/api/payroll-report/pdf', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const pp = getPayPeriod(req.query.date ? new Date(req.query.date + 'T12:00:00') : new Date());
    const user = req.session.user;
    const empQuery = `SELECT e.*, COALESCE(e.payroll_center, e.center) as effective_payroll_center FROM employees e WHERE (e.is_active = TRUE OR EXISTS (SELECT 1 FROM daily_hours dh WHERE dh.employee_id = e.id AND dh.work_date >= $1 AND dh.work_date <= $2)) ORDER BY COALESCE(e.payroll_center, e.center), e.last_name, e.first_name`;
    const empsResult = await pool.query(empQuery, [pp.start, pp.end]);
    let empRows = empsResult.rows.filter(e => !shouldHideFromUser(e, user));
    const report = [];
    for (const emp of empRows) {
      const sunSatWeeks = getSunSatWeeks(pp.start, pp.end);
      const allDates = new Set();
      sunSatWeeks.forEach(w => {
        for (let d = new Date(w.sunday + 'T12:00:00'); d <= new Date(w.saturday + 'T12:00:00'); d.setDate(d.getDate() + 1))
          allDates.add(d.toISOString().split('T')[0]);
      });
      const allHours = await pool.query(`SELECT work_date, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date = ANY($2)`, [emp.id, [...allDates]]);
      const hoursMap = {};
      allHours.rows.forEach(h => { hoursMap[h.work_date.toISOString().split('T')[0]] = parseFloat(h.hours_worked); });
      let totalHours = 0;
      const weekDetails = [];
      for (const w of sunSatWeeks) {
        let weekTotal = 0, weekInPeriod = 0;
        for (let d = new Date(w.sunday + 'T12:00:00'); d <= new Date(w.saturday + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          const h = hoursMap[ds] || 0;
          weekTotal += h;
          if (ds >= pp.start && ds <= pp.end) weekInPeriod += h;
        }
        const weekOT = Math.max(0, weekTotal - 40);
        weekDetails.push({ ...w, weekTotal, weekOT, weekReg: weekTotal - weekOT, weekInPeriod });
        totalHours += weekInPeriod;
      }
      let periodRegular = 0, periodOT = 0;
      for (const w of weekDetails) {
        if (w.weekTotal <= 40) { periodRegular += w.weekInPeriod; }
        else { periodOT += Math.max(0, w.weekInPeriod - Math.max(0, 40 - (w.weekTotal - w.weekInPeriod))); periodRegular += w.weekInPeriod - Math.max(0, w.weekInPeriod - Math.max(0, 40 - (w.weekTotal - w.weekInPeriod))); }
      }
      const pto = await pool.query(`SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'P' AND entry_date >= $2 AND entry_date <= $3`, [emp.id, pp.start, pp.end]);
      const ptoDays = parseInt(pto.rows[0].count);
      const unpaid = await pool.query(`SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'U' AND entry_date >= $2 AND entry_date <= $3`, [emp.id, pp.start, pp.end]);
      const unpaidDays = parseInt(unpaid.rows[0].count);
      const increases = await pool.query(`SELECT * FROM pay_increase_requests WHERE employee_id = $1 AND status = 'approved' AND reviewed_at >= $2 AND reviewed_at <= $3`, [emp.id, pp.start + 'T00:00:00', pp.end + 'T23:59:59']);
      report.push({
        id: emp.id, first_name: emp.first_name, last_name: emp.last_name,
        center: emp.effective_payroll_center || emp.center, position: emp.position, hourly_rate: emp.hourly_rate,
        is_full_time: emp.is_full_time, start_date: emp.start_date,
        totalHours: Math.round(totalHours * 100) / 100,
        regularHours: Math.round(periodRegular * 100) / 100,
        overtimeHours: Math.round(periodOT * 100) / 100,
        ptoDays, unpaidDays, payIncreases: increases.rows, weekDetails
      });
    }
    const termResult = await pool.query(
      `SELECT * FROM employees WHERE is_active = FALSE AND terminated_date IS NOT NULL AND terminated_date >= $1 ORDER BY terminated_date DESC`, [pp.start]);
    const terminations = termResult.rows.map(t => ({
      id: t.id, first_name: t.first_name, last_name: t.last_name,
      center: t.center, terminated_date: t.terminated_date,
      termination_reason: t.termination_reason, terminated_by: t.terminated_by
    }));
    const ppStartDate = new Date(pp.start + 'T12:00:00');
    const ppEndDate = new Date(pp.end + 'T12:00:00');
    const newHireW4s = [];
    for (const emp of empRows) {
      if (emp.start_date) {
        const sd = new Date(emp.start_date);
        if (sd >= ppStartDate && sd <= ppEndDate) {
          const w4 = await pool.query(
            `SELECT file_data FROM documents WHERE employee_id = $1 AND doc_type = 'W-4' ORDER BY created_at DESC LIMIT 1`, [emp.id]);
          newHireW4s.push({
            id: emp.id, first_name: emp.first_name, last_name: emp.last_name,
            center: emp.center, position: emp.position, start_date: emp.start_date,
            hourly_rate: emp.hourly_rate, hasW4: w4.rows.length > 0,
            w4Data: w4.rows.length > 0 ? w4.rows[0].file_data : null
          });
        }
      }
    }
    const pdfBuffer = await generatePayrollPDF(pp, report, terminations, newHireW4s);
    await pool.query(
      `INSERT INTO payroll_report_archives (period_start, period_end, pay_date, period_label, report_data, pdf_data, generated_by, generated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (period_start, period_end) DO UPDATE SET report_data = $5, pdf_data = $6, generated_by = $7, generated_by_user_id = $8, pay_date = $3, period_label = $4, created_at = NOW()`,
      [pp.start, pp.end, pp.payDate, pp.label, JSON.stringify({ payPeriod: pp, report, terminations }), pdfBuffer, user.full_name, user.id]
    );
    const filename = `TCC-Payroll-${pp.start}-to-${pp.end}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// PAYROLL REPORT ARCHIVES
// ========================
app.get('/api/payroll-archives', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, period_start, period_end, pay_date, period_label, generated_by, notes, created_at,
       (pdf_data IS NOT NULL) as has_pdf
       FROM payroll_report_archives ORDER BY period_start DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/payroll-archives/:id', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, period_start, period_end, pay_date, period_label, report_data, generated_by, notes, created_at, (pdf_data IS NOT NULL) as has_pdf FROM payroll_report_archives WHERE id = $1',
      [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/payroll-archives/:id/pdf', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const result = await pool.query('SELECT pdf_data, period_label, period_start, period_end FROM payroll_report_archives WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (!result.rows[0].pdf_data) return res.status(404).json({ error: 'No PDF stored for this archive' });
    const row = result.rows[0];
    const filename = `TCC-Payroll-${row.period_start}-to-${row.period_end}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(row.pdf_data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payroll-archives', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { period_start, period_end, pay_date, period_label, report_data, notes } = req.body;
    const user = req.session.user;
    const result = await pool.query(
      `INSERT INTO payroll_report_archives (period_start, period_end, pay_date, period_label, report_data, generated_by, generated_by_user_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (period_start, period_end) DO UPDATE SET report_data = $5, generated_by = $6, generated_by_user_id = $7, notes = $8, pay_date = $3, period_label = $4, created_at = NOW()
       RETURNING *`,
      [period_start, period_end, pay_date, period_label, JSON.stringify(report_data), user.full_name, user.id, notes || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/payroll-archives/:id', requireRole('owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM payroll_report_archives WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================
// PAY PERIODS LIST & SMART DEFAULT
// ========================
app.get('/api/pay-periods/list', requireAuth, async (req, res) => {
  try {
    const current = getPayPeriod(new Date());
    const periods = [];
    for (let i = -12; i <= 4; i++) {
      const d = new Date(); d.setDate(d.getDate() + (i * 15));
      const pp = getPayPeriod(d);
      if (!periods.find(p => p.start === pp.start)) { pp.isCurrent = pp.start === current.start; periods.push(pp); }
    }
    periods.sort((a, b) => a.start.localeCompare(b.start));
    res.json(periods);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/pay-period/smart-default', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const currentPP = getPayPeriod(new Date());
    if (user.role === 'payroll') {
      const status = await pool.query(`SELECT * FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND payroll_closed = TRUE LIMIT 1`, [currentPP.start, currentPP.end]);
      if (status.rows.length > 0) {
        const nextDate = new Date(currentPP.end + 'T12:00:00'); nextDate.setDate(nextDate.getDate() + 1);
        res.json(getPayPeriod(nextDate));
      } else {
        const prevDate = new Date(currentPP.start + 'T12:00:00'); prevDate.setDate(prevDate.getDate() - 1);
        res.json(getPayPeriod(prevDate));
      }
    } else if (user.role === 'director') {
      const status = await pool.query(`SELECT * FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND center = $3 AND director_closed = TRUE`, [currentPP.start, currentPP.end, user.center]);
      if (status.rows.length > 0) {
        const nextDate = new Date(currentPP.end + 'T12:00:00'); nextDate.setDate(nextDate.getDate() + 1);
        res.json(getPayPeriod(nextDate));
      } else { res.json(currentPP); }
    } else { res.json(currentPP); }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── STATIC + CATCH-ALL ────────────────
app.get('/', (req, res) => {
  const hubToken = req.query.hub_token;
  if (hubToken) {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');
    const patchScript = `<script>
(function(){
  var HUB_TOKEN = ${JSON.stringify(hubToken)};
  var originalFetch = window.fetch;
  window.fetch = function(url, opts) {
    opts = opts || {};
    if (typeof url === 'string' && url.startsWith('/api/')) {
      opts.headers = opts.headers || {};
      if (opts.headers instanceof Headers) { opts.headers.set('Authorization', 'Bearer ' + HUB_TOKEN); }
      else { opts.headers['Authorization'] = 'Bearer ' + HUB_TOKEN; }
    }
    return originalFetch.call(this, url, opts);
  };
  window._hubSSO = true;
})();
</script>`;
    html = html.replace('</head>', patchScript + '</head>');
    return res.send(html);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('{*path}', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// Start
initDB().then(() => {
  app.listen(PORT, () => console.log(`TCC Payroll Hub running on port ${PORT}`));
}).catch(err => { console.error('DB init error:', err); process.exit(1); });
