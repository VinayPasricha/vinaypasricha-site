import type { NextConfig } from "next";

// The whole app is served under vinaypasricha.com/workspace (behind a Firebase
// Hosting rewrite → this Cloud Run service). basePath prefixes all pages, API
// routes and assets. NOTE: /ai-business-leaders is the SEPARATE legacy static
// runtime on the main site — kept deliberately distinct so this never shadows it.
const nextConfig: NextConfig = {
  basePath: "/workspace",
  output: "standalone", // lean container for GCP Cloud Run
};

export default nextConfig;
