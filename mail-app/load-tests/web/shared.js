import http from 'k6/http'
import { check, fail, sleep } from 'k6'

const configuredBaseUrl = String(__ENV.BASE_URL || '').trim()
const allowInsecureBaseUrl = String(__ENV.ALLOW_INSECURE_BASE_URL || 'false').toLowerCase() === 'true'

if (!configuredBaseUrl) {
  fail('BASE_URL environment variable is required for load tests.')
}

if (!configuredBaseUrl.startsWith('https://') && !allowInsecureBaseUrl) {
  fail('BASE_URL must use https:// unless ALLOW_INSECURE_BASE_URL=true is set explicitly.')
}

export const BASE_URL = configuredBaseUrl.replace(/\/$/, '')
export const MAIL_BASE_PATH = normalizeBasePath(__ENV.MAIL_BASE_PATH || '/mail')
export const SESSION_REUSE_WINDOW_MS = 10 * 60 * 1000

export const smokeThresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<1500'],
}

export const standardThresholds = {
  http_req_failed: ['rate<0.02'],
  http_req_duration: ['p(95)<2500', 'p(99)<4000'],
}

export function normalizeBasePath(basePath) {
  const trimmedPath = String(basePath || '/mail').trim()

  if (!trimmedPath.startsWith('/')) {
    return `/${trimmedPath}`.replace(/\/$/, '')
  }

  return trimmedPath.replace(/\/$/, '') || '/mail'
}

export function buildMailUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${BASE_URL}${MAIL_BASE_PATH}${normalizedPath}`
}

export function buildJsonHeaders(extraHeaders = {}) {
  return {
    'Content-Type': 'application/json',
    Origin: BASE_URL,
    ...extraHeaders,
  }
}

export function parseUsersCsv(content) {
  const rows = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  if (!rows.length) {
    return []
  }

  const hasHeader = /email|prefix|password/i.test(rows[0])
  const dataRows = hasHeader ? rows.slice(1) : rows

  return dataRows.map((row, index) => {
    const parts = row.split(',').map((part) => part.trim())

    if (parts.length < 2) {
      fail(`Invalid load test user row at line ${hasHeader ? index + 2 : index + 1}`)
    }

    return {
      emailPrefix: parts[0],
      email: `${parts[0]}@${__ENV.MAIL_DOMAIN || 'nexatech.edu.kg'}`.toLowerCase(),
      password: parts[1],
      studentId: parts[2] || '',
    }
  })
}

export function parseMessageMap(content) {
  const parsed = JSON.parse(String(content || '{}'))

  if (!parsed || !Array.isArray(parsed.users)) {
    fail('message-map.json must contain a users array')
  }

  return {
    generatedAt: parsed.generatedAt,
    domain: parsed.domain,
    users: parsed.users.filter((user) => Array.isArray(user.messageIds) && user.messageIds.length > 0),
  }
}

export function requireUsers(users) {
  if (!Array.isArray(users) || users.length === 0) {
    fail('No load-test users found. Populate load-tests/fixtures/users.csv first.')
  }

  return users
}

export function requireMessageTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    fail('No message targets found. Run the export-load-test-fixtures script first.')
  }

  return targets
}

export function pickConsistentUser(users) {
  requireUsers(users)
  return users[(__VU - 1) % users.length]
}

export function pickIteratedUser(users, offset = 0) {
  requireUsers(users)
  return users[(__VU + __ITER + offset) % users.length]
}

export function pickPage() {
  const roll = Math.random()

  if (roll < 0.8) {
    return 1
  }

  if (roll < 0.95) {
    return 2
  }

  return 3 + Math.floor(Math.random() * 3)
}

export function loginStudent(user, tags = {}) {
  return http.post(
    buildMailUrl('/api/auth/login'),
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: buildJsonHeaders(),
      tags: {
        flow: 'student-login',
        ...tags,
      },
    }
  )
}

export function loginAdmin(adminEmail, adminPassword, tags = {}) {
  if (!adminEmail || !adminPassword) {
    fail('ADMIN_EMAIL and ADMIN_PASSWORD must be set for admin load tests.')
  }

  return http.post(
    buildMailUrl('/api/admin/auth/login'),
    JSON.stringify({ email: adminEmail, password: adminPassword }),
    {
      headers: buildJsonHeaders(),
      tags: {
        flow: 'admin-login',
        ...tags,
      },
    }
  )
}

export function getInbox(page = 1, tags = {}) {
  return http.get(buildMailUrl(`/inbox?page=${page}`), {
    tags: {
      flow: 'inbox',
      ...tags,
    },
  })
}

export function getMessageDetail(messageId, page = 1, tags = {}) {
  return http.get(buildMailUrl(`/inbox/${messageId}?page=${page}`), {
    tags: {
      flow: 'message-detail',
      ...tags,
    },
  })
}

export function getAdminDashboard(tags = {}) {
  return http.get(buildMailUrl('/api/admin/dashboard'), {
    tags: {
      flow: 'admin-dashboard',
      ...tags,
    },
  })
}

export function getHealth(tags = {}) {
  return http.get(buildMailUrl('/api/health'), {
    tags: {
      flow: 'health',
      ...tags,
    },
  })
}

export function ensureStatus(response, allowedStatuses, label) {
  const statuses = Array.isArray(allowedStatuses) ? allowedStatuses : [allowedStatuses]

  check(response, {
    [`${label} status is ${statuses.join('/')}`]: (res) => statuses.includes(res.status),
  })
}

export function ensureHtml(response, label) {
  check(response, {
    [`${label} returns html`]: (res) =>
      String(res.headers['Content-Type'] || res.headers['content-type'] || '').includes('text/html'),
  })
}

export function ensureJsonSuccess(response, label) {
  check(response, {
    [`${label} returns success json`]: (res) => {
      try {
        const body = res.json()
        return body && body.success === true
      } catch {
        return false
      }
    },
  })
}

export function thinkTime(minSeconds = 3, maxSeconds = 15) {
  const floor = Number.isFinite(minSeconds) ? minSeconds : 3
  const ceiling = Number.isFinite(maxSeconds) ? maxSeconds : 15
  const duration = floor + Math.random() * Math.max(ceiling - floor, 0)
  sleep(duration)
}
