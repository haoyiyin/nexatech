import {
  ensureJsonSuccess,
  ensureStatus,
  getAdminDashboard,
  loginAdmin,
  SESSION_REUSE_WINDOW_MS,
  standardThresholds,
  thinkTime,
} from './shared.js'

const adminEmail = String(__ENV.ADMIN_EMAIL || '').trim()
const adminPassword = String(__ENV.ADMIN_PASSWORD || '').trim()

if (!adminEmail || !adminPassword) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.')
}

let authenticatedAt = 0

function ensureAdminSession() {
  const now = Date.now()

  if (authenticatedAt > 0 && now - authenticatedAt < SESSION_REUSE_WINDOW_MS) {
    return true
  }

  const loginResponse = loginAdmin(adminEmail, adminPassword, { scenario: 'admin-dashboard-auth' })

  if (loginResponse.status !== 200) {
    return false
  }

  authenticatedAt = now
  return true
}

export const options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || '2m',
  thresholds: standardThresholds,
}

export default function () {
  if (!ensureAdminSession()) {
    return
  }

  const response = getAdminDashboard({ scenario: 'admin-dashboard' })

  ensureStatus(response, 200, 'admin dashboard api')
  ensureJsonSuccess(response, 'admin dashboard api')
  thinkTime(5, 15)
}
