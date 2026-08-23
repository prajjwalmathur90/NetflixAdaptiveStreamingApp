export const TASK_QUEUE = "video-processing";
export const PROCESS_VIDEO_WORKFLOW = "processVideoWorkflow";

export interface ProcessVideoInput {
  videoId: string;
  inputRelativePath: string;
  outputRelativePath: string;
}
