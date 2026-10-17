// Site configuration - reads from Vite environment variables
// Set these in the root .env file

export const siteConfig = {
  name: import.meta.env.VITE_SITE_NAME || "StreamForge",
  domain: import.meta.env.VITE_SITE_DOMAIN || "localhost:5173",
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:3000",
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || "admin@localhost",
  version: "1.0.0",
  description:
    "Adaptive HLS streaming platform. Upload source video files for automated multi-bitrate transcoding (360p to 1080p) via Temporal workers and FFmpeg.",
} as const;

export type SiteConfig = typeof siteConfig;
