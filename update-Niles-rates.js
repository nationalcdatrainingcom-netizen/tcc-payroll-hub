// Run: DATABASE_URL=your_url node update-niles-rates.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function update() {
  const rates = [
    ['Alvarado','Lorianne', 21.90],
    ['Barkmann','Cynthia', 13.73],
    ['Brooks','Marina', 14.92],
    ['Gibson','Marissa', 14.22],
    ['Hill','Kyleah', 18.45],
    ['Hill','Sarah', 21.90],
    ['Johnson','Chloe', 14.96],
    ['Johnson','Shay', 17.00],
    ['Judy','Amber', 25.35],
    ['LaPanne','Pennie', 18.96],
    ['Leonard','Samantha', 15.39],
    ['Lima-Wills','Alexandra', 21.09],
    ['Little','Carrie', 17.20],
    ['Persaud','Abigayle', 14.61],
    ['Richards','Mady', 18.45],
    ['Ritchie','Logan', 14.16],
    ['Swem','Kirsten', 29.35],
    ['Thompson','Jordyn', 13.75],
    ['Uribe','Vicky', 18.55],
    ['Wardlaw','Jared', 28.00],
    ['Wardlaw','Kelsey', 20.00],
    ['Whitworth','Cortney', 19.09],
  ];

  let updated = 0;
  for (const [last, first, rate] of rates) {
    const r = await pool.query(
      `UPDATE employees SET hourly_rate = $1 WHERE LOWER(last_name) = LOWER($2) AND LOWER(first_name) LIKE LOWER($3) || '%' AND center = 'Niles' AND hourly_rate IS NULL`,
      [rate, last, first]
    );
    if (r.rowCount > 0) {
      console.log(`  Updated: ${last}, ${first} -> $${rate}`);
      updated += r.rowCount;
    } else {
      // Try without center restriction for people like Jared who might be at Peace
      const r2 = await pool.query(
        `UPDATE employees SET hourly_rate = $1 WHERE LOWER(last_name) = LOWER($2) AND LOWER(first_name) LIKE LOWER($3) || '%' AND hourly_rate IS NULL`,
        [rate, last, first]
      );
      if (r2.rowCount > 0) {
        console.log(`  Updated (any center): ${last}, ${first} -> $${rate}`);
        updated += r2.rowCount;
      } else {
        console.log(`  Skipped (already set or not found): ${last}, ${first}`);
      }
    }
  }
  
  console.log(`\n✅ Updated ${updated} employee rates`);
  
  // Also verify - list any employees still without rates
  const missing = await pool.query(`SELECT first_name, last_name, center FROM employees WHERE hourly_rate IS NULL AND is_active = TRUE ORDER BY center, last_name`);
  if (missing.rows.length > 0) {
    console.log(`\n⚠️ Employees still missing rates:`);
    missing.rows.forEach(e => console.log(`  ${e.last_name}, ${e.first_name} (${e.center})`));
  } else {
    console.log(`\n✅ All active employees have rates set!`);
  }
  
  process.exit(0);
}
update().catch(e => { console.error(e); process.exit(1); });
