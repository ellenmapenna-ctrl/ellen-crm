import pg from "pg";
import { readFileSync } from "node:fs";

const file = process.argv[2];
const sql = readFileSync(file, "utf-8");
const client = new pg.Client({
  host: `db.${process.env.SB_REF}.supabase.co`,
  port: 5432,
  user: "postgres",
  password: process.env.SB_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(sql);
console.log(`Aplicado: ${file}`);
await client.end();
