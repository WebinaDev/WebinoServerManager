import bundleAnalyzer from "@next/bundle-analyzer"
import createNextIntlPlugin from "next-intl/plugin"

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const apiProxyTarget =
  process.env.API_PROXY_TARGET ?? "http://localhost:8080"
const agentWsTarget =
  process.env.AGENT_WS_TARGET ?? "http://localhost:9091"
const phpmyadminProxyTarget =
  process.env.PHPMYADMIN_PROXY_TARGET ?? "http://localhost:8081"
const phppgadminProxyTarget =
  process.env.PHPPGADMIN_PROXY_TARGET ?? "http://localhost:8083"
const roundcubeProxyTarget =
  process.env.ROUNDCUBE_PROXY_TARGET ?? "http://localhost:8082"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/terminal/ws",
          destination: `${agentWsTarget}/ws`,
        },
        {
          source: "/embed/phpmyadmin/:path*",
          destination: `${phpmyadminProxyTarget}/:path*`,
        },
        {
          source: "/embed/phppgadmin/:path*",
          destination: `${phppgadminProxyTarget}/:path*`,
        },
        {
          source: "/embed/webmail/:path*",
          destination: `${roundcubeProxyTarget}/:path*`,
        },
      ],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${apiProxyTarget}/:path*`,
        },
      ],
    }
  },
}

export default withBundleAnalyzer(withNextIntl(nextConfig))
