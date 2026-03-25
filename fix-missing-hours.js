// Fix: Import hours for employees missed due to name mismatches
// Also updates Niles rates if not already set
// Run: node fix-missing-hours.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function run() {
  // ---- Fix hours for name mismatches ----
  const fixes = [
    // [last_name_in_db, first_name_in_db, hours, center]
    // Hutchins Kristen - not in DB yet, skip (new employee to add)
    // Galvin Kara -> already merged to Dakara at Montessori (304.44h done)
    // Brant Anne - not in DB (sub?)
    // Brooks-Snyder Julie - not in DB (sub?)
    ['Wardlaw', 'Jared', 81.62, 'Niles'],           // Jared is at Peace in DB but works at Niles
    ['Richards', 'Mady', 303.80, 'Niles'],           // CSV has "Madisyn", DB has "Mady"
    ['Lima-Wills', 'Alexandra', 296.60, 'Niles'],    // CSV has "Lima Will", DB has "Lima-Wills"
    ['Norrick', 'Kathleen', 333.82, 'Montessori'],   // CSV has "Katheen" (typo), DB has "Kathleen"
    ['Albertine', 'Tina', 125.17, 'Montessori'],      // CSV has "Bell-Bowman Albertine", DB has "Tina Albertine"
    // Madamageri Supriya - not in DB (new employee to add)
    ['Rose', 'Kristen', 0, 'Peace Boulevard'],        // Rose was missed - check
  ];

  console.log('Fixing missing hours...\n');
  for (const [last, first, hours, center] of fixes) {
    if (hours <= 0) continue;
    
    const emp = await pool.query(
      `SELECT id, first_name, last_name, center FROM employees 
       WHERE LOWER(last_name) = LOWER($1) AND LOWER(first_name) LIKE LOWER($2) || '%' AND is_active = TRUE LIMIT 1`,
      [last, first]
    );
    
    if (emp.rows.length === 0) {
      console.log(`  ✗ Not found: ${last}, ${first}`);
      continue;
    }
    
    await pool.query(
      `INSERT INTO daily_hours (employee_id, work_date, hours_worked, source)
       VALUES ($1, '2026-01-01', $2, 'ytd_import')
       ON CONFLICT (employee_id, work_date) DO UPDATE SET hours_worked = GREATEST(daily_hours.hours_worked, $2)`,
      [emp.rows[0].id, hours]
    );
    console.log(`  ✓ ${emp.rows[0].last_name}, ${emp.rows[0].first_name} (${emp.rows[0].center}): ${hours}h`);
  }

  // ---- Update Niles rates if not already set ----
  console.log('\nUpdating Niles rates...');
  const nilesRates = [
    ['Alvarado','Lorianne',21.90],['Barkmann','Cynthia',13.73],['Brooks','Marina',14.92],
    ['Gibson','Marissa',14.22],['Hill','Kyleah',18.45],['Hill','Sarah',21.90],
    ['Johnson','Chloe',14.96],['Johnson','Shay',17.00],['Judy','Amber',25.35],
    ['LaPanne','Pennie',18.96],['Leonard','Samantha',15.39],['Lima-Wills','Alexandra',21.09],
    ['Little','Carrie',17.20],['Persaud','Abigayle',14.61],['Richards','Mady',18.45],
    ['Ritchie','Logan',14.16],['Swem','Kirsten',29.35],['Thompson','Jordyn',13.75],
    ['Uribe','Vicky',18.55],['Wardlaw','Jared',28.00],['Wardlaw','Kelsey',20.00],
    ['Whitworth','Cortney',19.09],['Walter','Jenny',14.92],['Brooks','Marina',14.92],
    ['Alvarado','Lorianne',21.90],
  ];
  
  let rateCount = 0;
  for (const [last, first, rate] of nilesRates) {
    const r = await pool.query(
      `UPDATE employees SET hourly_rate = $1 WHERE LOWER(last_name) = LOWER($2) AND LOWER(first_name) LIKE LOWER($3) || '%' AND hourly_rate IS NULL`,
      [rate, last, first]
    );
    if (r.rowCount > 0) { console.log(`  Rate: ${last}, ${first} -> $${rate}`); rateCount++; }
  }
  console.log(`  Updated ${rateCount} rates`);

  // ---- Verify ----
  console.log('\nEmployees still missing hours:');
  const missing = await pool.query(
    `SELECT e.first_name, e.last_name, e.center FROM employees e 
     WHERE e.is_active = TRUE 
     AND NOT EXISTS (SELECT 1 FROM daily_hours dh WHERE dh.employee_id = e.id AND EXTRACT(YEAR FROM dh.work_date) = 2026)
     ORDER BY e.center, e.last_name`
  );
  missing.rows.forEach(e => console.log(`  - ${e.last_name}, ${e.first_name} (${e.center})`));
  
  console.log('\nEmployees still missing rates:');
  const noRate = await pool.query(
    `SELECT first_name, last_name, center FROM employees WHERE hourly_rate IS NULL AND is_active = TRUE ORDER BY center, last_name`
  );
  noRate.rows.forEach(e => console.log(`  - ${e.last_name}, ${e.first_name} (${e.center})`));
  
  console.log('\n✅ Done');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
