import { SharedArray } from 'k6/data'
import {
  ensureHtml,
  ensureStatus,
  getInbox,
  loginStudent,
  parseUsersCsv,
  pickConsistentUser,
  pickPage,
  requireUsers,
  SESSION_REUSE_WINDOW_MS,
  standardThresholds,
  thinkTime,
} from './shared.js'

const users = new SharedArray('load-test-users-inbox', () =>
  requireUsers(parseUsersCsv(open('../fixtures/users.csv')))
)

let authenticatedEmail = null
let authenticatedAt = 0

function ensureStudentSession(user) {
  const now = Date.now()

  if (authenticatedEmail === user.email && now - authenticatedAt < SESSION_REUSE_WINDOW_MS) {
    return true
  }

  const loginResponse = loginStudent(user, { scenario: 'inbox-auth' })

  if (loginResponse.status !== 200) {
    return false
  }

  authenticatedEmail = user.email
  authenticatedAt = now
  return true
}

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '5m',
  thresholds: standardThresholds,
}

export default function () {
  const user = pickConsistentUser(users)

  if (!ensureStudentSession(user)) {
    return
  }

  const page = pickPage()
  const response = getInbox(page, { scenario: 'inbox', page: String(page) })

  ensureStatus(response, 200, 'inbox page')
  ensureHtml(response, 'inbox page')
  thinkTime()
}
