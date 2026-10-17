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

export async function getTranscodingResolutions(): Promise<Resolution[]> {
  return [
    { width: 1920, height: 1080, bitRate: config.bitrates["1080p"], label: "1080p" },
    { width: 1280, height: 720, bitRate: config.bitrates["720p"], label: "720p" },
    { width: 924, height: 520, bitRate: config.bitrates["520p"], label: "520p" },
    { width: 640, height: 360, bitRate: config.bitrates["360p"], label: "360p" },
  ];
}

export async function transcodeResolution(
  inputRelativePath: string,
  outputRelativePath: string,
  resolution: Resolution,
) {
  const inputPath = resolveMediaPath(inputRelativePath);
  const outputPath = resolveMediaPath(outputRelativePath);

  const bitRate =
    config.bitrates[resolution.label as keyof typeof config.bitrates] ||
    resolution.bitRate;

  const variantOutput = `${outputPath}${path.sep}${resolution.label}`;
  const variantPlaylist = `${variantOutput}${path.sep}playlist.m3u8`;

  await fs.mkdir(variantOutput, { recursive: true });

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=${resolution.width}:${resolution.height}`, // scale the video to the resolution
        `-b:v ${bitRate}k`, // set the video bitrate from .env
        "-codec:v libx264", // use the x264 codec
        "-codec:a aac", // use the aac codec
        "-hls_time 10", // set the hls time to 10 seconds
        "-hls_playlist_type vod", // set the hls playlist type to vod
        `-hls_segment_filename ${path.join(variantOutput, "segment-%05d.ts")}`,
      ])
      .output(variantPlaylist)
      .on("end", () => {
        console.log(`Transcoded ${inputPath} to ${variantPlaylist} (${bitRate}k)`);
        resolve(true);
      })
      .on("error", (err) => {
        console.error(`Error transcoding ${inputPath}: ${err}`);
        reject(err);
      })
      .run();
  });

  return `#EXT-X-STREAM-INF:BANDWIDTH=${bitRate * 1000},RESOLUTION=${resolution.width}x${resolution.height}\n${resolution.label}/playlist.m3u8`;
}

export async function writeMasterPlaylist(
  outRelativePath: string,
  resolutionEntries: string[],
) {
  const outputPath = resolveMediaPath(outRelativePath);
  const writeMasterPlaylist = `${outputPath}${path.sep}master.m3u8`;

  await fs.mkdir(outputPath, { recursive: true });
  await fs.writeFile(
    writeMasterPlaylist,
    `#EXTM3U\n${resolutionEntries.join("\n")}\n`,
  );

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
