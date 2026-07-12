import { createPage } from "@/lib/create-page"

const ProductsPage = createPage(() => import("@/views/ProductsPage"))

export default function Page() {
  return <ProductsPage />
}
