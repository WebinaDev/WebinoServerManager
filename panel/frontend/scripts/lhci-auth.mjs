const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost"

/**
 * @param {import('puppeteer').Page} page
 */
module.exports = async (page) => {
  const url = page.url()
  if (url.includes("/login") || url === page.url()) {
    // no-op for public routes
  }

  if (!url.endsWith("/") && !url.match(/\/(dashboard|domains|databases)/)) {
    return
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username: process.env.LHCI_LOGIN_USERNAME || "admin",
        password: process.env.LHCI_LOGIN_PASSWORD || "password",
      }),
    })
    if (!res.ok) return

    const setCookie = res.headers.getSetCookie?.() ?? []
    if (setCookie.length) {
      const cookies = setCookie.map((raw) => {
        const [pair] = raw.split(";")
        const [name, ...rest] = pair.split("=")
        return { name, value: rest.join("="), url: page.url() }
      })
      await page.setCookie(...cookies)
    }

    if (!url.includes("/login")) {
      await page.reload({ waitUntil: "networkidle0" })
    }
  } catch {
    // Perf runs may proceed without authenticated API
  }
}
