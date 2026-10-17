import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";
import { ProcessVideoInput, RESOLUTIONS } from "@adaptive-streaming/shared";

const {
  getTranscodingResolutions,
  transcodeResolution,
  writeMasterPlaylist,
  deleteSourceFile,
  updateVideoStatus,
  ensureOutputDirectory,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 hour",
  retry: {
    maximumAttempts: 3,
  },
});

export async function processVideoWorkflow(input: ProcessVideoInput) {
  const { videoId, inputRelativePath, outputRelativePath } = input;

  try {
    await updateVideoStatus(videoId, "pending");

    await ensureOutputDirectory(outputRelativePath);

    const resolutions =
      input.resolutions && input.resolutions.length > 0
        ? input.resolutions
        : await getTranscodingResolutions();

    // for scaling up we must run a separate worker for each resolution
    const resolutionEntries = await Promise.all(
      resolutions.map((resolution) =>
        transcodeResolution(inputRelativePath, outputRelativePath, resolution),
      ),
    );

    const masterPlaylistRelativePath = await writeMasterPlaylist(
      outputRelativePath,
      resolutionEntries,
    );

    await deleteSourceFile(inputRelativePath);

    await updateVideoStatus(videoId, "completed");

    return {
      videoId,
      masterPlaylistRelativePath,
    };
  } catch (error) {
    await updateVideoStatus(videoId, "failed");
    throw error;
  }
}
