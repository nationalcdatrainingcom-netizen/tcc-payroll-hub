const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function run() {
  console.log('Syncing staffing plan assignments to employee roster...\n');

  // Get all staffing plan entries with employee info
  const sp = await pool.query(
    `SELECT DISTINCT ON (sp.employee_id) sp.employee_id, sp.classroom, sp.role_in_room, sp.center,
       e.first_name, e.last_name, e.classroom as current_classroom, e.position as current_position
     FROM staffing_plan sp
     JOIN employees e ON sp.employee_id = e.id
     WHERE e.is_active = TRUE
     ORDER BY sp.employee_id, sp.id`
  );

  let updated = 0;
  for (const row of sp.rows) {
    const needsUpdate = row.current_classroom !== row.classroom || row.current_position !== row.role_in_room;
    if (needsUpdate) {
      await pool.query(
        'UPDATE employees SET classroom = $1, position = $2 WHERE id = $3',
        [row.classroom, row.role_in_room, row.employee_id]
      );
      console.log('  ' + row.last_name + ', ' + row.first_name + ': ' + 
        (row.current_classroom || '—') + ' -> ' + row.classroom + ' | ' +
        (row.current_position || '—') + ' -> ' + row.role_in_room);
      updated++;
    }
  }

  console.log('\n✅ Updated ' + updated + ' employee records to match staffing plan');
  
  // Show any remaining unassigned
  const unassigned = await pool.query(
    `SELECT e.first_name, e.last_name, e.center, e.classroom, e.position
     FROM employees e
     WHERE e.is_active = TRUE AND (e.classroom IS NULL OR e.classroom = '')
     ORDER BY e.center, e.last_name`
  );
  
  if (unassigned.rows.length > 0) {
    console.log('\nStill unassigned (' + unassigned.rows.length + '):');
    unassigned.rows.forEach(e => console.log('  ' + e.last_name + ', ' + e.first_name + ' (' + e.center + ') - ' + (e.position || 'no position')));
  }
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
