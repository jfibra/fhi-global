const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SUB_PATH = "c:\\Users\\User\\Downloads\\salesteam_subteam.json";
const TEAM_PATH = "c:\\Users\\User\\Downloads\\sales_team.json";
const OUR_PATH = path.join(__dirname, "..", "guides", "our_teams.json");

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

function normalize(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTimestamp(value) {
  const raw = value ? String(value).trim() : "";
  if (!raw || /^0{4}-0{2}-0{2}/.test(raw)) {
    return null;
  }
  if (/[+-]\d{2}:?\d{2}$/.test(raw)) {
    return raw;
  }
  return `${raw}+00`;
}

function loadTable(filePath, tableName) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const table = data.find((item) => item.name === tableName);
  if (!table) throw new Error(`table ${tableName} not found`);
  return table.data;
}

const subteams = loadTable(SUB_PATH, "salesteam_subteam");
const salesTeams = loadTable(TEAM_PATH, "sales_team");
const ourTeams = JSON.parse(fs.readFileSync(OUR_PATH, "utf-8"));

const nameToId = new Map();
ourTeams.forEach((team) => {
  if (team.name) {
    nameToId.set(normalize(team.name), team.id);
  }
});

const parentLookup = new Map();
salesTeams.forEach((team) => {
  if (team.id && team.teamname) {
    parentLookup.set(Number(team.id), team.teamname);
  }
});

const slugUsage = new Map();
ourTeams.forEach((team) => {
  if (team.slug) {
    slugUsage.set(team.slug, 1);
  }
});

function reserveSlug(base) {
  const normalized = base || "untitled";
  const current = slugUsage.get(normalized) ?? 0;
  if (current === 0) {
    slugUsage.set(normalized, 1);
    return normalized;
  }

  let suffix = current;
  let candidate;
  do {
    candidate = `${normalized}-${suffix}`;
    suffix += 1;
  } while (slugUsage.has(candidate));

  slugUsage.set(normalized, suffix);
  slugUsage.set(candidate, 1);
  return candidate;
}

const rows = [];
const missingParents = new Set();
subteams
  .slice()
  .sort((a, b) => Number(a.sid || 0) - Number(b.sid || 0))
  .forEach((row) => {
    const parentId = row.tteamID ? Number(row.tteamID) : null;
    const parentName = parentId ? parentLookup.get(parentId) : null;
    const normalizedParent = parentName ? normalize(parentName) : null;
    const parentUuid = normalizedParent ? nameToId.get(normalizedParent) : null;
    if (parentName && !parentUuid) {
      missingParents.add(parentName);
    }

    const baseSlug = slugify(row.teamName ?? "");
    rows.push({
      id: crypto.randomUUID(),
      name: row.teamName,
      slug: reserveSlug(baseSlug),
      parent_id: parentUuid,
      team_type: "subteam",
      is_active: row.status?.toLowerCase() === "active" ? "TRUE" : "FALSE",
      created: normalizeTimestamp(row.created_at),
      updated: normalizeTimestamp(row.updated_at),
    });
  });

console.log("-- INSERT statements for sales subteams")
console.log("INSERT INTO public.teams (id, name, slug, parent_id, team_type, is_active, created_at, updated_at) VALUES");
rows.forEach((row, idx) => {
  const createdValue = row.created ? `'${row.created}'` : "now()";
  const updatedReference = row.updated ?? row.created;
  const updatedValue = updatedReference ? `'${updatedReference}'` : "now()";
  const parent = row.parent_id ? `'${row.parent_id}'` : "NULL";
  const safeName = row.name?.replace(/'/g, "''") ?? "";
  const line = `  ('${row.id}', '${safeName}', '${row.slug}', ${parent}, '${row.team_type}', ${row.is_active}, ${createdValue}, ${updatedValue})${
    idx < rows.length - 1 ? "," : ";"
  }`;
  console.log(line);
});

if (missingParents.size) {
  console.error("\n-- Missing parent uuid for the following parent team names:");
  missingParents.forEach((name) => console.error(`-- ${name}`));
}
