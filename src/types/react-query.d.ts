import '@tanstack/react-query'
import type { ApiError } from '@/libs/ApiClient'

declare module '@tanstack/react-query' {
  interface Register {
    // Errors from queryFn/mutationFn are ApiError (thrown by ApiClient), or an
    // unexpected Error from our own code.
    defaultError: ApiError | Error
    mutationMeta: {
      /** Skip the global error toast; the caller shows the error itself. */
      silentError?: boolean
    }
  }
}
