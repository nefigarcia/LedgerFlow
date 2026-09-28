import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfkit reads its built-in font metrics with `__dirname + "/data/*.afm"`.
  // If webpack bundles it, __dirname points at the route chunk and every
  // PDF request fails with ENOENT. Loading it from node_modules keeps the
  // font files where pdfkit expects them.
  serverExternalPackages: ["pdfkit"],
  // Make sure serverless deployments (Vercel) ship pdfkit's font data with
  // the PDF route even though it's loaded dynamically via fs.
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./node_modules/pdfkit/js/data/**/*"],
  },
  experimental: {
    serverActions: {
      // Logo uploads are capped at 2 MB in the action; this leaves headroom
      // for multipart overhead.
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
