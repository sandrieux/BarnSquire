import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Allow next/image to load photos served from the configured object storage
// (MinIO in dev, R2/S3 in prod) in addition to local dev hosts. Derived from
// STORAGE_PUBLIC_URL so it works on any deployment without hardcoding the host.
function storageRemotePattern(): RemotePattern[] {
  const url = process.env["STORAGE_PUBLIC_URL"];
  if (!url) return [];
  try {
    const u = new URL(url);
    return [
      {
        protocol: u.protocol.replace(":", "") as "http" | "https",
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@barnsquire/db", "@barnsquire/trpc", "@barnsquire/validators"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "127.0.0.1", port: "9000" },
      ...storageRemotePattern(),
    ],
  },
};

export default withNextIntl(nextConfig);
