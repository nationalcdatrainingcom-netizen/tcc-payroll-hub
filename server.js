const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new PgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'tcc-payroll-hub-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, secure: false }
}));

// File upload config
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
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(employee_id, work_date)
    );

    CREATE TABLE IF NOT EXISTS staffing_plan (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id),
      center VARCHAR(100) NOT NULL,
      classroom VARCHAR(200) NOT NULL,
      role_in_room VARCHAR(100),
      orientation_date DATE,
      cpr_first_aid_date DATE,
      health_safety_abc_date DATE,
      health_safety_refresher DATE,
      ccbc_consent_date DATE,
      fingerprinting_date DATE,
      date_eligible DATE,
      abuse_neglect_statement DATE,
      last_evaluation DATE,
      date_promoted_lead DATE,
      date_assigned_room DATE,
      education TEXT,
      semester_hours TEXT,
      infant_toddler_training TEXT,
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
      timecards_signed_by VARCHAR(200),
      timecards_signed_at TIMESTAMP,
      timeoff_approved BOOLEAN DEFAULT FALSE,
      timeoff_signed_by VARCHAR(200),
      timeoff_signed_at TIMESTAMP,
      director_closed BOOLEAN DEFAULT FALSE,
      director_closed_by VARCHAR(200),
      director_closed_at TIMESTAMP,
      payroll_closed BOOLEAN DEFAULT FALSE,
      payroll_closed_by VARCHAR(200),
      payroll_closed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(period_start, period_end, center)
    );

    CREATE TABLE IF NOT EXISTS payroll_signatures (
      id SERIAL PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      center VARCHAR(100),
      action_type VARCHAR(50) NOT NULL,
      signed_by_user_id INTEGER REFERENCES users(id),
      signed_by_name VARCHAR(200) NOT NULL,
      signature_text VARCHAR(500),
      statement TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Add carryover column if it doesn't exist (for existing databases)
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS pto_carryover_hours NUMERIC(6,2) DEFAULT 0`);

  // Seed default users if none exist
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

// Calculates tenure bonus days (Component 2 & 3 from policy) - these are granted, not accrued
function getTenureBonusDays(yearHired, isFullTime, isAdmin, weeklyHours) {
  const currentYear = new Date().getFullYear();
  const yearsEmployed = currentYear - yearHired;
  let additionalDays = 0;
  
  if (isFullTime && weeklyHours >= 35) {
    if (yearsEmployed >= 5 || isAdmin) {
      const effectiveYears = Math.max(yearsEmployed, 5);
      additionalDays = effectiveYears + 6; // year5=11, year6=12, etc.
    } else if (yearsEmployed >= 1) {
      additionalDays = yearsEmployed;
    }
  }
  
  const hoursPerDay = weeklyHours >= 40 ? 8 : (weeklyHours / 5);
  return { additionalDays, additionalHours: additionalDays * hoursPerDay, hoursPerDay, yearsEmployed };
}

// Static PTO info (used for employee list where we don't need DB query per employee)
function calculatePTOAllowance(yearHired, isFullTime, isAdmin, weeklyHours) {
  const tenure = getTenureBonusDays(yearHired, isFullTime, isAdmin, weeklyHours);
  return {
    baseDays: 10,
    baseHours: 80, // max accrual cap
    additionalDays: tenure.additionalDays,
    additionalHours: tenure.additionalHours,
    totalMaxDays: 10 + tenure.additionalDays,
    totalMaxHours: 80 + tenure.additionalHours,
    hoursPerDay: tenure.hoursPerDay,
    yearsEmployed: tenure.yearsEmployed,
    carryoverCap: 80
  };
}

// Full PTO calculation with actual hours from DB
async function calculateActualPTO(empId, yearHired, isFullTime, isAdmin, weeklyHours, carryoverHours) {
  const currentYear = new Date().getFullYear();
  const tenure = getTenureBonusDays(yearHired, isFullTime, isAdmin, weeklyHours);
  const hoursPerDay = tenure.hoursPerDay;
  
  // Component 1: Accrued PTO from actual hours worked this year
  const hoursResult = await pool.query(
    `SELECT COALESCE(SUM(hours_worked), 0) as total_hours FROM daily_hours 
     WHERE employee_id = $1 AND EXTRACT(YEAR FROM work_date) = $2`,
    [empId, currentYear]
  );
  const totalHoursWorked = parseFloat(hoursResult.rows[0].total_hours);
  const rawAccruedHours = totalHoursWorked / 20; // 1 hour PTO per 20 hours worked
  const accruedHours = Math.min(rawAccruedHours, 80); // Capped at 80 hours
  
  // Component 2+3: Tenure bonus (granted at start of year)
  const tenureBonusHours = tenure.additionalHours;
  
  // Carryover from previous year (capped at 80 hours)
  const carryover = Math.min(parseFloat(carryoverHours) || 0, 80);
  
  // Total available = carryover + accrued + tenure bonus
  const totalAvailableHours = carryover + accruedHours + tenureBonusHours;
  const totalAvailableDays = totalAvailableHours / hoursPerDay;
  
  // PTO used this year
  const usedResult = await pool.query(
    `SELECT COUNT(*) as days_used FROM time_off_entries 
     WHERE employee_id = $1 AND entry_type = 'P' AND EXTRACT(YEAR FROM entry_date) = $2`,
    [empId, currentYear]
  );
  const daysUsed = parseInt(usedResult.rows[0].days_used);
  const hoursUsed = daysUsed * hoursPerDay;
  
  // Remaining
  const remainingHours = Math.max(0, totalAvailableHours - hoursUsed);
  const remainingDays = remainingHours / hoursPerDay;
  
  // Unpaid days last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const unpaidResult = await pool.query(
    `SELECT COUNT(*) as count FROM time_off_entries 
     WHERE employee_id = $1 AND entry_type = 'U' AND entry_date >= $2`,
    [empId, sixMonthsAgo.toISOString().split('T')[0]]
  );
  const unpaidLast6Months = parseInt(unpaidResult.rows[0].count);
  
  return {
    // Hours worked
    totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
    
    // Accrual
    accruedHours: Math.round(accruedHours * 100) / 100,
    accruedDays: Math.round((accruedHours / hoursPerDay) * 100) / 100,
    accrualRate: '1hr per 20hrs worked',
    accrualCap: 80,
    
    // Tenure bonus
    tenureBonusDays: tenure.additionalDays,
    tenureBonusHours: Math.round(tenureBonusHours * 100) / 100,
    yearsEmployed: tenure.yearsEmployed,
    
    // Carryover
    carryoverHours: carryover,
    carryoverDays: Math.round((carryover / hoursPerDay) * 100) / 100,
    
    // Totals
    totalAvailableHours: Math.round(totalAvailableHours * 100) / 100,
    totalAvailableDays: Math.round(totalAvailableDays * 100) / 100,
    
    // Used
    daysUsed,
    hoursUsed: Math.round(hoursUsed * 100) / 100,
    
    // Remaining
    remainingHours: Math.round(remainingHours * 100) / 100,
    remainingDays: Math.round(remainingDays * 100) / 100,
    
    // Unpaid
    unpaidLast6Months,
    unpaidWarning: unpaidLast6Months > 5,
    
    // Info
    hoursPerDay,
    isFullTime,
  };
}

function getPayPeriod(date) {
  const d = date || new Date();
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  
  let start, end, payDate;
  
  if (day >= 9 && day <= 23) {
    // Current period: 9th-23rd, paid on the 1st of next month
    start = new Date(year, month, 9);
    end = new Date(year, month, 23);
    let nextMonth = month + 1;
    let payYear = year;
    if (nextMonth > 11) { nextMonth = 0; payYear++; }
    payDate = new Date(payYear, nextMonth, 1);
  } else {
    // Current period: 24th-8th, paid on the 15th
    if (day >= 24) {
      start = new Date(year, month, 24);
      let nextMonth = month + 1;
      let endYear = year;
      if (nextMonth > 11) { nextMonth = 0; endYear++; }
      end = new Date(endYear, nextMonth, 8);
      payDate = new Date(endYear, nextMonth, 15);
    } else {
      // day 1-8
      let prevMonth = month - 1;
      let startYear = year;
      if (prevMonth < 0) { prevMonth = 11; startYear--; }
      start = new Date(startYear, prevMonth, 24);
      end = new Date(year, month, 8);
      payDate = new Date(year, month, 15);
    }
  }
  
  // Adjust pay date for weekends
  const payDay = payDate.getDay();
  if (payDay === 6) payDate.setDate(payDate.getDate() - 1); // Sat -> Fri
  if (payDay === 0) payDate.setDate(payDate.getDate() + 1); // Sun -> Mon
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    payDate: payDate.toISOString().split('T')[0],
    label: `${start.toLocaleDateString('en-US', {month:'short',day:'numeric'})} - ${end.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}`
  };
}

function getMonToSunWeeks(startDate, endDate) {
  // Get all Mon-Sun weeks that overlap with the pay period
  const start = new Date(startDate);
  const end = new Date(endDate);
  const weeks = [];
  
  // Find the Monday on or before start
  let monday = new Date(start);
  const startDay = monday.getDay();
  const daysToMonday = startDay === 0 ? 6 : startDay - 1;
  monday.setDate(monday.getDate() - daysToMonday);
  
  while (monday <= end) {
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    weeks.push({
      monday: monday.toISOString().split('T')[0],
      sunday: sunday.toISOString().split('T')[0]
    });
    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

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

// Employees hidden from HR view (only visible to owner/payroll and their own director)
const HR_HIDDEN_NAMES = ['wardlaw_jay','wardlaw_mary','swem_kirsten','wardlaw_kelsey','wardlaw_jared','phillips_shari','fountain_gabrielle'];

function isHRHidden(emp) {
  const key = `${emp.last_name.toLowerCase()}_${emp.first_name.toLowerCase()}`;
  return HR_HIDDEN_NAMES.some(h => key.startsWith(h.split('_')[0]) && key.includes(h.split('_')[1]));
}

// Employees
app.get('/api/employees', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    let query = 'SELECT * FROM employees WHERE is_active = TRUE ORDER BY last_name, first_name';
    let params = [];
    
    if (user.role === 'director') {
      query = 'SELECT * FROM employees WHERE is_active = TRUE AND center = $1 ORDER BY last_name, first_name';
      params = [user.center];
    }
    
    const result = await pool.query(query, params);
    let employees = result.rows;
    
    // HR: hide admin/owner/director employees
    if (user.role === 'hr') {
      employees = employees.filter(e => !isHRHidden(e));
    }
    
    // Strip pay rate for directors
    if (!canSeePayRate(user)) {
      employees = employees.map(e => { const { hourly_rate, ...rest } = e; return rest; });
    }
    
    // Add PTO calculations
    employees = employees.map(e => ({
      ...e,
      pto: calculatePTOAllowance(e.year_hired, e.is_full_time, e.is_admin, parseFloat(e.weekly_hours) || 40)
    }));
    
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const { first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin, is_active, pto_carryover_hours } = req.body;
    const result = await pool.query(
      `UPDATE employees SET first_name=$1, last_name=$2, center=$3, classroom=$4, position=$5, year_hired=$6, start_date=$7, scheduled_times=$8, is_full_time=$9, weekly_hours=$10, hourly_rate=$11, is_admin=$12, is_active=$13, pto_carryover_hours=COALESCE($14, pto_carryover_hours)
       WHERE id=$15 RETURNING *`,
      [first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin, is_active, pto_carryover_hours, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update PTO carryover for an employee
app.post('/api/employees/:id/carryover', requireRole('owner', 'payroll', 'hr'), async (req, res) => {
  try {
    const { carryover_hours } = req.body;
    const result = await pool.query(
      `UPDATE employees SET pto_carryover_hours = $1 WHERE id = $2 RETURNING id, first_name, last_name, pto_carryover_hours`,
      [parseFloat(carryover_hours) || 0, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Employee detail with PTO used, unpaid days
app.get('/api/employees/:id/detail', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const emp = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (emp.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    let employee = emp.rows[0];
    
    if (user.role === 'director' && employee.center !== user.center) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // HR cannot view hidden admin employees
    if (user.role === 'hr' && isHRHidden(employee)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!canSeePayRate(user)) {
      delete employee.hourly_rate;
    }
    
    // Actual PTO calculation using hours worked
    employee.pto = await calculateActualPTO(
      employee.id, employee.year_hired, employee.is_full_time, 
      employee.is_admin, parseFloat(employee.weekly_hours) || 40,
      employee.pto_carryover_hours || 0
    );
    
    // Time off entries this year
    const year = new Date().getFullYear();
    const entries = await pool.query(
      `SELECT * FROM time_off_entries WHERE employee_id = $1 AND EXTRACT(YEAR FROM entry_date) = $2 ORDER BY entry_date`,
      [req.params.id, year]
    );
    employee.timeOffEntries = entries.rows;
    
    // Pay increase history
    const increases = await pool.query(
      `SELECT pir.*, u.full_name as requested_by_name FROM pay_increase_requests pir LEFT JOIN users u ON pir.requested_by = u.id WHERE pir.employee_id = $1 ORDER BY pir.created_at DESC`,
      [req.params.id]
    );
    if (canSeePayRate(user)) {
      employee.payIncreaseHistory = increases.rows;
    }
    
    // Documents
    const docs = await pool.query(
      `SELECT id, doc_type, file_name, notes, affects_pay_period, created_at FROM documents WHERE employee_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    employee.documents = docs.rows;
    
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Time off entries
app.get('/api/time-off', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const { month, year, center } = req.query;
    let query = `
      SELECT toe.*, e.first_name, e.last_name, e.center, e.classroom 
      FROM time_off_entries toe 
      JOIN employees e ON toe.employee_id = e.id 
      WHERE EXTRACT(MONTH FROM toe.entry_date) = $1 AND EXTRACT(YEAR FROM toe.entry_date) = $2
    `;
    let params = [month || new Date().getMonth() + 1, year || new Date().getFullYear()];
    
    if (user.role === 'director') {
      query += ' AND e.center = $3';
      params.push(user.center);
    } else if (center) {
      query += ' AND e.center = $3';
      params.push(center);
    }
    
    query += ' ORDER BY e.last_name, e.first_name, toe.entry_date';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/time-off', requireAuth, async (req, res) => {
  try {
    const { employee_id, entry_date, entry_type, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO time_off_entries (employee_id, entry_date, entry_type, entered_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (employee_id, entry_date) DO UPDATE SET entry_type = $3, notes = $5, entered_by = $4
       RETURNING *`,
      [employee_id, entry_date, entry_type, req.session.user.id, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/time-off/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM time_off_entries WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pay increase requests
app.get('/api/pay-increases', requireRole('owner', 'hr', 'payroll'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pir.*, e.first_name, e.last_name, e.center, u.full_name as requested_by_name,
             rv.full_name as reviewed_by_name
      FROM pay_increase_requests pir
      JOIN employees e ON pir.employee_id = e.id
      LEFT JOIN users u ON pir.requested_by = u.id
      LEFT JOIN users rv ON pir.reviewed_by = rv.id
      ORDER BY pir.status = 'pending' DESC, pir.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pay-increases', requireRole('owner', 'hr'), async (req, res) => {
  try {
    const { employee_id, reason_category, reason_detail, current_rate, proposed_rate } = req.body;
    const result = await pool.query(
      `INSERT INTO pay_increase_requests (employee_id, requested_by, reason_category, reason_detail, current_rate, proposed_rate)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [employee_id, req.session.user.id, reason_category, reason_detail, current_rate, proposed_rate]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pay-increases/:id', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { status, review_notes } = req.body;
    const result = await pool.query(
      `UPDATE pay_increase_requests SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4 RETURNING *`,
      [status, review_notes, req.session.user.id, req.params.id]
    );
    
    // If approved, update employee rate
    if (status === 'approved') {
      const req2 = result.rows[0];
      await pool.query('UPDATE employees SET hourly_rate = $1 WHERE id = $2', [req2.proposed_rate, req2.employee_id]);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Document uploads
app.post('/api/documents', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { employee_id, doc_type, notes, affects_pay_period } = req.body;
    const fileData = fs.readFileSync(req.file.path);
    const result = await pool.query(
      `INSERT INTO documents (employee_id, doc_type, file_name, file_data, notes, uploaded_by, affects_pay_period)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, doc_type, file_name, notes, affects_pay_period, created_at`,
      [employee_id, doc_type, req.file.originalname, fileData, notes, req.session.user.id, affects_pay_period]
    );
    fs.unlinkSync(req.file.path);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/download', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT file_name, file_data FROM documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Disposition', `attachment; filename="${result.rows[0].file_name}"`);
    res.send(result.rows[0].file_data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parse "X hrs Y min" to decimal hours
function parseBillableHours(str) {
  if (!str) return 0;
  const m = str.match(/(\d+)\s*hrs?\s*(\d+)\s*min/i);
  if (m) return parseInt(m[1]) + parseInt(m[2]) / 60;
  return 0;
}

// CSV Timecard import - Playground format
app.post('/api/import-timecard', requireRole('owner', 'payroll', 'director'), upload.single('file'), async (req, res) => {
  try {
    const results = [];
    
    // Read file, strip BOM if present
    let fileContent = fs.readFileSync(req.file.path, 'utf8');
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.substring(1);
    }
    fs.writeFileSync(req.file.path, fileContent, 'utf8');
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          // Also strip BOM from any key names just in case
          const clean = {};
          for (const [k, v] of Object.entries(data)) {
            clean[k.replace(/^\uFEFF/, '').trim()] = v;
          }
          results.push(clean);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    fs.unlinkSync(req.file.path);
    
    // Parse and match to employees
    let matched = 0, unmatched = 0, totalRows = 0;
    const unmatchedNames = new Set();
    const dailySummary = {}; // {empId-date: hours}
    
    for (const row of results) {
      const lastName = (row['Last Name'] || '').trim();
      const firstName = (row['First Name'] || '').trim();
      const dateStr = (row['Date'] || '').trim();
      const billable = (row['Billable'] || '').trim();
      
      if (!lastName || !dateStr) continue;
      totalRows++;
      
      const hours = parseBillableHours(billable);
      
      // Parse date M/D/YYYY
      const dateParts = dateStr.split('/');
      if (dateParts.length !== 3) continue;
      const isoDate = `${dateParts[2]}-${dateParts[0].padStart(2,'0')}-${dateParts[1].padStart(2,'0')}`;
      
      // Find matching employee (case-insensitive, partial match for hyphenated/compound names)
      const emp = await pool.query(
        `SELECT id FROM employees WHERE 
         (LOWER(last_name) = LOWER($1) OR LOWER($1) LIKE '%' || LOWER(last_name) || '%' OR LOWER(last_name) LIKE '%' || LOWER($1) || '%')
         AND (LOWER(first_name) = LOWER($2) OR LOWER(first_name) LIKE LOWER($2) || '%')
         AND is_active = TRUE LIMIT 1`,
        [lastName, firstName]
      );
      
      if (emp.rows.length > 0) {
        const empId = emp.rows[0].id;
        const key = `${empId}-${isoDate}`;
        dailySummary[key] = (dailySummary[key] || 0) + hours;
        matched++;
      } else {
        unmatched++;
        unmatchedNames.add(`${lastName}, ${firstName}`);
      }
    }
    
    // Upsert daily_hours
    let savedDays = 0;
    for (const [key, hours] of Object.entries(dailySummary)) {
      const [empId, date] = key.split('-').length > 2 
        ? [key.substring(0, key.indexOf('-')), key.substring(key.indexOf('-') + 1)]
        : key.split('-');
      
      // Fix: split on first dash only for empId, rest is date
      const firstDash = key.indexOf('-');
      const eid = key.substring(0, firstDash);
      const dt = key.substring(firstDash + 1);
      
      await pool.query(
        `INSERT INTO daily_hours (employee_id, work_date, hours_worked, source)
         VALUES ($1, $2, $3, 'import')
         ON CONFLICT (employee_id, work_date) DO UPDATE SET hours_worked = $3, source = 'import'`,
        [parseInt(eid), dt, Math.round(hours * 100) / 100]
      );
      savedDays++;
    }
    
    // Build preview data
    const preview = results.slice(0, 40).map(r => ({
      name: `${(r['Last Name']||'').trim()}, ${(r['First Name']||'').trim()}`,
      date: (r['Date']||'').trim(),
      times: (r['Times']||'').trim().replace(/\n/g, ' | '),
      breaks: (r['Breaks']||'').trim(),
      billable: (r['Billable']||'').trim(),
      hours: parseBillableHours((r['Billable']||'').trim()).toFixed(2)
    }));
    
    res.json({ 
      imported: totalRows, 
      matched, 
      unmatched, 
      unmatchedNames: [...unmatchedNames],
      savedDays,
      preview,
      payPeriod: getPayPeriod(new Date())
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily hours for OT tracking
app.get('/api/overtime/:employeeId', requireAuth, async (req, res) => {
  try {
    const payPeriod = getPayPeriod(req.query.date ? new Date(req.query.date + 'T12:00:00') : new Date());
    const weeks = getMonToSunWeeks(payPeriod.start, payPeriod.end);
    
    // Get daily hours for all overlapping weeks
    const allDates = [];
    weeks.forEach(w => {
      for (let d = new Date(w.monday); d <= new Date(w.sunday); d.setDate(d.getDate() + 1)) {
        allDates.push(d.toISOString().split('T')[0]);
      }
    });
    
    if (allDates.length === 0) return res.json({ weeks: [], payPeriod });
    
    const hours = await pool.query(
      `SELECT work_date, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date = ANY($2) ORDER BY work_date`,
      [req.params.employeeId, allDates]
    );
    
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
      return {
        ...w,
        days,
        totalHours,
        regularHours: Math.min(totalHours, 40),
        overtimeHours: Math.max(0, totalHours - 40)
      };
    });
    
    res.json({ weeks: weekDetails, payPeriod });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Staffing plan
app.get('/api/staffing-plan', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    let query = `
      SELECT sp.*, e.first_name, e.last_name, e.start_date as emp_start_date, e.scheduled_times as emp_schedule
      FROM staffing_plan sp
      LEFT JOIN employees e ON sp.employee_id = e.id
      ORDER BY sp.center, sp.classroom, 
        CASE sp.role_in_room 
          WHEN 'Co-Lead' THEN 1 WHEN 'Lead' THEN 2 WHEN 'Assistant' THEN 3 
          WHEN 'Caregiver' THEN 4 WHEN 'Floater' THEN 5 ELSE 6 END
    `;
    let params = [];
    
    if (user.role === 'director') {
      query = `
        SELECT sp.*, e.first_name, e.last_name, e.start_date as emp_start_date, e.scheduled_times as emp_schedule
        FROM staffing_plan sp
        LEFT JOIN employees e ON sp.employee_id = e.id
        WHERE sp.center = $1
        ORDER BY sp.classroom, 
          CASE sp.role_in_room 
            WHEN 'Co-Lead' THEN 1 WHEN 'Lead' THEN 2 WHEN 'Assistant' THEN 3 
            WHEN 'Caregiver' THEN 4 WHEN 'Floater' THEN 5 ELSE 6 END
      `;
      params = [user.center];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staffing-plan', requireRole('owner', 'hr', 'director'), async (req, res) => {
  try {
    const d = req.body;
    const result = await pool.query(
      `INSERT INTO staffing_plan (employee_id, center, classroom, role_in_room, orientation_date, cpr_first_aid_date, health_safety_abc_date, health_safety_refresher, ccbc_consent_date, fingerprinting_date, date_eligible, abuse_neglect_statement, last_evaluation, date_promoted_lead, date_assigned_room, education, semester_hours, infant_toddler_training)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [d.employee_id, d.center, d.classroom, d.role_in_room, d.orientation_date, d.cpr_first_aid_date, d.health_safety_abc_date, d.health_safety_refresher, d.ccbc_consent_date, d.fingerprinting_date, d.date_eligible, d.abuse_neglect_statement, d.last_evaluation, d.date_promoted_lead, d.date_assigned_room, d.education, d.semester_hours, d.infant_toddler_training]
    );
    // Sync to employee record
    if (d.employee_id) {
      await pool.query('UPDATE employees SET classroom = $1, position = $2 WHERE id = $3', [d.classroom, d.role_in_room, d.employee_id]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/staffing-plan/:id', requireRole('owner', 'hr', 'director'), async (req, res) => {
  try {
    const d = req.body;
    const result = await pool.query(
      `UPDATE staffing_plan SET employee_id=$1, center=$2, classroom=$3, role_in_room=$4, orientation_date=$5, cpr_first_aid_date=$6, health_safety_abc_date=$7, health_safety_refresher=$8, ccbc_consent_date=$9, fingerprinting_date=$10, date_eligible=$11, abuse_neglect_statement=$12, last_evaluation=$13, date_promoted_lead=$14, date_assigned_room=$15, education=$16, semester_hours=$17, infant_toddler_training=$18 WHERE id=$19 RETURNING *`,
      [d.employee_id, d.center, d.classroom, d.role_in_room, d.orientation_date, d.cpr_first_aid_date, d.health_safety_abc_date, d.health_safety_refresher, d.ccbc_consent_date, d.fingerprinting_date, d.date_eligible, d.abuse_neglect_statement, d.last_evaluation, d.date_promoted_lead, d.date_assigned_room, d.education, d.semester_hours, d.infant_toddler_training, req.params.id]
    );
    // Sync to employee record
    if (d.employee_id) {
      await pool.query('UPDATE employees SET classroom = $1, position = $2 WHERE id = $3', [d.classroom, d.role_in_room, d.employee_id]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/staffing-plan/:id', requireRole('owner', 'hr', 'director'), async (req, res) => {
  try {
    await pool.query('DELETE FROM staffing_plan WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Printable staffing plan - landscape HTML for printing
app.get('/api/staffing-plan/print/:center', requireAuth, async (req, res) => {
  try {
    const center = decodeURIComponent(req.params.center);
    const spData = await pool.query(
      `SELECT sp.*, e.first_name, e.last_name, e.start_date as emp_start_date, e.scheduled_times as emp_schedule
       FROM staffing_plan sp LEFT JOIN employees e ON sp.employee_id = e.id
       WHERE sp.center = $1
       ORDER BY sp.classroom, CASE sp.role_in_room WHEN 'Co-Lead' THEN 1 WHEN 'Lead' THEN 2 WHEN 'Assistant' THEN 3 WHEN 'Caregiver' THEN 4 WHEN 'Floater' THEN 5 ELSE 6 END`,
      [center]
    );

    // Deduplicate by employee_id
    const seen = new Set();
    const rows = spData.rows.filter(r => { if (seen.has(r.employee_id)) return false; seen.add(r.employee_id); return true; });

    // Get signature
    const sig = await pool.query("SELECT value, updated_at FROM app_settings WHERE key = 'owner_signature'");
    const sigData = sig.rows[0];

    // License info
    const licenseNum = center === 'Montessori' ? 'DC110278344' : 'DC110415511';
    const centerFull = center === 'Montessori' ? 'Montessori Children\'s Center' : `The Children's Center - ${center}`;

    function fd(d) {
      if (!d) return '';
      const s = typeof d === 'string' ? d : d.toISOString ? d.toISOString() : String(d);
      const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      return m ? parseInt(m[2])+'/'+parseInt(m[3])+'/'+m[1].slice(2) : '';
    }

    // Group by classroom
    const classrooms = {};
    rows.forEach(r => { if (!classrooms[r.classroom]) classrooms[r.classroom] = []; classrooms[r.classroom].push(r); });

    let tableRows = '';
    for (const [cls, staff] of Object.entries(classrooms)) {
      tableRows += `<tr class="section"><td colspan="19">${cls}</td></tr>`;
      staff.forEach(s => {
        tableRows += `<tr>
          <td>${s.role_in_room||''}</td>
          <td class="name">${(s.first_name||'')+' '+(s.last_name||'')}</td>
          <td>${fd(s.emp_start_date)}</td>
          <td>${s.emp_schedule||''}</td>
          <td>${fd(s.orientation_date)}</td>
          <td>${fd(s.cpr_first_aid_date)}</td>
          <td>${fd(s.health_safety_abc_date)}</td>
          <td>${fd(s.health_safety_refresher)}</td>
          <td>${fd(s.ccbc_consent_date)}</td>
          <td>${fd(s.fingerprinting_date)}</td>
          <td>${fd(s.date_eligible)}</td>
          <td>${fd(s.abuse_neglect_statement)}</td>
          <td>${fd(s.last_evaluation)}</td>
          <td>${fd(s.date_promoted_lead)}</td>
          <td>${fd(s.date_assigned_room)}</td>
          <td>${s.education||''}</td>
          <td>${s.semester_hours||''}</td>
          <td>${s.infant_toddler_training||''}</td>
        </tr>`;
      });
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Staffing Plan — ${centerFull}</title>
<style>
  @page { size: landscape; margin: 0.3in; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 7pt; color: #1B2A4A; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; padding-bottom:4px; border-bottom:2px solid #C8963E; }
  .header h1 { font-size:11pt; font-weight:700; }
  .header .sub { font-size:7pt; color:#666; }
  .header .sig { text-align:right; }
  .header .sig img { height:25px; }
  table { width:100%; border-collapse:collapse; font-size:6.5pt; }
  th { background:#1B2A4A; color:white; padding:2px 3px; text-align:left; font-weight:600; font-size:6pt; white-space:nowrap; }
  td { padding:2px 3px; border-bottom:0.5px solid #ddd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90px; }
  td.name { font-weight:600; max-width:100px; }
  tr.section td { background:#1B2A4A; color:white; font-weight:700; font-size:7pt; padding:3px 5px; }
  tr:nth-child(even):not(.section) { background:#f8f9fa; }
  .resp-row { font-size:5.5pt; color:#888; margin-bottom:2px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <div>
    <h1>Staffing Plan</h1>
    <div class="sub">${centerFull} · License #${licenseNum}</div>
    <div class="sub">All Staff and Unsupervised Volunteers · ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
  </div>
  <div class="sig">
    <div class="sub">Mary Wardlaw, Licensee</div>
    ${sigData?.value ? `<img src="${sigData.value}"><div class="sub">${new Date(sigData.updated_at).toLocaleDateString()}</div>` : ''}
  </div>
</div>
<div class="resp-row">Responsible: Program Director completes Name, Start Date, Schedule, Evaluations, Promoted, Room Assigned · Amy (Dir. Professional Development) completes Orientation, CPR, H&S, CCBC, Fingerprint, Eligible, Abuse/Neglect, Education, Hours, I/T Training</div>
<table>
<thead><tr>
  <th>Role</th><th>Name</th><th>Start</th><th>Schedule</th>
  <th>Orient.</th><th>CPR/FA</th><th>H&S ABC</th><th>H&S Ref.</th>
  <th>CCBC</th><th>Fingerpr.</th><th>Eligible</th><th>Abuse/Neg.</th>
  <th>Last Eval</th><th>Promoted</th><th>Room Asgn</th>
  <th>Education</th><th>Hrs/CEUs</th><th>I/T Training</th>
</tr></thead>
<tbody>${tableRows}</tbody>
</table>
<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #ccc;padding-top:8px">
  <div style="flex:1">
    <div style="font-size:7pt;font-weight:600;color:#666;margin-bottom:2px">Licensee Signature:</div>
    ${sigData?.value 
      ? '<img src="' + sigData.value + '" style="height:30px;margin-bottom:2px"><br><span style="font-size:6pt;color:#999">Digital signature on file</span>'
      : '<div style="border-bottom:1px solid #333;width:250px;height:25px;margin-bottom:2px"></div><span style="font-size:6pt;color:#999">Sign here</span>'}
  </div>
  <div style="text-align:center;flex:1">
    <div style="font-size:7pt;font-weight:600">Mary Wardlaw, Licensee</div>
  </div>
  <div style="text-align:right;flex:1">
    <div style="font-size:7pt;font-weight:600;color:#666;margin-bottom:2px">Date:</div>
    ${sigData?.value 
      ? '<span style="font-size:8pt">' + new Date(sigData.updated_at).toLocaleDateString() + '</span>' 
      : '<div style="border-bottom:1px solid #333;width:150px;height:20px;display:inline-block"></div>'}
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Signature storage
app.post('/api/settings/signature', requireRole('owner'), async (req, res) => {
  try {
    const { signature_data } = req.body;
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('owner_signature', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [signature_data]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/signature', requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT value, updated_at FROM app_settings WHERE key = 'owner_signature'");
    res.json(result.rows[0] || { value: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// PAYROLL PERIOD WORKFLOW
// ========================

// Get or create payroll period for a center
app.get('/api/payroll-period-status', requireAuth, async (req, res) => {
  try {
    const pp = getPayPeriod(req.query.date ? new Date(req.query.date + 'T12:00:00') : new Date());
    const user = req.session.user;
    const centers = user.role === 'director' ? [user.center] : ['Peace Boulevard', 'Niles', 'Montessori'];
    
    const results = {};
    for (const center of centers) {
      // Upsert period
      await pool.query(
        `INSERT INTO payroll_periods (period_start, period_end, pay_date, center)
         VALUES ($1, $2, $3, $4) ON CONFLICT (period_start, period_end, center) DO NOTHING`,
        [pp.start, pp.end, pp.payDate, center]
      );
      const r = await pool.query(
        'SELECT * FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND center = $3',
        [pp.start, pp.end, center]
      );
      results[center] = r.rows[0];
    }
    
    // Get signatures for this period
    const sigs = await pool.query(
      'SELECT * FROM payroll_signatures WHERE period_start = $1 AND period_end = $2 ORDER BY created_at',
      [pp.start, pp.end]
    );
    
    res.json({ payPeriod: pp, periods: results, signatures: sigs.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Director signs off on timecards
app.post('/api/payroll-workflow/sign-timecards', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center, signature_name } = req.body;
    const user = req.session.user;
    
    await pool.query(
      `UPDATE payroll_periods SET timecards_uploaded = TRUE, timecards_signed_by = $1, timecards_signed_at = NOW()
       WHERE period_start = $2 AND period_end = $3 AND center = $4`,
      [signature_name, period_start, period_end, center]
    );
    
    await pool.query(
      `INSERT INTO payroll_signatures (period_start, period_end, center, action_type, signed_by_user_id, signed_by_name, signature_text, statement)
       VALUES ($1, $2, $3, 'timecards_verified', $4, $5, $6, 'I verify that the uploaded timecards have been reviewed and are accurate.')`,
      [period_start, period_end, center, user.id, user.full_name, signature_name]
    );
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Director signs off on time-off
app.post('/api/payroll-workflow/sign-timeoff', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center, signature_name } = req.body;
    const user = req.session.user;
    
    await pool.query(
      `UPDATE payroll_periods SET timeoff_approved = TRUE, timeoff_signed_by = $1, timeoff_signed_at = NOW()
       WHERE period_start = $2 AND period_end = $3 AND center = $4`,
      [signature_name, period_start, period_end, center]
    );
    
    await pool.query(
      `INSERT INTO payroll_signatures (period_start, period_end, center, action_type, signed_by_user_id, signed_by_name, signature_text, statement)
       VALUES ($1, $2, $3, 'timeoff_verified', $4, $5, $6, 'I verify that all paid and unpaid time off entries for this pay period are accurate.')`,
      [period_start, period_end, center, user.id, user.full_name, signature_name]
    );
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Director closes out their center
app.post('/api/payroll-workflow/director-close', requireAuth, async (req, res) => {
  try {
    const { period_start, period_end, center, signature_name } = req.body;
    const user = req.session.user;
    
    await pool.query(
      `UPDATE payroll_periods SET director_closed = TRUE, director_closed_by = $1, director_closed_at = NOW(), status = 'director_submitted'
       WHERE period_start = $2 AND period_end = $3 AND center = $4`,
      [signature_name, period_start, period_end, center]
    );
    
    await pool.query(
      `INSERT INTO payroll_signatures (period_start, period_end, center, action_type, signed_by_user_id, signed_by_name, signature_text, statement)
       VALUES ($1, $2, $3, 'director_closeout', $4, $5, $6, 'I certify that all payroll information for this pay period has been reviewed, verified, and submitted for processing.')`,
      [period_start, period_end, center, user.id, user.full_name, signature_name]
    );
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Jared closes out payroll
app.post('/api/payroll-workflow/payroll-close', requireRole('owner', 'payroll'), async (req, res) => {
  try {
    const { period_start, period_end, signature_name } = req.body;
    const user = req.session.user;
    
    await pool.query(
      `UPDATE payroll_periods SET payroll_closed = TRUE, payroll_closed_by = $1, payroll_closed_at = NOW(), status = 'closed'
       WHERE period_start = $2 AND period_end = $3`,
      [signature_name, period_start, period_end]
    );
    
    for (const center of ['Peace Boulevard', 'Niles', 'Montessori']) {
      await pool.query(
        `INSERT INTO payroll_signatures (period_start, period_end, center, action_type, signed_by_user_id, signed_by_name, signature_text, statement)
         VALUES ($1, $2, $3, 'payroll_processed', $4, $5, $6, 'Payroll has been processed for this pay period.')`,
        [period_start, period_end, center, user.id, user.full_name, signature_name]
      );
    }
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// PAYROLL REPORT
// ========================
app.get('/api/payroll-report', requireRole('owner', 'payroll', 'hr'), async (req, res) => {
  try {
    const pp = getPayPeriod(req.query.date ? new Date(req.query.date + 'T12:00:00') : new Date());
    const center = req.query.center;
    
    // Get employees
    let empQuery = 'SELECT * FROM employees WHERE is_active = TRUE';
    let empParams = [];
    if (center) { empQuery += ' AND center = $1'; empParams = [center]; }
    empQuery += ' ORDER BY center, last_name, first_name';
    const empsResult = await pool.query(empQuery, empParams);
    
    // Filter out hidden employees for HR
    let empRows = empsResult.rows;
    if (req.session.user.role === 'hr') {
      empRows = empRows.filter(e => !isHRHidden(e));
    }
    
    const report = [];
    
    for (const emp of empRows) {
      // Daily hours in this pay period
      const hours = await pool.query(
        `SELECT work_date, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date >= $2 AND work_date <= $3 ORDER BY work_date`,
        [emp.id, pp.start, pp.end]
      );
      
      // Calculate OT using Sun-Sat weeks
      const weeks = getMonToSunWeeks(pp.start, pp.end);
      // Actually we need Sun-Sat weeks
      const sunSatWeeks = getSunSatWeeks(pp.start, pp.end);
      
      const allDates = new Set();
      sunSatWeeks.forEach(w => {
        for (let d = new Date(w.sunday + 'T12:00:00'); d <= new Date(w.saturday + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
          allDates.add(d.toISOString().split('T')[0]);
        }
      });
      
      // Get ALL hours for overlapping weeks (including outside pay period)
      const allHours = await pool.query(
        `SELECT work_date, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date = ANY($2)`,
        [emp.id, [...allDates]]
      );
      const hoursMap = {};
      allHours.rows.forEach(h => { hoursMap[h.work_date.toISOString().split('T')[0]] = parseFloat(h.hours_worked); });
      
      let totalRegular = 0, totalOT = 0, totalHours = 0;
      const weekDetails = [];
      
      for (const w of sunSatWeeks) {
        let weekTotal = 0;
        let weekInPeriod = 0;
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
        // Proportionally allocate OT to in-period days
        const weekReg = weekTotal - weekOT;
        
        weekDetails.push({ ...w, days, weekTotal, weekOT, weekReg, weekInPeriod });
        totalHours += weekInPeriod;
      }
      
      // Simple OT calc: sum all hours in period, then calculate based on week totals
      let periodRegular = 0, periodOT = 0;
      for (const w of weekDetails) {
        if (w.weekTotal <= 40) {
          periodRegular += w.weekInPeriod;
        } else {
          // Hours over 40 in this week are OT
          const otHours = w.weekTotal - 40;
          // Determine how many OT hours fall within the pay period
          let inPeriodAfter40 = 0;
          let runningTotal = 0;
          for (const day of w.days) {
            runningTotal += day.hours;
            if (day.inPeriod) {
              if (runningTotal > 40) {
                inPeriodAfter40 += Math.min(day.hours, runningTotal - 40);
              }
            }
          }
          periodOT += inPeriodAfter40;
          periodRegular += (w.weekInPeriod - inPeriodAfter40);
        }
      }
      
      // PTO in this period
      const pto = await pool.query(
        `SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'P' AND entry_date >= $2 AND entry_date <= $3`,
        [emp.id, pp.start, pp.end]
      );
      const ptoDays = parseInt(pto.rows[0].count);
      
      // Unpaid in this period
      const unpaid = await pool.query(
        `SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'U' AND entry_date >= $2 AND entry_date <= $3`,
        [emp.id, pp.start, pp.end]
      );
      const unpaidDays = parseInt(unpaid.rows[0].count);
      
      // Pay increases in this period
      const increases = await pool.query(
        `SELECT * FROM pay_increase_requests WHERE employee_id = $1 AND status = 'approved' AND reviewed_at >= $2 AND reviewed_at <= $3`,
        [emp.id, pp.start + 'T00:00:00', pp.end + 'T23:59:59']
      );
      
      report.push({
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        center: emp.center,
        position: emp.position,
        hourly_rate: emp.hourly_rate,
        is_full_time: emp.is_full_time,
        totalHours: Math.round(totalHours * 100) / 100,
        regularHours: Math.round(periodRegular * 100) / 100,
        overtimeHours: Math.round(periodOT * 100) / 100,
        ptoDays,
        unpaidDays,
        payIncreases: increases.rows,
        weekDetails
      });
    }
    
    res.json({ payPeriod: pp, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getSunSatWeeks(startDate, endDate) {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const weeks = [];
  
  // Find the Sunday on or before start
  let sunday = new Date(start);
  const startDay = sunday.getDay();
  sunday.setDate(sunday.getDate() - startDay);
  
  while (sunday <= end) {
    const saturday = new Date(sunday);
    saturday.setDate(saturday.getDate() + 6);
    weeks.push({
      sunday: sunday.toISOString().split('T')[0],
      saturday: saturday.toISOString().split('T')[0]
    });
    sunday = new Date(sunday);
    sunday.setDate(sunday.getDate() + 7);
  }
  
  return weeks;
}

// Get adjacent pay periods for navigation
app.get('/api/pay-periods/list', requireAuth, async (req, res) => {
  try {
    const current = getPayPeriod(new Date());
    const periods = [];
    
    // Generate 6 months back and 2 forward
    for (let i = -12; i <= 4; i++) {
      const d = new Date();
      // Approximate: shift by half-months
      d.setDate(d.getDate() + (i * 15));
      const pp = getPayPeriod(d);
      // Deduplicate
      if (!periods.find(p => p.start === pp.start)) {
        pp.isCurrent = pp.start === current.start;
        periods.push(pp);
      }
    }
    
    periods.sort((a, b) => a.start.localeCompare(b.start));
    res.json(periods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Smart default pay period based on role
app.get('/api/pay-period/smart-default', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const now = new Date();
    const currentPP = getPayPeriod(now);
    
    if (user.role === 'payroll') {
      // Jared: show the period being processed (current paycheck)
      // On Mar 24, the Mar 9-23 period is being processed for Apr 1 paycheck
      // Check if the current period is closed; if so, show next
      const status = await pool.query(
        `SELECT * FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND payroll_closed = TRUE LIMIT 1`,
        [currentPP.start, currentPP.end]
      );
      if (status.rows.length > 0) {
        // Current is closed, show next period
        const nextDate = new Date(currentPP.end + 'T12:00:00');
        nextDate.setDate(nextDate.getDate() + 1);
        res.json(getPayPeriod(nextDate));
      } else {
        // Show the period that just ended (needs processing)
        // On Mar 24 (which is in the Mar24-Apr8 period), show Mar9-23
        const prevDate = new Date(currentPP.start + 'T12:00:00');
        prevDate.setDate(prevDate.getDate() - 1);
        res.json(getPayPeriod(prevDate));
      }
    } else if (user.role === 'director') {
      // Directors: show current period unless it's submitted, then show next
      const status = await pool.query(
        `SELECT * FROM payroll_periods WHERE period_start = $1 AND period_end = $2 AND center = $3 AND director_closed = TRUE`,
        [currentPP.start, currentPP.end, user.center]
      );
      if (status.rows.length > 0) {
        const nextDate = new Date(currentPP.end + 'T12:00:00');
        nextDate.setDate(nextDate.getDate() + 1);
        res.json(getPayPeriod(nextDate));
      } else {
        res.json(currentPP);
      }
    } else {
      // Owner/HR: show current period
      res.json(currentPP);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));
app.get('{*path}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start
initDB().then(() => {
  app.listen(PORT, () => console.log(`TCC Payroll Hub running on port ${PORT}`));
}).catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});
