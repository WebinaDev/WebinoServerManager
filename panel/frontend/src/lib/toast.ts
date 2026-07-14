import { toast } from "sonner"

export { toast }

export function toastMutationError(error: unknown, fallback = "Request failed") {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback
  toast.error(message)
}
