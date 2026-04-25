import http from 'k6/http'
import { check, sleep } from 'k6'
import { SharedArray } from 'k6/data'

const SUPABASE_URL = String(__ENV.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(__ENV.SUPABASE_SERVICE_ROLE_KEY || '').trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.')
}

const REST_BASE = `${SUPABASE_URL}/rest/v1`
const AUTH_HEADER = `Bearer ${SERVICE_KEY}`
const JSON_HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': AUTH_HEADER,
  'Content-Type': 'application/json',
}
const COUNT_HEADERS = {
  ...JSON_HEADERS,
  'Prefer': 'count=exact',
}

// Load test users from CSV
const users = new SharedArray('load-test-users', () => {
  const content = open('../fixtures/users.csv')
  const rows = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  const hasHeader = /email|prefix|password/i.test(rows[0])
  const dataRows = hasHeader ? rows.slice(1) : rows

  return dataRows.map((row) => {
    const parts = row.split(',').map((part) => part.trim())
    return {
      email: `${parts[0]}@nexatech.edu.kg`.toLowerCase(),
      password: parts[1],
      studentId: parts[2] || '',
    }
  })
})

// Fetch user_ids from Supabase
let userIds = []

export function setup() {
  const resp = http.get(`${REST_BASE}/mailbox_accounts?select=user_id&status=eq.active&limit=1000`, {
    headers: JSON_HEADERS,
  })

  if (resp.status === 200) {
    try {
      const accounts = JSON.parse(resp.body)
      userIds = accounts.map((a) => a.user_id)
      console.log(`Loaded ${userIds.length} user_ids for load test`)
    } catch (e) {
      console.error(`Failed to parse user_ids: ${e.message}`)
    }
  } else {
    console.error(`Failed to load user_ids: status ${resp.status}`)
  }

  return { userIds }
}

export default function (data) {
  const uids = data.userIds || userIds

  if (uids.length === 0) {
    console.error('No user_ids available for load testing')
    return
  }

  const roll = Math.random()
  const userId = uids[(__VU + __ITER) % uids.length]
  const userEmail = users[(__VU + __ITER) % users.length].email

  if (roll < 0.4) {
    inbox_query(userId)
  } else if (roll < 0.7) {
    account_lookup(userEmail)
  } else if (roll < 0.85) {
    message_count_query(userId)
  } else {
    recent_messages_query()
  }

  sleep(0.3 + Math.random() * 1)
}

function inbox_query(userId) {
  const url = `${REST_BASE}/mail_messages?select=id,from_address,subject,received_at,is_read&owner_user_id=eq.${userId}&order=received_at.desc&limit=20`
  const resp = http.get(url, {
    headers: COUNT_HEADERS,
    tags: { query: 'inbox' },
  })
  check(resp, {
    'inbox query succeeds': (r) => r.status === 200,
  })
}

function account_lookup(email) {
  const url = `${REST_BASE}/mailbox_accounts?select=id,email_address&email_address=eq.${email}`
  const resp = http.get(url, {
    headers: JSON_HEADERS,
    tags: { query: 'account_lookup' },
  })
  check(resp, {
    'account lookup succeeds': (r) => r.status === 200,
  })
}

function message_count_query(userId) {
  const url = `${REST_BASE}/mail_messages?select=id&owner_user_id=eq.${userId}&limit=1`
  const resp = http.get(url, {
    headers: COUNT_HEADERS,
    tags: { query: 'message_count' },
  })
  check(resp, {
    'count query succeeds': (r) => r.status === 200,
  })
}

function recent_messages_query() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const url = `${REST_BASE}/mail_messages?select=id&received_at=gte.${cutoff}&limit=1`
  const resp = http.get(url, {
    headers: COUNT_HEADERS,
    tags: { query: 'recent_messages' },
  })
  check(resp, {
    'recent messages query succeeds': (r) => r.status === 200,
  })
}

export const options = {
  scenarios: {
    db_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '5m', target: 150 },
        { duration: '5m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<4000'],
    'http_req_failed': ['rate<0.05'],
    'http_req_duration{query:inbox}': ['p(95)<2000'],
    'http_req_duration{query:account_lookup}': ['p(95)<1500'],
    'http_req_duration{query:message_count}': ['p(95)<1500'],
    'http_req_duration{query:recent_messages}': ['p(95)<2000'],
  },
}
