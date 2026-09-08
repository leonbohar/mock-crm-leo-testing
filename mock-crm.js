/**
 * Mock CRM Server
 * ----------------
 * A lightweight, in-memory CRM simulator used to integration-test the LEO
 * platform against realistic CRM data and webhook events, without needing
 * a real CRM account or database.
 *
 * Run: npm start   (listens on PORT, default 3001)
 */

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ---------------------------------------------------------------------------
// In-memory data store
// ---------------------------------------------------------------------------
// Nothing here is persisted to disk. Restarting the server resets everything
// back to the seed data below.

const db = {
  companies: [],
  contacts: [],
  deals: [],
  activities: [],
  webhooks: [], // { id, url, events: [...], createdAt }
};

const SERVER_STARTED_AT = new Date().toISOString();

// Simple id generator for records created at runtime (companies/contacts/
// deals/activities created via POST). Seed data below uses fixed, readable
// ids instead so the documentation can reference them reliably.
function generateId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Seed data: 3 fictional companies + a handful of related contacts, deals
// and activities so the API has something realistic to return immediately.
// ---------------------------------------------------------------------------

db.companies.push(
  {
    id: 'comp-001',
    name: 'TechFlow Solutions',
    industry: 'Software / SaaS',
    website: 'https://techflowsolutions.example.com',
    phone: '+1-415-555-0101',
    address: '120 Market St, San Francisco, CA',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  },
  {
    id: 'comp-002',
    name: 'StartupWave',
    industry: 'Venture-backed Startup',
    website: 'https://startupwave.example.com',
    phone: '+1-212-555-0102',
    address: '88 Innovation Ave, New York, NY',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  },
  {
    id: 'comp-003',
    name: 'Creative Design Studio',
    industry: 'Design / Creative Agency',
    website: 'https://creativedesignstudio.example.com',
    phone: '+1-310-555-0103',
    address: '45 Sunset Blvd, Los Angeles, CA',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  }
);

db.contacts.push(
  {
    id: 'cont-001',
    firstName: 'John',
    lastName: 'Carter',
    email: 'john.carter@techflowsolutions.example.com',
    phone: '+1-415-555-0111',
    title: 'VP of Engineering',
    companyId: 'comp-001',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  },
  {
    id: 'cont-002',
    firstName: 'Sarah',
    lastName: 'Kim',
    email: 'sarah.kim@startupwave.example.com',
    phone: '+1-212-555-0112',
    title: 'Founder & CEO',
    companyId: 'comp-002',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  },
  {
    id: 'cont-003',
    firstName: 'Mike',
    lastName: 'Rivera',
    email: 'mike.rivera@creativedesignstudio.example.com',
    phone: '+1-310-555-0113',
    title: 'Creative Director',
    companyId: 'comp-003',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  }
);

db.deals.push(
  {
    id: 'deal-001',
    name: 'TechFlow - Enterprise License',
    companyId: 'comp-001',
    contactId: 'cont-001',
    stage: 'proposal',
    amount: 45000,
    currency: 'USD',
    closeDate: '2026-10-15',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  },
  {
    id: 'deal-002',
    name: 'StartupWave - Seed Package',
    companyId: 'comp-002',
    contactId: 'cont-002',
    stage: 'qualification',
    amount: 12000,
    currency: 'USD',
    closeDate: '2026-09-30',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  },
  {
    id: 'deal-003',
    name: 'Creative Design Studio - Brand Refresh',
    companyId: 'comp-003',
    contactId: 'cont-003',
    stage: 'negotiation',
    amount: 8000,
    currency: 'USD',
    closeDate: '2026-09-20',
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  }
);

db.activities.push(
  {
    id: 'act-001',
    type: 'call',
    subject: 'Discovery call with John Carter',
    description: 'Discussed enterprise licensing needs and rollout timeline.',
    companyId: 'comp-001',
    contactId: 'cont-001',
    dealId: 'deal-001',
    dueDate: '2026-09-10',
    completed: true,
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  },
  {
    id: 'act-002',
    type: 'email',
    subject: 'Sent seed package proposal to Sarah Kim',
    description: 'Follow-up email with pricing tiers attached.',
    companyId: 'comp-002',
    contactId: 'cont-002',
    dealId: 'deal-002',
    dueDate: '2026-09-08',
    completed: true,
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  },
  {
    id: 'act-003',
    type: 'meeting',
    subject: 'Brand refresh kickoff meeting',
    description: 'Scheduled kickoff meeting with Creative Design Studio team.',
    companyId: 'comp-003',
    contactId: 'cont-003',
    dealId: 'deal-003',
    dueDate: '2026-09-12',
    completed: false,
    createdAt: SERVER_STARTED_AT,
    updatedAt: SERVER_STARTED_AT,
  }
);

// ---------------------------------------------------------------------------
// Webhook event system
// ---------------------------------------------------------------------------

const VALID_EVENTS = [
  'company.created',
  'company.updated',
  'contact.created',
  'contact.updated',
  'deal.created',
  'deal.updated',
  'deal.stage_changed',
  'activity.created',
  'activity.updated',
];

// Sample payloads used by GET /api/test/trigger so any event can be fired
// on demand without needing to perform the real CRUD action first.
const SAMPLE_PAYLOADS = {
  'company.created': db.companies[0],
  'company.updated': db.companies[1],
  'contact.created': db.contacts[0],
  'contact.updated': db.contacts[1],
  'deal.created': db.deals[0],
  'deal.updated': db.deals[1],
  'deal.stage_changed': {
    ...db.deals[2],
    previousStage: 'proposal',
    newStage: db.deals[2].stage,
  },
  'activity.created': db.activities[0],
  'activity.updated': db.activities[1],
};

/**
 * Fires a webhook event: logs it to the console and reports which
 * registered subscriptions matched it. Actual HTTP delivery is not
 * implemented yet -- swap the console.log below for a real POST
 * (e.g. via fetch) when upgrading to live delivery.
 */
function fireWebhookEvent(eventType, payload) {
  const timestamp = new Date().toISOString();
  const envelope = { event: eventType, timestamp, data: payload };

  const matched = db.webhooks.filter(
    (wh) => wh.events.includes('*') || wh.events.includes(eventType)
  );

  console.log('\n' + '-'.repeat(70));
  console.log(`[WEBHOOK EVENT] ${eventType}  @ ${timestamp}`);
  console.log(JSON.stringify(payload, null, 2));

  if (matched.length === 0) {
    console.log('  -> No webhook subscriptions registered for this event.');
  } else {
    matched.forEach((wh) => {
      console.log(`  -> Delivered (simulated) to ${wh.url}  [webhook id: ${wh.id}]`);
      // TODO (future upgrade): real HTTP delivery, e.g.
      // fetch(wh.url, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(envelope),
      // }).catch((err) => console.error(`Webhook delivery failed: ${err.message}`));
    });
  }
  console.log('-'.repeat(70) + '\n');

  return { envelope, notified: matched.map((wh) => ({ id: wh.id, url: wh.url })) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findById(collection, id) {
  return collection.find((item) => item.id === id);
}

function notFound(res, resource, id) {
  return res.status(404).json({ error: `${resource} with id "${id}" not found` });
}

// Optional query-param filtering by companyId, used by contacts/deals/activities.
function filterByQuery(collection, query) {
  let result = collection;
  if (query.companyId) {
    result = result.filter((item) => item.companyId === query.companyId);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Root + status endpoints
// ---------------------------------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    service: 'Mock CRM Server',
    message: 'See MOCK_CRM_GUIDE.md for full API documentation.',
    status: '/api/status',
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Mock CRM Server',
    version: '1.0.0',
    port: PORT,
    startedAt: SERVER_STARTED_AT,
    uptimeSeconds: process.uptime(),
    counts: {
      companies: db.companies.length,
      contacts: db.contacts.length,
      deals: db.deals.length,
      activities: db.activities.length,
      webhookSubscriptions: db.webhooks.length,
    },
  });
});

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

app.get('/api/companies', (req, res) => {
  res.json(db.companies);
});

app.get('/api/companies/:id', (req, res) => {
  const company = findById(db.companies, req.params.id);
  if (!company) return notFound(res, 'Company', req.params.id);
  res.json(company);
});

app.post('/api/companies', (req, res) => {
  const now = new Date().toISOString();
  const company = {
    id: generateId('comp'),
    name: req.body.name,
    industry: req.body.industry || null,
    website: req.body.website || null,
    phone: req.body.phone || null,
    address: req.body.address || null,
    createdAt: now,
    updatedAt: now,
  };
  db.companies.push(company);
  fireWebhookEvent('company.created', company);
  res.status(201).json(company);
});

app.put('/api/companies/:id', (req, res) => {
  const company = findById(db.companies, req.params.id);
  if (!company) return notFound(res, 'Company', req.params.id);
  Object.assign(company, req.body, { id: company.id, updatedAt: new Date().toISOString() });
  fireWebhookEvent('company.updated', company);
  res.json(company);
});

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

app.get('/api/contacts', (req, res) => {
  res.json(filterByQuery(db.contacts, req.query));
});

app.get('/api/contacts/:id', (req, res) => {
  const contact = findById(db.contacts, req.params.id);
  if (!contact) return notFound(res, 'Contact', req.params.id);
  res.json(contact);
});

app.post('/api/contacts', (req, res) => {
  const now = new Date().toISOString();
  const contact = {
    id: generateId('cont'),
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    phone: req.body.phone || null,
    title: req.body.title || null,
    companyId: req.body.companyId || null,
    createdAt: now,
    updatedAt: now,
  };
  db.contacts.push(contact);
  fireWebhookEvent('contact.created', contact);
  res.status(201).json(contact);
});

app.put('/api/contacts/:id', (req, res) => {
  const contact = findById(db.contacts, req.params.id);
  if (!contact) return notFound(res, 'Contact', req.params.id);
  Object.assign(contact, req.body, { id: contact.id, updatedAt: new Date().toISOString() });
  fireWebhookEvent('contact.updated', contact);
  res.json(contact);
});

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

app.get('/api/deals', (req, res) => {
  res.json(filterByQuery(db.deals, req.query));
});

app.get('/api/deals/:id', (req, res) => {
  const deal = findById(db.deals, req.params.id);
  if (!deal) return notFound(res, 'Deal', req.params.id);
  res.json(deal);
});

app.post('/api/deals', (req, res) => {
  const now = new Date().toISOString();
  const deal = {
    id: generateId('deal'),
    name: req.body.name,
    companyId: req.body.companyId || null,
    contactId: req.body.contactId || null,
    stage: req.body.stage || 'prospecting',
    amount: req.body.amount || 0,
    currency: req.body.currency || 'USD',
    closeDate: req.body.closeDate || null,
    createdAt: now,
    updatedAt: now,
  };
  db.deals.push(deal);
  fireWebhookEvent('deal.created', deal);
  res.status(201).json(deal);
});

app.put('/api/deals/:id', (req, res) => {
  const deal = findById(db.deals, req.params.id);
  if (!deal) return notFound(res, 'Deal', req.params.id);

  const previousStage = deal.stage;
  Object.assign(deal, req.body, { id: deal.id, updatedAt: new Date().toISOString() });

  fireWebhookEvent('deal.updated', deal);

  // A stage change is a distinct, higher-value event for CRM integrations
  // (e.g. triggering a "deal won" workflow in LEO), so it fires separately.
  if (req.body.stage && req.body.stage !== previousStage) {
    fireWebhookEvent('deal.stage_changed', { ...deal, previousStage, newStage: deal.stage });
  }

  res.json(deal);
});

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

app.get('/api/activities', (req, res) => {
  res.json(filterByQuery(db.activities, req.query));
});

app.get('/api/activities/:id', (req, res) => {
  const activity = findById(db.activities, req.params.id);
  if (!activity) return notFound(res, 'Activity', req.params.id);
  res.json(activity);
});

app.post('/api/activities', (req, res) => {
  const now = new Date().toISOString();
  const activity = {
    id: generateId('act'),
    type: req.body.type || 'note',
    subject: req.body.subject,
    description: req.body.description || null,
    companyId: req.body.companyId || null,
    contactId: req.body.contactId || null,
    dealId: req.body.dealId || null,
    dueDate: req.body.dueDate || null,
    completed: req.body.completed || false,
    createdAt: now,
    updatedAt: now,
  };
  db.activities.push(activity);
  fireWebhookEvent('activity.created', activity);
  res.status(201).json(activity);
});

app.put('/api/activities/:id', (req, res) => {
  const activity = findById(db.activities, req.params.id);
  if (!activity) return notFound(res, 'Activity', req.params.id);
  Object.assign(activity, req.body, { id: activity.id, updatedAt: new Date().toISOString() });
  fireWebhookEvent('activity.updated', activity);
  res.json(activity);
});

// ---------------------------------------------------------------------------
// Webhook management
// ---------------------------------------------------------------------------

app.get('/api/webhooks', (req, res) => {
  res.json(db.webhooks);
});

app.post('/api/webhooks/subscribe', (req, res) => {
  const { url, events } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '"url" (string) is required' });
  }

  const subscribedEvents = Array.isArray(events) && events.length > 0 ? events : ['*'];
  const invalidEvents = subscribedEvents.filter(
    (e) => e !== '*' && !VALID_EVENTS.includes(e)
  );
  if (invalidEvents.length > 0) {
    return res.status(400).json({
      error: `Unknown event type(s): ${invalidEvents.join(', ')}`,
      validEvents: VALID_EVENTS,
    });
  }

  const webhook = {
    id: generateId('webhook'),
    url,
    events: subscribedEvents,
    createdAt: new Date().toISOString(),
  };
  db.webhooks.push(webhook);
  console.log(`[WEBHOOK SUBSCRIBED] ${webhook.id} -> ${url} (events: ${subscribedEvents.join(', ')})`);
  res.status(201).json(webhook);
});

app.delete('/api/webhooks/:id', (req, res) => {
  const index = db.webhooks.findIndex((wh) => wh.id === req.params.id);
  if (index === -1) return notFound(res, 'Webhook', req.params.id);
  const [removed] = db.webhooks.splice(index, 1);
  console.log(`[WEBHOOK REMOVED] ${removed.id} -> ${removed.url}`);
  res.json({ message: 'Webhook subscription removed', webhook: removed });
});

// ---------------------------------------------------------------------------
// Test endpoint: manually fire any supported event on demand
// ---------------------------------------------------------------------------

app.get('/api/test/trigger', (req, res) => {
  const eventType = req.query.event;

  if (!eventType) {
    return res.status(400).json({
      error: '"event" query parameter is required',
      validEvents: VALID_EVENTS,
    });
  }

  if (!VALID_EVENTS.includes(eventType)) {
    return res.status(400).json({
      error: `Unknown event type "${eventType}"`,
      validEvents: VALID_EVENTS,
    });
  }

  const payload = SAMPLE_PAYLOADS[eventType];
  const result = fireWebhookEvent(eventType, payload);

  res.json({
    message: `Event "${eventType}" triggered`,
    event: result.envelope,
    notifiedWebhooks: result.notified,
    totalSubscriptions: db.webhooks.length,
  });
});

// ---------------------------------------------------------------------------
// Fallback handlers
// ---------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({ error: `No route ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log('  MOCK CRM SERVER - running for LEO platform integration testing');
  console.log('='.repeat(70));
  console.log(`  URL:            http://localhost:${PORT}`);
  console.log(`  Status:         http://localhost:${PORT}/api/status`);
  console.log(`  Companies:      ${db.companies.map((c) => c.name).join(', ')}`);
  console.log(`  Docs:           see MOCK_CRM_GUIDE.md`);
  console.log('='.repeat(70));
});
