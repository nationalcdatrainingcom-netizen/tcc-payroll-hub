// TCC Payroll Hub - Complete Database Seed - All 3 Centers
// Run once: DATABASE_URL=your_url node seed.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function seed() {
  console.log('Clearing existing data...');
  for (const t of ['time_off_entries','staffing_plan','daily_hours','documents','pay_increase_requests','timecard_imports','employees']) {
    await pool.query(`DELETE FROM ${t}`);
  }

  // [first, last, center, position, yearHired, startDate, schedule, ft, weeklyHrs, rate, admin]
  const emps = [
    // PEACE BOULEVARD
    ['Gabrielle','Fountain','Peace Boulevard','Director',2023,'2023-01-01','',1,40,25.68,1],
    ['Amy','Gutierrez','Peace Boulevard','Dir. Professional Dev',2023,'2023-01-01','',1,40,28.00,1],
    ['Jenia','Sandoval','Peace Boulevard','Co-Lead',2024,'2024-06-04','8A-5P',1,40,18.45,0],
    ['Tamara','Robertson','Peace Boulevard','Co-Lead',2021,'2021-06-15','7am-4pm',1,40,18.45,0],
    ['Madison','Harvell','Peace Boulevard','Lead',2025,'2025-12-15','9-6',1,40,14.53,0],
    ['Michelle','Perkins','Peace Boulevard','Assistant',2025,'2025-02-03','7:30-4:30',1,40,15.70,0],
    ['Noemi','Reyna-Adams','Peace Boulevard','Lead',2026,'2026-01-12','8am-5pm',1,40,20.88,0],
    ['Victoria','Monroe','Peace Boulevard','Assistant',2026,'2026-03-23','8:30-5:30',1,40,null,0],
    ['Shannon','Milnickel','Peace Boulevard','Lead',2015,'2018-01-10','7am-3pm',1,35,17.57,0],
    ['Skye','Demean','Peace Boulevard','Assistant',2021,'2023-10-19','7:45am-4:45pm',1,40,14.25,0],
    ['Zoie','Oiler','Peace Boulevard','Assistant',2023,'2023-07-16','8:30am-5:30pm',1,40,16.13,0],
    ['Jenna','Froberg','Peace Boulevard','Assistant',2023,'2023-08-07','12-6',0,30,14.59,0],
    ['Tacara','Anderson','Peace Boulevard','Lead',2022,'2022-02-02','7am-4pm',1,40,22.21,0],
    ['Christina','Hurrell','Peace Boulevard','Assistant',2025,'2025-09-25','9-6',1,40,15.72,0],
    ['Josie','Mikkelsen','Peace Boulevard','Lead',2025,'2025-07-22','8:30-5:30',1,40,21.96,0],
    ['Abby','Garber','Peace Boulevard','Assistant',2025,'2025-07-22','8-5',1,40,16.40,0],
    ['Erin','Riggs','Peace Boulevard','Caregiver',2025,'2025-11-14','8:30-5:30',1,40,14.92,0],
    ['Grace','Ondias','Peace Boulevard','Lead',2024,'2024-09-23','7-4',1,40,19.56,0],
    ['Kristen','Rose','Peace Boulevard','Assistant',2024,'2024-05-06','8am-5pm',1,40,null,0],
    ['Elle','Bolin','Peace Boulevard','Lead',2022,'2022-01-17','9-6',1,40,20.00,0],
    ['Hannah','Anstey','Peace Boulevard','Assistant',2025,'2025-11-17','8:15-5:15',1,40,14.57,0],
    ['Olivia','Prusa','Peace Boulevard','Floater',2023,'2023-05-02','Varies',0,25,12.60,0],
    ['Laura','Bareham','Peace Boulevard','Floater',2023,'2023-02-20','Varies',1,40,15.32,0],
    ['Savanna','DeLoach','Peace Boulevard','Floater',2025,'2025-09-23','Varies',1,40,19.50,0],
    ['Carol','Smuda','Peace Boulevard','Floater',2025,'2025-06-12','Varies',0,20,20.86,0],
    ['Samantha','Salcher','Peace Boulevard','Floater',2025,'2025-04-07','Varies',1,40,null,0],
    ['Anna','Jannings','Peace Boulevard','Floater',2026,'2026-02-12','Varies',0,30,15.33,0],
    ['Bobby','Norrick','Peace Boulevard','Floater',2023,'2023-01-06','Varies',1,40,13.56,0],
    ['Kenadie','Sutton','Peace Boulevard','Floater',2025,'2025-12-15','Varies',0,25,13.21,0],
    ['Maria','Privett','Peace Boulevard','Floater',2025,'2025-01-01','',1,40,null,0],
    ['Makayla','Moore','Peace Boulevard','Floater',2021,'2021-01-01','',0,10,21.37,0],
    ['Tyeisha','Baines','Peace Boulevard','Floater',2026,'2026-01-01','',0,30,14.16,0],

    // NILES
    ['Kirsten','Swem','Niles','Director',2010,'2010-01-01','',1,40,null,1],
    ['Kelsey','Wardlaw','Niles','Asst. Director',2021,'2021-01-01','',1,40,null,1],
    ['Pennie','LaPanne','Niles','Lead',2023,'2023-10-16','7-4',1,40,null,0],
    ['Alexandra','Lima-Wills','Niles','Assistant',2025,'2025-10-03','8-5',1,40,null,0],
    ['Samantha','Leonard','Niles','Assistant',2026,'2026-02-05','9-6',1,40,null,0],
    ['Jenny','Walter','Niles','Assistant',2023,'2023-04-04','12-6',0,30,null,0],
    ['Mady','Richards','Niles','Lead',2018,'2018-01-19','6:45-3:45',1,40,null,0],
    ['Chloe','Johnson','Niles','Assistant',2025,'2025-03-03','9-6',1,40,null,0],
    ['Lorianne','Alvarado','Niles','Lead',2025,'2025-08-22','8-3:15',1,35,null,0],
    ['Sarah','Hill','Niles','Assistant',2016,'2016-12-14','6:30-3:15',1,35,null,0],
    ['Vicky','Uribe','Niles','Lead',2025,'2025-07-15','7-3:30',1,35,null,0],
    ['Marissa','Gibson','Niles','Assistant',2025,'2025-02-28','9:00-6:00',1,40,null,0],
    ['Cortney','Whitworth','Niles','Lead',2020,'2020-01-13','7:30-3:30',1,35,null,0],
    ['Carrie','Little','Niles','Assistant',2025,'2025-12-17','8:30-5:30',1,40,null,0],
    ['Amber','Judy','Niles','Lead',2004,'2004-07-15','9:00-6:00',1,40,null,0],
    ['Alexis','Layton','Niles','Assistant',2022,'2022-08-08','7:00-3:30',1,35,null,0],
    ['Marina','Brooks','Niles','Assistant',2025,'2025-12-15','Varies',1,40,null,0],
    ['Jordyn','Thompson','Niles','Floater',2026,'2026-01-27','Varies',1,40,null,0],
    ['Abigayle','Persaud','Niles','Floater',2025,'2025-08-15','7:30-4:30',1,40,null,0],
    ['Shay','Johnson','Niles','Floater',2022,'2022-06-07','8:00-2:45',0,30,null,0],
    ['Cynthia','Barkmann','Niles','Floater',2025,'2025-12-09','9-1:30, 4:45-6',0,25,null,0],
    ['Kyleah','Hill','Niles','Floater',2022,'2022-11-28','7-4',1,40,null,0],
    ['Logan','Ritchie','Niles','Floater',2026,'2026-01-01','',1,40,null,0],

    // MONTESSORI
    ['Shari','Phillips','Montessori','Director',2024,'2024-01-01','',1,40,29.35,1],
    ['Sanyqua','Rodgers','Montessori','Lead',2023,'2023-07-16','7am-3pm',1,40,18.06,0],
    ['Kathleen','Norrick','Montessori','Assistant',2024,'2025-08-14','9am-6pm',1,40,17.63,0],
    ['Kengela','Williams','Montessori','Lead',2025,'2025-03-04','7:45am-4:45pm',1,40,18.08,0],
    ['Dakara','Galvin','Montessori','Assistant',2024,'2024-07-01','9:00a-6:00p',1,40,16.06,0],
    ['Heather','Gendron-Naka','Montessori','Lead',2004,'2010-01-08','7am-3pm',1,40,22.75,1],
    ['Joanna','Angelo','Montessori','Assistant',2018,'2018-09-25','7am-3pm',1,40,19.45,0],
    ['Mariah','Glasgow','Montessori','Caregiver',2022,'2022-04-26','7:45am-4:45pm',1,40,16.77,0],
    ['Amanda','Kasper','Montessori','Lead',2024,'2024-09-22','7:30am-4:30pm',1,40,21.08,0],
    ['Trevania','Gnodtke','Montessori','Assistant',2024,'2024-07-28','8:30am-5:30pm',1,40,18.57,0],
    ['Melissa','Fritz','Montessori','Lead',2024,'2024-08-04','7:30am-4:30pm',1,40,19.44,0],
    ['Teona','Duckett','Montessori','Assistant',2020,'2020-06-17','7am-4pm',1,40,18.45,0],
    ['Stacy','Reeves','Montessori','Lead',2018,'2023-07-16','7am-4pm',1,40,21.93,0],
    ['Sarah','Moore','Montessori','Assistant',2022,'2022-02-23','7:30am-4:30pm',1,40,16.77,0],
    ['Itzel','Balcazar','Montessori','Floater',2022,'2022-04-14','8am-3pm',0,30,18.45,0],
    ['Alexia','Wilson','Montessori','Floater',2025,null,'',0,15,14.50,0],
    ['Jessica','Rubenstein','Montessori','Floater',2016,'2016-07-11','Floater',0,30,17.22,0],
    ['Tina','Albertine','Montessori','Floater',2026,'2026-02-04','9-6',1,40,17.50,0],
    ['Renee','Pigman','Montessori','Staff',2024,null,'',1,40,20.85,0],
    ['Carlee','Gibson','Montessori','Staff',2023,null,'',1,40,15.02,0],
    ['Caydance','Sluder','Montessori','Staff',2026,'2026-03-25','9-6',1,40,null,0],

    // ADMIN/SALARY
    ['Mary','Wardlaw','Peace Boulevard','Owner',2020,null,'',1,40,50.00,1],
    ['Jay','Wardlaw','Peace Boulevard','Operations',2019,null,'',1,40,25.00,1],
  ];

  const empMap = {};
  for (const e of emps) {
    const [first,last,center,position,year,start,schedule,ft,hrs,rate,admin] = e;
    const r = await pool.query(
      `INSERT INTO employees (first_name,last_name,center,position,year_hired,start_date,scheduled_times,is_full_time,weekly_hours,hourly_rate,is_admin,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE) RETURNING id`,
      [first,last,center,position,year,start||null,schedule,!!ft,hrs,rate,!!admin]
    );
    empMap[`${last.toLowerCase()}_${first.toLowerCase()}`] = r.rows[0].id;
  }
  console.log(`✅ ${emps.length} employees`);

  function findEmp(last, first) {
    const aliases = {'bolin-bash':'bolin','deamean':'demean','lima-will':'lima-wills','naka':'gendron-naka','gnodke':'gnodtke','walters':'walter','harvel':'harvell','mikkelson':'mikkelsen'};
    let ln = last.toLowerCase();
    let fn = first.toLowerCase().replace(/\s*\(.*\)/,'').trim();
    if (aliases[ln]) ln = aliases[ln];
    let key = `${ln}_${fn}`;
    if (empMap[key]) return empMap[key];
    for (const k of Object.keys(empMap)) {
      if (k.startsWith(ln+'_') && k.includes(fn.substring(0,3))) return empMap[k];
    }
    return null;
  }

  // TIME OFF: [last,first,month,day,type]
  const timeOff = [
    // PEACE JAN
    ['Fountain','Gabrielle',1,30,'P'],['Anderson','Tacara',1,1,'P'],['Anderson','Tacara',1,2,'P'],['Anderson','Tacara',1,19,'P'],['Anderson','Tacara',1,26,'U'],
    ['Anstey','Hannah',1,23,'U'],['Anstey','Hannah',1,26,'U'],['Bareham','Laura',1,14,'U'],['Bareham','Laura',1,15,'U'],['Bareham','Laura',1,16,'U'],['Bareham','Laura',1,28,'U'],
    ['Bolin','Elle',1,20,'U'],['Bolin','Elle',1,21,'U'],['Bolin','Elle',1,27,'U'],['DeLoach','Savanna',1,19,'U'],['DeLoach','Savanna',1,20,'U'],['Garber','Abby',1,26,'U'],
    ['Hurrell','Christina',1,23,'P'],['Moore','Makayla',1,23,'U'],['Norrick','Bobby',1,1,'P'],['Norrick','Bobby',1,2,'P'],
    ['Ondias','Grace',1,15,'U'],['Ondias','Grace',1,16,'U'],['Privett','Maria',1,15,'U'],
    ['Prusa','Olivia',1,8,'U'],['Prusa','Olivia',1,9,'U'],['Prusa','Olivia',1,23,'P'],['Robertson','Tamara',1,25,'U'],
    ['Rose','Kristen',1,15,'U'],['Sandoval','Jenia',1,17,'U'],['Sandoval','Jenia',1,18,'U'],['Salcher','Samantha',1,7,'P'],
    ['Harvell','Madison',1,15,'U'],['Harvell','Madison',1,16,'U'],['Harvell','Madison',1,17,'U'],['Mikkelsen','Josie',1,24,'U'],['Reyna-Adams','Noemi',1,12,'P'],
    // PEACE FEB
    ['Anderson','Tacara',2,6,'P'],['Anstey','Hannah',2,2,'U'],['Anstey','Hannah',2,8,'U'],['Anstey','Hannah',2,9,'U'],['Anstey','Hannah',2,18,'U'],
    ['Bareham','Laura',2,11,'U'],['Bareham','Laura',2,25,'U'],['Bolin','Elle',2,16,'U'],['Bolin','Elle',2,17,'U'],['DeLoach','Savanna',2,6,'U'],['Garber','Abby',2,3,'U'],
    ['Moore','Makayla',2,2,'U'],['Moore','Makayla',2,5,'U'],['Moore','Makayla',2,6,'U'],['Ondias','Grace',2,2,'U'],['Ondias','Grace',2,3,'U'],['Privett','Maria',2,2,'U'],
    ['Prusa','Olivia',2,8,'U'],['Prusa','Olivia',2,9,'U'],['Prusa','Olivia',2,23,'P'],['Robertson','Tamara',2,6,'U'],['Rose','Kristen',2,16,'U'],
    ['Sandoval','Jenia',2,17,'U'],['Sandoval','Jenia',2,18,'U'],['Salcher','Samantha',2,7,'P'],
    ['Harvell','Madison',2,15,'U'],['Harvell','Madison',2,16,'U'],['Harvell','Madison',2,21,'U'],['Riggs','Erin',2,10,'U'],
    // PEACE MAR
    ['Anderson','Tacara',3,18,'U'],['Garber','Abby',3,9,'U'],['Hurrell','Christina',3,9,'U'],['Perkins','Michelle',3,19,'U'],
    ['Prusa','Olivia',3,2,'U'],['Prusa','Olivia',3,3,'U'],['Prusa','Olivia',3,4,'U'],['Prusa','Olivia',3,16,'U'],['Prusa','Olivia',3,17,'U'],['Prusa','Olivia',3,18,'U'],
    ['Robertson','Tamara',3,11,'U'],['Rose','Kristen',3,12,'U'],['Rose','Kristen',3,16,'U'],['Rose','Kristen',3,17,'U'],['Rose','Kristen',3,18,'U'],['Rose','Kristen',3,23,'U'],
    ['Reyna-Adams','Noemi',3,11,'U'],['Reyna-Adams','Noemi',3,12,'U'],['Reyna-Adams','Noemi',3,13,'U'],['Riggs','Erin',3,9,'U'],
    ['Privett','Maria',3,15,'U'],['Privett','Maria',3,16,'U'],['Privett','Maria',3,17,'U'],['Privett','Maria',3,18,'U'],['Privett','Maria',3,19,'U'],['Privett','Maria',3,20,'U'],['Privett','Maria',3,21,'U'],
    // NILES JAN
    ['Swem','Kirsten',1,30,'U'],['Alvarado','Lorianne',1,1,'P'],['Alvarado','Lorianne',1,2,'P'],['Alvarado','Lorianne',1,9,'U'],['Alvarado','Lorianne',1,15,'U'],['Alvarado','Lorianne',1,26,'U'],
    ['Gibson','Marissa',1,1,'P'],['Gibson','Marissa',1,2,'P'],['Gibson','Marissa',1,30,'U'],
    ['Hill','Kyleah',1,15,'U'],['Hill','Kyleah',1,19,'U'],['Hill','Kyleah',1,20,'U'],['Hill','Kyleah',1,21,'U'],['Hill','Kyleah',1,22,'U'],['Hill','Kyleah',1,23,'U'],
    ['Hill','Sarah',1,19,'U'],['Hill','Sarah',1,20,'U'],['Hill','Sarah',1,22,'U'],['Hill','Sarah',1,23,'U'],['Hill','Sarah',1,28,'U'],
    ['Johnson','Shay',1,23,'P'],['Judy','Amber',1,1,'P'],['Judy','Amber',1,2,'P'],['LaPanne','Pennie',1,19,'U'],
    ['Layton','Alexis',1,19,'U'],['Layton','Alexis',1,20,'P'],['Layton','Alexis',1,21,'P'],['Layton','Alexis',1,22,'P'],['Layton','Alexis',1,23,'P'],
    ['Lima-Wills','Alexandra',1,6,'U'],['Lima-Wills','Alexandra',1,7,'U'],['Lima-Wills','Alexandra',1,8,'U'],['Lima-Wills','Alexandra',1,9,'U'],['Lima-Wills','Alexandra',1,26,'U'],
    ['Persaud','Abigayle',1,16,'U'],['Persaud','Abigayle',1,19,'U'],['Persaud','Abigayle',1,26,'U'],['Persaud','Abigayle',1,28,'U'],['Persaud','Abigayle',1,29,'U'],['Persaud','Abigayle',1,30,'U'],
    ['Richards','Mady',1,1,'P'],['Richards','Mady',1,2,'P'],['Richards','Mady',1,16,'U'],['Richards','Mady',1,21,'U'],['Richards','Mady',1,22,'U'],['Richards','Mady',1,23,'U'],
    ['Uribe','Vicky',1,1,'P'],['Uribe','Vicky',1,2,'P'],['Uribe','Vicky',1,12,'U'],['Uribe','Vicky',1,16,'U'],['Uribe','Vicky',1,26,'U'],['Uribe','Vicky',1,27,'U'],['Uribe','Vicky',1,28,'U'],['Uribe','Vicky',1,29,'U'],['Uribe','Vicky',1,30,'U'],
    ['Walter','Jenny',1,12,'U'],['Whitworth','Cortney',1,1,'P'],['Whitworth','Cortney',1,2,'P'],['Whitworth','Cortney',1,19,'U'],['Whitworth','Cortney',1,26,'P'],
    ['Brooks','Marina',1,19,'U'],['Brooks','Marina',1,20,'U'],['Little','Carrie',1,19,'U'],['Little','Carrie',1,27,'U'],['Little','Carrie',1,28,'U'],
    // NILES FEB
    ['Swem','Kirsten',2,2,'P'],['Swem','Kirsten',2,3,'P'],['Swem','Kirsten',2,4,'P'],['Swem','Kirsten',2,5,'P'],['Swem','Kirsten',2,6,'P'],
    ['Alvarado','Lorianne',2,9,'U'],['Alvarado','Lorianne',2,20,'U'],['Alvarado','Lorianne',2,23,'P'],
    ['Hill','Kyleah',2,5,'U'],['Hill','Kyleah',2,13,'U'],['Hill','Kyleah',2,24,'U'],['Hill','Sarah',2,13,'U'],['LaPanne','Pennie',2,9,'U'],['Layton','Alexis',2,9,'U'],
    ['Persaud','Abigayle',2,27,'U'],['Uribe','Vicky',2,17,'U'],['Walter','Jenny',2,6,'U'],
    ['Little','Carrie',2,2,'U'],['Little','Carrie',2,3,'U'],['Little','Carrie',2,4,'U'],['Little','Carrie',2,5,'U'],['Little','Carrie',2,6,'U'],['Little','Carrie',2,13,'U'],
    // NILES MAR
    ['Alvarado','Lorianne',3,9,'U'],['Alvarado','Lorianne',3,10,'U'],['Hill','Kyleah',3,4,'U'],['Hill','Kyleah',3,24,'U'],['Hill','Sarah',3,4,'U'],
    ['Johnson','Chloe',3,16,'U'],['Johnson','Chloe',3,17,'U'],['Judy','Amber',3,19,'P'],['Judy','Amber',3,20,'P'],['LaPanne','Pennie',3,12,'U'],
    ['Lima-Wills','Alexandra',3,4,'U'],['Lima-Wills','Alexandra',3,5,'U'],['Lima-Wills','Alexandra',3,6,'U'],
    ['Persaud','Abigayle',3,2,'U'],['Persaud','Abigayle',3,16,'U'],['Uribe','Vicky',3,18,'U'],['Leonard','Samantha',3,12,'U'],['Leonard','Samantha',3,13,'U'],
    // MCC JAN
    ['Phillips','Shari',1,1,'P'],['Angelo','Joanna',1,1,'P'],['Angelo','Joanna',1,16,'P'],['Angelo','Joanna',1,20,'P'],
    ['Balcazar','Itzel',1,15,'P'],['Balcazar','Itzel',1,20,'P'],['Balcazar','Itzel',1,21,'P'],['Balcazar','Itzel',1,23,'P'],
    ['Demean','Skye',1,1,'P'],['Demean','Skye',1,2,'P'],['Demean','Skye',1,15,'P'],
    ['Duckett','Teona',1,1,'P'],['Duckett','Teona',1,13,'U'],['Duckett','Teona',1,15,'P'],['Duckett','Teona',1,20,'P'],['Duckett','Teona',1,22,'P'],['Duckett','Teona',1,26,'P'],
    ['Glasgow','Mariah',1,19,'U'],['Glasgow','Mariah',1,20,'P'],['Glasgow','Mariah',1,21,'U'],
    ['Milnickel','Shannon',1,9,'P'],['Milnickel','Shannon',1,12,'P'],
    ['Moore','Sarah',1,2,'P'],['Moore','Sarah',1,23,'P'],['Moore','Sarah',1,26,'P'],
    ['Norrick','Kathleen',1,12,'U'],['Oiler','Zoie',1,26,'P'],['Oiler','Zoie',1,28,'P'],
    ['Reeves','Stacy',1,1,'P'],['Reeves','Stacy',1,2,'P'],['Reeves','Stacy',1,20,'P'],['Reeves','Stacy',1,23,'P'],['Reeves','Stacy',1,25,'P'],
    ['Rodgers','Sanyqua',1,15,'P'],['Rodgers','Sanyqua',1,20,'P'],
    // MCC FEB
    ['Glasgow','Mariah',2,23,'U'],['Gnodtke','Trevania',2,25,'P'],['Williams','Kengela',2,23,'U'],['Williams','Kengela',2,25,'U'],
    // MCC MAR
    ['Reeves','Stacy',3,27,'U'],
  ];

  const adminUser = await pool.query("SELECT id FROM users WHERE username='mary'");
  const adminId = adminUser.rows[0]?.id||1;
  let toCount = 0;
  for (const [last,first,m,d,type] of timeOff) {
    const empId = findEmp(last,first);
    if (!empId) { console.log(`  WARN TO: ${last}, ${first}`); continue; }
    const dt = `2026-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    await pool.query(`INSERT INTO time_off_entries (employee_id,entry_date,entry_type,entered_by) VALUES ($1,$2,$3,$4) ON CONFLICT (employee_id,entry_date) DO UPDATE SET entry_type=$3`,[empId,dt,type,adminId]);
    toCount++;
  }
  console.log(`✅ ${toCount} time off entries`);

  // STAFFING PLAN: [last,first,center,classroom,role, ori,cpr,abc,ref,ccbc,fp,elig,abuse,eval,prom,assign,edu,hrs,it]
  const sp = [
    // PEACE
    ['Sandoval','Jenia','Peace Boulevard','Infants - Caterpillars','Co-Lead','2024-06-01','2024-10-17','2024-06-22','2025-09-10','2024-05-30','2024-05-30','2024-05-30','2024-06-04','2025-12-11',null,null,null,null,'Infant/Tod CDA 9/19/25'],
    ['Robertson','Tamara','Peace Boulevard','Infants - Caterpillars','Co-Lead','2022-08-28','2025-01-15',null,'2025-08-21','2021-06-16','2021-06-18','2021-07-07','2021-06-21','2026-01-27',null,null,null,null,'Infant/Todd CDA 7/15/24'],
    ['Harvell','Madison','Peace Boulevard','Toddlers - Kangas','Lead','2025-12-15',null,'2025-12-15','2025-12-15','2025-12-11','2025-12-11','2025-12-11','2025-12-15',null,null,null,null,null,'Working on I/T CDA'],
    ['Perkins','Michelle','Peace Boulevard','Toddlers - Kangas','Assistant','2025-01-30','2024-07-31','2024-06-04','2025-01-29','2025-01-22','2025-05-30','2025-01-22','2025-02-03',null,null,null,null,null,null],
    ['Reyna-Adams','Noemi','Peace Boulevard','Toddlers - Lions','Lead','2026-01-12',null,'2024-08-27','2025-09-04','2026-01-12','2024-05-09','2026-01-12','2026-01-12',null,null,null,'BA in ECE',null,null],
    ['Monroe','Victoria','Peace Boulevard','Toddlers - Lions','Assistant',null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    ['Milnickel','Shannon','Peace Boulevard','Montessori Infants','Lead','2026-01-22','2024-04-15','2024-06-20','2025-10-10','2025-05-09','2023-05-19','2025-05-09',null,null,null,null,null,null,'17 ECE credit hours + 963 hrs'],
    ['Demean','Skye','Peace Boulevard','Montessori Infants','Assistant','2026-01-22','2024-04-15','2024-11-13','2025-09-03','2025-05-09','2021-10-21','2025-05-09',null,null,null,null,null,null,null],
    ['Oiler','Zoie','Peace Boulevard','Montessori Infants','Assistant','2024-11-24','2024-04-15',null,'2025-09-17','2025-05-09','2023-03-31','2025-05-09',null,null,null,null,null,null,null],
    ['Froberg','Jenna','Peace Boulevard','Montessori Infants','Assistant','2023-08-08','2025-01-15','2023-08-10','2025-10-08','2024-12-09','2023-07-21','2025-05-09',null,null,null,null,null,null,null],
    ['Anderson','Tacara','Peace Boulevard','Twos - Bears','Lead','2022-02-03','2025-01-15',null,'2025-09-04','2022-01-27','2023-08-17','2023-08-22','2022-02-03','2025-10-07','2002-01-27','2024-06-06','Preschool CDA',null,null],
    ['Hurrell','Christina','Peace Boulevard','Twos - Bears','Assistant','2025-09-25','2025-10-22','2025-02-14','2025-01-29','2025-09-23','2025-11-09','2025-09-23','2025-09-25',null,null,null,null,null,null],
    ['Mikkelsen','Josie','Peace Boulevard','GSRP - Penguins','Lead','2025-06-19','2024-09-14','2025-06-18','2025-06-18','2025-05-20','2024-06-07','2025-05-20','2025-07-22','2025-12-12',null,null,'ECE BA',null,null],
    ['Garber','Abby','Peace Boulevard','GSRP - Penguins','Assistant','2025-07-21','2025-10-22','2025-07-22','2025-07-22','2025-07-15','2025-07-16','2025-07-18','2025-07-22','2025-12-12','2025-12-12','2024-06-10',null,null,null],
    ['Riggs','Erin','Peace Boulevard','GSRP - Penguins','Caregiver','2025-11-18',null,'2025-11-17','2025-11-18','2025-11-14','2025-06-05','2025-11-14','2025-12-10',null,null,null,null,null,null],
    ['Ondias','Grace','Peace Boulevard','GSRP - Dinos','Lead','2024-09-23','2024-10-17','2024-09-24','2025-08-27','2024-09-20','2024-10-05','2024-10-08','2024-10-14','2025-12-09','2024-09-26','2024-11-11',"Bachelor's in ECE",null,null],
    ['Rose','Kristen','Peace Boulevard','GSRP - Dinos','Assistant','2024-01-29','2024-10-17','2024-05-07','2025-09-15','2024-04-17','2024-04-24','2024-05-01','2024-05-06','2025-12-09',null,null,null,null,null],
    ['Bolin','Elle','Peace Boulevard','Threes/Fours Flamingos','Lead','2022-01-18','2025-10-25','2024-10-20','2025-09-11','2023-06-23','2022-01-19','2023-06-23','2022-01-18','2025-12-10',null,null,null,null,'CDA in preschool 10/05/23'],
    ['Anstey','Hannah','Peace Boulevard','Threes/Fours Flamingos','Assistant','2025-11-18',null,'2025-10-02','2025-10-02','2025-11-13','2025-12-15','2025-01-08','2025-11-17',null,null,null,null,null,null],
    // NILES
    ['LaPanne','Pennie','Niles','Infants/Ones','Lead','2023-10-10','2025-10-22',null,'2025-07-22','2023-09-19','2023-09-21','2023-10-12','2023-10-15','2024-11-14',null,null,null,null,'CDA 6/5/24'],
    ['Lima-Wills','Alexandra','Niles','Infants/Ones','Assistant','2025-10-05','2025-10-22',null,'2025-10-04','2025-09-24','2025-10-04','2025-10-07','2025-10-03',null,null,null,null,null,null],
    ['Richards','Mady','Niles','Ones/Twos','Lead','2018-01-20','2025-06-11','2024-03-28','2025-09-10','2023-06-09','2023-06-20','2023-06-26','2018-01-19','2024-11-14',null,null,null,null,'120 I/T CDA hrs, preparing for CDA'],
    ['Alvarado','Lorianne','Niles','Strong Beginnings - Threes','Lead','2025-08-21',null,'2025-09-09','2025-08-22','2025-08-13','2025-08-18','2025-08-20','2025-08-22',null,null,null,'BA in ECE',null,null],
    ['Hill','Sarah','Niles','Strong Beginnings - Threes','Assistant','2016-12-22','2025-06-11',null,'2025-06-23','2023-05-25','2023-06-05','2023-06-12','2016-12-15','2024-11-15',null,null,'Preschool CDA 6/24/24',null,null],
    ['Uribe','Vicky','Niles','GSRP - 1 (4-Day)','Lead','2022-11-15','2024-10-17',null,'2025-10-31','2025-07-02','2025-07-07','2025-07-08','2025-11-18',null,null,null,null,null,null],
    ['Gibson','Marissa','Niles','GSRP - 1 (4-Day)','Assistant','2025-02-25','2025-06-11','2025-03-04','2025-03-05','2025-02-14','2025-03-04','2025-03-05','2025-02-28',null,null,null,null,null,null],
    ['Whitworth','Cortney','Niles','GSRP - 2 (4-Day)','Lead','2020-01-14','2025-06-11',null,'2025-10-31','2020-01-08','2025-01-07','2025-01-08','2020-01-13','2024-11-14',null,null,'Preschool CDA',null,null],
    ['Little','Carrie','Niles','GSRP - 2 (4-Day)','Assistant','2025-12-17','2025-08-29','2025-12-17',null,'2025-12-17','2026-01-05','2026-01-06','2025-12-17',null,null,null,null,null,null],
    ['Judy','Amber','Niles','Multi-Age - Miss Judy','Lead','2008-06-12','2025-06-11',null,'2025-10-21','2023-05-22','2023-05-31','2023-06-08','2009-02-12','2024-11-14',null,null,'Associate in ECE',null,null],
    ['Layton','Alexis','Niles','Multi-Age - Miss Judy','Assistant','2022-08-08','2025-10-22',null,'2025-07-22','2022-08-02','2021-05-17','2022-08-02','2022-08-09','2024-11-14',null,null,'Preschool CDA 6/21/24',null,null],
    ['Persaud','Abigayle','Niles','Floaters','Floater','2025-08-10',null,'2025-09-10','2025-09-03','2025-08-04','2024-01-09','2025-08-04','2025-09-02',null,null,null,null,null,null],
    ['Johnson','Shay','Niles','Floaters','Floater','2022-06-08','2025-06-11',null,'2025-11-01','2022-06-07','2022-06-09','2022-08-17','2022-06-07',null,null,null,'Preschool CDA 7/24/24',null,null],
    ['Barkmann','Cynthia','Niles','Floaters','Floater','2025-12-09',null,'2025-12-05','2025-12-09','2025-12-04','2025-12-10','2025-12-11','2025-12-09',null,null,null,null,null,null],
    ['Hill','Kyleah','Niles','Floaters','Floater','2022-11-23','2025-01-15',null,'2025-09-16','2022-11-22','2022-12-02','2022-12-16','2022-11-28',null,null,null,null,null,null],
    // MONTESSORI
    ['Rodgers','Sanyqua','Montessori','Toddlers - Purple','Lead','2024-10-12','2025-01-15','2023-01-17','2025-09-30','2025-05-09','2023-02-02','2025-05-09','2023-10-31',null,null,null,null,null,'I/T CDA 7/10/25'],
    ['Norrick','Kathleen','Montessori','Toddlers - Purple','Assistant','2023-01-16','2025-10-22',null,'2025-03-28','2025-08-07','2023-01-18','2025-08-07','2025-11-18',null,null,null,'I/T CDA 1/25/24',null,null],
    ['Williams','Kengela','Montessori','Pre-Primary - Yellow','Lead','2025-03-13','2025-06-11',null,'2025-03-13','2025-03-12','2023-05-16','2025-05-29','2023-11-01',null,'2025-12-01','2025-12-01','Preschool CDA 11/6/25',null,null],
    ['Galvin','Dakara','Montessori','Pre-Primary - Yellow','Assistant','2024-06-24','2024-10-17','2024-07-04','2025-09-06','2024-06-20','2024-06-27','2024-06-28','2024-06-27',null,null,null,null,null,null],
    ['Gendron-Naka','Heather','Montessori','Primary - Red','Lead','2025-01-12','2025-10-22','2020-07-01','2025-10-14','2025-05-09','2023-07-17','2025-05-09','2023-11-01',null,'2024-08-25','2024-08-25','Montessori Certificate June 2007',null,null],
    ['Angelo','Joanna','Montessori','Primary - Red','Assistant','2025-01-10','2025-09-05','2020-07-20','2025-10-03','2025-05-09','2023-08-28','2025-05-09','2023-11-02',null,null,null,'Preschool CDA 9/9/24',null,null],
    ['Glasgow','Mariah','Montessori','Primary - Red','Caregiver','2025-01-14','2025-06-11','2022-04-26','2025-10-28','2025-05-09','2022-04-25','2025-05-09','2023-10-30',null,null,null,null,null,null],
    ['Kasper','Amanda','Montessori','GSRP - Orange','Lead','2024-09-20','2025-01-15','2024-09-23','2025-09-27','2024-09-18','2024-09-27','2024-10-03','2024-09-23',null,'2024-08-25','2024-08-25','BA in Special Education',null,null],
    ['Gnodtke','Trevania','Montessori','GSRP - Orange','Assistant','2024-07-29','2025-06-11','2024-07-28','2025-10-10','2024-07-22','2024-07-26','2024-07-26','2024-07-29',null,null,null,'BA in Fine Arts',null,null],
    ['Fritz','Melissa','Montessori','GSRP - Blue','Lead','2024-07-29','2025-01-15','2019-09-01','2025-10-11','2024-07-25','2023-09-11','2024-07-25','2024-08-05',null,'2024-08-25','2024-08-25','CDA 8/20/22',null,null],
    ['Duckett','Teona','Montessori','GSRP - Blue','Assistant','2025-01-21','2024-04-15','2020-03-15','2025-10-16','2025-05-29','2025-06-12','2025-06-12','2023-10-31',null,null,null,'I/T CDA 10/13/25',null,null],
    ['Reeves','Stacy','Montessori','GSRP - Pink','Lead','2025-11-12','2024-04-15','2020-05-06','2025-10-22','2025-05-09','2023-05-23','2025-05-09','2023-10-31',null,'2025-08-25','2025-08-25','Preschool CDA + BA in family studies',null,null],
    ['Moore','Sarah','Montessori','GSRP - Pink','Assistant','2025-01-06','2024-04-15','2024-06-17','2025-10-10','2025-05-09','2021-05-17','2025-05-09','2023-10-30',null,null,null,'Preschool CDA 10/16/25',null,null],
    ['Rubenstein','Jessica','Montessori','Floaters','Floater','2025-05-20','2025-10-22','2024-06-14','2025-10-14','2025-05-09','2023-06-16','2025-05-09','2023-10-30',null,null,null,null,null,null],
    ['Balcazar','Itzel','Montessori','Floaters','Floater','2025-11-24','2024-04-15','2024-06-20','2025-09-15','2024-12-20','2022-04-14','2024-12-20','2023-11-01',null,null,null,null,null,null],
    ['Albertine','Tina','Montessori','Floaters','Floater','2026-01-21',null,null,null,'2026-02-04','2026-02-04','2026-02-05','2026-02-04',null,null,null,null,null,null],
  ];

  let spCount = 0;
  for (const s of sp) {
    const [last,first,center,classroom,role,...dates] = s;
    const empId = findEmp(last,first);
    if (!empId) { console.log(`  WARN SP: ${last}, ${first}`); continue; }
    const [ori,cpr,abc,ref,ccbc,fp,elig,abuse,eval2,prom,assign,edu,hrs2,it] = dates;
    await pool.query(
      `INSERT INTO staffing_plan (employee_id,center,classroom,role_in_room,orientation_date,cpr_first_aid_date,health_safety_abc_date,health_safety_refresher,ccbc_consent_date,fingerprinting_date,date_eligible,abuse_neglect_statement,last_evaluation,date_promoted_lead,date_assigned_room,education,semester_hours,infant_toddler_training)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [empId,center,classroom,role,ori||null,cpr||null,abc||null,ref||null,ccbc||null,fp||null,elig||null,abuse||null,eval2||null,prom||null,assign||null,edu||null,hrs2||null,it||null]
    );
    spCount++;
  }
  console.log(`✅ ${spCount} staffing plan entries`);
  console.log(`\n🎉 SEED COMPLETE: ${emps.length} employees, ${toCount} time-off, ${spCount} staffing plan`);
  process.exit(0);
}
seed().catch(e=>{console.error(e);process.exit(1)});
