
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('/usr/src/app/sqlite.db');

db.run("UPDATE users SET email_verified = 1 WHERE email IN ('security_test1@test.com', 'security_test2@test.com')", (err) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('✅ Test users verified');
  }
  db.close();
});
