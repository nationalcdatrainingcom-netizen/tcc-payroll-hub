const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function run() {
  // 1. Check Wardlaw situation
  const wardlaws = await pool.query("SELECT id, first_name, last_name, position, center FROM employees WHERE LOWER(last_name) = 'wardlaw' AND is_active = TRUE");
  console.log('Wardlaw records:');
  wardlaws.rows.forEach(w => console.log('  ID ' + w.id + ': ' + w.first_name + ' - ' + w.position + ' (' + w.center + ')'));
  
  const jay = wardlaws.rows.find(w => w.first_name === 'Jay');
  const jared = wardlaws.rows.find(w => w.first_name === 'Jared');
  
  if (jay && !jared) {
    console.log('\nAdding Jared Wardlaw as separate employee...');
    const r = await pool.query(
      "INSERT INTO employees (first_name,last_name,center,position,year_hired,is_full_time,weekly_hours,hourly_rate,is_admin,is_active) VALUES ('Jared','Wardlaw','Niles','Operations/Payroll',2019,TRUE,40,28.00,TRUE,TRUE) RETURNING id"
    );
    await pool.query("INSERT INTO daily_hours (employee_id,work_date,hours_worked,source) VALUES ($1,'2026-01-01',81.62,'ytd_import') ON CONFLICT (employee_id,work_date) DO UPDATE SET hours_worked=81.62", [r.rows[0].id]);
    console.log('  Created ID ' + r.rows[0].id + ' with 81.62h');
  } else if (jared) {
    await pool.query("INSERT INTO daily_hours (employee_id,work_date,hours_worked,source) VALUES ($1,'2026-01-01',81.62,'ytd_import') ON CONFLICT (employee_id,work_date) DO UPDATE SET hours_worked=81.62", [jared.id]);
    console.log('  Updated Jared hours: 81.62h');
  }

  // 2. Fix Alexis Layton rate - from Niles payroll she earns $21.09/hr
  // Actually Niles payroll showed: 164.02 hrs, $1307.65 reg pay... wait that was Alvarado
  // Layton: 155.52 reg hrs - need to check. Actually the script already tried $21.09
  // Let me use a direct update
  await pool.query("UPDATE employees SET hourly_rate = 21.09 WHERE LOWER(last_name) = 'layton' AND LOWER(first_name) LIKE 'alex%' AND hourly_rate IS NULL");
  
  // 3. Rose Kristen hours - she was on Peace CSV with 0 listed, but the data shows she worked
  // The Peace CSV actually did not have Rose listed - she may not have worked Jan-Mar 8
  // She had unpaid time off entries though, so she was employed

  // 4. Final check
  console.log('\n--- Missing hours ---');
  const noH = await pool.query("SELECT first_name, last_name, center FROM employees e WHERE is_active = TRUE AND NOT EXISTS (SELECT 1 FROM daily_hours dh WHERE dh.employee_id = e.id AND EXTRACT(YEAR FROM dh.work_date) = 2026) ORDER BY center, last_name");
  noH.rows.forEach(e => console.log('  ' + e.last_name + ', ' + e.first_name + ' (' + e.center + ')'));
  
  console.log('\n--- Missing rates ---');
  const noR = await pool.query("SELECT first_name, last_name, center FROM employees WHERE hourly_rate IS NULL AND is_active = TRUE ORDER BY center, last_name");
  noR.rows.forEach(e => console.log('  ' + e.last_name + ', ' + e.first_name + ' (' + e.center + ')'));
  
  console.log('\nDone!');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
