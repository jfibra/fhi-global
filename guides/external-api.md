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

## Joining the two

`sales[].agent.id` and `sales[].credits[].id` are `agents[].id`. Email is the key to match a person across the other company sites.
