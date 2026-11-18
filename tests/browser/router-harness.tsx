import type { AnalysisResult } from '../../src/analysis.ts'
import { createRoot } from 'react-dom/client'
import { App } from '../../src/app.tsx'
import { createDatasetSession } from '../../src/dataset-session.ts'
import { createAnalysisRouter } from '../../src/router/execute.ts'

const session = createDatasetSession<AnalysisResult>()
const router = createAnalysisRouter(session)
const harness = { router, clear: session.clear }

declare global {
  interface Window { askoraRouterTest: typeof harness }
}

window.askoraRouterTest = harness
createRoot(document.getElementById('root')!).render(<App session={session} />)
