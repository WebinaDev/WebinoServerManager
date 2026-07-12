import { Suspense } from "react"

import { createPage } from "@/lib/create-page"

const ResetPasswordPage = createPage(() => import("@/views/ResetPasswordPage"))

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  )
}
