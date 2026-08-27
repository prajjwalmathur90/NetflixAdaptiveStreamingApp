import {
  createVideoRecord,
  getVideoByVideoId,
  listVideos,
} from "../repository/video.repository";

export async function listVideoService() {
  return await listVideos();
}

export async function createVideoRecordService(
  videoId: string,
  originalFileName: string,
) {
  return await createVideoRecord(videoId, originalFileName);
}

export async function getVideoByVideoIdService(videoId: string) {
  return await getVideoByVideoId(videoId);
}
