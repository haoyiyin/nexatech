import { ensureJsonSuccess, ensureStatus, getHealth, smokeThresholds, thinkTime } from './shared.js'

export const options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || '30s',
  thresholds: smokeThresholds,
}

export default function () {
  const response = getHealth({ scenario: 'health-smoke' })

  ensureStatus(response, 200, 'health endpoint')
  ensureJsonSuccess(response, 'health endpoint')
  thinkTime(1, 2)
}
