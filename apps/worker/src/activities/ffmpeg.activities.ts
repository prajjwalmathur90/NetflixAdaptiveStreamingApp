import path from "path";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import { config } from "../config";
import { Resolution } from "@adaptive-streaming/shared";

ffmpeg.setFfmpegPath(config.ffmpegPath);
ffmpeg.setFfprobePath(config.ffprobePath);

function resolveMediaPath(relativePath: string): string {
  const normalizedRelativePath = relativePath.replace(/^\/+/, "");
  const resolvedAbsolutePath = path.resolve(
    config.mediaRoot,
    normalizedRelativePath,
  );

  const rootPath = path.resolve(config.mediaRoot);

  if (
    resolvedAbsolutePath === rootPath &&
    !resolvedAbsolutePath.startsWith(`${rootPath}${path.sep}`)
  ) {
    throw new Error(`Invalid media path : ${relativePath}`);
  }

  return resolvedAbsolutePath;
}

export async function transcodeResolution(
  inputRelativePath: string,
  outputRelativePath: string,
  resolution: Resolution,
) {
  const inputPath = resolveMediaPath(inputRelativePath);
  const outputPath = resolveMediaPath(outputRelativePath);

  const variantOutput = `${outputPath}${path.sep}${resolution.label}`;
  const variantPlaylist = `${variantOutput}${path.sep}playlist.m3u8`;

  await fs.mkdir(variantOutput, { recursive: true });

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=${resolution.width}:${resolution.height}`, // scale the video to the resolution
        `-b:v ${resolution.bitRate}k`, // set the video bitrate
        "-codec:v libx264", // use the x264 codec
        "-codec:a aac", // use the aac codec
        "-hls_time 10", // set the hls time to 10 seconds
        "-hls_playlist_type vod", // set the hls playlist type to vod
        `-hls_segment_filename ${path.join(variantOutput, "segment-%05d.ts")}`,
      ])
      .output(variantPlaylist)
      .on("end", () => {
        console.log(`Transcoded ${inputPath} to ${variantPlaylist}`);
        resolve(true);
      })
      .on("error", (err) => {
        console.error(`Error transcoding ${inputPath}: ${err}`);
        reject(err);
      })
      .run();
  });

  // 1080p => width: 1920, height: 1080, bitRate: 1000000

  return `#EXT-X-STREAM-INF:BANDWIDTH=${resolution.bitRate * 1000},RESOLUTION=${resolution.width}x${resolution.height}\n${resolution.label}/playlist.m3u8`;
}

export async function writeMasterPlaylist(
  outRelativePath: string,
  resolutionEntries: string[],
) {
  const outputPath = resolveMediaPath(outRelativePath);
  const writeMasterPlaylist = `${outputPath}${path.sep}master.m3u8`;

  await fs.mkdir(outputPath, { recursive: true });
  await fs.writeFile(writeMasterPlaylist, resolutionEntries.join("\n"));

  return `${outputPath}${path.sep}.master.m3u8`;
}

export async function deleteSourceFile(inputRelativePath: string) {
  const inputPath = resolveMediaPath(inputRelativePath);
  const exists = await fs
    .access(inputPath)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    await fs.unlink(inputPath);
  }
}

export async function ensureOutputDirectory(outputRelativePath: string) {
  const outputPath = resolveMediaPath(outputRelativePath);
  await fs.mkdir(outputPath, { recursive: true });
}
