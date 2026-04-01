const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

p.query(
  `SELECT work_date, hours_worked, created_at FROM daily_hours 
   WHERE employee_id = (SELECT id FROM employees WHERE LOWER(last_name) = 'oiler' LIMIT 1) 
   AND work_date >= '2026-03-09' AND work_date <= '2026-03-23' 
   ORDER BY work_date`
).then(r => {
  let t = 0;
  console.log('Date        | Hours  | Last Written');
  console.log('------------|--------|---------------------------');
  r.rows.forEach(h => {
    const hrs = parseFloat(h.hours_worked);
    t += hrs;
    console.log(h.work_date.toISOString().split('T')[0] + ' | ' + hrs.toFixed(2).padStart(6) + ' | ' + new Date(h.created_at).toLocaleString());
  });
  console.log('------------|--------|');
  console.log('DB Total:   | ' + t.toFixed(2).padStart(6));
  console.log('CSV Total:  |  16.77');
  process.exit();
}).catch(e => { console.error(e.message); process.exit(1); });
