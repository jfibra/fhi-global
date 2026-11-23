# FHI Global external API

Read-only JSON for FHI's own systems — first the cross-company AI chat for admins and agents (November 2026). Everything here runs on the service role behind one key; nothing is public.

## The key

Set `FHI_EXTERNAL_API_KEY` in Vercel (and `.env` locally) to a long random string, for example the output of `openssl rand -hex 32`. Send it on every request, either way:

```
Authorization: Bearer <key>
x-api-key: <key>
```

For a quick look in a browser the key may also go in the link, `?key=<key>`; code should send the header, since a key in a URL ends up in logs and browser history. Without the key the endpoints answer `401`; with no key configured on the server they answer `503`. Each IP gets 600 requests per 10 minutes.

`GET /api/external/users` predates the key and is still open, for Rentsouq's auto-login; it is not part of this set.

## GET /api/external/sales

The company's recorded sales. Amounts are AED.

| Parameter | Meaning |
|---|---|
| `from`, `to` | `YYYY-MM-DD`, by the sale's business date: the reservation date, else the day it was recorded. Inclusive. |
| `status` | `validated` (default — what the leaderboards and the admin panel count), `pending`, `invalid` or `all`. |
| `agent` | A profile id or an email. Returns the sales credited to that person, including shared deals where they are a partner. |
| `developer` | A developer id. |
| `project` | A project id or slug. |
| `since` | An ISO timestamp; only rows changed since then (`updated_at`), for incremental syncs. |
| `merchant` | A merchant id or code (`M-4K7Q`): the rentals that came through that merchant's QR (the Merchant Partnership Programme). |
| `type` | `project`, `brokerage` or `rental`. |
| `page`, `limit` | Paging; `limit` ≤ 100, default 50. Newest first. |

```
curl -H "Authorization: Bearer $KEY" \
  "https://fhiglobal.ae/api/external/sales?from=2026-01-01&to=2026-11-30&status=validated&limit=5"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "business_date": "2026-10-01",
      "reservation_date": "2026-10-01",
      "recorded_at": "2026-10-03T08:12:00+00:00",
      "updated_at": "2026-10-05T10:00:00+00:00",
      "validation_status": "validated",
      "commission_status": "pending",
      "leader_confirmed_at": null,
      "currency": "AED",
      "contract_price": 2016960,
      "unit": { "number": "1804", "block": null, "lot": null, "area_sqft": 1210, "price_per_sqft": 1667, "project_unit_id": null },
      "payment": { "plan": "60/40", "terms": null },
      "developer": { "id": "…", "name": "Azizi Developments" },
      "project": { "id": 123, "name": "Azizi Venice", "slug": "azizi-venice" },
      "agent": { "id": "…", "name": "Maria Santos" },
      "credits": [
        { "id": "…", "name": "Maria Santos", "share_percent": 50, "value": 1008480 },
        { "id": "…", "name": "Ahmed Al Marri", "share_percent": 50, "value": 1008480 }
      ],
      "client": { "id": "…", "name": "Juan Dela Cruz" },
      "remarks": null
    }
  ],
  "summary": { "count": 143, "value": 212400000, "currency": "AED" },
  "meta": { "total": 143, "page": 1, "limit": 5, "filters": { "from": "2026-01-01", "to": "2026-11-30", "status": "validated", "agent": null, "developer": null, "project": null, "since": null } }
}
```

`summary` covers the whole filter, not just the page. `credits` is who the sale counts for and how much: a solo sale is its agent at 100%; a shared deal lists every partner with their share. The client is named only; no contact details leave the system through this endpoint.

Since 2026-11-20 each sale also carries `sale_type` (`project`, `brokerage` or `rental`), `property` (`{ type, address }` for brokerage and rental deals, else null) and `merchant` (`{ id, name, code }` when a rental came through a merchant's QR, else null).

## GET /api/external/sales/top

The leaderboards, computed the way the dashboards and FHI's assistant compute them, so every surface quotes the same numbers.

| Parameter | Meaning |
|---|---|
| `by` | `agents` (default), `developers`, `projects` or `teams`. |
| `from`, `to` | `YYYY-MM-DD`, inclusive, by business date. Omit both for all time. |
| `developer` | A developer id or slug; narrows the agents or projects board. |
| `project` | A project id or slug; narrows the agents board. |
| `limit` | Rows, up to 100. Default 10. |

```
curl -H "Authorization: Bearer $KEY" "https://fhiglobal.ae/api/external/sales/top?by=agents&from=2026-01-01&to=2026-12-31&limit=3"
```

```json
{
  "success": true,
  "by": "agents",
  "period": { "from": "2026-01-01", "to": "2026-12-31" },
  "data": [
    { "rank": 1, "id": "…", "name": "Michelle & Carlos Guinto", "slug": null, "image": "https://…", "deals": 15, "value": 11264125, "currency": "AED" },
    { "rank": 2, "id": "…", "name": "Malou Prado", "slug": null, "image": null, "deals": 3, "value": 2100000, "currency": "AED" }
  ],
  "meta": { "sales_counted": 29, "filters": { "developer": null, "project": null }, "rules": "Validated sales only; a shared deal credits each agent their share of the price." }
}
```

Rules: validated sales only; `agents` credits a shared deal to each agent by share; `developers` and `projects` count every sale once in full; `teams` ranks top-level teams, each including its subteams at any depth, with each team credited its members' shares and a deal shared inside one team counted once. For `teams` the response also carries `subteams`, listed apart; their figures are already inside their parent's and must never be added again. `members` on a team row is its active member count.

## GET /api/external/sales/summary

The period figures the boss's daily, weekly and monthly reports and FHI's assistant give.

| Parameter | Meaning |
|---|---|
| `from`, `to` | `YYYY-MM-DD`, inclusive, by business date. Omit both for all time; the breakdown then covers the last 12 months. |
| `group` | `month` (default), `quarter` or `year` for the breakdown. |
| `developer`, `project` | An id or slug; narrows the figures. |
| `agent` | A profile id or email; that agent's own figures, each deal at their share. |

```
curl -H "Authorization: Bearer $KEY" "https://fhiglobal.ae/api/external/sales/summary?from=2026-01-01&to=2026-12-31&group=month"
```

```json
{
  "success": true,
  "period": { "from": "2026-01-01", "to": "2026-12-31" },
  "currency": "AED",
  "validated": { "deals": 29, "value": 25863298 },
  "pending": { "deals": 0, "value": 0 },
  "other_statuses": { "rejected": 2 },
  "all_statuses_count": 31,
  "previous_period": {
    "from": "2025-01-01", "to": "2025-12-31",
    "validated": { "deals": 61, "value": 50200000 },
    "pending": { "deals": 0, "value": 0 },
    "change": { "validated_deals": "-52%", "validated_value": "-48%" }
  },
  "breakdown": { "group": "month", "rows": [ { "period": "2026-01", "validated_deals": 3, "validated_value": 2900000, "pending_deals": 0, "pending_value": 0 } ] },
  "meta": { "filters": { "developer": null, "project": null, "agent": null }, "rules": "Company figures: every sale counts once, in full; …" }
}
```

Company figures count every sale once, in full, shared or not. `previous_period` is the equal-length span just before `from`, present only when a period was given. With `agent`, every value is that agent's share of the deal, the way their own dashboard counts.

## GET /api/external/teams

| Parameter | Meaning |
|---|---|
| `q`, `id`, `slug` | Find a team by name words, id or slug. |
| `status` | `active` (default) or `all`. |
| `from`, `to` | `YYYY-MM-DD`, inclusive; the period for the sales figures. Omit for all time. |
| `include` | `members` adds the member list, subteams included, up to 1000. |
| `page`, `limit` | Paging; `limit` ≤ 100, default 50. By name. |

```
curl -H "Authorization: Bearer $KEY" "https://fhiglobal.ae/api/external/teams?q=mcg&include=members&from=2026-01-01&to=2026-12-31"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "name": "MCG Properties",
      "slug": "mcg-properties",
      "description": null,
      "logo_url": "https://…",
      "type": "department",
      "active": true,
      "parent": null,
      "subteams": [],
      "leader": { "id": "…", "name": "Michelle & Carlos Guinto", "role": "team_leader", "role_label": "Team Leader", "status": "active", "avatar_url": "https://…", "role_in_team": "Team Leader", "joined_at": "2026-10-02T06:00:00+00:00" },
      "members_count": { "own": 598, "with_subteams": 598 },
      "sales": { "validated_deals": 26, "validated_value": 22921410, "currency": "AED", "period": { "from": "2026-01-01", "to": "2026-12-31" } },
      "members": [ { "id": "…", "name": "Agnes Jones", "role": "agent", "role_label": "Agent", "status": "active", "avatar_url": null, "role_in_team": "member", "joined_at": "2026-10-02T06:00:00+00:00", "team_id": "…", "team_name": "MCG Properties" } ],
      "created_at": "2026-10-02T06:00:00+00:00"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 50, "filters": { "q": "mcg", "status": "active", "from": "2026-01-01", "to": "2026-12-31", "include": "members" }, "rules": "…" }
}
```

A team's sales include its subteams at any depth; each team is credited its members' shares and a deal shared inside one team counts once, like the Teams page and the top-teams board. The leader is the active member whose role in the team reads like a leader (lead, head).

## GET /api/external/events

| Parameter | Meaning |
|---|---|
| `when` | `upcoming` (default), `past` or `all`. An event is past once its last day has started. |
| `from`, `to` | `YYYY-MM-DD`; by the first day. |
| `status` | `published` (default), `draft` or `all`. |
| `host` | `company`, `agents` or `all` (default). |
| `agent` | A profile id; that agent's events. |
| `q`, `id`, `slug` | Find an event by title words, id or slug. |
| `include` | `days` adds per-day seats; one lookup per event, so 50 events at most. |
| `page`, `limit` | Paging; `limit` ≤ 100, default 50. Upcoming soonest first, past latest first. |

```
curl -H "Authorization: Bearer $KEY" "https://fhiglobal.ae/api/external/events?when=upcoming&include=days"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "title": "BE THE LANDLORD: How OFWs earn rental income in Dubai",
      "slug": "be-the-landlord-how-ofws-earn-rental-income-in-dubai",
      "url": "https://fhiglobal.ae/events/be-the-landlord-how-ofws-earn-rental-income-in-dubai",
      "status": "published",
      "registration_open": true,
      "when": { "start": "2026-11-21T09:00:00+00:00", "first_day": "2026-11-21", "last_day": "2026-11-22", "days": 2, "schedule": [ { "day": 1, "date": "2026-11-21", "time": "13:00", "start": "2026-11-21T09:00:00.000Z" }, { "day": 2, "date": "2026-11-22", "time": "13:00", "start": "2026-11-22T09:00:00.000Z" } ], "past": false },
      "venue": { "name": "13th Floor, Azizi Developments, Conrad Hotel, Sheikh Zayed Road", "latitude": 25.21, "longitude": 55.27 },
      "host": { "type": "agent", "id": "…", "name": "Michelle & Carlos Guinto" },
      "shown_on": { "fhiglobal": true, "website": true, "website_slug": "michelle-guinto" },
      "registrations": { "total": 12, "per_day": [ { "day": 1, "limit": 60, "taken": 12, "left": 48, "full": false }, { "day": 2, "limit": 60, "taken": 5, "left": 55, "full": false } ] },
      "engagement": { "views": 5, "qr_scans": 0 },
      "brand": "fhiglobal",
      "image": "https://…",
      "description": "…",
      "created_at": "2026-11-01T08:00:00+00:00",
      "updated_at": "2026-11-10T08:00:00+00:00"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 50, "filters": { "when": "upcoming", "status": "published", "host": "all", "agent": null, "from": null, "to": null, "q": null, "include": "days" } }
}
```

`host.type` is `company` for FHI's own events and `agent` for an agent's. `url` is the fhiglobal.ae page when the event is shown there, else the agent's website page; a draft shown nowhere has none. Times are Dubai.

## GET /api/external/agents

The agents' accounts, with their team and sales totals.

| Parameter | Meaning |
|---|---|
| `role` | `agent`, `team_leader`, `unit_manager`, `global_partner`, or `all` for every role. Default: every selling role. |
| `status` | `active` (default), `pending`, `inactive`, or `all`. |
| `team` | A team id; members of that team and its subteams. |
| `q` | Words to match in the name or email. |
| `id`, `email` | One person. |
| `page`, `limit` | Paging; `limit` ≤ 100, default 50. By name. |

```
curl -H "Authorization: Bearer $KEY" "https://fhiglobal.ae/api/external/agents?q=santos"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "name": "Maria Santos",
      "first_name": "Maria",
      "last_name": "Santos",
      "email": "maria@example.com",
      "phone": "+971 50 000 0000",
      "role": "agent",
      "role_label": "Agent",
      "status": "active",
      "joined_at": "2026-03-02T09:00:00+00:00",
      "avatar_url": "https://…",
      "team": { "id": "…", "name": "CMG Properties", "role_in_team": "member" },
      "invited_by": "…",
      "sales": { "validated_deals": 4, "validated_value": 6100000, "pending_deals": 1, "last_sale_date": "2026-10-01", "currency": "AED" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 50, "filters": { "role": "selling", "status": "active", "team": null, "q": "santos" } }
}
```

`sales` counts the person's share of each deal, the same way the leaderboards do, so a 50/50 deal adds half its price to each partner. `invited_by` is the recruiter's profile id, usable as `id` on this endpoint.

## GET /api/external/projects

The live projects, with the same rules as the public site: published, active, not deleted, not a test record.

| Parameter | Meaning |
|---|---|
| `developer` | A developer id or slug. |
| `stage` | `pre_launch`, `launch`, `under_construction` or `completed`. |
| `area` | Words to match in the community, sub-community, location, region or city. |
| `handover` | A year; projects whose handover quarter (else expected completion) falls in it. |
| `q` | Words to match in the name. |
| `id`, `slug` | One project. |
| `since` | An ISO timestamp; only rows changed since then. |
| `page`, `limit` | Paging; `limit` ≤ 100, default 50. By name. |

```
curl -H "Authorization: Bearer $KEY" "https://fhiglobal.ae/api/external/projects?handover=2027&limit=2"
```

```json
{
  "success": true,
  "data": [
    {
      "id": 392,
      "name": "Damac Riverside",
      "slug": "damac-riverside",
      "url": "https://fhiglobal.ae/projects/damac-riverside",
      "stage": "under_construction",
      "developer": { "id": "…", "name": "Damac Properties", "slug": "damac-properties", "logo_url": "https://…" },
      "where": { "community": "Dubai Investments Park", "sub_community": null, "location": "Dubai Investments Park 2", "region": "Dubai", "city": "Dubai", "country": "UAE", "latitude": 24.98, "longitude": 55.17 },
      "price": { "from": 1250000, "launch_from": 888000, "launch_to": 3200000, "currency": "AED" },
      "payment": { "down_payment_percent": 20, "plan": "70/30", "installments": true },
      "dates": { "launch": "2025-09-01", "construction_start": "2025-11-01", "expected_completion": "2027-12-31", "handover": null, "handover_quarter": "Q4 2027", "handover_label": "Q4 2027" },
      "size": { "buildings": 4, "units": 1200, "floors": 12 },
      "returns": { "expected_roi": 8.5, "rental_yield": 7 },
      "ownership": { "freehold": true, "type": "freehold", "direct_from_developer": true },
      "units": [
        { "id": "…", "type": "Apartment", "layout": "1 Bedroom", "bedrooms": 1, "bathrooms": 2, "size_sqft": 780, "size_sqm": 72.5, "price_from": 1250000, "price_to": 1600000, "available_units": 40, "available": true }
      ],
      "media": { "image": "https://…", "video": null },
      "featured": true,
      "published_at": "2025-09-02T10:00:00+00:00",
      "updated_at": "2026-10-20T08:00:00+00:00"
    }
  ],
  "meta": { "total": 61, "page": 1, "limit": 2, "filters": { "developer": null, "stage": null, "area": null, "handover": 2027, "q": null, "since": null } }
}
```

`price.from` is the starting price the site itself shows: the headline launch price, unless the project's own unit table proves it is a placeholder, in which case the cheapest real unit. `dates.handover_label` is derived from `handover_quarter`, else the expected completion date.

## GET /api/external/developers

| Parameter | Meaning |
|---|---|
| `q` | Words to match in the name. |
| `id`, `slug` | One developer. |
| `page`, `limit` | Paging; `limit` ≤ 100, default 50. By name. |

```
curl -H "Authorization: Bearer $KEY" "https://fhiglobal.ae/api/external/developers?q=emaar"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "name": "Emaar Properties",
      "slug": "emaar-properties",
      "url": "https://fhiglobal.ae/developers/emaar-properties",
      "logo_url": "https://…",
      "description": "…",
      "contact": { "website": "https://www.emaar.com", "phone": null, "email": null, "address": null },
      "verified": true,
      "rating": 4.8,
      "live_projects": 14,
      "updated_at": "2026-09-01T09:00:00+00:00"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 50, "filters": { "q": "emaar" } }
}
```

## GET /api/external/merchants

The Merchant Partnership Programme (`guides/merchants.md`): businesses signed by the agents that show a QR for rentsouq.ae and earn AED 100 per rented unit; the agent who signed them earns AED 100 too. rentsouq.ae shows each merchant its dashboard from this. **Bank details are never returned.**

| Parameter | Meaning |
|---|---|
| `status` | `accepted` (default), `submitted` (all four documents in, waiting for FHI), `onboarding`, `declined`, `ended` or `all`. |
| `agent` | A profile id; the merchants that agent signed. |
| `code` | One merchant by its code, like `M-4K7Q`. |
| `id`, `q` | One merchant by id, or words to match in the name or code. |
| `include` | `deals` — adds the period figures, the statement and the newest rentals (50 merchants at most per page). |
| `page`, `limit` | Paging; `limit` ≤ 100, default 50. Newest first. |

```
GET /api/external/merchants?status=accepted&include=deals
GET /api/external/merchants?code=M-4K7Q&include=deals
```

Each row:

```json
{
  "id": "…", "code": "M-4K7Q", "business_name": "Bayt Al Noor Restaurant", "category": "Restaurant",
  "address": "Shop 4, Al Barsha Mall, Al Barsha 1", "emirate": "Dubai", "website": null, "status": "accepted",
  "agreement": { "starts_on": "2026-11-20", "ends_on": "2027-11-19", "active": true },
  "agent": { "id": "…", "name": "Michelle Guinto", "email": "…", "phone": "+971…" },
  "contact": { "name": "Khalid Al Mansoori", "title": "Owner", "email": "…", "whatsapp": "+971…", "account_id": "<the merchant's FHI login id>" },
  "voucher": "15% off any meal for two",
  "qr": { "url": "https://fhiglobal.ae/m/M-4K7Q", "landing": "https://rentsouq.ae/?ref=M-4K7Q" },
  "documents": { "complete": true },
  "scans": { "this_month": 212, "total": 1140 },
  "deals": { "validated_this_month": 5, "validated_total": 5 },
  "incentives": { "merchant_per_deal": 100, "agent_per_deal": 100, "merchant_this_month": 500, "agent_this_month": 500, "currency": "AED" },
  "figures": { "month": { "validated": 5, "pending": 1, "invalid": 0, "merchant_incentive": 500, "agent_incentive": 500 }, "last_month": { … }, "all_time": { … },
               "statement": { "month_key": "2026-11", "label": "November 2026", "validated": 5, "merchant_amount": 500, "agent_amount": 500, "merchant_pay_date": "15 Dec 2026", "agent_pay_date": "10 Dec 2026" } },
  "recent_deals": [ { "id": "<sale id>", "date": "2026-11-14", "unit": "Apartment · Unit 1203 · Marina Gate 2", "validation_status": "validated", "contract_price": 95000, "agent": { "id": "…", "name": "…" }, "merchant_incentive": 100, "agent_incentive": 100 } ],
  "accepted_at": "…", "created_at": "…", "updated_at": "…"
}
```

`figures` and `recent_deals` come only with `include=deals`. `contact.account_id` is the merchant's FHI login, the same id the users route gives rentsouq.ae for auto-login. A closed deal is a **validated** Rental sale on FHI tagged with the merchant (`sales[].merchant` on the sales endpoint, `sales?merchant=M-4K7Q`); the QR opens `fhiglobal.ae/m/<code>`, which counts the scan and forwards to rentsouq.ae with `?ref=<code>`.

## Connect Claude directly (MCP)

Every endpoint above is also a tool Claude can call while someone chats with it, through FHI's MCP server at `https://fhiglobal.ae/api/mcp` (`app/api/mcp/route.ts`, `lib/mcp/server.ts`). It speaks MCP over Streamable HTTP, statelessly, and takes the **same key** as the API, sent as `Authorization: Bearer <key>`. Every tool is read-only: each one is a GET of the matching endpoint, run in-process with the caller's key, so the filters, the rules and the rate limit are exactly the API's. The tool descriptions are generated from `lib/api-catalog.ts`.

| Tool | Endpoint |
|---|---|
| `fhi_sales` | `/api/external/sales` |
| `fhi_top_sellers` | `/api/external/sales/top` |
| `fhi_sales_summary` | `/api/external/sales/summary` |
| `fhi_accounts` | `/api/external/agents` |
| `fhi_projects` | `/api/external/projects` |
| `fhi_developers` | `/api/external/developers` |
| `fhi_teams` | `/api/external/teams` |
| `fhi_events` | `/api/external/events` |
| `fhi_merchants` | `/api/external/merchants` |

Where to plug it in:

- **claude.ai** — Customize → Connectors → Add → Add custom connector: name `FHI Global`, URL `https://fhiglobal.ae/api/mcp`, no sign-in, and a request header `Authorization` = `Bearer <key>`. On a Team or Enterprise plan the organisation owner adds it under Organization settings → Connectors and members click Connect.
- **Claude Code** — `claude mcp add --transport http fhi https://fhiglobal.ae/api/mcp --header "Authorization: Bearer <key>"`, then `/mcp` shows it connected.
- **FH ONE (Messages API)** — the MCP connector: `mcp_servers: [{ type: "url", url: "https://fhiglobal.ae/api/mcp", name: "fhi", authorization_token: "<key>" }]` plus `tools: [{ type: "mcp_toolset", mcp_server_name: "fhi" }]` with the beta header `mcp-client-2025-11-20`.

The handshake and the tool list are open (claude.ai probes a "no sign-in" connector without credentials and refuses to add it on a 401); every tool call needs the key and answers with a plain message saying where to put it when it is missing. The key can also ride on the server URL as `?key=<key>` for a client that cannot send headers. With no key configured on the server the tools answer 503. Anyone holding the key sees everything the key sees, so give it only to accounts that may read sales and client names.

## Joining them

`sales[].agent.id` and `sales[].credits[].id` are `agents[].id`. `sales[].project.id` is `projects[].id`, and `projects[].developer.id`, `sales[].developer.id` are `developers[].id`. Email is the key to match a person across the other company sites.
