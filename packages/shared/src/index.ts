export const TASK_QUEUE = "video-processing";
export const PROCESS_VIDEO_WORKFLOW = "processVideoWorkflow";

export interface Resolution {
  width: number;
  height: number;
  bitRate: number;
  label: string;
}

export interface ProcessVideoInput {
  videoId: string;
  inputRelativePath: string;
  outputRelativePath: string;
  resolutions?: Resolution[];
}

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export function getResolutions(): Resolution[] {
  const b1080 = typeof process !== "undefined" && process.env?.BITRATE_1080P
    ? Number(process.env.BITRATE_1080P)
    : 4000;
  const b720 = typeof process !== "undefined" && process.env?.BITRATE_720P
    ? Number(process.env.BITRATE_720P)
    : 2500;
  const b520 = typeof process !== "undefined" && (process.env?.BITRATE_520P || process.env?.BITRATE_540P || process.env?.BITRATE_480P)
    ? Number(process.env.BITRATE_520P || process.env.BITRATE_540P || process.env.BITRATE_480P)
    : 1500;
  const b360 = typeof process !== "undefined" && process.env?.BITRATE_360P
    ? Number(process.env.BITRATE_360P)
    : 900;

  return [
    { width: 1920, height: 1080, bitRate: b1080, label: "1080p" },
    { width: 1280, height: 720, bitRate: b720, label: "720p" },
    { width: 924, height: 520, bitRate: b520, label: "520p" },
    { width: 640, height: 360, bitRate: b360, label: "360p" },
  ];
}

export const RESOLUTIONS: Resolution[] = getResolutions();
