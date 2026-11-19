import { lazy } from 'react'
import { messages } from './locale.ts'
import type { Locale } from './locale.ts'

function ChartUnavailable({ locale }: { locale: Locale }) {
  return <p className="muted">{messages[locale].chartUnavailable}</p>
}

function loadCharts() {
  return import('./charts.tsx').catch(() => ({
    DistributionCharts: ChartUnavailable,
    ScatterChart: ChartUnavailable,
    IntervalChart: ChartUnavailable,
  }))
}

export const DistributionCharts = lazy(() => loadCharts().then(module => ({ default: module.DistributionCharts })))
export const ScatterChart = lazy(() => loadCharts().then(module => ({ default: module.ScatterChart })))
export const IntervalChart = lazy(() => loadCharts().then(module => ({ default: module.IntervalChart })))
