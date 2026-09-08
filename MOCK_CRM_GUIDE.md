# Mock CRM Server — Guide

A lightweight, in-memory CRM simulator for testing the **LEO platform**
integration without needing a real CRM account. No database — all data
resets when the server restarts.

- **Base URL:** `http://localhost:3001`
- **Start:** `npm start`
- **Data:** in-memory only (companies, contacts, deals, activities, webhook subscriptions)

---

## 1. Setup

```bash
npm install
npm start
```

You should see:

```
======================================================================
  MOCK CRM SERVER - running for LEO platform integration testing
======================================================================
  URL:            http://localhost:3001
  Status:         http://localhost:3001/api/status
  Companies:      TechFlow Solutions, StartupWave, Creative Design Studio
  Docs:           see MOCK_CRM_GUIDE.md
======================================================================
```

---

## 2. Seed data — the 3 fictional companies

| id | Company | Industry | Contact | Deal | Activity |
|---|---|---|---|---|---|
| `comp-001` | TechFlow Solutions | Software / SaaS | John Carter (`cont-001`), VP of Engineering | `deal-001` — Enterprise License, $45,000, stage `proposal` | `act-001` — Discovery call (completed) |
| `comp-002` | StartupWave | Venture-backed Startup | Sarah Kim (`cont-002`), Founder & CEO | `deal-002` — Seed Package, $12,000, stage `qualification` | `act-002` — Proposal email (completed) |
| `comp-003` | Creative Design Studio | Design / Creative Agency | Mike Rivera (`cont-003`), Creative Director | `deal-003` — Brand Refresh, $8,000, stage `negotiation` | `act-003` — Kickoff meeting (pending) |

These ids are fixed and stable across restarts, so you can reference them
directly in tests (e.g. `GET /api/companies/comp-001`).

---

## 3. API Reference

All request/response bodies are JSON. Send `Content-Type: application/json`
on POST/PUT requests.

### Status

| Method | Path | Description |
|---|---|---|
| GET | `/api/status` | Server health, uptime, and record counts |

### Companies

| Method | Path | Description |
|---|---|---|
| GET | `/api/companies` | List all companies |
| GET | `/api/companies/:id` | Get one company |
| POST | `/api/companies` | Create a company → fires `company.created` |
| PUT | `/api/companies/:id` | Update a company → fires `company.updated` |

### Contacts

| Method | Path | Description |
|---|---|---|
| GET | `/api/contacts` | List all contacts (optional `?companyId=comp-001`) |
| GET | `/api/contacts/:id` | Get one contact |
| POST | `/api/contacts` | Create a contact → fires `contact.created` |
| PUT | `/api/contacts/:id` | Update a contact → fires `contact.updated` |

### Deals

| Method | Path | Description |
|---|---|---|
| GET | `/api/deals` | List all deals (optional `?companyId=comp-001`) |
| GET | `/api/deals/:id` | Get one deal |
| POST | `/api/deals` | Create a deal → fires `deal.created` |
| PUT | `/api/deals/:id` | Update a deal → fires `deal.updated`, and `deal.stage_changed` if `stage` changed |

### Activities

| Method | Path | Description |
|---|---|---|
| GET | `/api/activities` | List all activities (optional `?companyId=comp-001`) |
| GET | `/api/activities/:id` | Get one activity |
| POST | `/api/activities` | Create an activity → fires `activity.created` |
| PUT | `/api/activities/:id` | Update an activity → fires `activity.updated` |

### Webhooks

| Method | Path | Description |
|---|---|---|
| GET | `/api/webhooks` | List all webhook subscriptions |
| POST | `/api/webhooks/subscribe` | Register a webhook (`{ url, events? }`) |
| DELETE | `/api/webhooks/:id` | Remove a webhook subscription |

### Test trigger

| Method | Path | Description |
|---|---|---|
| GET | `/api/test/trigger?event=EVENT_TYPE` | Manually fire any supported event with sample data, without doing the real CRUD action |

### Supported webhook events

```
company.created
company.updated
contact.created
contact.updated
deal.created
deal.updated
deal.stage_changed
activity.created
activity.updated
```

> **Note on delivery:** webhook events are currently **logged to the server
> console only** (simulated delivery). The code marks exactly where to plug
> in real HTTP `POST` delivery (`fireWebhookEvent` in `mock-crm.js`) if/when
> you need the mock server to actually call LEO's webhook receiver.

---

## 4. PowerShell examples

PowerShell's `curl`/`wget` are aliases for `Invoke-WebRequest`, which returns
a response object rather than parsed JSON. For JSON APIs, `Invoke-RestMethod`
is more convenient — examples below use it, with `curl.exe` (the real curl
binary) shown as an alternative.

### Status check

```powershell
Invoke-RestMethod http://localhost:3001/api/status
```

```powershell
curl.exe http://localhost:3001/api/status
```

### List companies

```powershell
Invoke-RestMethod http://localhost:3001/api/companies
```

### Get one company

```powershell
Invoke-RestMethod http://localhost:3001/api/companies/comp-001
```

### Create a company

```powershell
$body = @{
    name     = "Northwind Traders"
    industry = "Retail"
    website  = "https://northwindtraders.example.com"
    phone    = "+1-206-555-0199"
    address  = "1 Trade St, Seattle, WA"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/companies `
    -Method Post -ContentType "application/json" -Body $body
```

```powershell
curl.exe -X POST http://localhost:3001/api/companies `
    -H "Content-Type: application/json" `
    -d '{"name":"Northwind Traders","industry":"Retail"}'
```

### Update a company

```powershell
$body = @{ phone = "+1-206-555-0200" } | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/companies/comp-001 `
    -Method Put -ContentType "application/json" -Body $body
```

### List contacts for one company

```powershell
Invoke-RestMethod "http://localhost:3001/api/contacts?companyId=comp-001"
```

### Create a contact

```powershell
$body = @{
    firstName = "Alice"
    lastName  = "Nguyen"
    email     = "alice.nguyen@techflowsolutions.example.com"
    title     = "Product Manager"
    companyId = "comp-001"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/contacts `
    -Method Post -ContentType "application/json" -Body $body
```

### Create a deal

```powershell
$body = @{
    name      = "TechFlow - Add-on Modules"
    companyId = "comp-001"
    contactId = "cont-001"
    stage     = "prospecting"
    amount    = 15000
    closeDate = "2026-11-01"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/deals `
    -Method Post -ContentType "application/json" -Body $body
```

### Move a deal to a new stage (fires `deal.stage_changed`)

```powershell
$body = @{ stage = "closed_won" } | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/deals/deal-001 `
    -Method Put -ContentType "application/json" -Body $body
```

### Log an activity

```powershell
$body = @{
    type      = "call"
    subject   = "Follow-up call re: renewal"
    companyId = "comp-002"
    contactId = "cont-002"
    dealId    = "deal-002"
    dueDate   = "2026-09-15"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/activities `
    -Method Post -ContentType "application/json" -Body $body
```

---

## 5. Webhook subscription examples

### Subscribe to specific events

```powershell
$body = @{
    url    = "https://leo.example.com/webhooks/crm"
    events = @("contact.created", "deal.stage_changed", "activity.created")
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/webhooks/subscribe `
    -Method Post -ContentType "application/json" -Body $body
```

### Subscribe to all events

```powershell
$body = @{ url = "https://leo.example.com/webhooks/crm" } | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/webhooks/subscribe `
    -Method Post -ContentType "application/json" -Body $body
```

(Omitting `events`, or passing `events: ["*"]`, subscribes to every event type.)

### List active subscriptions

```powershell
Invoke-RestMethod http://localhost:3001/api/webhooks
```

### Remove a subscription

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/webhooks/<webhook-id>" -Method Delete
```

### Manually fire an event (no subscription needed to see the console log)

```powershell
Invoke-RestMethod "http://localhost:3001/api/test/trigger?event=deal.stage_changed"
```

Watch the server's console — every fired event prints the event name,
timestamp, full payload, and which subscribed webhook URLs it would have
been delivered to.

---

## 6. Integrating with the LEO platform

1. **Start the mock server** (`npm start`) — it listens on `http://localhost:3001`.
2. **Point LEO's CRM connector** at `http://localhost:3001` as the CRM base URL.
3. **Register LEO's webhook receiver** via `POST /api/webhooks/subscribe`,
   passing LEO's actual callback URL and the event types LEO cares about.
4. **Drive test scenarios** by creating/updating contacts, deals, and
   activities through the REST endpoints — each mutation fires the
   corresponding webhook event automatically.
5. **Spot-check event handling** at any time with
   `GET /api/test/trigger?event=EVENT_TYPE`, without needing to set up
   the underlying data first.
6. **Verify server health** during a test run via `GET /api/status`
   (record counts, uptime).

> Since webhook delivery is currently console-only (simulated), LEO will
> not receive live HTTP callbacks yet. Use the console output to confirm
> *which* events would fire and *when*; wire up real delivery in
> `fireWebhookEvent` (`mock-crm.js`) once LEO exposes a receivable webhook
> endpoint for this environment.

---

## 7. Resetting data

There is no persistence — simply stop (`Ctrl+C`) and restart (`npm start`)
the server to reset all companies, contacts, deals, activities, and webhook
subscriptions back to the seed data in section 2.
