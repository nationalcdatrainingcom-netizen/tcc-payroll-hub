// Fix: Merge Kara Galvin into Dakara Galvin at Montessori
// Also updates her combined YTD hours (Peace 232.67 + MCC 71.77 = 304.44)
// Run: node fix-galvin-merge.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function run() {
  // Find all Galvin records
  const galvins = await pool.query(
    `SELECT id, first_name, last_name, center, position, hourly_rate FROM employees WHERE LOWER(last_name) = 'galvin' AND is_active = TRUE`
  );
  console.log('Found Galvin records:');
  galvins.rows.forEach(g => console.log(`  ID ${g.id}: ${g.first_name} ${g.last_name} (${g.center}) - ${g.position} - $${g.hourly_rate}`));

  // The correct record is Dakara at Montessori
  // Find the Montessori one (should be the one from the seed)
  const montessori = galvins.rows.find(g => g.center === 'Montessori');
  const others = galvins.rows.filter(g => g.center !== 'Montessori');

  if (!montessori) {
    console.log('No Montessori Galvin found - checking by name...');
    const dakara = galvins.rows.find(g => g.first_name.toLowerCase().includes('dakara') || g.first_name.toLowerCase().includes('kara'));
    if (dakara) {
      console.log(`Using ${dakara.first_name} (ID ${dakara.id})`);
      // Update to Montessori
      await pool.query(`UPDATE employees SET center = 'Montessori', first_name = 'Dakara' WHERE id = $1`, [dakara.id]);
    }
  }

  const keepId = montessori?.id || galvins.rows[0]?.id;
  if (!keepId) { console.log('No Galvin found at all!'); process.exit(1); }

  // Make sure the kept record has the right name
  await pool.query(`UPDATE employees SET first_name = 'Dakara', center = 'Montessori' WHERE id = $1`, [keepId]);
  console.log(`\nKept: ID ${keepId} -> Dakara Galvin (Montessori)`);

  // Deactivate/merge others
  for (const other of others) {
    if (other.id === keepId) continue;
    // Move any time_off_entries, daily_hours, staffing_plan, documents from other to keepId
    await pool.query(`UPDATE time_off_entries SET employee_id = $1 WHERE employee_id = $2`, [keepId, other.id]);
    await pool.query(`UPDATE staffing_plan SET employee_id = $1 WHERE employee_id = $2`, [keepId, other.id]);
    await pool.query(`UPDATE documents SET employee_id = $1 WHERE employee_id = $2`, [keepId, other.id]);
    await pool.query(`UPDATE pay_increase_requests SET employee_id = $1 WHERE employee_id = $2`, [keepId, other.id]);
    
    // For daily_hours, combine if same date
    const otherHours = await pool.query(`SELECT * FROM daily_hours WHERE employee_id = $1`, [other.id]);
    for (const h of otherHours.rows) {
      const existing = await pool.query(
        `SELECT id, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date = $2`,
        [keepId, h.work_date]
      );
      if (existing.rows.length > 0) {
        // Add hours together
        const combined = parseFloat(existing.rows[0].hours_worked) + parseFloat(h.hours_worked);
        await pool.query(`UPDATE daily_hours SET hours_worked = $1 WHERE id = $2`, [combined, existing.rows[0].id]);
      } else {
        await pool.query(`UPDATE daily_hours SET employee_id = $1 WHERE id = $2`, [keepId, h.id]);
      }
    }
    
    // Deactivate the duplicate
    await pool.query(`UPDATE employees SET is_active = FALSE WHERE id = $1`, [other.id]);
    console.log(`Deactivated duplicate: ID ${other.id} (${other.first_name} at ${other.center})`);
  }

  // Update combined YTD hours (Peace 232.67 + MCC 71.77 = 304.44)
  const currentHours = await pool.query(
    `SELECT work_date, hours_worked FROM daily_hours WHERE employee_id = $1 AND work_date = '2026-01-01'`, [keepId]
  );
  if (currentHours.rows.length > 0) {
    console.log(`Current YTD hours on 2026-01-01: ${currentHours.rows[0].hours_worked}`);
  }
  
  // Set combined hours
  await pool.query(
    `INSERT INTO daily_hours (employee_id, work_date, hours_worked, source) VALUES ($1, '2026-01-01', 304.44, 'ytd_import')
     ON CONFLICT (employee_id, work_date) DO UPDATE SET hours_worked = 304.44`,
    [keepId]
  );
  console.log(`Set combined YTD hours: 304.44`);

  // Verify
  const final = await pool.query(`SELECT * FROM employees WHERE id = $1`, [keepId]);
  console.log(`\n✅ Final: ${final.rows[0].first_name} ${final.rows[0].last_name} (${final.rows[0].center}) - $${final.rows[0].hourly_rate}/hr`);
  
  const hrs = await pool.query(`SELECT SUM(hours_worked) as total FROM daily_hours WHERE employee_id = $1 AND EXTRACT(YEAR FROM work_date) = 2026`, [keepId]);
  console.log(`   YTD Hours: ${hrs.rows[0].total}`);
  console.log(`   PTO Accrued: ${Math.min(parseFloat(hrs.rows[0].total)/20, 80).toFixed(2)} hrs`);

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
