import { createPage } from "@/lib/create-page"

const SshKeysPage = createPage(() => import("@/views/SshKeysPage"))

export default function Page() {
  return <SshKeysPage />
}
