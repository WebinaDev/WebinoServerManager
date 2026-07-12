import { createPage } from "@/lib/create-page"

const ForgotPasswordPage = createPage(() => import("@/views/ForgotPasswordPage"))

export default function Page() {
  return <ForgotPasswordPage />
}
