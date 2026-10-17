import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Hls, { Level } from "hls.js";
import { getStreamUrl, getVideoStatus, VideoSummary } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { AlertIcon, ChevronRightIcon, ClockIcon } from "../components/Icons";

function isCompleted(status: VideoSummary["processingStatus"] | undefined) {
  return status === "completed";
}

function isFailed(status: VideoSummary["processingStatus"] | undefined) {
  return status === "failed";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TelemetryState {
  resolution: string;
  bitrate: number;
  bufferLength: number;
  abrMode: "Auto" | "Manual Lock";
  currentLevelLabel: string;
}

const PIPELINE_STEPS = [
  {
    id: "ingest",
    label: "Ingest",
    desc: "Source file received and stored in media volume.",
  },
  {
    id: "transcode",
    label: "Parallel HLS Rendition Encoding",
    desc: "FFmpeg concurrently transcoding 360p / 480p / 720p / 1080p HLS segments.",
  },
  {
    id: "playlist",
    label: "Master Playlist Generation",
    desc: "Worker writes master.m3u8 referencing all resolved renditions.",
  },
];

export default function StreamPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [video, setVideo] = useState<VideoSummary | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    resolution: "-",
    bitrate: 0,
    bufferLength: 0,
    abrMode: "Auto",
    currentLevelLabel: "Auto",
  });

  // Status polling
  useEffect(() => {
    if (!videoId) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const fetchStatus = async () => {
      const status = await getVideoStatus(videoId);
      if (!cancelled) {
        setVideo(status);
        setLoading(false);
        if (!status) setNotFound(true);
      }
      return status;
    };

    fetchStatus().then((status) => {
      if (
        status &&
        !isCompleted(status.processingStatus) &&
        !isFailed(status.processingStatus)
      ) {
        interval = setInterval(async () => {
          const latest = await fetchStatus();
          if (latest && (isCompleted(latest.processingStatus) || isFailed(latest.processingStatus))) {
            clearInterval(interval);
          }
        }, 3000);
      }
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [videoId]);

  // HLS player
  useEffect(() => {
    const streamUrl = getStreamUrl(video?.streamUrl ?? null);
    const videoElement = videoRef.current;
    if (!streamUrl || !videoElement || !isCompleted(video?.processingStatus)) return;

    setPlaybackError(null);

    // HLS player with continuous telemetry
    if (Hls.isSupported()) {
      const hls = new Hls({
        autoStartLoad: true,
        startLevel: -1,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(videoElement);
      hlsRef.current = hls;

      const syncTelemetry = () => {
        const currentTime = videoElement.currentTime;
        const buf = videoElement.buffered;
        let forwardBuffer = 0;
        for (let i = 0; i < buf.length; i++) {
          if (buf.start(i) <= currentTime && currentTime <= buf.end(i)) {
            forwardBuffer = buf.end(i) - currentTime;
            break;
          }
        }

        // Determine active level index with accuracy
        let currentIdx = -1;
        if (hls.currentLevel >= 0) {
          currentIdx = hls.currentLevel;
        } else if (videoElement.videoHeight > 0) {
          const matchIdx = hls.levels.findIndex(
            (l) => l.height === videoElement.videoHeight,
          );
          if (matchIdx >= 0) currentIdx = matchIdx;
        } else if (hls.loadLevel >= 0) {
          currentIdx = hls.loadLevel;
        }

        if (currentIdx === -1 && hls.levels.length > 0) {
          currentIdx = hls.levels.length - 1;
        }

        const lvl = currentIdx >= 0 ? hls.levels[currentIdx] : undefined;

        const activeRes =
          videoElement.videoWidth && videoElement.videoHeight
            ? `${videoElement.videoWidth}x${videoElement.videoHeight}`
            : lvl
              ? `${lvl.width}x${lvl.height}`
              : "-";

        const activeBitrate = lvl?.bitrate ? Math.round(lvl.bitrate / 1000) : 0;
        const activeLabel = lvl ? `${lvl.height}p` : "Auto";

        setTelemetry((prev) => ({
          ...prev,
          resolution: activeRes,
          bitrate: activeBitrate,
          bufferLength: Number(forwardBuffer.toFixed(1)),
          currentLevelLabel:
            prev.abrMode === "Auto" ? `Auto (${activeLabel})` : activeLabel,
        }));
      };

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(data.levels);
        setCurrentLevel(-1);
        syncTelemetry();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        syncTelemetry();
      });

      hls.on(Hls.Events.FRAG_CHANGED, () => {
        syncTelemetry();
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        syncTelemetry();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setPlaybackError(`Playback error: ${data.type} / ${data.details}`);
        }
      });

      videoElement.addEventListener("timeupdate", syncTelemetry);
      videoElement.addEventListener("progress", syncTelemetry);
      videoElement.addEventListener("resize", syncTelemetry);
      videoElement.addEventListener("playing", syncTelemetry);

      const timer = setInterval(syncTelemetry, 500);

      return () => {
        clearInterval(timer);
        videoElement.removeEventListener("timeupdate", syncTelemetry);
        videoElement.removeEventListener("progress", syncTelemetry);
        videoElement.removeEventListener("resize", syncTelemetry);
        videoElement.removeEventListener("playing", syncTelemetry);
        hls.destroy();
        hlsRef.current = null;
        videoElement.removeAttribute("src");
        videoElement.load();
      };
    } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS fallback (Safari)
      videoElement.src = streamUrl;
      const syncNativeTelemetry = () => {
        const currentTime = videoElement.currentTime;
        const buf = videoElement.buffered;
        let forwardBuffer = 0;
        for (let i = 0; i < buf.length; i++) {
          if (buf.start(i) <= currentTime && currentTime <= buf.end(i)) {
            forwardBuffer = buf.end(i) - currentTime;
            break;
          }
        }
        const activeRes =
          videoElement.videoWidth && videoElement.videoHeight
            ? `${videoElement.videoWidth}x${videoElement.videoHeight}`
            : "-";

        setTelemetry((prev) => ({
          ...prev,
          resolution: activeRes,
          bufferLength: Number(forwardBuffer.toFixed(1)),
        }));
      };

      videoElement.addEventListener("timeupdate", syncNativeTelemetry);
      videoElement.addEventListener("progress", syncNativeTelemetry);
      videoElement.addEventListener("resize", syncNativeTelemetry);

      const timer = setInterval(syncNativeTelemetry, 500);

      return () => {
        clearInterval(timer);
        videoElement.removeEventListener("timeupdate", syncNativeTelemetry);
        videoElement.removeEventListener("progress", syncNativeTelemetry);
        videoElement.removeEventListener("resize", syncNativeTelemetry);
        videoElement.removeAttribute("src");
        videoElement.load();
      };
    } else {
      setPlaybackError("HLS playback is not supported in this browser.");
    }
  }, [video?.streamUrl, video?.processingStatus]);

  const setQualityLevel = (levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = levelIndex;
    setCurrentLevel(levelIndex);
    if (levelIndex === -1) {
      const activeIdx = hls.loadLevel >= 0 ? hls.loadLevel : 0;
      const lvl = hls.levels[activeIdx];
      setTelemetry((prev) => ({
        ...prev,
        abrMode: "Auto",
        currentLevelLabel: lvl ? `Auto (${lvl.height}p)` : "Auto",
      }));
    } else {
      const lvl = hls.levels[levelIndex];
      setTelemetry((prev) => ({
        ...prev,
        abrMode: "Manual Lock",
        currentLevelLabel: lvl ? `${lvl.height}p` : `${levelIndex}`,
        resolution: lvl ? `${lvl.width}x${lvl.height}` : prev.resolution,
        bitrate: lvl ? Math.round(lvl.bitrate / 1000) : prev.bitrate,
      }));
    }
  };

  const getLevelLabel = (l: Level) => `${l.height}p`;

  return (
    <div className="page">
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
            <h1 className="page__title">Stream Player</h1>
            {video && <StatusBadge status={video.processingStatus} />}
          </div>
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
              ID: {videoId}
            </span>
            {video?.createdAt && (
              <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <ClockIcon size={12} />
                {formatDate(video.createdAt)}
              </span>
            )}
          </div>
        </div>
        <Link to="/" className="btn btn--secondary" id="back-to-catalog">
          Catalog <ChevronRightIcon size={14} />
        </Link>
      </div>

      {/* Processing pipeline view */}
      {video && !isCompleted(video.processingStatus) && !isFailed(video.processingStatus) && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="section-title">Transcoding Pipeline</div>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "var(--space-5)" }}>
            Temporal workflow active on queue <code style={{ fontFamily: "var(--font-mono)" }}>video-processing</code>. Polling status every 3s.
          </p>
          <div className="pipeline">
            {PIPELINE_STEPS.map((step, i) => {
              const done = video.processingStatus === "completed" ||
                (video.processingStatus === "processing" && i === 0);
              const active = video.processingStatus === "processing" && i === 1;
              return (
                <div
                  key={step.id}
                  className={`pipeline__step${active ? " pipeline__step--active" : done ? " pipeline__step--done" : ""}`}
                >
                  <div className="pipeline__dot">{i + 1}</div>
                  <div className="pipeline__content">
                    <div className="pipeline__title">{step.label}</div>
                    <div className="pipeline__desc">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Failed state */}
      {isFailed(video?.processingStatus) && (
        <div className="notice notice--error" style={{ marginBottom: "var(--space-6)" }}>
          <AlertIcon size={16} />
          <span>Processing failed. Check the Temporal UI and worker logs for the error trace.</span>
        </div>
      )}

      {/* Player + Telemetry */}
      {isCompleted(video?.processingStatus) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "var(--space-6)", alignItems: "start" }}>
          <div>
            {/* Video player */}
            <div className="player-container" style={{ marginBottom: "var(--space-4)" }}>
              <video ref={videoRef} controls playsInline id="hls-video-player" />
            </div>

            {playbackError && (
              <div className="notice notice--error" style={{ marginBottom: "var(--space-4)" }}>
                <AlertIcon size={16} />
                <span>{playbackError}</span>
              </div>
            )}

            {/* Quality selector */}
            {levels.length > 0 && (
              <div>
                <div className="section-title">Rendition / Quality Selector</div>
                <div className="quality-selector">
                  <button
                    id="quality-auto"
                    className={`quality-btn${currentLevel === -1 ? " quality-btn--active" : ""}`}
                    onClick={() => setQualityLevel(-1)}
                  >
                    Auto (ABR)
                  </button>
                  {levels.map((level, idx) => (
                    <button
                      key={idx}
                      id={`quality-${level.height}p`}
                      className={`quality-btn${currentLevel === idx ? " quality-btn--active" : ""}`}
                      onClick={() => setQualityLevel(idx)}
                    >
                      {getLevelLabel(level)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Telemetry panel */}
          <div>
            <div className="section-title">Live Stream Telemetry</div>
            <div className="telemetry-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="telemetry-cell">
                <div className="telemetry-cell__label">Resolution</div>
                <div className="telemetry-cell__value">{telemetry.resolution}</div>
              </div>
              <div className="telemetry-cell">
                <div className="telemetry-cell__label">Bitrate</div>
                <div className="telemetry-cell__value">{telemetry.bitrate}</div>
                <div className="telemetry-cell__sub">kbps</div>
              </div>
              <div className="telemetry-cell">
                <div className="telemetry-cell__label">Buffer</div>
                <div className="telemetry-cell__value">{telemetry.bufferLength}</div>
                <div className="telemetry-cell__sub">seconds ahead</div>
              </div>
              <div className="telemetry-cell">
                <div className="telemetry-cell__label">ABR Mode</div>
                <div className="telemetry-cell__value" style={{ fontSize: "0.875rem" }}>
                  {telemetry.abrMode}
                </div>
                <div className="telemetry-cell__sub">{telemetry.currentLevelLabel}</div>
              </div>
            </div>

            {/* Stream info */}
            <div className="card card--compact" style={{ marginTop: "var(--space-4)" }}>
              <div className="section-title" style={{ marginBottom: "var(--space-3)" }}>Stream Info</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div className="kv-row">
                  <span className="kv-row__label" style={{ width: 90 }}>Video ID</span>
                  <span className="kv-row__value" style={{ fontSize: "0.6875rem", wordBreak: "break-all" }}>{videoId}</span>
                </div>
                {video?.streamUrl && (
                  <div className="kv-row">
                    <span className="kv-row__label" style={{ width: 90 }}>Manifest</span>
                    <span className="kv-row__value" style={{ fontSize: "0.6875rem", wordBreak: "break-all" }}>
                      {video.streamUrl}
                    </span>
                  </div>
                )}
                <div className="kv-row">
                  <span className="kv-row__label" style={{ width: 90 }}>Renditions</span>
                  <span className="kv-row__value" style={{ fontSize: "0.75rem" }}>
                    {levels.length > 0 ? levels.map((l) => `${l.height}p`).join(" / ") : "360p / 480p / 720p / 1080p"}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-row__label" style={{ width: 90 }}>Segment</span>
                  <span className="kv-row__value" style={{ fontSize: "0.75rem" }}>10s VOD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Not found state */}
      {!loading && notFound && (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}>
          <div className="section-title" style={{ marginBottom: "var(--space-2)" }}>Video Not Found</div>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
            The requested video ID does not exist in the catalog or may have been deleted.
          </p>
          <Link to="/" className="btn btn--primary" id="not-found-catalog">
            Return to Catalog
          </Link>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16)" }}>
          <div className="spinner" />
        </div>
      )}
    </div>
  );
}
