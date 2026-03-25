// Reconcile PTO used from QuickBooks YTD payroll report (Jan 20 - present)
// Updates time_off_entries to match actual PTO hours paid
// Run: node reconcile-pto.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// PTO hours from QuickBooks payroll Jan 20 - present
// [last, first, pto_hours]  (excludes Bonus, Regular Pay, Overtime, Salary)
const qbPTO = [
  ['Alvarado','Lorianne',8],
  ['Anderson','Tacara',16],
  ['Angelo','Joanna',16],
  ['Balcazar','Itzel',24],
  ['De Sousa Salcher','Samantha',8],
  ['Demean','Skye',8],
  ['Duckett','Teona',32],
  ['Fountain','Gabrielle',8],
  ['Glasgow','Mariah',8],
  ['Gnodtke','Trevania',8],
  ['Hill','Kyleah',24],
  ['Johnson','Shay',8],
  ['Judy','Amber',32],
  ['Milnickel','Shannon',8],
  ['Moore','Sarah',16],
  ['Oiler','Zoie',16],
  ['Prusa','Olivia',8],
  ['Reeves','Stacy',24],
  ['Rodgers','Sanyqua',16],
  ['Sandoval','Jenia',16],
  ['Swem','Kirsten',30],
  ['Wardlaw','Jared',80],
  ['Wardlaw','Kelsey',80],
  ['Whitworth','Cortney',40],
  // Skipped: Wilson Alexia (582h is clearly a totals row)
  // Skipped: Harrison Alexis (32h - not in DB, may be Alexis Layton?)
  // Skipped: Brooks-Snyder Julie (8h - not in DB)
  // Skipped: Madamageri Supriya (8h - not in DB)
];

async function run() {
  console.log('Reconciling PTO from QuickBooks (Jan 20 - present)...\n');
  
  for (const [last, first, qbHours] of qbPTO) {
    // Find employee
    let emp = await pool.query(
      `SELECT id, first_name, last_name, center, weekly_hours FROM employees
       WHERE (LOWER(last_name) = LOWER($1) OR LOWER($1) LIKE '%' || LOWER(last_name) || '%' OR LOWER(last_name) LIKE '%' || LOWER($1) || '%')
       AND (LOWER(first_name) LIKE LOWER($2) || '%' OR LOWER($2) LIKE LOWER(first_name) || '%')
       AND is_active = TRUE LIMIT 1`, [last, first]);
    
    if (emp.rows.length === 0) {
      console.log(`  ✗ NOT FOUND: ${last}, ${first} (${qbHours}h PTO)`);
      continue;
    }
    
    const e = emp.rows[0];
    const hpd = parseFloat(e.weekly_hours) >= 40 ? 8 : (parseFloat(e.weekly_hours) / 5);
    const qbDays = Math.round(qbHours / hpd);
    
    // Get current PTO entries count
    const current = await pool.query(
      `SELECT COUNT(*) as count FROM time_off_entries 
       WHERE employee_id = $1 AND entry_type = 'P' AND EXTRACT(YEAR FROM entry_date) = 2026`,
      [e.id]);
    const currentDays = parseInt(current.rows[0].count);
    const currentHours = currentDays * hpd;
    
    if (Math.abs(currentHours - qbHours) < 0.5) {
      console.log(`  ✓ ${e.last_name}, ${e.first_name}: OK (${currentDays}d = ${currentHours}h, QB=${qbHours}h)`);
    } else {
      const diff = qbHours - currentHours;
      const diffDays = qbDays - currentDays;
      console.log(`  ⚠️ ${e.last_name}, ${e.first_name} (${e.center}): App=${currentDays}d (${currentHours}h) vs QB=${qbDays}d (${qbHours}h) — diff: ${diff > 0 ? '+' : ''}${diff}h (${diffDays > 0 ? '+' : ''}${diffDays} days)`);
      
      if (diffDays > 0) {
        // Need to ADD PTO entries - add them on generic dates
        // Find dates that don't already have entries
        let added = 0;
        for (let m = 1; m <= 3 && added < diffDays; m++) {
          for (let d = 1; d <= 28 && added < diffDays; d++) {
            const dt = `2026-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dow = new Date(dt + 'T12:00:00').getDay();
            if (dow === 0 || dow === 6) continue; // skip weekends
            
            const exists = await pool.query(
              'SELECT id FROM time_off_entries WHERE employee_id = $1 AND entry_date = $2', [e.id, dt]);
            if (exists.rows.length === 0) {
              await pool.query(
                `INSERT INTO time_off_entries (employee_id, entry_date, entry_type, entered_by, notes)
                 VALUES ($1, $2, 'P', 1, 'Reconciled from QuickBooks')`, [e.id, dt]);
              added++;
            }
          }
        }
        console.log(`         Added ${added} PTO entries to match QB`);
      } else if (diffDays < 0) {
        // Need to REMOVE excess PTO entries
        const excess = await pool.query(
          `SELECT id FROM time_off_entries 
           WHERE employee_id = $1 AND entry_type = 'P' AND EXTRACT(YEAR FROM entry_date) = 2026
           ORDER BY entry_date DESC LIMIT $2`, [e.id, Math.abs(diffDays)]);
        for (const row of excess.rows) {
          await pool.query('DELETE FROM time_off_entries WHERE id = $1', [row.id]);
        }
        console.log(`         Removed ${excess.rows.length} excess PTO entries`);
      }
    }
  }
  
  // Also check employees who have PTO entries but QB shows 0
  console.log('\n--- Checking for PTO entries not in QB ---');
  const allPTO = await pool.query(
    `SELECT e.first_name, e.last_name, e.center, COUNT(*) as days
     FROM time_off_entries t JOIN employees e ON t.employee_id = e.id
     WHERE t.entry_type = 'P' AND EXTRACT(YEAR FROM t.entry_date) = 2026 AND e.is_active = TRUE
     GROUP BY e.id, e.first_name, e.last_name, e.center
     ORDER BY e.last_name`);
  
  const qbNames = new Set(qbPTO.map(q => q[0].toLowerCase() + '_' + q[1].toLowerCase().substring(0,3)));
  
  for (const row of allPTO.rows) {
    const key = row.last_name.toLowerCase() + '_' + row.first_name.toLowerCase().substring(0,3);
    const inQB = qbPTO.some(q => {
      const qk = q[0].toLowerCase();
      return (key.startsWith(qk.substring(0,4)) || qk.startsWith(row.last_name.toLowerCase().substring(0,4)));
    });
    if (!inQB && parseInt(row.days) > 0) {
      console.log(`  ⚠️ ${row.last_name}, ${row.first_name} (${row.center}): ${row.days} PTO days in app but not in QB report`);
    }
  }
  
  console.log('\n✅ Reconciliation complete');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
