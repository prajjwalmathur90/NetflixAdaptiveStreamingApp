import { Request, Response } from "express";
import {
  createVideoRecordService,
  getVideoByVideoIdService,
  listVideoService,
} from "../service/video.service";
import { getOutputRelativePath, getUploadRelativePath } from "../lib/media";
import { startVideoProcessingWorkflow } from "../lib/temporal";

export async function listVideoController(_req: Request, res: Response) {
  try {
    const videos = await listVideoService();

    res.status(200).json({
      success: true,
      data: videos.map((video) => ({
        videoId: video.videoId,
        originalFileName: video.originalFileName,
        processingStatus: video.processingStatus,
        createdAt: video.createdAt,
        streamUrl:
          video.processingStatus === "completed"
            ? `/media/output/${video.videoId}/master.m3u8`
            : null,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
}

export async function uploadVideoController(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded!",
    });
  }

  const videoId = String(Date.now());
  const inputRelativePath = getUploadRelativePath(req.file.path);
  const outputRelativePath = getOutputRelativePath(videoId);

  try {
    await createVideoRecordService(videoId, req.file.originalname);

    const workflowId = await startVideoProcessingWorkflow(
      videoId,
      inputRelativePath,
      outputRelativePath,
    );

    res.status(200).json({
      success: true,
      message: "Video Processing Started",
      data: {
        videoId,
        workflowId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

export async function getVideoStatusController(req: Request, res: Response) {
  const videoId = req.params.videoId;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: "Video Id is Required",
    });
  }

  try {
    const video = await getVideoByVideoIdService(String(videoId));

    if (!video) {
      return res.status(400).json({
        success: false,
        message: "Video not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        videoId: video.videoId,
        originalFileName: video.originalFileName,
        processingStatus: video.processingStatus,
        createdAt: video.createdAt,
        streamUrl:
          video.processingStatus === "completed"
            ? `/media/output/${video.videoId}/master.m3u8`
            : null,
      },
    });
  } catch (error) {
    console.error(error);
  }
}
