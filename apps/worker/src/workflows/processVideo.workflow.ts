import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { placeholderActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/**
 * Lesson 4 — processVideoWorkflow
 *
 * TODO: Replace this stub with the real orchestration:
 * - update status to PROCESSING
 * - ensure output directory
 * - parallel transcode all RESOLUTIONS
 * - write master.m3u8
 * - delete source file
 * - update status to COMPLETED (or FAILED on error)
 */
export async function processVideoWorkflow(input: {
  videoId: string;
  inputRelativePath: string;
  outputRelativePath: string;
}): Promise<void> {
  await placeholderActivity(input);
}
