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

And, since 2026-11-23, the admin FHI Assistant's read-only tools under the prefix `fhi_assistant_` — the same functions the admin chat runs, with their own names, descriptions and parameters (`lib/fhi-chat-tools.ts`): `website_traffic` (Google Analytics: visitors, sources, countries, devices, pages, the day-by-day trend, who is on the site now), `search_keywords` (Search Console), `leads_overview`, `sales_pipeline`, `support_tickets`, `company_purchases`, `agent_websites`, `listings_overview`, `clients_overview`, `agent_reviews`, `activity_log`, `activity_feed`, `member_lookup`, `owner_documents`, `teams_detail`, `event_engagement`, `event_attendees`, `events_overview`, `news_overview`, `data_health`, `platform_counts`, `new_accounts`, `recent_sales`, `agent_sales`, `agent_recruits`, `agent_network`, `developer_overview`, `projects_stats`, `project_details`, `find_projects`, `top_agents`, `top_developers`, `top_teams`, `sales_summary`, `upcoming_birthdays`. The tools that act — posters, business cards, emails — are never exposed. These answers include lead and client contact details, so the key is admin-level reading.

Where to plug it in:

- **claude.ai** — Customize → Connectors → Add → Add custom connector: name `FHI Global`, URL `https://fhiglobal.ae/api/mcp`, no sign-in, and a request header `Authorization` = `Bearer <key>`. On a Team or Enterprise plan the organisation owner adds it under Organization settings → Connectors and members click Connect.
- **Claude Code** — `claude mcp add --transport http fhi https://fhiglobal.ae/api/mcp --header "Authorization: Bearer <key>"`, then `/mcp` shows it connected.
- **FH ONE (Messages API)** — the MCP connector: `mcp_servers: [{ type: "url", url: "https://fhiglobal.ae/api/mcp", name: "fhi", authorization_token: "<key>" }]` plus `tools: [{ type: "mcp_toolset", mcp_server_name: "fhi" }]` with the beta header `mcp-client-2025-11-20`.

The handshake and the tool list are open (claude.ai probes a "no sign-in" connector without credentials and refuses to add it on a 401); every tool call needs the key and answers with a plain message saying where to put it when it is missing. The key can also ride on the server URL as `?key=<key>` for a client that cannot send headers. With no key configured on the server the tools answer 503. Anyone holding the key sees everything the key sees, so give it only to accounts that may read sales and client names.

### Claude for agents and team leaders (sign-in, 2026-11-24)

A second address, `https://fhiglobal.ae/api/mcp/me` (`app/api/mcp/me/route.ts`), is for a person's **own** Claude: no key, their FHI login. In claude.ai (on a computer): Plugins → Connectors → Add → Add custom connector (the menu is "Customize" on some accounts), name `FHI Global`, MCP server URL `https://fhiglobal.ae/api/mcp/me`, Continue — the form asks nothing else. Once added on the web it also works in the Claude phone app. Claude sends them to `https://fhiglobal.ae/oauth/authorize`; signed out, they get the staff sign-in first (email + password, or Google — `next` brings them back); signed in, a consent screen lists what their role gets and they press **Allow**. From then on every tool call carries a pass FHI issued to that login and runs as that person:

- **Agents and team leaders** get the agent FHI Assistant's tools, read-only, as `fhi_<name>` (`lib/mcp/personal.ts`): `my_sales`, `top_sales_board`, `person_sales`, `find_projects`, `project_details`, `news_overview`, `my_leads`, `client_note` (list / find), `reminder` (list), `my_goal` (get), `my_listings`, `my_website`, `my_reviews`, `my_recruits`, `my_events`; team leaders add `my_team` and `team_attention`. They are identity-bound — "my sales" is always the caller's, the team tools refuse a non-leader, another person's amounts are not in what they return — so a connected Claude cannot read anyone else's record. The tools that write, build a PDF or call the chat model themselves (`mark_lead_contacted`, `member_message`, `client_message`, `project_brochure`, `project_comparison`, `my_report`) are not exposed; the note, reminder and goal tools refuse their write actions with a message pointing to the dashboard assistant.
- **Admin staff** signing in get the admin server above (the key's 44 tools), with the server's own key — and, when they left the box ticked on the consent screen, the four event tools below.
- Any other role is told on the consent screen that Claude tools are not available for the account yet (`MCP_SIGN_IN_ROLES` in `lib/oauth/server.ts`).

Under the hood it is OAuth 2.1 as the MCP authorization spec asks (`lib/oauth/server.ts`, routes under `app/api/oauth/*`, tables in migration 093, service role only): a request without a pass is answered `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/api/mcp/me"`; the discovery files `/.well-known/oauth-protected-resource[/api/mcp/me]`, `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration` are rewrites in `next.config.mjs` to `app/api/oauth/{protected-resource,metadata}`; dynamic client registration at `POST /api/oauth/register` accepts only Claude's callback (`https://claude.ai/api/mcp/auth_callback`, `https://claude.com/…`) and loopback addresses as `redirect_uris` (Claude's published client-id metadata document is accepted too); PKCE S256 is required; `POST /api/oauth/token` exchanges the one-time code (10 minutes, burned on first use) for an access pass (1 hour) and a refresh pass (90 days, rotated on every renewal); `POST /api/oauth/revoke` closes the connection. Every call re-reads the account (active, allowed role), is limited to 300 calls per 10 minutes per connection, and the connection's `last_used_at` is kept. Connecting and disconnecting are written to the audit log under `claude_sign_in`.

Where people manage it: **Connect Claude** in the agent and team leader dashboards (`/agent/connect-claude`, `/teamleader/connect-claude`, `features/dashboard/connect-claude`) shows the three steps, the address with Copy, the connections with **Disconnect** (`GET /api/account/connected-apps`, `DELETE /api/account/connected-apps/[id]`); admins see every sign-in with who it belongs to on the API page and can disconnect anyone (`GET /api/admin/connected-apps`, `DELETE …/[id]`). A deactivated account is refused on its very next call. Claude Code: `claude mcp add --transport http fhi-me https://fhiglobal.ae/api/mcp/me`, then `/mcp` → sign in. The key connector at `/api/mcp` is unchanged and still the way for the boss's and the owner's Claude and for FH ONE.

### Events from Claude (admins, agents and team leaders, 2026-11-27)

The one place FHI's MCP server **writes**. A person signed in at `/api/mcp/me` can make an event by talking — admin staff a **company** event, an agent or team leader one of **their own**: "Create an event: Open House at Azizi Venice, 12 December 2026, 3 pm, 50 seats", "Make it like the last orientation, on 15 January", "Write the description from these notes", "Publish it". Code: `lib/mcp/events.ts` (the tools), `lib/events/write.ts` (`createEvent` / `updateEvent` — the same functions the dashboard routes `app/api/admin/events` and `…/[id]` call, so slug, audit row, page purges and IndexNow are identical).

Who gets the tools — all three, re-checked on every call:

1. the signed-in endpoint only (`/api/mcp/me`); the key connector at `/api/mcp` never has them, because no person is behind a key;
2. a role that runs events in the dashboard (`canUseEventsArea`): admin staff for company events (`canManageEvents`), agents and team leaders for their own (`canManageOwnEvents`; unit managers and Global Partners run their own events too, but cannot sign in to the connector yet);
3. the connection carries the scope `fhi:events` (`OAUTH_SCOPE_EVENTS` in `lib/oauth/server.ts`): the consent screen shows such a role a ticked box — "Create, change and publish company events" for admin staff, "…your own events" for agents and team leaders (`eventsScopeLabel`); unticked, or connected before 2026-11-27, the connection is reading-only (`fhi:read`) until the connector is removed and added again. The scope is decided from the role and the box (`grantedScope`), never from what the app asked for, and is stored on `oauth_grants.scope` (no migration: the column was there).

**Whose events (the dashboard's two tiers, `lib/events/access.ts`).** The route hands the tools a writer with a `scope`:

- `all` — admin staff, through `buildFhiMcpServer`. They create and change **company** events. An agent's own event can be read and copied from, never changed; a reference is looked up among company events first, so an agent's event with the same words cannot make it ambiguous.
- `own` — an agent or team leader, through `buildPersonalMcpServer`. Every lookup (id, slug, link, title words — for the target and for `copy_from` / `venue_from` / `photo_from`) is pinned to `agent_id = their id` inside `findEvents`, so a company event or another person's event answers "None of your events matches", as if it did not exist. They also get `where` (`fhiglobal`, `website`, `both`): where the event appears, the dashboard's own choice (074) — both when they have a Website Builder site and said nothing, fhiglobal.ae otherwise; `placementIssue` refuses the website without a site. The answer carries `appears_on`, and `public_page` is the website page for a website-only event.

| Tool | What it does |
|---|---|
| `fhi_event_create` | A **draft** company event. Needs title, date (`YYYY-MM-DD`, Dubai) and start time (`HH:MM`, Dubai); when one is missing nothing is saved and the answer says what to ask. Optional: `days`, `day_times`, `seats` or `seats_per_day`, `venue`, `description`, `brand`, `video_url`, `registration_open`. `copy_from` (an id, or words from a title — the most recent match) brings a past event's description, brand, cover photo, venue with its map pin, sign-up fields, certificate settings, days, seats and start time; `venue_from` / `photo_from` bring just the venue + pin, or just the photo. |
| `fhi_event_update` | Changes a draft: send only the fields that change. A live event is refused (unpublish first, or the dashboard). A typed venue removes the old map pin. More days keep the seat limit when every day had the same one. |
| `fhi_event_publish` | `action: "publish"` puts a draft live — refused, with the list, unless it has an upcoming date, a venue and a description (photo and map pin are reminders only). `action: "unpublish"` takes a live event back to draft; registrations are kept. |
| `fhi_event_check` | Reads one event (any status) with what is still missing; with no `event`, the company's drafts and upcoming live events. Read-only. |

**The card (2026-11-27).** The person does not only read Claude's sentence: each of the four tools shows an event card in the chat — cover photo, Draft / Live badge, title, date, venue with its map-pin state, seats, what is still missing, an **Open in dashboard** button (and **View page** once live). It is an MCP App (`lib/mcp/event-card.ts`): the tools carry `_meta.ui.resourceUri = ui://fhi-global/event-card-v1` (plus the flat `ui/resourceUri` older hosts read), Claude fetches that resource once (`resources/read`, MIME `text/html;profile=mcp-app`) and renders it in a sandboxed frame, then hands it every tool result.

- One self-contained HTML page, no library and no build step. It speaks the Apps protocol itself (JSON-RPC over `postMessage`: `ui/initialize`, `ui/notifications/initialized`, `ui/notifications/tool-result` in, `ui/notifications/size-changed` and `ui/open-link` out; answers `ping` and `ui/resource-teardown`). The official client is about 500 KB bundled, and a script served from our own origin is refused by our `Cross-Origin-Resource-Policy: same-origin` header, so neither is used. It was tested against the official host class (`AppBridge` from `@modelcontextprotocol/ext-apps`), which validates every message.
- It reads the tool's normal JSON text — the answer Claude itself gets — so card and sentence cannot disagree, and a host that shows no cards (Claude Code) loses nothing. `event.cover_photo` and `event.is_past` exist for it.
- Look: Claude's style variables with fallbacks, transparent background, FHI gold only as an accent, 44 px buttons (Anthropic's inline-card guidelines). When Claude gives a height limit (`hostContext.containerDimensions.maxHeight`) and the card is taller, the photo becomes a thumbnail, then goes.
- Safety: the only outside thing it loads is the cover photo, from the storage origin declared in `_meta.ui.csp.resourceDomains`; all text is written with `textContent`; links go through `ui/open-link`, which makes Claude ask before opening; there is **no button that writes**, because a tool call made from a card skips Claude's approval prompt.
- Claude labels a custom connector's card "Unverified". Claude may keep a copy of the page: after changing it, bump the version in `EVENT_CARD_URI`. People who connected before the card existed remove and re-add the connector once, as for any new tool feature.

Every answer carries `missing` (each item: `what`, `needed_to_publish`, `how_to_fix`), `ready_to_publish`, and `open_in_dashboard` — `/<role base>/events?event=<id>`, which opens that event's form on the Events page (once; a save's reload does not reopen it). That list is how Claude guides the person.

Rules that are Claude's only: a new event is always a draft; a start already past is refused (a wrong year is the usual slip) and so is a date that does not exist; the same title at the same date and time returns the event already there instead of a second one; `CLAUDE_EVENTS_DAILY_LIMIT` (default 20) new events per person per 24 hours, counted from the audit log; an admin changes company events only and an owner only their own; nothing is deleted; a map pin is never made from typed text — it comes only with a venue reused from an event whose pin was picked in the dashboard. Every write is in Activity Logs as the person, `source = 'claude'`, with "via Claude" in the sentence. Registrations, certificates, the raffle and emails stay in the dashboard. The API page's Claude sign-ins list marks such a connection "Can create events", and so does the person's own Connect Claude page (a connection made before 2026-11-27 reads "Reading only" with how to renew it).

## Joining them

`sales[].agent.id` and `sales[].credits[].id` are `agents[].id`. `sales[].project.id` is `projects[].id`, and `projects[].developer.id`, `sales[].developer.id` are `developers[].id`. Email is the key to match a person across the other company sites.
