import type { NextConfig } from "next";

const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  /* config options here */
  ...(staticExport
    ? {
        output: "export" as const,
        distDir: ".next-export",
        // The aadu-puli Board.ts / board.ts casing clash fails `tsc` on this
        // case-insensitive disk. Dev typecheck is unchanged.
        typescript: { ignoreBuildErrors: true },
      }
    : { cacheComponents: true, partialPrefetching: true }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
