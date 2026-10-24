// Gives an existing account the admin role (sign up in the app first).
//
// Usage: npm run make-admin -- you@example.com
import "dotenv/config";
import mysql from "mysql2/promise";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- you@example.com");
  process.exit(1);
}

const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });
try {
  const [result] = await connection.query("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
  if (result.affectedRows === 0) {
    console.error(`✖ No account with email ${email}. Sign up in the app first.`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${email} is now an admin`);
  }
} finally {
  await connection.end();
}
