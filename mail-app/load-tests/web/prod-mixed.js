import { SharedArray } from 'k6/data'
import {
  ensureHtml,
  ensureJsonSuccess,
  ensureStatus,
  getAdminDashboard,
  getInbox,
  getMessageDetail,
  loginAdmin,
  loginStudent,
  parseMessageMap,
  parseUsersCsv,
  pickConsistentUser,
  pickIteratedUser,
  pickPage,
  requireMessageTargets,
  requireUsers,
  SESSION_REUSE_WINDOW_MS,
  standardThresholds,
  thinkTime,
} from './shared.js'

const users = new SharedArray('load-test-users-mixed', () =>
  requireUsers(parseUsersCsv(open('../fixtures/users.csv')))
)
const userByEmail = Object.fromEntries(users.map((user) => [user.email, user]))
const messageTargets = new SharedArray('load-test-message-targets-mixed', () => {
  const map = parseMessageMap(open('../fixtures/message-map.json'))

  return requireMessageTargets(
    map.users
      .map((target) => {
        const user = userByEmail[target.email]

        if (!user) {
          return null
        }

        return {
          user,
          messageIds: target.messageIds,
        }
      })
      .filter(Boolean)
  )
})
const adminEmail = String(__ENV.ADMIN_EMAIL || '').trim()
const adminPassword = String(__ENV.ADMIN_PASSWORD || '').trim()

if (!adminEmail || !adminPassword) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.')
}

let studentEmail = null
let studentAuthenticatedAt = 0
let adminAuthenticatedAt = 0

function ensureStudentSession(user) {
  const now = Date.now()

  if (studentEmail === user.email && now - studentAuthenticatedAt < SESSION_REUSE_WINDOW_MS) {
    return true
  }

  const loginResponse = loginStudent(user, { scenario: 'mixed-student-auth' })

  if (loginResponse.status !== 200) {
    return false
  }

  studentEmail = user.email
  studentAuthenticatedAt = now
  return true
}

function ensureAdminSession() {
  const now = Date.now()

  if (adminAuthenticatedAt > 0 && now - adminAuthenticatedAt < SESSION_REUSE_WINDOW_MS) {
    return true
  }

  const loginResponse = loginAdmin(adminEmail, adminPassword, { scenario: 'mixed-admin-auth' })

  if (loginResponse.status !== 200) {
    return false
  }

  adminAuthenticatedAt = now
  return true
}

export const options = {
  scenarios: {
    prod_mixed: {
      executor: 'ramping-vus',
      startVUs: Number(__ENV.START_VUS || 5),
      stages: [
        { duration: __ENV.STAGE_1_DURATION || '2m', target: Number(__ENV.STAGE_1_TARGET || 25) },
        { duration: __ENV.STAGE_2_DURATION || '5m', target: Number(__ENV.STAGE_2_TARGET || 75) },
        { duration: __ENV.STAGE_3_DURATION || '10m', target: Number(__ENV.STAGE_3_TARGET || 150) },
        { duration: __ENV.STAGE_4_DURATION || '5m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: standardThresholds,
}

export default function () {
  const roll = Math.random()

  if (roll < 0.1) {
    const response = loginStudent(pickIteratedUser(users), { scenario: 'mixed-login' })
    ensureStatus(response, [200, 429], 'mixed login')
    if (response.status === 200) {
      ensureJsonSuccess(response, 'mixed login')
    }
    thinkTime(2, 6)
    return
  }

  if (roll < 0.65) {
    const user = pickConsistentUser(users)
    if (!ensureStudentSession(user)) {
      return
    }

    const page = pickPage()
    const response = getInbox(page, { scenario: 'mixed-inbox', page: String(page) })
    ensureStatus(response, 200, 'mixed inbox')
    ensureHtml(response, 'mixed inbox')
    thinkTime()
    return
  }

  if (roll < 0.9) {
    const target = messageTargets[(__VU + __ITER) % messageTargets.length]
    if (!ensureStudentSession(target.user)) {
      return
    }

    const messageId = target.messageIds[__ITER % target.messageIds.length]
    const response = getMessageDetail(messageId, 1, { scenario: 'mixed-message-detail' })
    ensureStatus(response, 200, 'mixed message detail')
    ensureHtml(response, 'mixed message detail')
    thinkTime(4, 12)
    return
  }

  if (roll < 0.92) {
    if (!ensureAdminSession()) {
      return
    }

    const response = getAdminDashboard({ scenario: 'mixed-admin-dashboard' })
    ensureStatus(response, 200, 'mixed admin dashboard')
    ensureJsonSuccess(response, 'mixed admin dashboard')
    thinkTime(5, 15)
    return
  }

  thinkTime()
}
