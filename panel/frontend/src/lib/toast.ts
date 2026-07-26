import { toast } from "sonner"

export { toast }

/**
 * React Query `onError` compatible: first arg is the error; extra arity args are ignored.
 * Optional string second arg is treated as a fallback message when called directly.
 */
export function toastMutationError(error: unknown, fallbackOrVars?: unknown, ..._rest: unknown[]): void {
  const fallback = typeof fallbackOrVars === "string" ? fallbackOrVars : "Request failed"
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback
  toast.error(message)
}
