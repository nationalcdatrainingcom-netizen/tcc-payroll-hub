// Import YTD hours (Jan 1 - Mar 8, 2026) and generate PTO report
// Run: node import-ytd-hours.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

const ytdHours = [
  ['Balcazar','Itzel',11.05,'Peace Boulevard'],['Baines','Tyeisha',34.22,'Peace Boulevard'],
  ['Bolin','Elle',307.78,'Peace Boulevard'],['Harvell','Madison',287.4,'Peace Boulevard'],
  ['Sutton','Kenadie',210.37,'Peace Boulevard'],['Jannings','Anna',61.3,'Peace Boulevard'],
  ['Hurrell','Christina',364.63,'Peace Boulevard'],['Riggs','Erin',233.15,'Peace Boulevard'],
  ['Oiler','Zoie',113.48,'Peace Boulevard'],['Demean','Skye',328.97,'Peace Boulevard'],
  ['Anstey','Hannah',315.08,'Peace Boulevard'],['Sandoval','Jenia',294.9,'Peace Boulevard'],
  ['Reyna-Adams','Noemi',300.63,'Peace Boulevard'],['Hutchins','Kristen',261.78,'Peace Boulevard'],
  ['Mikkelsen','Josie',366.08,'Peace Boulevard'],['Gutierrez','Amy',334.88,'Peace Boulevard'],
  ['Fountain','Gabrielle',369.67,'Peace Boulevard'],['Garber','Abby',308.32,'Peace Boulevard'],
  ['Anderson','Tacara',323.2,'Peace Boulevard'],['Robertson','Tamara',297.9,'Peace Boulevard'],
  ['Ondias','Grace',323.08,'Peace Boulevard'],['Milnickel','Shannon',281.87,'Peace Boulevard'],
  ['Perkins','Michelle',343.47,'Peace Boulevard'],['Norrick','Bobby',380.02,'Peace Boulevard'],
  ['Smuda','Carol',32.2,'Peace Boulevard'],['Froberg','Jenna',161.3,'Peace Boulevard'],
  ['DeLoach','Savanna',330.18,'Peace Boulevard'],['Prusa','Olivia',219.18,'Peace Boulevard'],
  ['Bareham','Laura',229.45,'Peace Boulevard'],['Moore','Makayla',165.33,'Peace Boulevard'],
  ['Galvin','Kara',232.67,'Peace Boulevard'],['de Sousa Salcher','Samantha',158.22,'Peace Boulevard'],
  ['Privett','Maria',81.52,'Peace Boulevard'],['Brant','Anne',86.25,'Peace Boulevard'],
  ['Brooks-Snyder','Julie',62.62,'Peace Boulevard'],['Rubenstein','Jessica',2.43,'Peace Boulevard'],
  ['Wardlaw','Kelsey',65.5,'Niles'],['Ritchie','Logan',70.93,'Niles'],
  ['Brooks','Marina',276.37,'Niles'],['Thompson','Jordyn',147.95,'Niles'],
  ['Judy','Amber',367.13,'Niles'],['Gibson','Marissa',345.05,'Niles'],
  ['Gibson','Carlee',71.68,'Niles'],['Leonard','Sam',153.12,'Niles'],
  ['Johnson','Chloe',337.67,'Niles'],['Barkmann','Cynthia',214.5,'Niles'],
  ['Moore','Makayla',73.17,'Niles'],['Alvarado','Lorianne',278.48,'Niles'],
  ['little','Carrie',270.67,'Niles'],['Johnson','Shay',296.0,'Niles'],
  ['Persaud','Abigayle',286.97,'Niles'],['Wardlaw','Jared',81.62,'Niles'],
  ['Whitworth','Cortney',327.65,'Niles'],['Uribe','Vicky',291.57,'Niles'],
  ['Hill','Kyleah',284.8,'Niles'],['Richards','Madisyn',303.8,'Niles'],
  ['LaPanne','Pennie',357.35,'Niles'],['Hill','Sarah',302.28,'Niles'],
  ['Swem','Kirsten',216.47,'Niles'],['Lima Will','Alexandra',296.6,'Niles'],
  ['Walters','Jenny',177.27,'Niles'],['Layton','Alexis',164.02,'Niles'],
  ['Froberg','Jenna',36.55,'Montessori'],['Wilson','Alexia',18.5,'Montessori'],
  ['Pigman','Renee',368.08,'Montessori'],['Rubenstein','Jessica',53.95,'Montessori'],
  ['Galvin','Kara',71.77,'Montessori'],['Norrick','Katheen',333.82,'Montessori'],
  ['Glasgow','Mariah',288.65,'Montessori'],['Gnodtke','Trevania',303.72,'Montessori'],
  ['Balcazar','Itzel',232.28,'Montessori'],['Fritz','Melissa',349.45,'Montessori'],
  ['Phillips','Shari',401.07,'Montessori'],['Moore','Sarah',319.05,'Montessori'],
  ['Kasper','Amanda',337.82,'Montessori'],['Williams','Kengela',339.53,'Montessori'],
  ['Gendron-Naka','Heather',325.57,'Montessori'],['Duckett','Teona',313.5,'Montessori'],
  ['Reeves','Stacy',347.28,'Montessori'],['Angelo','JoAnna',328.28,'Montessori'],
  ['Rodgers','Sanyqua',392.17,'Montessori'],['Demean','Skye',7.9,'Montessori'],
  ['Milnickel','Shannon',11.47,'Montessori'],['Bell-Bowman','Albertine',125.17,'Montessori'],
  ['Oiler','Zoie',175.2,'Montessori'],['Madamageri','Supriya',154.7,'Montessori'],
];

async function run() {
  console.log('Importing YTD hours (Jan 1 - Mar 8, 2026)...\n');
  let matched = 0, notFound = [];

  for (const [last, first, hours, center] of ytdHours) {
    let emp = await pool.query(
      `SELECT id, first_name, last_name, center FROM employees
       WHERE (LOWER(last_name) = LOWER($1) OR LOWER($1) LIKE '%' || LOWER(last_name) || '%' OR LOWER(last_name) LIKE '%' || LOWER($1) || '%')
       AND (LOWER(first_name) LIKE LOWER($2) || '%' OR LOWER($2) LIKE LOWER(first_name) || '%')
       AND center = $3 AND is_active = TRUE LIMIT 1`, [last, first, center]);
    if (emp.rows.length === 0) {
      emp = await pool.query(
        `SELECT id, first_name, last_name, center FROM employees
         WHERE (LOWER(last_name) = LOWER($1) OR LOWER($1) LIKE '%' || LOWER(last_name) || '%' OR LOWER(last_name) LIKE '%' || LOWER($1) || '%')
         AND (LOWER(first_name) LIKE LOWER($2) || '%' OR LOWER($2) LIKE LOWER(first_name) || '%')
         AND is_active = TRUE LIMIT 1`, [last, first]);
    }
    if (emp.rows.length === 0) { notFound.push(`${last}, ${first} (${center})`); continue; }

    await pool.query(
      `INSERT INTO daily_hours (employee_id, work_date, hours_worked, source)
       VALUES ($1, '2026-01-01', $2, 'ytd_import')
       ON CONFLICT (employee_id, work_date) DO UPDATE SET hours_worked = GREATEST(daily_hours.hours_worked, $2), source = 'ytd_import'`,
      [emp.rows[0].id, hours]);
    matched++;
    console.log(`  ✓ ${emp.rows[0].last_name}, ${emp.rows[0].first_name} (${emp.rows[0].center}): ${hours}h`);
  }

  console.log(`\n✅ Imported ${matched} employees`);
  if (notFound.length > 0) { console.log(`⚠️ Not found (${notFound.length}):`); notFound.forEach(n => console.log(`  - ${n}`)); }

  // PTO REPORT
  console.log('\n' + '═'.repeat(125));
  console.log('  PTO REPORT — The Children\'s Center / Montessori Children\'s Center');
  console.log('  As of March 25, 2026 | Hours: Jan 1 – Mar 8');
  console.log('═'.repeat(125));

  const emps = await pool.query(
    `SELECT e.*,
       COALESCE((SELECT SUM(dh.hours_worked) FROM daily_hours dh WHERE dh.employee_id = e.id AND EXTRACT(YEAR FROM dh.work_date) = 2026), 0) as ytd_hours,
       COALESCE((SELECT COUNT(*) FROM time_off_entries t WHERE t.employee_id = e.id AND t.entry_type = 'P' AND EXTRACT(YEAR FROM t.entry_date) = 2026), 0) as pto_used,
       COALESCE((SELECT COUNT(*) FROM time_off_entries t WHERE t.employee_id = e.id AND t.entry_type = 'U' AND EXTRACT(YEAR FROM t.entry_date) = 2026), 0) as unpaid_ytd
     FROM employees e WHERE e.is_active = TRUE ORDER BY e.center, e.last_name, e.first_name`);

  let ctr = '';
  for (const e of emps.rows) {
    if (e.center !== ctr) {
      ctr = e.center;
      console.log(`\n  ${ctr.toUpperCase()}`);
      console.log(`  ${'Name'.padEnd(28)} ${'Yrs'.padStart(3)} ${'HrsWkd'.padStart(7)} ${'Accrd'.padStart(6)} ${'Bonus'.padStart(5)} ${'BnsHrs'.padStart(6)} ${'Carry'.padStart(5)} ${'TOTAL'.padStart(7)} ${'Used'.padStart(5)} ${'UsedH'.padStart(6)} ${'REMAIN'.padStart(7)} ${'Unpd'.padStart(5)}`);
      console.log('  ' + '-'.repeat(105));
    }
    const yrs = 2026 - e.year_hired;
    const ytd = parseFloat(e.ytd_hours);
    const acc = Math.min(ytd / 20, 80);
    const wh = parseFloat(e.weekly_hours) || 40;
    const hpd = wh >= 40 ? 8 : (wh / 5);
    let bon = 0;
    if (e.is_full_time && wh >= 35) { if (yrs >= 5 || e.is_admin) bon = Math.max(yrs, 5) + 6; else if (yrs >= 1) bon = yrs; }
    const bonH = bon * hpd;
    const carry = parseFloat(e.pto_carryover_hours) || 0;
    const tot = acc + bonH + carry;
    const used = parseInt(e.pto_used);
    const usedH = used * hpd;
    const rem = tot - usedH;
    const unpd = parseInt(e.unpaid_ytd);
    const flag = rem < 0 ? '⚠️' : unpd > 5 ? '❌' : '  ';
    console.log(`  ${(e.last_name+', '+e.first_name).padEnd(28)} ${String(yrs).padStart(3)} ${ytd.toFixed(1).padStart(7)} ${acc.toFixed(1).padStart(6)} ${String(bon).padStart(5)} ${bonH.toFixed(0).padStart(6)} ${carry.toFixed(0).padStart(5)} ${tot.toFixed(1).padStart(7)} ${String(used).padStart(5)} ${usedH.toFixed(0).padStart(6)} ${rem.toFixed(1).padStart(7)} ${String(unpd).padStart(5)} ${flag}`);
  }

  console.log('\n  Accrd = HrsWkd÷20 (max 80h) | Bonus = tenure days | Carry = 2025 carryover');
  console.log('  ⚠️ negative balance | ❌ >5 unpaid days YTD\n');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
