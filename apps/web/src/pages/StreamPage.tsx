import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Hls from 'hls.js';
import { getStreamUrl, getVideoStatus, VideoSummary } from '../api/client';

export default function StreamPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [video, setVideo] = useState<VideoSummary | null>(null);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;

    const fetchStatus = async () => {
      const status = await getVideoStatus(videoId);
      setVideo(status);
      return status;
    };

    fetchStatus().then((status) => {
      if (status && status.processingStatus !== 'COMPLETED' && status.processingStatus !== 'FAILED') {
        interval = setInterval(async () => {
          const latest = await fetchStatus();
          if (
            latest &&
            (latest.processingStatus === 'COMPLETED' || latest.processingStatus === 'FAILED')
          ) {
            clearInterval(interval);
          }
        }, 3000);
      }
    });

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [videoId]);

  useEffect(() => {
    const streamUrl = getStreamUrl(video?.streamUrl ?? null);
    const videoElement = videoRef.current;

    if (!streamUrl || !videoElement || !Hls.isSupported()) {
      return;
    }

    const hls = new Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(videoElement);
    hlsRef.current = hls;

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [video?.streamUrl]);

  return (
    <main className="container">
      <div className="card">
        <div className="notice">
          UI is ready. Connect <code>getVideoStatus()</code> in Lesson 6 after the API is implemented.
        </div>

        <h1>Stream Preview</h1>
        <p>
          Video ID: <code>{videoId}</code>
        </p>

        {video && (
          <p>
            Status:{' '}
            <span className={`status status-${video.processingStatus.toLowerCase()}`}>
              {video.processingStatus}
            </span>
          </p>
        )}

        {!video && <p>Waiting for status from API...</p>}

        {video?.processingStatus === 'COMPLETED' ? (
          <video ref={videoRef} controls />
        ) : (
          video && (
            <p>
              {video.processingStatus === 'FAILED'
                ? 'Processing failed. Check worker logs.'
                : 'Waiting for Temporal workers to finish FFmpeg transcoding...'}
            </p>
          )
        )}

        <p style={{ marginTop: '1rem' }}>
          <Link to="/">Back to home</Link>
        </p>
      </div>
    </main>
  );
}
