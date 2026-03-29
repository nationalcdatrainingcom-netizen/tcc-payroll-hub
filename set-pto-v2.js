const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const data = [
  // Montessori
  { last: 'Angelo', first: 'JoAnna', center: 'Montessori', carryover: 0, qb_used: 16 },
  { last: 'Balcazar', first: 'Itzel', center: 'Montessori', carryover: 8, qb_used: 24 },
  { last: 'Brown', first: 'Tracy', center: 'Montessori', carryover: 0, qb_used: 0 },
  { last: 'Deamean', first: 'Skye', center: 'Montessori', carryover: 0, qb_used: 8 },
  { last: 'Duckett', first: 'Teona', center: 'Montessori', carryover: 0, qb_used: 32 },
  { last: 'Fritz', first: 'Melissa', center: 'Montessori', carryover: 0, qb_used: 0 },
  { last: 'Froberg', first: 'Jenna', center: 'Montessori', carryover: 0, qb_used: 0 },
  { last: 'Gibson', first: 'Carlee', center: 'Montessori', carryover: 0, qb_used: 0 },
  { last: 'Glasgow', first: 'Mariah', center: 'Montessori', carryover: 0, qb_used: 8 },
  { last: 'Gnodtke', first: 'Trevania', center: 'Montessori', carryover: 0, qb_used: 8 },
  { last: 'Kasper', first: 'Amanda', center: 'Montessori', carryover: 0, qb_used: 0 },
  { last: 'Madamageri', first: 'Supriya', center: 'Montessori', carryover: 0, qb_used: 8 },
  { last: 'Milnickel', first: 'Shannon', center: 'Montessori', carryover: 0, qb_used: 8 },
  { last: 'Moore', first: 'Sarah', center: 'Montessori', carryover: 0, qb_used: 16 },
  { last: 'Norrick', first: 'Kathleen', center: 'Montessori', carryover: 8, qb_used: 0 },
  { last: 'Oiler', first: 'Zoie', center: 'Montessori', carryover: 0, qb_used: 16 },
  { last: 'Peterson', first: 'Lori', center: 'Montessori', carryover: 24, qb_used: 0 },
  { last: 'Phillips', first: 'Shari', center: 'Montessori', carryover: 0, qb_used: 0 },
  { last: 'Pigman', first: 'Renee', center: 'Montessori', carryover: 0, qb_used: 0 },
  { last: 'Reeves', first: 'Stacy', center: 'Montessori', carryover: 0, qb_used: 24 },
  { last: 'Rodgers', first: 'Sanyqua', center: 'Montessori', carryover: 0, qb_used: 16 },
  { last: 'Tekin', first: 'Megan', center: 'Montessori', carryover: 24, qb_used: 0 },
  { last: 'Walton', first: 'Emily', center: 'Montessori', carryover: 72, qb_used: 0 },
  { last: 'Williams', first: 'Kengela', center: 'Montessori', carryover: 0, qb_used: 0 },
  // Niles
  { last: 'Alvarado', first: 'LoriAnne', center: 'Niles', carryover: 32, qb_used: 24 },
  { last: 'Barkmann', first: 'Cynthia', center: 'Niles', carryover: 0, qb_used: 0 },
  { last: 'Gibson', first: 'Marissa', center: 'Niles', carryover: 16, qb_used: 16 },
  { last: 'Hill', first: 'Kyleah', center: 'Niles', carryover: 0, qb_used: 24 },
  { last: 'Hill', first: 'Sarah', center: 'Niles', carryover: 0, qb_used: 0 },
  { last: 'Johnson', first: 'Shay', center: 'Niles', carryover: 8, qb_used: 8 },
  { last: 'Johnson', first: 'Chloe', center: 'Niles', carryover: 80, qb_used: 0 },
  { last: 'Judy', first: 'Amber', center: 'Niles', carryover: 56, qb_used: 48 },
  { last: 'LaPanne', first: 'Pennie', center: 'Niles', carryover: 8, qb_used: 0 },
  { last: 'Layton', first: 'Alexis', center: 'Niles', carryover: 80, qb_used: 0 },
  { last: 'Lima-Will', first: 'Alexandra', center: 'Niles', carryover: 80, qb_used: 0 },
  { last: 'Little', first: 'Carrie', center: 'Niles', carryover: 80, qb_used: 0 },
  { last: 'Moore', first: 'Makayla', center: 'Niles', carryover: 0, qb_used: 0 },
  { last: 'Persaud', first: 'Abigayle', center: 'Niles', carryover: 80, qb_used: 0 },
  { last: 'Richards', first: 'Mady', center: 'Niles', carryover: 24, qb_used: 16 },
  { last: 'Swem', first: 'Kirsten', center: 'Niles', carryover: 72, qb_used: 46 },
  { last: 'Thompson', first: 'Jordyn', center: 'Niles', carryover: 0, qb_used: 0 },
  { last: 'Uribe', first: 'Vicky', center: 'Niles', carryover: 16, qb_used: 16 },
  { last: 'Walters', first: 'Jenny', center: 'Niles', carryover: 48, qb_used: 0 },
  { last: 'Wardlaw', first: 'Jared', center: 'Niles', carryover: 80, qb_used: 80 },
  { last: 'Wardlaw', first: 'Kelsey', center: 'Niles', carryover: 80, qb_used: 80 },
  { last: 'Whitworth', first: 'Cortney', center: 'Niles', carryover: 16, qb_used: 56 },
  // Peace Boulevard
  { last: 'Anderson', first: 'Tacara', center: 'Peace Boulevard', carryover: 8, qb_used: 16 },
  { last: 'Antsey', first: 'Hannah', center: 'Peace Boulevard', carryover: 80, qb_used: 0 },
  { last: 'Bareham', first: 'Laura', center: 'Peace Boulevard', carryover: 64, qb_used: 0 },
  { last: 'Bell-Bowman', first: 'Albertine', center: 'Peace Boulevard', carryover: 0, qb_used: 0 },
  { last: 'Bolin-Bash', first: 'Elle', center: 'Peace Boulevard', carryover: 56, qb_used: 0 },
  { last: 'Brant', first: 'Anne', center: 'Peace Boulevard', carryover: 80, qb_used: 0 },
  { last: 'Brooks-Snyder', first: 'Julie', center: 'Peace Boulevard', carryover: 80, qb_used: 8 },
  { last: 'DeLoach', first: 'Savanna', center: 'Peace Boulevard', carryover: 80, qb_used: 0 },
  { last: 'Fountain', first: 'Gabrielle', center: 'Peace Boulevard', carryover: 0, qb_used: 8 },
  { last: 'Galvin', first: 'Dakara', center: 'Peace Boulevard', carryover: 0, qb_used: 0 },
  { last: 'Garber', first: 'Abby', center: 'Peace Boulevard', carryover: 80, qb_used: 0 },
  { last: 'Gutierrez', first: 'Amy', center: 'Peace Boulevard', carryover: 0, qb_used: 0 },
  { last: 'Harvell', first: 'Madison', center: 'Peace Boulevard', carryover: 80, qb_used: 0 },
  { last: 'Himes', first: 'Carissa', center: 'Peace Boulevard', carryover: 80, qb_used: 0 },
  { last: 'Hurrell', first: 'Christina', center: 'Peace Boulevard', carryover: 80, qb_used: 0 },
  { last: 'Hutchins', first: 'Kristen', center: 'Peace Boulevard', carryover: 0, qb_used: 0 },
  { last: 'Moore', first: 'Makayla', center: 'Peace Boulevard', carryover: 64, qb_used: 0 },
  { last: 'Norrick', first: 'Bobby', center: 'Peace Boulevard', carryover: 0, qb_used: 0 },
  { last: 'Ondrias', first: 'Grace', center: 'Peace Boulevard', carryover: 8, qb_used: 0 },
  { last: 'Perkins', first: 'Michelle', center: 'Peace Boulevard', carryover: 0, qb_used: 0 },
  { last: 'Privett', first: 'Maria', center: 'Peace Boulevard', carryover: 48, qb_used: 0 },
  { last: 'Prussa', first: 'Olivia', center: 'Peace Boulevard', carryover: 80, qb_used: 8 },
  { last: 'Robertson', first: 'Tamara', center: 'Peace Boulevard', carryover: 64, qb_used: 0 },
  { last: 'Rose', first: 'Kristen', center: 'Peace Boulevard', carryover: 8, qb_used: 0 },
  { last: 'Sandoval', first: 'Jenia', center: 'Peace Boulevard', carryover: 56, qb_used: 16 },
  { last: 'Smuda', first: 'Carol', center: 'Peace Boulevard', carryover: 80, qb_used: 0 },
];

async function run() {
  let updated = 0, notFound = 0;
  const missed = [];
  
  for (const emp of data) {
    // Try exact match first
    let r = await pool.query(
      `UPDATE employees SET pto_carryover_hours = $1, pto_hours_used_qb = $2 
       WHERE LOWER(last_name) = LOWER($3) AND LOWER(first_name) = LOWER($4) AND is_active = TRUE
       RETURNING id, first_name, last_name`,
      [emp.carryover, emp.qb_used, emp.last, emp.first]
    );
    
    // Try starts-with match
    if (r.rowCount === 0) {
      r = await pool.query(
        `UPDATE employees SET pto_carryover_hours = $1, pto_hours_used_qb = $2 
         WHERE LOWER(last_name) = LOWER($3) AND LOWER(first_name) LIKE LOWER($4) || '%' AND is_active = TRUE
         RETURNING id, first_name, last_name`,
        [emp.carryover, emp.qb_used, emp.last, emp.first]
      );
    }
    
    // Try contains match for nicknames
    if (r.rowCount === 0 && emp.first.length >= 3) {
      r = await pool.query(
        `UPDATE employees SET pto_carryover_hours = $1, pto_hours_used_qb = $2 
         WHERE LOWER(last_name) = LOWER($3) AND (LOWER(first_name) LIKE '%' || LOWER($4) || '%' OR LOWER($4) LIKE '%' || LOWER(first_name) || '%') AND is_active = TRUE
         RETURNING id, first_name, last_name`,
        [emp.carryover, emp.qb_used, emp.last, emp.first]
      );
    }
    
    // Try hyphenated last name variations
    if (r.rowCount === 0 && emp.last.includes('-')) {
      const lastNorm = emp.last.replace(/-/g, '');
      r = await pool.query(
        `UPDATE employees SET pto_carryover_hours = $1, pto_hours_used_qb = $2 
         WHERE LOWER(REPLACE(last_name, '-', '')) = LOWER($3) AND LOWER(first_name) LIKE LOWER($4) || '%' AND is_active = TRUE
         RETURNING id, first_name, last_name`,
        [emp.carryover, emp.qb_used, lastNorm, emp.first]
      );
    }
    
    if (r.rowCount > 0) {
      updated++;
      const e = r.rows[0];
      if (emp.carryover > 0 || emp.qb_used > 0) {
        console.log(`✅ ${e.first_name} ${e.last_name}: carryover=${emp.carryover}h, used=${emp.qb_used}h`);
      }
    } else {
      notFound++;
      missed.push(`${emp.first} ${emp.last} (${emp.center})`);
    }
  }
  
  console.log(`\nUpdated: ${updated}, Not found: ${notFound}`);
  if (missed.length > 0) {
    console.log('Missed:', missed.join(', '));
  }
  
  // Verify key people
  console.log('\n=== VERIFICATION ===');
  const verify = await pool.query(
    `SELECT first_name, last_name, pto_carryover_hours, pto_hours_used_qb 
     FROM employees WHERE last_name IN ('Wardlaw','Richards','Swem','Judy','Fountain')
     ORDER BY last_name, first_name`
  );
  verify.rows.forEach(e => {
    console.log(`  ${e.first_name} ${e.last_name}: carryover=${e.pto_carryover_hours}h, qb_used=${e.pto_hours_used_qb}h`);
  });
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
