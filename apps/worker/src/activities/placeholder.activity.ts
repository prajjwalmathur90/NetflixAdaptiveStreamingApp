
export async function placeholderActivity(_input: {
  videoId: string;
  inputRelativePath: string;
  outputRelativePath: string;
}): Promise<void> {
  throw new Error(
    'TODO: Implement FFmpeg and DB activities, then replace processVideoWorkflow stub.',
  );
}
