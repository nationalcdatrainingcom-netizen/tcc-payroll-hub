// TCC Payroll Hub - Database Seed Script
// Run once after deployment: node seed.js
// Requires DATABASE_URL environment variable

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seed() {
  console.log('Starting seed...');

  // =============================================
  // EMPLOYEES - from payroll summary + Peace staffing plan
  // =============================================
  // Center assignments based on staffing plan cross-reference
  // Peace staff: from Peace tracking sheet
  // Others: will be assigned when Niles/MCC tracking sheets are uploaded
  
  const employees = [
    // === PEACE BOULEVARD STAFF ===
    // From staffing plan + payroll rates
    { first: 'Gabrielle', last: 'Fountain', center: 'Peace Boulevard', position: 'Director', year: 2023, start: '2023-01-01', schedule: '', ft: true, hrs: 40, rate: 25.68, admin: true },
    { first: 'Amy', last: 'Gutierrez', center: 'Peace Boulevard', position: 'Dir. of Professional Development', year: 2023, start: '2023-01-01', schedule: '', ft: true, hrs: 40, rate: 28.00, admin: true },
    { first: 'Jenia', last: 'Sandoval', center: 'Peace Boulevard', position: 'Co-Lead', year: 2024, start: '2024-06-04', schedule: '8A-5P', ft: true, hrs: 40, rate: 18.45, admin: false },
    { first: 'Tamara', last: 'Robertson', center: 'Peace Boulevard', position: 'Co-Lead', year: 2021, start: '2021-06-15', schedule: '7am-4pm', ft: true, hrs: 40, rate: 18.45, admin: false },
    { first: 'Madison', last: 'Harvell', center: 'Peace Boulevard', position: 'Lead', year: 2025, start: '2025-12-15', schedule: '9-6', ft: true, hrs: 40, rate: 14.53, admin: false },
    { first: 'Michelle', last: 'Perkins', center: 'Peace Boulevard', position: 'Assistant', year: 2025, start: '2025-02-03', schedule: '7:30-4:30', ft: true, hrs: 40, rate: 15.70, admin: false },
    { first: 'Noemi', last: 'Reyna-Adams', center: 'Peace Boulevard', position: 'Lead', year: 2026, start: '2026-01-12', schedule: '8am-5pm', ft: true, hrs: 40, rate: 20.88, admin: false },
    { first: 'Victoria', last: 'Monroe', center: 'Peace Boulevard', position: 'Assistant', year: 2026, start: '2026-03-23', schedule: '8:30-5:30', ft: true, hrs: 40, rate: null, admin: false },
    { first: 'Shannon', last: 'Milnickel', center: 'Peace Boulevard', position: 'Lead', year: 2023, start: '2023-07-16', schedule: '7am-3pm', ft: true, hrs: 35, rate: 17.57, admin: false },
    { first: 'Skye', last: 'Demean', center: 'Peace Boulevard', position: 'Assistant', year: 2023, start: '2023-10-19', schedule: '7:45am-4:45pm', ft: true, hrs: 40, rate: 14.25, admin: false },
    { first: 'Zoie', last: 'Oiler', center: 'Peace Boulevard', position: 'Assistant', year: 2023, start: '2023-07-16', schedule: '8:30am-5:30pm', ft: true, hrs: 40, rate: 16.13, admin: false },
    { first: 'Jenna', last: 'Froberg', center: 'Peace Boulevard', position: 'Assistant', year: 2023, start: '2023-08-07', schedule: '12-6', ft: false, hrs: 30, rate: 14.59, admin: false },
    { first: 'Tacara', last: 'Anderson', center: 'Peace Boulevard', position: 'Lead', year: 2022, start: '2022-02-02', schedule: '7am-4pm', ft: true, hrs: 40, rate: 22.21, admin: false },
    { first: 'Christina', last: 'Hurrell', center: 'Peace Boulevard', position: 'Assistant', year: 2025, start: '2025-09-25', schedule: '9-6', ft: true, hrs: 40, rate: 15.72, admin: false },
    { first: 'Josie', last: 'Mikkelsen', center: 'Peace Boulevard', position: 'Lead', year: 2025, start: '2025-07-22', schedule: '8:30-5:30', ft: true, hrs: 40, rate: 21.96, admin: false },
    { first: 'Abby', last: 'Garber', center: 'Peace Boulevard', position: 'Assistant', year: 2025, start: '2025-07-22', schedule: '8-5', ft: true, hrs: 40, rate: 16.40, admin: false },
    { first: 'Erin', last: 'Riggs', center: 'Peace Boulevard', position: 'Caregiver', year: 2025, start: '2025-11-14', schedule: '8:30-5:30', ft: true, hrs: 40, rate: 14.92, admin: false },
    { first: 'Grace', last: 'Ondrias', center: 'Peace Boulevard', position: 'Lead', year: 2024, start: '2024-09-23', schedule: '7-4', ft: true, hrs: 40, rate: 19.56, admin: false },
    { first: 'Kristen', last: 'Rose', center: 'Peace Boulevard', position: 'Assistant', year: 2024, start: '2024-05-06', schedule: '8am-5pm', ft: true, hrs: 40, rate: null, admin: false },
    { first: 'Elle', last: 'Bolin', center: 'Peace Boulevard', position: 'Lead', year: 2022, start: '2022-01-17', schedule: '9-6', ft: true, hrs: 40, rate: 20.00, admin: false },
    { first: 'Hannah', last: 'Anstey', center: 'Peace Boulevard', position: 'Assistant', year: 2025, start: '2025-11-17', schedule: '8:15-5:15', ft: true, hrs: 40, rate: 14.57, admin: false },
    { first: 'Olivia', last: 'Prusa', center: 'Peace Boulevard', position: 'Floater', year: 2023, start: '2023-05-02', schedule: 'Varies', ft: false, hrs: 25, rate: 12.60, admin: false },
    { first: 'Laura', last: 'Bareham', center: 'Peace Boulevard', position: 'Floater', year: 2023, start: '2023-02-20', schedule: 'Varies', ft: true, hrs: 40, rate: 15.32, admin: false },
    { first: 'Savanna', last: 'DeLoach', center: 'Peace Boulevard', position: 'Floater', year: 2025, start: '2025-09-23', schedule: 'Varies', ft: true, hrs: 40, rate: 19.50, admin: false },
    { first: 'Carol', last: 'Smuda', center: 'Peace Boulevard', position: 'Floater', year: 2025, start: '2025-06-12', schedule: 'Varies', ft: false, hrs: 20, rate: 20.86, admin: false },
    { first: 'Samantha', last: 'Salcher', center: 'Peace Boulevard', position: 'Floater', year: 2025, start: '2025-04-07', schedule: 'Varies', ft: true, hrs: 40, rate: null, admin: false },
    { first: 'Anna', last: 'Jannings', center: 'Peace Boulevard', position: 'Floater', year: 2026, start: '2026-02-12', schedule: 'Varies', ft: false, hrs: 30, rate: 15.33, admin: false },
    { first: 'Bobby', last: 'Norrick', center: 'Peace Boulevard', position: 'Floater', year: 2023, start: '2023-01-06', schedule: 'Varies', ft: true, hrs: 40, rate: 13.56, admin: false },
    { first: 'Kenadie', last: 'Sutton', center: 'Peace Boulevard', position: 'Floater', year: 2025, start: '2025-12-15', schedule: 'Varies', ft: false, hrs: 25, rate: 13.21, admin: false },
    { first: 'Maria', last: 'Privett', center: 'Peace Boulevard', position: 'Floater', year: 2025, start: '2025-01-01', schedule: '', ft: true, hrs: 40, rate: null, admin: false },
    { first: 'Makayla', last: 'Moore', center: 'Peace Boulevard', position: 'Floater', year: 2021, start: '2021-01-01', schedule: '', ft: false, hrs: 10, rate: 21.37, admin: false },
    { first: 'Tyeisha', last: 'Baines', center: 'Peace Boulevard', position: 'Floater', year: 2026, start: '2026-01-01', schedule: '', ft: false, hrs: 30, rate: 14.16, admin: false },
    
    // === EMPLOYEES ON PAYROLL NOT YET ASSIGNED TO A CENTER ===
    // These will be assigned when Niles/MCC tracking sheets arrive
    { first: 'Joanna', last: 'Angelo', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 19.45, admin: false },
    { first: 'Itzel', last: 'Balcazar', center: 'Peace Boulevard', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 18.45, admin: false },
    { first: 'Albertine', last: 'Bell-Bowman', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 17.50, admin: false },
    { first: 'Teona', last: 'Duckett', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 18.45, admin: false },
    { first: 'Melissa', last: 'Fritz', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 19.44, admin: false },
    { first: 'Dakara', last: 'Galvin', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 16.06, admin: false },
    { first: 'Heather', last: 'Gendron-Naka', center: 'Montessori', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 22.75, admin: false },
    { first: 'Carlee', last: 'Gibson', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 15.02, admin: false },
    { first: 'Mariah', last: 'Glasgow', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 16.77, admin: false },
    { first: 'Trevania', last: 'Gnodtke', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 18.57, admin: false },
    { first: 'Kristen', last: 'Hutchins', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 14.92, admin: false },
    { first: 'Amanda', last: 'Kasper', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 21.08, admin: false },
    { first: 'Sarah', last: 'Moore', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 16.77, admin: false },
    { first: 'Kathleen', last: 'Norrick', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 17.63, admin: false },
    { first: 'Shari', last: 'Phillips', center: 'Montessori', position: 'Director', year: 2020, start: null, schedule: '', ft: true, hrs: 40, rate: 29.35, admin: true },
    { first: 'Renee', last: 'Pigman', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 20.85, admin: false },
    { first: 'Stacy', last: 'Reeves', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 21.93, admin: false },
    { first: 'Sanyqua', last: 'Rodgers', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 18.06, admin: false },
    { first: 'Jessica', last: 'Rubenstein', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: false, hrs: 30, rate: 17.22, admin: false },
    { first: 'Kengela', last: 'Williams', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: true, hrs: 40, rate: 18.08, admin: false },
    { first: 'Alexia', last: 'Wilson', center: 'Niles', position: 'Staff', year: 2023, start: null, schedule: '', ft: false, hrs: 15, rate: 14.50, admin: false },
    
    // === SALARIED / ADMIN ===
    { first: 'Jay', last: 'Wardlaw', center: 'Peace Boulevard', position: 'Operations', year: 2020, start: null, schedule: '', ft: true, hrs: 40, rate: 25.00, admin: true },
    { first: 'Mary', last: 'Wardlaw', center: 'Peace Boulevard', position: 'Owner', year: 2020, start: null, schedule: '', ft: true, hrs: 40, rate: 50.00, admin: true },
  ];

  // Clear existing data
  await pool.query('DELETE FROM time_off_entries');
  await pool.query('DELETE FROM staffing_plan');
  await pool.query('DELETE FROM daily_hours');
  await pool.query('DELETE FROM documents');
  await pool.query('DELETE FROM pay_increase_requests');
  await pool.query('DELETE FROM timecard_imports');
  await pool.query('DELETE FROM employees');

  // Insert employees
  const empMap = {}; // lastName_firstName -> id
  for (const e of employees) {
    const result = await pool.query(
      `INSERT INTO employees (first_name, last_name, center, classroom, position, year_hired, start_date, scheduled_times, is_full_time, weekly_hours, hourly_rate, is_admin, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE) RETURNING id`,
      [e.first, e.last, e.center, null, e.position, e.year, e.start, e.schedule, e.ft, e.hrs, e.rate, e.admin]
    );
    const key = `${e.last.toLowerCase()}_${e.first.toLowerCase()}`;
    empMap[key] = result.rows[0].id;
    console.log(`  Employee: ${e.last}, ${e.first} (${e.center}) -> ID ${result.rows[0].id}`);
  }

  console.log(`\nInserted ${employees.length} employees`);

  // =============================================
  // TIME OFF ENTRIES - from Peace tracking sheets Jan-Mar 2026
  // =============================================
  const timeOffEntries = [
    // January
    { last: 'Fountain', first: 'Gabrielle', month: 1, day: 30, type: 'P' },
    { last: 'Anderson', first: 'Tacara', month: 1, day: 1, type: 'P' },
    { last: 'Anderson', first: 'Tacara', month: 1, day: 2, type: 'P' },
    { last: 'Anderson', first: 'Tacara', month: 1, day: 19, type: 'P' },
    { last: 'Anderson', first: 'Tacara', month: 1, day: 26, type: 'U' },
    { last: 'Anstey', first: 'Hannah', month: 1, day: 23, type: 'U' },
    { last: 'Anstey', first: 'Hannah', month: 1, day: 26, type: 'U' },
    { last: 'Bareham', first: 'Laura', month: 1, day: 14, type: 'U' },
    { last: 'Bareham', first: 'Laura', month: 1, day: 15, type: 'U' },
    { last: 'Bareham', first: 'Laura', month: 1, day: 16, type: 'U' },
    { last: 'Bareham', first: 'Laura', month: 1, day: 28, type: 'U' },
    { last: 'Bolin', first: 'Elle', month: 1, day: 20, type: 'U' },
    { last: 'Bolin', first: 'Elle', month: 1, day: 21, type: 'U' },
    { last: 'Bolin', first: 'Elle', month: 1, day: 27, type: 'U' },
    { last: 'DeLoach', first: 'Savanna', month: 1, day: 19, type: 'U' },
    { last: 'DeLoach', first: 'Savanna', month: 1, day: 20, type: 'U' },
    { last: 'Garber', first: 'Abby', month: 1, day: 26, type: 'U' },
    { last: 'Hurrell', first: 'Christina', month: 1, day: 23, type: 'P' },
    { last: 'Moore', first: 'Makayla', month: 1, day: 23, type: 'U' },
    { last: 'Norrick', first: 'Bobby', month: 1, day: 1, type: 'P' },
    { last: 'Norrick', first: 'Bobby', month: 1, day: 2, type: 'P' },
    { last: 'Ondrias', first: 'Grace', month: 1, day: 15, type: 'U' },
    { last: 'Ondrias', first: 'Grace', month: 1, day: 16, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 1, day: 15, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 1, day: 8, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 1, day: 9, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 1, day: 23, type: 'P' },
    { last: 'Robertson', first: 'Tamara', month: 1, day: 25, type: 'U' },
    { last: 'Rose', first: 'Kristen', month: 1, day: 15, type: 'U' },
    { last: 'Sandoval', first: 'Jenia', month: 1, day: 17, type: 'U' },
    { last: 'Sandoval', first: 'Jenia', month: 1, day: 18, type: 'U' },
    { last: 'Salcher', first: 'Samantha', month: 1, day: 7, type: 'P' },
    { last: 'Harvell', first: 'Madison', month: 1, day: 15, type: 'U' },
    { last: 'Harvell', first: 'Madison', month: 1, day: 16, type: 'U' },
    { last: 'Harvell', first: 'Madison', month: 1, day: 17, type: 'U' },
    { last: 'Mikkelsen', first: 'Josie', month: 1, day: 24, type: 'U' },
    { last: 'Reyna-Adams', first: 'Noemi', month: 1, day: 12, type: 'P' },
    
    // February
    { last: 'Anderson', first: 'Tacara', month: 2, day: 6, type: 'P' },
    { last: 'Anstey', first: 'Hannah', month: 2, day: 2, type: 'U' },
    { last: 'Anstey', first: 'Hannah', month: 2, day: 8, type: 'U' },
    { last: 'Anstey', first: 'Hannah', month: 2, day: 9, type: 'U' },
    { last: 'Anstey', first: 'Hannah', month: 2, day: 18, type: 'U' },
    { last: 'Bareham', first: 'Laura', month: 2, day: 11, type: 'U' },
    { last: 'Bareham', first: 'Laura', month: 2, day: 25, type: 'U' },
    { last: 'Bolin', first: 'Elle', month: 2, day: 16, type: 'U' },
    { last: 'Bolin', first: 'Elle', month: 2, day: 17, type: 'U' },
    { last: 'DeLoach', first: 'Savanna', month: 2, day: 6, type: 'U' },
    { last: 'Garber', first: 'Abby', month: 2, day: 3, type: 'U' },
    { last: 'Moore', first: 'Makayla', month: 2, day: 2, type: 'U' },
    { last: 'Moore', first: 'Makayla', month: 2, day: 5, type: 'U' },
    { last: 'Moore', first: 'Makayla', month: 2, day: 6, type: 'U' },
    { last: 'Ondrias', first: 'Grace', month: 2, day: 2, type: 'U' },
    { last: 'Ondrias', first: 'Grace', month: 2, day: 3, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 2, day: 2, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 2, day: 8, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 2, day: 9, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 2, day: 23, type: 'P' },
    { last: 'Robertson', first: 'Tamara', month: 2, day: 6, type: 'U' },
    { last: 'Rose', first: 'Kristen', month: 2, day: 16, type: 'U' },
    { last: 'Sandoval', first: 'Jenia', month: 2, day: 17, type: 'U' },
    { last: 'Sandoval', first: 'Jenia', month: 2, day: 18, type: 'U' },
    { last: 'Salcher', first: 'Samantha', month: 2, day: 7, type: 'P' },
    { last: 'Harvell', first: 'Madison', month: 2, day: 15, type: 'U' },
    { last: 'Harvell', first: 'Madison', month: 2, day: 16, type: 'U' },
    { last: 'Harvell', first: 'Madison', month: 2, day: 21, type: 'U' },
    { last: 'Riggs', first: 'Erin', month: 2, day: 10, type: 'U' },
    
    // March
    { last: 'Anderson', first: 'Tacara', month: 3, day: 18, type: 'U' },
    { last: 'Garber', first: 'Abby', month: 3, day: 9, type: 'U' },
    { last: 'Hurrell', first: 'Christina', month: 3, day: 9, type: 'U' },
    { last: 'Perkins', first: 'Michelle', month: 3, day: 19, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 3, day: 2, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 3, day: 3, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 3, day: 4, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 3, day: 16, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 3, day: 17, type: 'U' },
    { last: 'Prusa', first: 'Olivia', month: 3, day: 18, type: 'U' },
    { last: 'Robertson', first: 'Tamara', month: 3, day: 11, type: 'U' },
    { last: 'Rose', first: 'Kristen', month: 3, day: 12, type: 'U' },
    { last: 'Rose', first: 'Kristen', month: 3, day: 16, type: 'U' },
    { last: 'Rose', first: 'Kristen', month: 3, day: 17, type: 'U' },
    { last: 'Rose', first: 'Kristen', month: 3, day: 18, type: 'U' },
    { last: 'Rose', first: 'Kristen', month: 3, day: 23, type: 'U' },
    { last: 'Reyna-Adams', first: 'Noemi', month: 3, day: 11, type: 'U' },
    { last: 'Reyna-Adams', first: 'Noemi', month: 3, day: 12, type: 'U' },
    { last: 'Reyna-Adams', first: 'Noemi', month: 3, day: 13, type: 'U' },
    { last: 'Riggs', first: 'Erin', month: 3, day: 9, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 3, day: 15, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 3, day: 16, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 3, day: 17, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 3, day: 18, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 3, day: 19, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 3, day: 20, type: 'U' },
    { last: 'Privett', first: 'Maria', month: 3, day: 21, type: 'U' },
  ];

  // Get admin user for entered_by
  const adminUser = await pool.query("SELECT id FROM users WHERE username = 'mary'");
  const adminId = adminUser.rows[0]?.id || 1;

  let toInserted = 0;
  for (const entry of timeOffEntries) {
    const key = `${entry.last.toLowerCase()}_${entry.first.toLowerCase()}`;
    const empId = empMap[key];
    if (!empId) {
      console.log(`  WARNING: No employee found for ${entry.last}, ${entry.first}`);
      continue;
    }
    const dateStr = `2026-${String(entry.month).padStart(2,'0')}-${String(entry.day).padStart(2,'0')}`;
    await pool.query(
      `INSERT INTO time_off_entries (employee_id, entry_date, entry_type, entered_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT (employee_id, entry_date) DO UPDATE SET entry_type = $3`,
      [empId, dateStr, entry.type, adminId]
    );
    toInserted++;
  }
  console.log(`Inserted ${toInserted} time off entries`);

  // =============================================
  // STAFFING PLAN - Peace Boulevard classroom assignments
  // =============================================
  const staffingEntries = [
    { last: 'Sandoval', first: 'Jenia', classroom: 'Infants - Caterpillars', role: 'Co-Lead',
      orientation: '2024-06-01', cpr: '2024-10-17', hs_abc: '2024-06-22', hs_refresh: '2025-09-10',
      ccbc: '2024-05-30', fingerprint: '2024-05-30', eligible: '2024-05-30', abuse: '2024-06-04',
      eval: '2025-12-11', promoted: null, assigned: null, education: null, hours: null, it_training: 'Infant/Tod CDA 9/19/25' },
    { last: 'Robertson', first: 'Tamara', classroom: 'Infants - Caterpillars', role: 'Co-Lead',
      orientation: '2022-08-28', cpr: '2025-01-15', hs_abc: null, hs_refresh: '2025-08-21',
      ccbc: '2021-06-16', fingerprint: '2021-06-18', eligible: '2021-07-07', abuse: '2021-06-21',
      eval: '2026-01-27', promoted: null, assigned: null, education: null, hours: null, it_training: 'Infant/Todd CDA 7/15/24' },
    { last: 'Harvell', first: 'Madison', classroom: 'Toddlers - Kangas', role: 'Lead',
      orientation: '2025-12-15', cpr: null, hs_abc: '2025-12-15', hs_refresh: '2025-12-15',
      ccbc: '2025-12-11', fingerprint: '2025-12-11', eligible: '2025-12-11', abuse: '2025-12-15',
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: 'Working on I/T CDA' },
    { last: 'Perkins', first: 'Michelle', classroom: 'Toddlers - Kangas', role: 'Assistant',
      orientation: '2025-01-30', cpr: '2024-07-31', hs_abc: '2024-06-04', hs_refresh: '2025-01-29',
      ccbc: '2025-01-22', fingerprint: '2025-05-30', eligible: '2025-01-22', abuse: '2025-02-03',
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: null },
    { last: 'Reyna-Adams', first: 'Noemi', classroom: 'Toddlers - Lions', role: 'Lead',
      orientation: '2026-01-12', cpr: null, hs_abc: '2024-08-27', hs_refresh: '2025-09-04',
      ccbc: '2026-01-12', fingerprint: '2024-05-09', eligible: '2026-01-12', abuse: '2026-01-12',
      eval: null, promoted: null, assigned: null, education: 'BA in ECE', hours: null, it_training: null },
    { last: 'Monroe', first: 'Victoria', classroom: 'Toddlers - Lions', role: 'Assistant',
      orientation: '2026-03-23', cpr: null, hs_abc: null, hs_refresh: null,
      ccbc: null, fingerprint: null, eligible: null, abuse: null,
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: null },
    { last: 'Milnickel', first: 'Shannon', classroom: 'Montessori Infants', role: 'Lead',
      orientation: '2026-01-22', cpr: '2024-04-15', hs_abc: '2024-06-20', hs_refresh: '2025-10-10',
      ccbc: '2025-05-09', fingerprint: '2023-05-19', eligible: '2025-05-09', abuse: null,
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: '17 ECE credit hours + 963 hrs of experience' },
    { last: 'Demean', first: 'Skye', classroom: 'Montessori Infants', role: 'Assistant',
      orientation: '2026-01-22', cpr: '2024-04-15', hs_abc: '2024-11-13', hs_refresh: '2025-09-03',
      ccbc: '2025-05-09', fingerprint: '2021-10-21', eligible: '2025-05-09', abuse: null,
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: null },
    { last: 'Oiler', first: 'Zoie', classroom: 'Montessori Infants', role: 'Assistant',
      orientation: '2024-11-24', cpr: '2024-04-15', hs_abc: null, hs_refresh: '2025-09-17',
      ccbc: '2025-05-09', fingerprint: '2023-03-31', eligible: '2025-05-09', abuse: null,
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: null },
    { last: 'Froberg', first: 'Jenna', classroom: 'Montessori Infants', role: 'Assistant',
      orientation: '2023-08-08', cpr: '2025-01-15', hs_abc: '2023-08-10', hs_refresh: '2025-10-08',
      ccbc: '2024-12-09', fingerprint: '2023-07-21', eligible: '2025-05-09', abuse: null,
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: null },
    { last: 'Anderson', first: 'Tacara', classroom: 'Twos - Bears', role: 'Lead',
      orientation: '2022-02-03', cpr: '2025-01-15', hs_abc: null, hs_refresh: '2025-09-04',
      ccbc: '2022-01-27', fingerprint: '2023-08-17', eligible: '2023-08-22', abuse: '2022-02-03',
      eval: '2025-10-07', promoted: '2002-01-27', assigned: '2024-06-06', education: 'Preschool CDA', hours: null, it_training: null },
    { last: 'Hurrell', first: 'Christina', classroom: 'Twos - Bears', role: 'Assistant',
      orientation: '2025-09-25', cpr: '2025-10-22', hs_abc: '2025-02-14', hs_refresh: '2025-01-29',
      ccbc: '2025-09-23', fingerprint: '2025-11-09', eligible: '2025-09-23', abuse: '2025-09-25',
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: null },
    { last: 'Mikkelsen', first: 'Josie', classroom: 'GSRP - Penguins', role: 'Lead',
      orientation: '2025-06-19', cpr: '2024-09-14', hs_abc: '2025-06-18', hs_refresh: '2025-06-18',
      ccbc: '2025-05-20', fingerprint: '2024-06-07', eligible: '2025-05-20', abuse: '2025-07-22',
      eval: '2025-12-12', promoted: null, assigned: null, education: 'ECE BA', hours: null, it_training: null },
    { last: 'Garber', first: 'Abby', classroom: 'GSRP - Penguins', role: 'Assistant',
      orientation: '2025-07-21', cpr: '2025-10-22', hs_abc: '2025-07-22', hs_refresh: '2025-07-22',
      ccbc: '2025-07-15', fingerprint: '2025-07-16', eligible: '2025-07-18', abuse: '2025-07-22',
      eval: '2025-12-12', promoted: '2025-12-12', assigned: '2024-06-10', education: null, hours: null, it_training: null },
    { last: 'Riggs', first: 'Erin', classroom: 'GSRP - Penguins', role: 'Caregiver',
      orientation: '2025-11-18', cpr: null, hs_abc: '2025-11-17', hs_refresh: '2025-11-18',
      ccbc: '2025-11-14', fingerprint: '2025-06-05', eligible: '2025-11-14', abuse: '2025-12-10',
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: null },
    { last: 'Ondrias', first: 'Grace', classroom: 'GSRP - Dinos', role: 'Lead',
      orientation: '2024-09-23', cpr: '2024-10-17', hs_abc: '2024-09-24', hs_refresh: '2025-08-27',
      ccbc: '2024-09-20', fingerprint: '2024-10-05', eligible: '2024-10-08', abuse: '2024-10-14',
      eval: '2025-12-09', promoted: '2024-09-26', assigned: '2024-11-11', education: "Bachelor's in Early Childhood Education", hours: null, it_training: null },
    { last: 'Rose', first: 'Kristen', classroom: 'GSRP - Dinos', role: 'Assistant',
      orientation: '2024-01-29', cpr: '2024-10-17', hs_abc: '2024-05-07', hs_refresh: '2025-09-15',
      ccbc: '2024-04-17', fingerprint: '2024-04-24', eligible: '2024-05-01', abuse: '2024-05-06',
      eval: '2025-12-09', promoted: null, assigned: null, education: null, hours: null, it_training: null },
    { last: 'Bolin', first: 'Elle', classroom: 'Threes/Fours Flamingos', role: 'Lead',
      orientation: '2022-01-18', cpr: '2025-10-25', hs_abc: '2024-10-20', hs_refresh: '2025-09-11',
      ccbc: '2023-06-23', fingerprint: '2022-01-19', eligible: '2023-06-23', abuse: '2022-01-18',
      eval: '2025-12-10', promoted: null, assigned: null, education: null, hours: null, it_training: 'CDA in preschool 10/05/23' },
    { last: 'Anstey', first: 'Hannah', classroom: 'Threes/Fours Flamingos', role: 'Assistant',
      orientation: '2025-11-18', cpr: null, hs_abc: '2025-10-02', hs_refresh: '2025-10-02',
      ccbc: '2025-11-13', fingerprint: '2025-12-15', eligible: '2025-01-08', abuse: '2025-11-17',
      eval: null, promoted: null, assigned: null, education: null, hours: null, it_training: null },
  ];

  let spInserted = 0;
  for (const sp of staffingEntries) {
    const key = `${sp.last.toLowerCase()}_${sp.first.toLowerCase()}`;
    const empId = empMap[key];
    if (!empId) {
      console.log(`  WARNING: No employee for staffing entry ${sp.last}, ${sp.first}`);
      continue;
    }
    await pool.query(
      `INSERT INTO staffing_plan (employee_id, center, classroom, role_in_room, orientation_date, cpr_first_aid_date, health_safety_abc_date, health_safety_refresher, ccbc_consent_date, fingerprinting_date, date_eligible, abuse_neglect_statement, last_evaluation, date_promoted_lead, date_assigned_room, education, semester_hours, infant_toddler_training)
       VALUES ($1, 'Peace Boulevard', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [empId, sp.classroom, sp.role, sp.orientation, sp.cpr, sp.hs_abc, sp.hs_refresh, sp.ccbc, sp.fingerprint, sp.eligible, sp.abuse, sp.eval, sp.promoted, sp.assigned, sp.education, sp.hours, sp.it_training]
    );
    spInserted++;
  }
  console.log(`Inserted ${spInserted} staffing plan entries`);

  console.log('\nSeed complete!');
  process.exit(0);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
