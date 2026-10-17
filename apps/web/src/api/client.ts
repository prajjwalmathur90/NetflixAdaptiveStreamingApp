import { siteConfig } from "../config/site";

const API_URL = siteConfig.apiUrl;

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface VideoSummary {
  videoId: string;
  originalFilename: string | null;
  processingStatus: ProcessingStatus;
  streamUrl: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    videoId: string;
    workflowId: string;
    status: string;
  };
}

export interface HealthStatus {
  status: string;
  mediaRoot?: string;
  implementation?: string;
}

export async function checkHealth(): Promise<HealthStatus | null> {
  try {
    const response = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function uploadVideo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("video", file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error("Invalid response from server"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("POST", `${API_URL}/api/v1/videos/upload`);
    xhr.send(formData);
  });
}

export async function listVideos(): Promise<VideoSummary[]> {
  const response = await fetch(`${API_URL}/api/v1/videos`);
  const json = await response.json();
  return json.data ?? [];
}

export async function getVideoStatus(videoId: string): Promise<VideoSummary | null> {
  const response = await fetch(`${API_URL}/api/v1/videos/${videoId}`);
  if (!response.ok) return null;
  const json = await response.json();
  return json.data ?? null;
}

export function getStreamUrl(streamPath: string | null): string | null {
  if (!streamPath) return null;
  return `${API_URL}${streamPath}`;
}
