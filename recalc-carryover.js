const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// 2025 paid days used from Mary's spreadsheets (verified data)
const paidDaysUsed2025 = {
  // Montessori
  'Angelo, JoAnna': 23, 'Balcazar, Itzel': 12, 'Brown, Tracy': 13,
  'Deamean, Skye': 14, 'Duckett, Teona': 21, 'Fritz, Melissa': 11,
  'Froberg, Jenna': 11, 'Glasgow, Mariah': 13, 'Gnodtke, Trevania': 11,
  'Kasper, Amanda': 11, 'Madamageri, Supriya': 11, 'Milnickel, Shannon': 26,
  'Moore, Sarah': 13, 'Norrick, Kathleen': 10, 'Oiler, Zoie': 12,
  'Peterson, Lori': 7, 'Phillips, Shari': 21, 'Pigman, Renee': 11,
  'Reeves, Stacy': 23, 'Rodgers, Sanyqua': 12, 'Tekin, Megan': 7,
  'Walton, Emily': 2, 'Williams, Kengela': 10,
  // Niles
  'Alvarado, LoriAnne': 6, 'Gibson, Marissa': 8, 'Hill, Kyleah': 14,
  'Hill, Sarah': 25, 'Johnson, Shay': 12, 'Johnson, Chloe': 0,
  'Judy, Amber': 30, 'LaPanne, Pennie': 11, 'Layton, Alexis': 3,
  'Lima-Will, Alexandra': 0, 'Little, Carrie': 0, 'Persaud, Abigail': 0,
  'Richards, Madisyn': 20, 'Swem, Kirsten': 22, 'Uribe, Vicky': 8,
  'Walters, Jenny': 6, 'Wardlaw, Jared': 1, 'Wardlaw, Kelsey': 0,
  'Whitworth, Cortney': 19,
  // Peace Boulevard
  'Anderson, Tacara': 12, 'Antsey, Hannah': 0, 'Bareham, Laura': 4,
  'Bolin-Bash, Elle': 6, 'Brant, Anne': 0, 'Brooks-Snyder, Julie': 0,
  'DeLoach, Savanna': 0, 'Fountain, Gabrielle': 21, 'Galvin, Dakara': 11,
  'Garber, Abby': 0, 'Gutierrez, Amy': 21, 'Harvell, Madison': 0,
  'Himes, Carissa': 0, 'Hurrell, Christina': 0, 'Moore, Makayla': 13,
  'Norrick, Bobby': 13, 'Ondrias, Grace': 9, 'Perkins, Michelle': 10,
  'Privett, Maria': 4, 'Prussa, Olivia': 0, 'Robertson, Tamara': 6,
  'Rose, Kristen': 10, 'Sandoval, Jenia': 4, 'Smuda, Carol': 0,
};

// 2026 PTO used from QB (already verified)
const qbUsed2026 = {
  'Angelo, JoAnna': 16, 'Balcazar, Itzel': 24, 'Duckett, Teona': 32,
  'Glasgow, Mariah': 8, 'Gnodtke, Trevania': 8, 'Madamageri, Supriya': 8,
  'Milnickel, Shannon': 8, 'Moore, Sarah': 16, 'Oiler, Zoie': 16,
  'Reeves, Stacy': 24, 'Rodgers, Sanyqua': 16, 'Deamean, Skye': 8,
  'Alvarado, LoriAnne': 24, 'Gibson, Marissa': 16, 'Hill, Kyleah': 24,
  'Johnson, Shay': 8, 'Judy, Amber': 48, 'Richards, Madisyn': 16,
  'Swem, Kirsten': 46, 'Uribe, Vicky': 16, 'Wardlaw, Jared': 80,
  'Wardlaw, Kelsey': 80, 'Whitworth, Cortney': 56,
  'Anderson, Tacara': 16, 'Brooks-Snyder, Julie': 8, 'Fountain, Gabrielle': 8,
  'Prussa, Olivia': 8, 'Sandoval, Jenia': 16, 'Hurrell, Christina': 8,
};

function getTenureBonusHours(yearHired, isFullTime, weeklyHours) {
  if (!isFullTime || weeklyHours < 35) return 0;
  const years = 2025 - yearHired;
  if (years <= 0) return 0;
  let days;
  if (years >= 5) days = 11 + (years - 5);
  else days = years; // 1yr=1d, 2yr=2d, 3yr=3d, 4yr=4d
  return days * 8;
}

async function run() {
  // Get all active employees
  const emps = await pool.query(
    `SELECT id, first_name, last_name, center, year_hired, is_full_time, is_admin, weekly_hours
     FROM employees WHERE is_active = TRUE ORDER BY center, last_name`
  );

  console.log('Recalculating PTO carryover using actual 2025 hours worked...\n');
  console.log(`${'Name'.padEnd(30)} ${'Center'.padEnd(16)} ${'2025hrs'.padStart(8)} ${'Accrued'.padStart(8)} ${'Tenure'.padStart(8)} ${'Total'.padStart(8)} ${'Used'.padStart(6)} ${'Remain'.padStart(8)} ${'Carry'.padStart(7)} ${'Old'.padStart(6)} ${'Change'.padStart(7)}`);
  console.log('-'.repeat(130));

  let updated = 0;
  let lastCenter = '';

  for (const emp of emps.rows) {
    const name = `${emp.last_name}, ${emp.first_name}`;
    
    // Get actual 2025 hours worked from daily_hours table
    const hrs = await pool.query(
      `SELECT COALESCE(SUM(hours_worked), 0) as total 
       FROM daily_hours WHERE employee_id = $1 AND EXTRACT(YEAR FROM work_date) = 2025`,
      [emp.id]
    );
    const hoursWorked2025 = parseFloat(hrs.rows[0].total);
    
    // Accrued PTO from actual hours: hours/20, capped at 80
    const accrued = Math.min(hoursWorked2025 / 20, 80);
    
    // Tenure bonus (only for full-time 35+ hrs, based on years as of 2025)
    const tenureHours = getTenureBonusHours(
      emp.year_hired, emp.is_full_time, parseFloat(emp.weekly_hours) || 40
    );
    
    // Admin/senior staff get extra tenure per the policy
    // The spreadsheet column F already captured this — use it for people we have data for
    const totalAvailable = accrued + tenureHours;
    
    // Paid days used in 2025 (from spreadsheet)
    // Try multiple name formats
    let paidUsed = paidDaysUsed2025[name];
    if (paidUsed === undefined) paidUsed = paidDaysUsed2025[`${emp.last_name}, ${emp.first_name.split(' ')[0]}`];
    if (paidUsed === undefined) {
      // Try partial first name match
      for (const [k, v] of Object.entries(paidDaysUsed2025)) {
        const [l, f] = k.split(', ');
        if (l.toLowerCase() === emp.last_name.toLowerCase() && 
            (emp.first_name.toLowerCase().startsWith(f.toLowerCase()) || 
             f.toLowerCase().startsWith(emp.first_name.toLowerCase()))) {
          paidUsed = v;
          break;
        }
      }
    }
    if (paidUsed === undefined) paidUsed = 0;
    
    const hoursUsed2025 = paidUsed * 8;
    const remaining = Math.max(0, totalAvailable - hoursUsed2025);
    const carryover = Math.min(remaining, 80);
    
    // Get the old carryover for comparison
    const oldCarry = parseFloat(emp.pto_carryover_hours || 0);
    // We need to query this since it's not in our result set
    const oldQ = await pool.query('SELECT pto_carryover_hours FROM employees WHERE id = $1', [emp.id]);
    const oldVal = parseFloat(oldQ.rows[0]?.pto_carryover_hours || 0);
    
    // QB used for 2026
    let qbUsed = qbUsed2026[name] || 0;
    if (!qbUsed) {
      for (const [k, v] of Object.entries(qbUsed2026)) {
        const [l, f] = k.split(', ');
        if (l.toLowerCase() === emp.last_name.toLowerCase() && 
            (emp.first_name.toLowerCase().startsWith(f.toLowerCase()) || 
             f.toLowerCase().startsWith(emp.first_name.toLowerCase()))) {
          qbUsed = v;
          break;
        }
      }
    }
    
    // Update
    await pool.query(
      'UPDATE employees SET pto_carryover_hours = $1, pto_hours_used_qb = $2 WHERE id = $3',
      [Math.round(carryover * 100) / 100, qbUsed, emp.id]
    );
    updated++;
    
    if (emp.center !== lastCenter) {
      lastCenter = emp.center;
      console.log(`\n  === ${lastCenter} ===`);
    }
    
    const changed = Math.abs(carryover - oldVal) > 0.1;
    if (carryover > 0 || oldVal > 0 || qbUsed > 0 || hoursWorked2025 > 0) {
      console.log(
        `  ${name.padEnd(28)} ${emp.center.padEnd(16)} ${hoursWorked2025.toFixed(0).padStart(8)} ${accrued.toFixed(1).padStart(8)} ${tenureHours.toFixed(0).padStart(8)} ${totalAvailable.toFixed(1).padStart(8)} ${hoursUsed2025.toString().padStart(6)} ${remaining.toFixed(1).padStart(8)} ${carryover.toFixed(0).padStart(7)} ${oldVal.toFixed(0).padStart(6)} ${changed ? '← CHANGED' : ''}`
      );
    }
  }

  console.log(`\n\nUpdated ${updated} employees.`);
  
  // Verify key people
  console.log('\n=== VERIFICATION ===');
  const verify = await pool.query(
    `SELECT first_name, last_name, pto_carryover_hours, pto_hours_used_qb 
     FROM employees WHERE last_name IN ('Wardlaw','Richards','Judy','Swem','Antsey','Anstey','Lima-Will','Little','Johnson')
     AND is_active = TRUE ORDER BY last_name, first_name`
  );
  verify.rows.forEach(e => {
    console.log(`  ${e.first_name} ${e.last_name}: carryover=${e.pto_carryover_hours}h, qb_used=${e.pto_hours_used_qb}h`);
  });
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
