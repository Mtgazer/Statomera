import { createRoot } from 'react-dom/client'
import { App } from './app.tsx'
import { createDatasetSession } from './dataset-session.ts'

createRoot(document.getElementById('root')!).render(<App session={createDatasetSession()} />)
