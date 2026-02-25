const fs = require("fs");
const path = require("path");
const subPath = "c:\\Users\\User\\Downloads\\salesteam_subteam.json";
const teamPath = "c:\\Users\\User\\Downloads\\sales_team.json";

function loadTable(filePath, tableName) {
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const table = doc.find((item) => item.name === tableName);
  if (!table) {
    throw new Error(`table ${tableName} not found`);
  }
  return table.data;
}

const subteams = loadTable(subPath, "salesteam_subteam");
const teams = loadTable(teamPath, "sales_team");
const lookup = new Map(
  teams
    .filter((team) => team.id)
    .map((team) => [Number(team.id), team.teamname.trim()])
);

console.log("Subteam | Parent ID | Parent Team");
console.log("--- | --- | ---");
const missing = new Set();
subteams
  .slice()
  .sort((a, b) => Number(a.sid || 0) - Number(b.sid || 0))
  .forEach((sub) => {
    const pid = Number(sub.tteamID || 0);
    const parent = lookup.get(pid);
    if (parent === undefined) {
      missing.add(pid);
    }
    console.log(`${sub.teamName} | ${pid} | ${parent ?? "UNKNOWN"}`);
  });
if (missing.size) {
  console.log("\nMissing parent IDs:", [...missing].sort((a, b) => a - b).join(", "));
}
