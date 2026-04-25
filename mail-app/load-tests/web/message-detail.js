import { SharedArray } from 'k6/data'
import {
  ensureHtml,
  ensureStatus,
  getMessageDetail,
  loginStudent,
  parseMessageMap,
  parseUsersCsv,
  requireMessageTargets,
  requireUsers,
  SESSION_REUSE_WINDOW_MS,
  standardThresholds,
  thinkTime,
} from './shared.js'

const users = new SharedArray('load-test-users-detail', () =>
  requireUsers(parseUsersCsv(open('../fixtures/users.csv')))
)
const userByEmail = Object.fromEntries(users.map((user) => [user.email, user]))
const messageTargets = new SharedArray('load-test-message-targets', () => {
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

let authenticatedEmail = null
let authenticatedAt = 0

function ensureStudentSession(user) {
  const now = Date.now()

  if (authenticatedEmail === user.email && now - authenticatedAt < SESSION_REUSE_WINDOW_MS) {
    return true
  }

  const loginResponse = loginStudent(user, { scenario: 'message-detail-auth' })

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
  const target = messageTargets[(__VU - 1) % messageTargets.length]

  if (!ensureStudentSession(target.user)) {
    return
  }

  const messageId = target.messageIds[__ITER % target.messageIds.length]
  const response = getMessageDetail(messageId, 1, { scenario: 'message-detail' })

  ensureStatus(response, 200, 'message detail page')
  ensureHtml(response, 'message detail page')
  thinkTime(4, 12)
}
