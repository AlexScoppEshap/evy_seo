import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Deep-link queries can contain recovery credentials; suppress dev access logs.
  logging: { incomingRequests: { ignore: [/\/(?:account-recovery(?:\/|\?|$)|event\/|user\/)/] } },
  // Keep legacy WordPress slashes while event canonicals remain unprefixed/slashless.
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: true,
  // Resolve eligibility in metadata before streaming, preserving true HTTP 404s.
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "seo.myevy.app",
        port: "",
        pathname: "/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
