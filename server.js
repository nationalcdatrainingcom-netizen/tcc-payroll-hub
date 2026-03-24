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
  `);

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
function calculatePTOAllowance(yearHired, isFullTime, isAdmin, weeklyHours) {
  const currentYear = new Date().getFullYear();
  const yearsEmployed = currentYear - yearHired;
  
  // Base: everyone gets up to 80 hours (10 days) accrual
  let baseDays = 10;
  let additionalDays = 0;
  
  if (isFullTime && weeklyHours >= 35) {
    if (yearsEmployed >= 5 || isAdmin) {
      // Senior staff: jump to 11 additional days at year 5
      const effectiveYears = Math.max(yearsEmployed, 5);
      additionalDays = effectiveYears + 6; // year5=11, year6=12, etc.
    } else if (yearsEmployed >= 1) {
      // Years 1-4: get 1 additional day per year
      additionalDays = yearsEmployed;
    }
  }
  
  const totalDays = baseDays + additionalDays;
  const hoursPerDay = weeklyHours >= 40 ? 8 : (weeklyHours / 5);
  
  return {
    baseDays,
    additionalDays,
    totalDays,
    baseHours: 80,
    additionalHours: additionalDays * hoursPerDay,
    totalHours: 80 + (additionalDays * hoursPerDay),
    hoursPerDay,
    yearsEmployed,
    carryoverCap: 80
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
    const { first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin, is_active } = req.body;
    const result = await pool.query(
      `UPDATE employees SET first_name=$1, last_name=$2, center=$3, classroom=$4, position=$5, year_hired=$6, start_date=$7, scheduled_times=$8, is_full_time=$9, weekly_hours=$10, hourly_rate=$11, is_admin=$12, is_active=$13
       WHERE id=$14 RETURNING *`,
      [first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin, is_active, req.params.id]
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
    
    if (!canSeePayRate(user)) {
      delete employee.hourly_rate;
    }
    
    // PTO allowance
    employee.pto = calculatePTOAllowance(employee.year_hired, employee.is_full_time, employee.is_admin, parseFloat(employee.weekly_hours) || 40);
    
    // PTO used this year
    const year = new Date().getFullYear();
    const ptoUsed = await pool.query(
      `SELECT COUNT(*) as days_used FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'P' AND EXTRACT(YEAR FROM entry_date) = $2`,
      [req.params.id, year]
    );
    employee.ptoDaysUsed = parseInt(ptoUsed.rows[0].days_used);
    employee.ptoDaysRemaining = employee.pto.totalDays - employee.ptoDaysUsed;
    
    // Unpaid days in last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const unpaid = await pool.query(
      `SELECT COUNT(*) as unpaid_count, array_agg(entry_date ORDER BY entry_date) as dates FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'U' AND entry_date >= $2`,
      [req.params.id, sixMonthsAgo.toISOString().split('T')[0]]
    );
    employee.unpaidLast6Months = parseInt(unpaid.rows[0].unpaid_count);
    employee.unpaidDates = unpaid.rows[0].dates || [];
    employee.unpaidWarning = employee.unpaidLast6Months > 5;
    
    // Time off entries this year
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

// CSV Timecard import
app.post('/api/import-timecard', requireRole('owner', 'payroll'), upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const payPeriod = getPayPeriod(new Date());
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });
    
    fs.unlinkSync(req.file.path);
    res.json({ imported: results.length, data: results, payPeriod });
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
    res.json(result.rows[0]);
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

// Serve the frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start
initDB().then(() => {
  app.listen(PORT, () => console.log(`TCC Payroll Hub running on port ${PORT}`));
}).catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});
