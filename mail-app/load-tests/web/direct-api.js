import http from 'k6/http'
import { check, fail, sleep } from 'k6'
import { SharedArray } from 'k6/data'

const BASE_URL = String(__ENV.BASE_URL || '').trim()
const MAIL_BASE_PATH = '/mail'
const MAIL_DOMAIN = String(__ENV.MAIL_DOMAIN || 'nexatech.edu.kg').toLowerCase()

if (!BASE_URL) {
  fail('BASE_URL is required')
}

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
      email: `${parts[0]}@${MAIL_DOMAIN}`.toLowerCase(),
      password: parts[1],
    }
  })
})

if (users.length === 0) {
  fail('No load-test users found')
}

export const options = {
  scenarios: {
    login_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<3000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.1'],
  },
}

function buildJsonHeaders() {
  return {
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
  }
}

export default function () {
  const user = users[(__VU + __ITER) % users.length]

  const response = http.post(
    `${BASE_URL}${MAIL_BASE_PATH}/api/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: buildJsonHeaders(),
      tags: { flow: 'login' },
    }
  )

  check(response, {
    'login is 200, 401, or 429': (res) => [200, 401, 429].includes(res.status),
    'login returns json': (res) => {
      try {
        const body = res.json()
        return body && typeof body.success === 'boolean'
      } catch {
        return false
      }
    },
  })

  sleep(1 + Math.random() * 2)
}
