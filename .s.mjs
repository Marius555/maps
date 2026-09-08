import { Client, TablesDB, Query } from "node-appwrite";
const db = new TablesDB(new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY));
const r = await db.listRows({ databaseId: process.env.DATABASE_ID, tableId: "mapSessions", queries: [Query.limit(20)] });
console.log(`mapSessions rows (= "Visits" on the dashboard): ${r.total}\n`);
for (const s of r.rows) {
  console.log(`row ${s.$id}`);
  console.log(`  startedAt ${s.startedAt}  host ${s.host}  ${s.eventCount} events`);
  for (const e of JSON.parse(s.events)) {
    const { t, o, ...rest } = e;
    console.log(`    +${String(o).padStart(7)}ms  ${t}${Object.keys(rest).length ? "  " + JSON.stringify(rest) : ""}`);
  }
}
