import { SharedArray } from 'k6/data'
import {
  ensureJsonSuccess,
  ensureStatus,
  loginStudent,
  parseUsersCsv,
  requireUsers,
  smokeThresholds,
  thinkTime,
  pickIteratedUser,
} from './shared.js'

const users = new SharedArray('load-test-users-login', () =>
  requireUsers(parseUsersCsv(open('../fixtures/users.csv')))
)

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '2m',
  thresholds: smokeThresholds,
}

export default function () {
  const user = pickIteratedUser(users)
  const response = loginStudent(user, { scenario: 'student-login' })

  ensureStatus(response, 200, 'student login')
  ensureJsonSuccess(response, 'student login')
  thinkTime(2, 6)
}
