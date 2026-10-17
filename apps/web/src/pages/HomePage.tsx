import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listVideos, VideoSummary, ProcessingStatus } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import {
  SearchIcon,
  CopyIcon,
  CheckIcon,
  ClockIcon,
  GridIcon,
  ListIcon,
  ChevronRightIcon,
  FilmIcon,
} from "../components/Icons";

type ViewMode = "grid" | "table";
type FilterTab = "all" | ProcessingStatus;

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "processing", label: "Processing" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
];


function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button className="copy-btn" onClick={handleCopy} title="Copy video ID" aria-label="Copy video ID">
      {copied ? <CheckIcon size={12} color="var(--status-completed-text)" /> : <CopyIcon size={12} />}
    </button>
  );
}

function VideoCardSlate({ video }: { video: VideoSummary }) {
  const [apiUrl] = useState(() => import.meta.env.VITE_API_URL || "http://localhost:3000");

  if (video.processingStatus === "completed" && video.streamUrl) {
    return (
      <div className="video-card__preview">
        <video
          src={`${apiUrl}${video.streamUrl}`}
          preload="metadata"
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <span className="video-card__hls-badge">HLS VOD</span>
      </div>
    );
  }

  return (
    <div className="video-card__preview">
      <div className="video-card__slate">
        <div>
          <div className="video-card__slate-label">Video ID</div>
          <div className="video-card__slate-value">{video.videoId.slice(0, 16)}...</div>
        </div>
        <div style={{ marginTop: "var(--space-2)" }}>
          <div className="video-card__slate-label">Status</div>
          <div className="video-card__slate-value">{video.processingStatus.toUpperCase()}</div>
        </div>
        {video.processingStatus === "completed" && (
          <div style={{ marginTop: "var(--space-2)" }}>
            <div className="video-card__slate-label">Profiles</div>
            <div className="video-card__slate-value">HLS VOD | 360p / 480p / 720p / 1080p</div>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: VideoSummary }) {
  return (
    <div className="video-card">
      <VideoCardSlate video={video} />
      <div className="video-card__body">
        <div className="video-card__title" title={video.originalFilename || "Untitled Source"}>
          {video.originalFilename || "Untitled Source"}
        </div>
        <div className="video-card__meta">
          <div className="video-card__id-row">
            <span className="video-card__id" title={video.videoId}>{video.videoId}</span>
            <CopyIdButton id={video.videoId} />
          </div>
          <div className="video-card__timestamp">
            <ClockIcon size={12} />
            {formatDate(video.createdAt)}
          </div>
        </div>
      </div>
      <div className="video-card__footer">
        <StatusBadge status={video.processingStatus} size="sm" />
        <Link
          to={`/stream/${video.videoId}`}
          className="btn btn--ghost btn--sm"
          id={`view-video-${video.videoId}`}
        >
          View <ChevronRightIcon size={14} />
        </Link>
      </div>
    </div>
  );
}

function VideoTableRow({ video }: { video: VideoSummary }) {
  return (
    <tr>
      <td>
        <div className="video-table__filename" title={video.originalFilename || "Untitled Source"}>
          {video.originalFilename || "Untitled Source"}
        </div>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span className="video-table__id" title={video.videoId}>{video.videoId}</span>
          <CopyIdButton id={video.videoId} />
        </div>
      </td>
      <td>
        <StatusBadge status={video.processingStatus} size="sm" />
      </td>
      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
        {formatDate(video.createdAt)}
      </td>
      <td>
        <Link to={`/stream/${video.videoId}`} className="btn btn--ghost btn--sm" id={`table-view-${video.videoId}`}>
          Stream <ChevronRightIcon size={14} />
        </Link>
      </td>
    </tr>
  );
}

export default function HomePage() {
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    listVideos()
      .then(setVideos)
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    all: videos.length,
    completed: videos.filter((v) => v.processingStatus === "completed").length,
    processing: videos.filter((v) => v.processingStatus === "processing").length,
    pending: videos.filter((v) => v.processingStatus === "pending").length,
    failed: videos.filter((v) => v.processingStatus === "failed").length,
  };

  const filtered = videos
    .filter((v) => filter === "all" || v.processingStatus === filter)
    .filter((v) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        v.videoId.toLowerCase().includes(q) ||
        (v.originalFilename || "").toLowerCase().includes(q)
      );
    });

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Video Catalog</h1>
        <p className="page__subtitle">
          Source files uploaded for HLS transcoding via Temporal workers and FFmpeg.
        </p>
      </div>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-item__label">Total</span>
          <span className="stat-item__value">{counts.all}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">Completed</span>
          <span className="stat-item__value" style={{ color: "var(--status-completed-text)" }}>
            {counts.completed}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">Processing</span>
          <span className="stat-item__value" style={{ color: "var(--status-processing-text)" }}>
            {counts.processing}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">Pending</span>
          <span className="stat-item__value" style={{ color: "var(--status-pending-text)" }}>
            {counts.pending}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">Failed</span>
          <span className="stat-item__value" style={{ color: "var(--status-failed-text)" }}>
            {counts.failed}
          </span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Link to="/upload" className="btn btn--primary" id="home-upload-cta">
            Upload Video
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar__search input-group">
          <span className="input-group__icon">
            <SearchIcon size={16} />
          </span>
          <input
            id="catalog-search"
            type="text"
            className="input"
            placeholder="Search by filename or video ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar__right">
          <div className="view-toggle">
            <button
              id="view-grid"
              className={`view-toggle-btn${viewMode === "grid" ? " view-toggle-btn--active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid view"
              aria-label="Switch to grid view"
            >
              <GridIcon size={16} />
            </button>
            <button
              id="view-table"
              className={`view-toggle-btn${viewMode === "table" ? " view-toggle-btn--active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Table view"
              aria-label="Switch to table view"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`filter-${tab.id}`}
            className={`tab${filter === tab.id ? " tab--active" : ""}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
            <span className="tab__count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16)" }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">
            <FilmIcon size={48} color="var(--text-tertiary)" />
          </div>
          <div className="empty-state__title">
            {search || filter !== "all" ? "No matching videos" : "No videos yet"}
          </div>
          <div className="empty-state__desc">
            {search || filter !== "all"
              ? "Try adjusting your search or filter."
              : "Upload a source video to begin transcoding."}
          </div>
          {!search && filter === "all" && (
            <Link to="/upload" className="btn btn--primary" id="empty-upload-cta">
              Upload Video
            </Link>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "grid" && (
        <div className="video-grid">
          {filtered.map((video) => (
            <VideoCard key={video.videoId} video={video} />
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "table" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="video-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Video ID</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((video) => (
                <VideoTableRow key={video.videoId} video={video} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
