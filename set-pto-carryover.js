const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  let updated = 0, notFound = 0;

  // Angelo, JoAnna (Montessori) — Carryover: 0h, 2026 PTO used: 16h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 16
     WHERE LOWER(last_name) = LOWER('Angelo') AND (LOWER(first_name) = LOWER('JoAnna') OR LOWER(first_name) LIKE LOWER('JoAnna') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Angelo, JoAnna: carryover=0h, used=16h'); }
  else { notFound++; console.log('  NOT FOUND: Angelo, JoAnna'); }

  // Balcazar, Itzel (Montessori) — Carryover: 8.0h, 2026 PTO used: 24h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 8.0, pto_hours_used_qb = 24
     WHERE LOWER(last_name) = LOWER('Balcazar') AND (LOWER(first_name) = LOWER('Itzel') OR LOWER(first_name) LIKE LOWER('Itzel') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Balcazar, Itzel: carryover=8.0h, used=24h'); }
  else { notFound++; console.log('  NOT FOUND: Balcazar, Itzel'); }

  // Brown, Tracy (Montessori) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Brown') AND (LOWER(first_name) = LOWER('Tracy') OR LOWER(first_name) LIKE LOWER('Tracy') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Brown, Tracy: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Brown, Tracy'); }

  // Deamean, Skye (Montessori) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Deamean') AND (LOWER(first_name) = LOWER('Skye') OR LOWER(first_name) LIKE LOWER('Skye') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Deamean, Skye: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Deamean, Skye'); }

  // Duckett, Teona (Montessori) — Carryover: 0h, 2026 PTO used: 32h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 32
     WHERE LOWER(last_name) = LOWER('Duckett') AND (LOWER(first_name) = LOWER('Teona') OR LOWER(first_name) LIKE LOWER('Teona') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Duckett, Teona: carryover=0h, used=32h'); }
  else { notFound++; console.log('  NOT FOUND: Duckett, Teona'); }

  // Fritz, Melissa (Montessori) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Fritz') AND (LOWER(first_name) = LOWER('Melissa') OR LOWER(first_name) LIKE LOWER('Melissa') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Fritz, Melissa: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Fritz, Melissa'); }

  // Froberg, Jenna (Montessori) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Froberg') AND (LOWER(first_name) = LOWER('Jenna') OR LOWER(first_name) LIKE LOWER('Jenna') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Froberg, Jenna: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Froberg, Jenna'); }

  // Glasgow, Mariah (Montessori) — Carryover: 0h, 2026 PTO used: 8h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 8
     WHERE LOWER(last_name) = LOWER('Glasgow') AND (LOWER(first_name) = LOWER('Mariah') OR LOWER(first_name) LIKE LOWER('Mariah') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Glasgow, Mariah: carryover=0h, used=8h'); }
  else { notFound++; console.log('  NOT FOUND: Glasgow, Mariah'); }

  // Gnodtke, Trevania (Montessori) — Carryover: 0h, 2026 PTO used: 8h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 8
     WHERE LOWER(last_name) = LOWER('Gnodtke') AND (LOWER(first_name) = LOWER('Trevania') OR LOWER(first_name) LIKE LOWER('Trevania') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Gnodtke, Trevania: carryover=0h, used=8h'); }
  else { notFound++; console.log('  NOT FOUND: Gnodtke, Trevania'); }

  // Kasper, Amanda (Montessori) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Kasper') AND (LOWER(first_name) = LOWER('Amanda') OR LOWER(first_name) LIKE LOWER('Amanda') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Kasper, Amanda: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Kasper, Amanda'); }

  // Madamageri, Supriya (Montessori) — Carryover: 0h, 2026 PTO used: 8h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 8
     WHERE LOWER(last_name) = LOWER('Madamageri') AND (LOWER(first_name) = LOWER('Supriya') OR LOWER(first_name) LIKE LOWER('Supriya') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Madamageri, Supriya: carryover=0h, used=8h'); }
  else { notFound++; console.log('  NOT FOUND: Madamageri, Supriya'); }

  // Milnickel, Shannon (Montessori) — Carryover: 0h, 2026 PTO used: 8h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 8
     WHERE LOWER(last_name) = LOWER('Milnickel') AND (LOWER(first_name) = LOWER('Shannon') OR LOWER(first_name) LIKE LOWER('Shannon') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Milnickel, Shannon: carryover=0h, used=8h'); }
  else { notFound++; console.log('  NOT FOUND: Milnickel, Shannon'); }

  // Moore, Sarah (Montessori) — Carryover: 0h, 2026 PTO used: 16h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 16
     WHERE LOWER(last_name) = LOWER('Moore') AND (LOWER(first_name) = LOWER('Sarah') OR LOWER(first_name) LIKE LOWER('Sarah') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Moore, Sarah: carryover=0h, used=16h'); }
  else { notFound++; console.log('  NOT FOUND: Moore, Sarah'); }

  // Norrick, Kathleen (Montessori) — Carryover: 8.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 8.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Norrick') AND (LOWER(first_name) = LOWER('Kathleen') OR LOWER(first_name) LIKE LOWER('Kathleen') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Norrick, Kathleen: carryover=8.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Norrick, Kathleen'); }

  // Oiler, Zoie (Montessori) — Carryover: 0h, 2026 PTO used: 16h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 16
     WHERE LOWER(last_name) = LOWER('Oiler') AND (LOWER(first_name) = LOWER('Zoie') OR LOWER(first_name) LIKE LOWER('Zoie') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Oiler, Zoie: carryover=0h, used=16h'); }
  else { notFound++; console.log('  NOT FOUND: Oiler, Zoie'); }

  // Peterson, Lori (Montessori) — Carryover: 24.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 24.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Peterson') AND (LOWER(first_name) = LOWER('Lori') OR LOWER(first_name) LIKE LOWER('Lori') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Peterson, Lori: carryover=24.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Peterson, Lori'); }

  // Phillips, Shari (Montessori) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Phillips') AND (LOWER(first_name) = LOWER('Shari') OR LOWER(first_name) LIKE LOWER('Shari') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Phillips, Shari: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Phillips, Shari'); }

  // Pigman, Renee (Montessori) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Pigman') AND (LOWER(first_name) = LOWER('Renee') OR LOWER(first_name) LIKE LOWER('Renee') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Pigman, Renee: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Pigman, Renee'); }

  // Reeves, Stacy (Montessori) — Carryover: 0h, 2026 PTO used: 24h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 24
     WHERE LOWER(last_name) = LOWER('Reeves') AND (LOWER(first_name) = LOWER('Stacy') OR LOWER(first_name) LIKE LOWER('Stacy') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Reeves, Stacy: carryover=0h, used=24h'); }
  else { notFound++; console.log('  NOT FOUND: Reeves, Stacy'); }

  // Rodgers, Sanyqua (Montessori) — Carryover: 0h, 2026 PTO used: 16h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 16
     WHERE LOWER(last_name) = LOWER('Rodgers') AND (LOWER(first_name) = LOWER('Sanyqua') OR LOWER(first_name) LIKE LOWER('Sanyqua') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Rodgers, Sanyqua: carryover=0h, used=16h'); }
  else { notFound++; console.log('  NOT FOUND: Rodgers, Sanyqua'); }

  // Tekin, Megan (Montessori) — Carryover: 24.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 24.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Tekin') AND (LOWER(first_name) = LOWER('Megan') OR LOWER(first_name) LIKE LOWER('Megan') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Tekin, Megan: carryover=24.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Tekin, Megan'); }

  // Walton, Emily (Montessori) — Carryover: 72.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 72.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Walton') AND (LOWER(first_name) = LOWER('Emily') OR LOWER(first_name) LIKE LOWER('Emily') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Walton, Emily: carryover=72.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Walton, Emily'); }

  // Williams, Kengela (Montessori) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Williams') AND (LOWER(first_name) = LOWER('Kengela') OR LOWER(first_name) LIKE LOWER('Kengela') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Williams, Kengela: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Williams, Kengela'); }

  // Alvarado, LoriAnne (Niles) — Carryover: 32.0h, 2026 PTO used: 24h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 32.0, pto_hours_used_qb = 24
     WHERE LOWER(last_name) = LOWER('Alvarado') AND (LOWER(first_name) = LOWER('LoriAnne') OR LOWER(first_name) LIKE LOWER('LoriAnne') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Alvarado, LoriAnne: carryover=32.0h, used=24h'); }
  else { notFound++; console.log('  NOT FOUND: Alvarado, LoriAnne'); }

  // Gibson, Marissa (Niles) — Carryover: 16.0h, 2026 PTO used: 16h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 16.0, pto_hours_used_qb = 16
     WHERE LOWER(last_name) = LOWER('Gibson') AND (LOWER(first_name) = LOWER('Marissa') OR LOWER(first_name) LIKE LOWER('Marissa') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Gibson, Marissa: carryover=16.0h, used=16h'); }
  else { notFound++; console.log('  NOT FOUND: Gibson, Marissa'); }

  // Hill, Kyleah (Niles) — Carryover: 0h, 2026 PTO used: 24h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 24
     WHERE LOWER(last_name) = LOWER('Hill') AND (LOWER(first_name) = LOWER('Kyleah') OR LOWER(first_name) LIKE LOWER('Kyleah') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Hill, Kyleah: carryover=0h, used=24h'); }
  else { notFound++; console.log('  NOT FOUND: Hill, Kyleah'); }

  // Hill, Sarah (Niles) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Hill') AND (LOWER(first_name) = LOWER('Sarah') OR LOWER(first_name) LIKE LOWER('Sarah') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Hill, Sarah: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Hill, Sarah'); }

  // Johnson, Shay (Niles) — Carryover: 8.0h, 2026 PTO used: 8h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 8.0, pto_hours_used_qb = 8
     WHERE LOWER(last_name) = LOWER('Johnson') AND (LOWER(first_name) = LOWER('Shay') OR LOWER(first_name) LIKE LOWER('Shay') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Johnson, Shay: carryover=8.0h, used=8h'); }
  else { notFound++; console.log('  NOT FOUND: Johnson, Shay'); }

  // Johnson, Chloe (Niles) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Johnson') AND (LOWER(first_name) = LOWER('Chloe') OR LOWER(first_name) LIKE LOWER('Chloe') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Johnson, Chloe: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Johnson, Chloe'); }

  // Judy, Amber (Niles) — Carryover: 56.0h, 2026 PTO used: 48h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 56.0, pto_hours_used_qb = 48
     WHERE LOWER(last_name) = LOWER('Judy') AND (LOWER(first_name) = LOWER('Amber') OR LOWER(first_name) LIKE LOWER('Amber') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Judy, Amber: carryover=56.0h, used=48h'); }
  else { notFound++; console.log('  NOT FOUND: Judy, Amber'); }

  // LaPanne, Pennie (Niles) — Carryover: 8.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 8.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('LaPanne') AND (LOWER(first_name) = LOWER('Pennie') OR LOWER(first_name) LIKE LOWER('Pennie') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set LaPanne, Pennie: carryover=8.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: LaPanne, Pennie'); }

  // Layton, Alexis (Niles) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Layton') AND (LOWER(first_name) = LOWER('Alexis') OR LOWER(first_name) LIKE LOWER('Alexis') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Layton, Alexis: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Layton, Alexis'); }

  // Lima-Will, Alexandra (Niles) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Lima-Will') AND (LOWER(first_name) = LOWER('Alexandra') OR LOWER(first_name) LIKE LOWER('Alexandra') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Lima-Will, Alexandra: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Lima-Will, Alexandra'); }

  // Little, Carrie (Niles) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Little') AND (LOWER(first_name) = LOWER('Carrie') OR LOWER(first_name) LIKE LOWER('Carrie') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Little, Carrie: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Little, Carrie'); }

  // Persaud, Abigail (Niles) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Persaud') AND (LOWER(first_name) = LOWER('Abigail') OR LOWER(first_name) LIKE LOWER('Abigail') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Persaud, Abigail: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Persaud, Abigail'); }

  // Richards, Madisyn (Mady) (Niles) — Carryover: 24.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 24.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Richards') AND (LOWER(first_name) = LOWER('Madisyn') OR LOWER(first_name) LIKE LOWER('Madisyn') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Richards, Madisyn (Mady): carryover=24.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Richards, Madisyn (Mady)'); }

  // Swem, Kirsten (Niles) — Carryover: 72.0h, 2026 PTO used: 46h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 72.0, pto_hours_used_qb = 46
     WHERE LOWER(last_name) = LOWER('Swem') AND (LOWER(first_name) = LOWER('Kirsten') OR LOWER(first_name) LIKE LOWER('Kirsten') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Swem, Kirsten: carryover=72.0h, used=46h'); }
  else { notFound++; console.log('  NOT FOUND: Swem, Kirsten'); }

  // Uribe, Vicky (Niles) — Carryover: 16.0h, 2026 PTO used: 16h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 16.0, pto_hours_used_qb = 16
     WHERE LOWER(last_name) = LOWER('Uribe') AND (LOWER(first_name) = LOWER('Vicky') OR LOWER(first_name) LIKE LOWER('Vicky') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Uribe, Vicky: carryover=16.0h, used=16h'); }
  else { notFound++; console.log('  NOT FOUND: Uribe, Vicky'); }

  // Walters, Jenny (Niles) — Carryover: 48.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 48.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Walters') AND (LOWER(first_name) = LOWER('Jenny') OR LOWER(first_name) LIKE LOWER('Jenny') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Walters, Jenny: carryover=48.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Walters, Jenny'); }

  // Wardlaw, Jared (Niles) — Carryover: 80h, 2026 PTO used: 80h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80, pto_hours_used_qb = 80
     WHERE LOWER(last_name) = LOWER('Wardlaw') AND (LOWER(first_name) = LOWER('Jared') OR LOWER(first_name) LIKE LOWER('Jared') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Wardlaw, Jared: carryover=80h, used=80h'); }
  else { notFound++; console.log('  NOT FOUND: Wardlaw, Jared'); }

  // Wardlaw, Kelsey (Niles) — Carryover: 80h, 2026 PTO used: 80h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80, pto_hours_used_qb = 80
     WHERE LOWER(last_name) = LOWER('Wardlaw') AND (LOWER(first_name) = LOWER('Kelsey') OR LOWER(first_name) LIKE LOWER('Kelsey') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Wardlaw, Kelsey: carryover=80h, used=80h'); }
  else { notFound++; console.log('  NOT FOUND: Wardlaw, Kelsey'); }

  // Whitworth, Cortney (Niles) — Carryover: 16.0h, 2026 PTO used: 56h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 16.0, pto_hours_used_qb = 56
     WHERE LOWER(last_name) = LOWER('Whitworth') AND (LOWER(first_name) = LOWER('Cortney') OR LOWER(first_name) LIKE LOWER('Cortney') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Whitworth, Cortney: carryover=16.0h, used=56h'); }
  else { notFound++; console.log('  NOT FOUND: Whitworth, Cortney'); }

  // Anderson, Tacara (Peace Boulevard) — Carryover: 8.0h, 2026 PTO used: 16h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 8.0, pto_hours_used_qb = 16
     WHERE LOWER(last_name) = LOWER('Anderson') AND (LOWER(first_name) = LOWER('Tacara') OR LOWER(first_name) LIKE LOWER('Tacara') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Anderson, Tacara: carryover=8.0h, used=16h'); }
  else { notFound++; console.log('  NOT FOUND: Anderson, Tacara'); }

  // Antsey, Hannah (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Antsey') AND (LOWER(first_name) = LOWER('Hannah') OR LOWER(first_name) LIKE LOWER('Hannah') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Antsey, Hannah: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Antsey, Hannah'); }

  // Bareham, Laura (Peace Boulevard) — Carryover: 64.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 64.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Bareham') AND (LOWER(first_name) = LOWER('Laura') OR LOWER(first_name) LIKE LOWER('Laura') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Bareham, Laura: carryover=64.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Bareham, Laura'); }

  // Bolin-Bash, Elle (Peace Boulevard) — Carryover: 56.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 56.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Bolin-Bash') AND (LOWER(first_name) = LOWER('Elle') OR LOWER(first_name) LIKE LOWER('Elle') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Bolin-Bash, Elle: carryover=56.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Bolin-Bash, Elle'); }

  // Brant, Anne (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Brant') AND (LOWER(first_name) = LOWER('Anne') OR LOWER(first_name) LIKE LOWER('Anne') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Brant, Anne: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Brant, Anne'); }

  // Brooks-Snyder, Julie (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 8h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 8
     WHERE LOWER(last_name) = LOWER('Brooks-Snyder') AND (LOWER(first_name) = LOWER('Julie') OR LOWER(first_name) LIKE LOWER('Julie') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Brooks-Snyder, Julie: carryover=80.0h, used=8h'); }
  else { notFound++; console.log('  NOT FOUND: Brooks-Snyder, Julie'); }

  // DeLoach, Savanna (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('DeLoach') AND (LOWER(first_name) = LOWER('Savanna') OR LOWER(first_name) LIKE LOWER('Savanna') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set DeLoach, Savanna: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: DeLoach, Savanna'); }

  // Fountain, Gabrielle (Peace Boulevard) — Carryover: 0h, 2026 PTO used: 8h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 8
     WHERE LOWER(last_name) = LOWER('Fountain') AND (LOWER(first_name) = LOWER('Gabrielle') OR LOWER(first_name) LIKE LOWER('Gabrielle') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Fountain, Gabrielle: carryover=0h, used=8h'); }
  else { notFound++; console.log('  NOT FOUND: Fountain, Gabrielle'); }

  // Galvin, Dakara (Peace Boulevard) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Galvin') AND (LOWER(first_name) = LOWER('Dakara') OR LOWER(first_name) LIKE LOWER('Dakara') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Galvin, Dakara: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Galvin, Dakara'); }

  // Garber, Abby (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Garber') AND (LOWER(first_name) = LOWER('Abby') OR LOWER(first_name) LIKE LOWER('Abby') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Garber, Abby: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Garber, Abby'); }

  // Gutierrez, Amy (Peace Boulevard) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Gutierrez') AND (LOWER(first_name) = LOWER('Amy') OR LOWER(first_name) LIKE LOWER('Amy') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Gutierrez, Amy: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Gutierrez, Amy'); }

  // Harvell, Madison (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Harvell') AND (LOWER(first_name) = LOWER('Madison') OR LOWER(first_name) LIKE LOWER('Madison') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Harvell, Madison: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Harvell, Madison'); }

  // Himes, Carissa (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Himes') AND (LOWER(first_name) = LOWER('Carissa') OR LOWER(first_name) LIKE LOWER('Carissa') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Himes, Carissa: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Himes, Carissa'); }

  // Hurrell, Christina (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Hurrell') AND (LOWER(first_name) = LOWER('Christina') OR LOWER(first_name) LIKE LOWER('Christina') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Hurrell, Christina: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Hurrell, Christina'); }

  // Moore, Makayla (Peace Boulevard) — Carryover: 64.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 64.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Moore') AND (LOWER(first_name) = LOWER('Makayla') OR LOWER(first_name) LIKE LOWER('Makayla') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Moore, Makayla: carryover=64.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Moore, Makayla'); }

  // Norrick, Bobby (Peace Boulevard) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Norrick') AND (LOWER(first_name) = LOWER('Bobby') OR LOWER(first_name) LIKE LOWER('Bobby') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Norrick, Bobby: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Norrick, Bobby'); }

  // Ondrias, Grace (Peace Boulevard) — Carryover: 8.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 8.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Ondrias') AND (LOWER(first_name) = LOWER('Grace') OR LOWER(first_name) LIKE LOWER('Grace') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Ondrias, Grace: carryover=8.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Ondrias, Grace'); }

  // Perkins, Michelle (Peace Boulevard) — Carryover: 0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Perkins') AND (LOWER(first_name) = LOWER('Michelle') OR LOWER(first_name) LIKE LOWER('Michelle') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Perkins, Michelle: carryover=0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Perkins, Michelle'); }

  // Privett, Maria (Peace Boulevard) — Carryover: 48.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 48.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Privett') AND (LOWER(first_name) = LOWER('Maria') OR LOWER(first_name) LIKE LOWER('Maria') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Privett, Maria: carryover=48.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Privett, Maria'); }

  // Prussa, Olivia (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 8h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 8
     WHERE LOWER(last_name) = LOWER('Prussa') AND (LOWER(first_name) = LOWER('Olivia') OR LOWER(first_name) LIKE LOWER('Olivia') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Prussa, Olivia: carryover=80.0h, used=8h'); }
  else { notFound++; console.log('  NOT FOUND: Prussa, Olivia'); }

  // Robertson, Tamara (Peace Boulevard) — Carryover: 64.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 64.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Robertson') AND (LOWER(first_name) = LOWER('Tamara') OR LOWER(first_name) LIKE LOWER('Tamara') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Robertson, Tamara: carryover=64.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Robertson, Tamara'); }

  // Rose, Kristen (Peace Boulevard) — Carryover: 8.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 8.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Rose') AND (LOWER(first_name) = LOWER('Kristen') OR LOWER(first_name) LIKE LOWER('Kristen') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Rose, Kristen: carryover=8.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Rose, Kristen'); }

  // Sandoval, Jenia (Peace Boulevard) — Carryover: 56.0h, 2026 PTO used: 16h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 56.0, pto_hours_used_qb = 16
     WHERE LOWER(last_name) = LOWER('Sandoval') AND (LOWER(first_name) = LOWER('Jenia') OR LOWER(first_name) LIKE LOWER('Jenia') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Sandoval, Jenia: carryover=56.0h, used=16h'); }
  else { notFound++; console.log('  NOT FOUND: Sandoval, Jenia'); }

  // Smuda, Carol (Peace Boulevard) — Carryover: 80.0h, 2026 PTO used: 0h
  let r = await pool.query(
    `UPDATE employees SET pto_carryover_hours = 80.0, pto_hours_used_qb = 0
     WHERE LOWER(last_name) = LOWER('Smuda') AND (LOWER(first_name) = LOWER('Carol') OR LOWER(first_name) LIKE LOWER('Carol') || '%')`);
  if (r.rowCount > 0) { updated++; console.log('  Set Smuda, Carol: carryover=80.0h, used=0h'); }
  else { notFound++; console.log('  NOT FOUND: Smuda, Carol'); }

  console.log(`\nDone: ${updated} updated, ${notFound} not found`);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
