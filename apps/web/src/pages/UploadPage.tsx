import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { uploadVideo } from "../api/client";
import { UploadIcon, CheckIcon, AlertIcon, FilmIcon } from "../components/Icons";

const b1080 = import.meta.env.VITE_BITRATE_1080P || "4000";
const b720 = import.meta.env.VITE_BITRATE_720P || "2500";
const b520 = import.meta.env.VITE_BITRATE_520P || "1500";
const b360 = import.meta.env.VITE_BITRATE_360P || "900";

const TRANSCODE_LADDER = [
  { label: "1080p", res: "1920x1080", bitrate: `${b1080}k`, codec: "H.264/AAC" },
  { label: "720p", res: "1280x720", bitrate: `${b720}k`, codec: "H.264/AAC" },
  { label: "520p", res: "924x520", bitrate: `${b520}k`, codec: "H.264/AAC" },
  { label: "360p", res: "640x360", bitrate: `${b360}k`, codec: "H.264/AAC" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadResult {
  videoId: string;
  workflowId: string;
  status: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragover, setDragover] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.type.startsWith("video/")) {
      setErrorMsg("Only video files are accepted.");
      return;
    }
    setErrorMsg(null);
    setResult(null);
    setFile(f);
    setUploadState("idle");
    setProgress(0);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragover(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadState("uploading");
    setProgress(0);
    setErrorMsg(null);

    try {
      const response = await uploadVideo(file, (pct) => setProgress(pct));
      if (response.success && response.data) {
        setResult(response.data);
        setUploadState("success");
      } else {
        setErrorMsg(response.message || "Upload failed.");
        setUploadState("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
      setUploadState("error");
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadState("idle");
    setProgress(0);
    setErrorMsg(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="page page--narrow">
      <div className="page__header">
        <h1 className="page__title">Upload Source Video</h1>
        <p className="page__subtitle">
          Upload a raw video file. The Temporal worker will transcode it into 4 HLS renditions (360p to 1080p) via FFmpeg and generate a master playlist.
        </p>
      </div>

      {/* Dropzone - only show when no file selected and not in success state */}
      {!file && uploadState !== "success" && (
        <div
          id="upload-dropzone"
          className={`dropzone${dragover ? " dropzone--dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Click or drag a video file to upload"
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="dropzone__input"
            onChange={handleChange}
            id="file-input"
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="dropzone__icon">
            <UploadIcon size={40} color={dragover ? "var(--accent)" : "var(--text-tertiary)"} />
          </div>
          <div className="dropzone__title">
            {dragover ? "Drop to select" : "Drag video file here"}
          </div>
          <div className="dropzone__subtitle">
            or click to browse. Accepts <code>video/*</code> formats.
          </div>
        </div>
      )}

      {/* File Inspector */}
      {file && uploadState !== "success" && (
        <div>
          <div className="section-title" style={{ marginBottom: "var(--space-3)" }}>File Properties</div>
          <div className="file-inspector">
            <div className="file-inspector__header">Source File</div>
            <div className="file-inspector__row">
              <span className="file-inspector__label">Filename</span>
              <span className="file-inspector__value">{file.name}</span>
            </div>
            <div className="file-inspector__row">
              <span className="file-inspector__label">Size</span>
              <span className="file-inspector__value">{formatBytes(file.size)}</span>
            </div>
            <div className="file-inspector__row">
              <span className="file-inspector__label">MIME type</span>
              <span className="file-inspector__value">{file.type}</span>
            </div>
            <div className="file-inspector__row">
              <span className="file-inspector__label">Last modified</span>
              <span className="file-inspector__value">
                {new Date(file.lastModified).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Upload progress */}
          {uploadState === "uploading" && (
            <div style={{ marginTop: "var(--space-6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Uploading to API...</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Error notice */}
          {errorMsg && uploadState === "error" && (
            <div className="notice notice--error" style={{ marginTop: "var(--space-4)" }}>
              <AlertIcon size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-6)" }}>
            <button
              id="upload-submit-btn"
              className="btn btn--primary btn--lg"
              onClick={handleUpload}
              disabled={uploadState === "uploading"}
            >
              {uploadState === "uploading" ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Uploading {progress}%
                </>
              ) : (
                <>
                  <UploadIcon size={16} />
                  Upload and Transcode
                </>
              )}
            </button>
            <button
              id="upload-cancel-btn"
              className="btn btn--secondary"
              onClick={handleReset}
              disabled={uploadState === "uploading"}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Target HLS Transcoding Ladder preview */}
      {uploadState !== "success" && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <div className="section-title">Target HLS Transcoding Ladder</div>
          <div className="transcode-ladder">
            {TRANSCODE_LADDER.map((tier) => (
              <div key={tier.label} className="transcode-tier">
                <div className="transcode-tier__label">{tier.label}</div>
                <div className="transcode-tier__res">{tier.res}</div>
                <div className="transcode-tier__bitrate">{tier.bitrate}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginTop: "var(--space-3)" }}>
            Segment duration: 10s. Playlist type: VOD. Worker: Temporal + FFmpeg (libx264/aac).
          </p>
        </div>
      )}

      {/* Success result */}
      {uploadState === "success" && result && (
        <div>
          <div className="notice notice--success" style={{ marginBottom: "var(--space-5)" }}>
            <CheckIcon size={16} />
            <span>Upload accepted. Temporal workflow started. The worker is now transcoding your video.</span>
          </div>

          <div className="upload-result">
            <div className="upload-result__header">
              <FilmIcon size={18} />
              Workflow Dispatched
            </div>
            <div className="upload-result__body">
              <div className="kv-row">
                <span className="kv-row__label">Video ID</span>
                <span className="kv-row__value">{result.videoId}</span>
              </div>
              <div className="kv-row">
                <span className="kv-row__label">Workflow ID</span>
                <span className="kv-row__value">{result.workflowId}</span>
              </div>
              <div className="kv-row">
                <span className="kv-row__label">Initial Status</span>
                <span className="kv-row__value">{result.status}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
            <Link
              to={`/stream/${result.videoId}`}
              className="btn btn--primary"
              id="go-to-stream-btn"
            >
              Watch Processing Status
            </Link>
            <button
              id="upload-another-btn"
              className="btn btn--secondary"
              onClick={handleReset}
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
