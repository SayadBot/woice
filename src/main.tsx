import './styles/fonts.css'
import './styles/index.css'

import 'flag-icons/css/flag-icons.min.css'

import { QueryClientProvider } from '@tanstack/react-query'
import ReactDOM from 'react-dom/client'
import { App } from './app'
import { TitleBar } from './components/title-bar'
import { Toaster } from './components/ui/sonner'
import { queryClient } from './lib/query-client'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(root).render(
  <main className="grid h-screen w-screen grid-rows-[auto_1fr] overflow-hidden">
    <TitleBar />

    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>

    <Toaster />
  </main>
)
