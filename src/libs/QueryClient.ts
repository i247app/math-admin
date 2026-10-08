/**
 * TanStack Query setup: caching, retries and app-wide error handling for every
 * request made through useQuery / useMutation.
 */
import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, getErrorMessage, NETWORK_ERROR } from '@/libs/ApiClient'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Admin data changes rarely under our feet; refetch after 30 s at most.
      staleTime: 30_000,
      // Retry only when the server was unreachable — a business error (bad
      // input, 401, not found) gives the same answer on every try.
      retry: (failureCount, error) =>
        error instanceof ApiError && error.mstatus === NETWORK_ERROR && failureCount < 2,
    },
    mutations: {
      retry: false,
    },
  },
  // Every failed mutation shows the server's message as a toast, unless the
  // caller handles it itself with `meta: { silentError: true }`.
  // Failed queries are shown inline by the screen that made them.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silentError) return
      toast.error(getErrorMessage(error))
    },
  }),
})
