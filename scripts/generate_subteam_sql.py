import json
import uuid
import re
from pathlib import Path

BASE_DIR = Path("D:/Reboot/FHIGlobal")
SUB_PATH = Path(r"c:\Users\User\Downloads\salesteam_subteam.json")
TEAM_PATH = Path(r"c:\Users\User\Downloads\sales_team.json")
OUR_PATH = BASE_DIR / "guides" / "our_teams.json"


def slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-") or "untitled"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


subteams_data = next(item for item in load_json(SUB_PATH) if item.get("name") == "salesteam_subteam")
subteams = subteams_data["data"]
team_data = next(item for item in load_json(TEAM_PATH) if item.get("name") == "sales_team")
sales_teams = {int(row["id"]): row for row in team_data["data"] if row.get("id")}
our_teams = load_json(OUR_PATH)

name_to_id = {}
for row in our_teams:
    name = row.get("name")
    if name:
        normalized = re.sub(r"\s+", " ", name.strip().lower())
        name_to_id[normalized] = row["id"]


def normalize(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())

insert_rows = []
missing_parents = set()

for row in sorted(subteams, key=lambda x: int(x.get("sid", "0"))):
    tteam_id = row.get("tteamID")
    parent_uuid = None
    parent_name = None
    if tteam_id:
        sales = sales_teams.get(int(tteam_id))
        if sales:
            parent_name = sales.get("teamname")
            normalized = normalize(parent_name)
            parent_uuid = name_to_id.get(normalized)
    if parent_name and not parent_uuid:
        missing_parents.add(parent_name)
    team_uuid = uuid.uuid4()
    slug = slugify(row.get("teamName", ""))
    created = row.get("created_at")
    updated = row.get("updated_at")
    status = row.get("status", "").lower()
    is_active = "TRUE" if status == "active" else "FALSE"
    team_type = "subteam"
    insert_rows.append((team_uuid, row.get("teamName"), slug, parent_uuid, team_type, is_active, created, updated))

print("-- Generated INSERT for subteams")
print("INSERT INTO public.teams (id, name, slug, parent_id, team_type, is_active, created_at, updated_at) VALUES")
for idx, (team_uuid, name, slug, parent_id, team_type, is_active, created, updated) in enumerate(insert_rows):
    name_sql = name.replace("'", "''") if name else ""
    parent_sql = f"'{parent_id}'" if parent_id else "NULL"
    created_sql = f"'{created}+00'" if created else "now()"
    updated_sql = f"'{updated}+00'" if updated else "now()"
    line = f"    ('{team_uuid}', '{name_sql}', '{slug}', {parent_sql}, '{team_type}', {is_active}, {created_sql}, {updated_sql})"
    line += "," if idx < len(insert_rows) - 1 else ";"
    print(line)

if missing_parents:
    print("\n-- Missing parent UUIDs for:")
    for name in sorted(missing_parents):
        print(f"-- {name}")
