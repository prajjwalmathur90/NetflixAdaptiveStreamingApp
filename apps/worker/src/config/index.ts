import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env"), override: true });

export const config = {
  mediaRoot: process.env.MEDIA_ROOT || "/data/adaptive-streaming-media",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@postgres:5432/adaptive_streaming",
  temporalAddress: process.env.TEMPORAL_ADDRESS || "temporal:7233",
  temporalTaskQueue: process.env.TEMPORAL_TASK_QUEUE || "video-processing",
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
  starttoclosetimeout: Number(process.env.START_TO_CLOSE_TIMEOUT) || 3600000,
  bitrates: {
    "1080p": Number(process.env.BITRATE_1080P) || 4000,
    "720p": Number(process.env.BITRATE_720P) || 2500,
    "520p": Number(process.env.BITRATE_520P || process.env.BITRATE_540P || process.env.BITRATE_480P) || 1500,
    "360p": Number(process.env.BITRATE_360P) || 900,
  },
};
