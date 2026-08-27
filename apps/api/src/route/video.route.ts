import { Router } from "express";
import {
  getVideoStatusController,
  listVideoController,
  uploadVideoController,
} from "../controller/video.controller";
import { uploadMiddleware } from "../middlewares/upload.middleware";

const videoRouter = Router();

videoRouter.get("/", listVideoController);
videoRouter.post(
  "/upload",
  uploadMiddleware.single("video"),
  uploadVideoController,
);
videoRouter.get("/:videoId", getVideoStatusController);

export default videoRouter;
