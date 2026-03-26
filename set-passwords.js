const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function run() {
  // Set unique passwords for each user
  const passwords = {
    jared:   'TCC-Jared2026!',
    amy:     'TCC-Amy2026!',
    gabby:   'TCC-Gabby2026!',
    kirsten: 'TCC-Kirsten2026!',
    shari:   'TCC-Shari2026!'
  };

  console.log('Setting unique passwords...\n');
  
  for (const [username, password] of Object.entries(passwords)) {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2',
      [hash, username]
    );
    if (result.rowCount > 0) {
      console.log('  ' + username.padEnd(10) + ' -> ' + password);
    } else {
      console.log('  ' + username.padEnd(10) + ' -> NOT FOUND');
    }
  }

  console.log('\nDone! Share these passwords securely with each person.');
  console.log('Users can change their password in the app under Settings.');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
