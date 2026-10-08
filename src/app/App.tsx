import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { setUnauthorizedHandler } from '@/libs/ApiClient'
import { queryClient } from '@/libs/QueryClient'
import { router } from './router'

const SIGN_IN_PATH = '/sign-in'

export default function App() {
  // Any 401 means the session is gone: drop cached data and go to sign-in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.clear()
      if (router.state.location.pathname !== SIGN_IN_PATH) {
        void router.navigate(SIGN_IN_PATH, { replace: true })
      }
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
