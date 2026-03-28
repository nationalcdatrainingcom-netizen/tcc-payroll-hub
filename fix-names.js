const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function run() {
  // Fix Ondias -> Ondrias
  let r = await pool.query("UPDATE employees SET last_name = 'Ondrias' WHERE LOWER(last_name) = 'ondias'");
  console.log('Ondias -> Ondrias: ' + r.rowCount);

  // Check Sandoval
  const s = await pool.query("SELECT id, first_name, last_name FROM employees WHERE LOWER(last_name) = 'sandoval'");
  s.rows.forEach(e => console.log('Sandoval in DB: ' + e.first_name + ' ' + e.last_name + ' (ID ' + e.id + ')'));

  // Check Fountain
  const f = await pool.query("SELECT id, first_name, last_name FROM employees WHERE LOWER(last_name) = 'fountain'");
  f.rows.forEach(e => console.log('Fountain in DB: ' + e.first_name + ' ' + e.last_name + ' (ID ' + e.id + ')'));

  console.log('\nDone! Re-upload the CSV and these should match now.');
  console.log('Remaining unmatched:');
  console.log('  - "Fountain, Gabby" - DB has "Gabrielle" - need to improve matching');
  console.log('  - "Hutchings, Tracy" - Not in DB - add if needed');
  console.log('  - "Sub, Teacher" - Playground placeholder, ignore');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
