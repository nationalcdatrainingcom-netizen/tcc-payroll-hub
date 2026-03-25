const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function run() {
  // Find both records
  const rose = await pool.query("SELECT * FROM employees WHERE LOWER(last_name) = 'rose' AND LOWER(first_name) LIKE 'kristen%' AND is_active = TRUE");
  const hutchins = await pool.query("SELECT * FROM employees WHERE LOWER(last_name) = 'hutchins' AND LOWER(first_name) LIKE 'kristen%' AND is_active = TRUE");

  console.log('Found records:');
  rose.rows.forEach(r => console.log('  Rose: ID ' + r.id + ' - ' + r.first_name + ' ' + r.last_name + ' (' + r.center + ') rate=$' + r.hourly_rate));
  hutchins.rows.forEach(r => console.log('  Hutchins: ID ' + r.id + ' - ' + r.first_name + ' ' + r.last_name + ' (' + r.center + ') rate=$' + r.hourly_rate));

  if (rose.rows.length === 0 && hutchins.rows.length === 0) {
    console.log('Neither record found!');
    process.exit(1);
  }

  // Keep whichever has more data, rename to Hutchins
  // Rose has staffing plan data, time off entries, etc from the seed
  // Hutchins may have hours data from the payroll import
  const keepId = rose.rows.length > 0 ? rose.rows[0].id : hutchins.rows[0].id;
  const otherId = rose.rows.length > 0 && hutchins.rows.length > 0 ? hutchins.rows[0].id : null;

  // Rename the kept record to Hutchins
  await pool.query("UPDATE employees SET last_name = 'Hutchins' WHERE id = $1", [keepId]);
  console.log('\nRenamed ID ' + keepId + ' to Kristen Hutchins');

  // If there's a second record, merge its data into the kept one
  if (otherId && otherId !== keepId) {
    console.log('Merging ID ' + otherId + ' into ID ' + keepId + '...');

    // Merge daily_hours - combine if same date
    const otherHours = await pool.query('SELECT * FROM daily_hours WHERE employee_id = $1', [otherId]);
    for (const h of otherHours.rows) {
      const existing = await pool.query(
        'SELECT id, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date = $2', [keepId, h.work_date]);
      if (existing.rows.length > 0) {
        const combined = parseFloat(existing.rows[0].hours_worked) + parseFloat(h.hours_worked);
        await pool.query('UPDATE daily_hours SET hours_worked = $1 WHERE id = $2', [combined, existing.rows[0].id]);
      } else {
        await pool.query('UPDATE daily_hours SET employee_id = $1 WHERE id = $2', [keepId, h.id]);
      }
    }
    console.log('  Merged ' + otherHours.rows.length + ' daily_hours records');

    // Move time_off_entries (skip conflicts)
    const toeResult = await pool.query(
      'UPDATE time_off_entries SET employee_id = $1 WHERE employee_id = $2 AND entry_date NOT IN (SELECT entry_date FROM time_off_entries WHERE employee_id = $1)',
      [keepId, otherId]);
    console.log('  Moved ' + toeResult.rowCount + ' time_off_entries');

    // Move staffing_plan
    const spResult = await pool.query('UPDATE staffing_plan SET employee_id = $1 WHERE employee_id = $2', [keepId, otherId]);
    console.log('  Moved ' + spResult.rowCount + ' staffing_plan records');

    // Move documents
    const docResult = await pool.query('UPDATE documents SET employee_id = $1 WHERE employee_id = $2', [keepId, otherId]);
    console.log('  Moved ' + docResult.rowCount + ' documents');

    // Move pay_increase_requests
    const piResult = await pool.query('UPDATE pay_increase_requests SET employee_id = $1 WHERE employee_id = $2', [keepId, otherId]);
    console.log('  Moved ' + piResult.rowCount + ' pay_increase_requests');

    // Take the better hourly_rate if the kept one is null
    const kept = await pool.query('SELECT hourly_rate FROM employees WHERE id = $1', [keepId]);
    const other = await pool.query('SELECT hourly_rate FROM employees WHERE id = $1', [otherId]);
    if (!kept.rows[0].hourly_rate && other.rows[0].hourly_rate) {
      await pool.query('UPDATE employees SET hourly_rate = $1 WHERE id = $2', [other.rows[0].hourly_rate, keepId]);
      console.log('  Copied rate $' + other.rows[0].hourly_rate + ' from Hutchins record');
    }

    // Deactivate the duplicate
    await pool.query('UPDATE employees SET is_active = FALSE WHERE id = $1', [otherId]);
    console.log('  Deactivated duplicate ID ' + otherId);
  }

  // Also add the Hutchins hours from the Playground CSV (261.78h) if not already there
  const currentHours = await pool.query(
    "SELECT SUM(hours_worked) as total FROM daily_hours WHERE employee_id = $1 AND EXTRACT(YEAR FROM work_date) = 2026", [keepId]);
  const total = parseFloat(currentHours.rows[0].total) || 0;
  console.log('\nCurrent YTD hours: ' + total);
  
  // The Peace CSV showed 261.78h under Hutchins Kristen
  // Make sure the combined total is at least that
  if (total < 261) {
    await pool.query(
      "INSERT INTO daily_hours (employee_id, work_date, hours_worked, source) VALUES ($1, '2026-01-01', 261.78, 'ytd_import') ON CONFLICT (employee_id, work_date) DO UPDATE SET hours_worked = GREATEST(daily_hours.hours_worked, 261.78)",
      [keepId]);
    console.log('Updated YTD hours to 261.78');
  }

  // Verify
  const final = await pool.query('SELECT * FROM employees WHERE id = $1', [keepId]);
  const hrs = await pool.query("SELECT SUM(hours_worked) as total FROM daily_hours WHERE employee_id = $1 AND EXTRACT(YEAR FROM work_date) = 2026", [keepId]);
  const pto = await pool.query("SELECT COUNT(*) as count FROM time_off_entries WHERE employee_id = $1 AND entry_type = 'P' AND EXTRACT(YEAR FROM entry_date) = 2026", [keepId]);
  
  console.log('\n✅ Final record:');
  console.log('  Name: ' + final.rows[0].first_name + ' ' + final.rows[0].last_name);
  console.log('  Center: ' + final.rows[0].center);
  console.log('  Rate: $' + final.rows[0].hourly_rate);
  console.log('  YTD Hours: ' + (parseFloat(hrs.rows[0].total) || 0));
  console.log('  PTO Days Used: ' + pto.rows[0].count);
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
