const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

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

/**
 * Lesson 6 — Wire to POST /api/v1/videos/upload
 */
export async function uploadVideo(_file: File): Promise<UploadResponse> {
  throw new Error('TODO: Implement uploadVideo in apps/web/src/api/client.ts');
}

/**
 * Lesson 6 — Wire to GET /api/v1/videos
 */
export async function listVideos(): Promise<VideoSummary[]> {
  return [];
}

/**
 * Lesson 6 — Wire to GET /api/v1/videos/:videoId
 */
export async function getVideoStatus(_videoId: string): Promise<VideoSummary | null> {
  return null;
}

export function getStreamUrl(streamPath: string | null): string | null {
  if (!streamPath) {
    return null;
  }
  return `${API_URL}${streamPath}`;
}

export { API_URL };
