import { siteConfig } from "../config/site";

const EFFECTIVE_DATE = "October 17, 2025";

export default function TermsPage() {
  return (
    <div className="legal-page">
      <h1>Terms and Conditions</h1>
      <div className="legal-meta">
        <p>
          Service: {siteConfig.name} - Adaptive HLS Streaming Platform<br />
          Domain: {siteConfig.domain}<br />
          Effective date: {EFFECTIVE_DATE}<br />
          Contact: <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
        </p>
      </div>

      <section className="legal-section" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using {siteConfig.name} ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use or access the Service.
        </p>
        <p>
          The Service is provided as an engineering platform for adaptive bitrate video transcoding (FFmpeg ladder generation from 360p to 1080p) and HLS streaming managed through Temporal workflows.
        </p>
      </section>

      <section className="legal-section">
        <h2>2. Video Upload and Transcoding Usage</h2>
        <p>
          The Service allows authorized users to upload source video files for automated processing. When you submit a video file:
        </p>
        <ul>
          <li>
            <strong>Ingest Processing</strong>: The uploaded file is staged in the server media storage directory and submitted to a Temporal workflow queue for asynchronous FFmpeg transcoding.
          </li>
          <li>
            <strong>Transcoding Ladder</strong>: The worker converts the source file into multiple HLS renditions (1080p at 2000 kbps, 720p at 1000 kbps, 480p at 700 kbps, and 360p at 300 kbps) with corresponding segment files and a master playlist.
          </li>
          <li>
            <strong>Resource Consumption</strong>: Transcoding operations require significant CPU, memory, and disk I/O resources. You agree not to overwhelm the system with concurrent uploads exceeding the capacity of the host infrastructure.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>3. Acceptable Content Guidelines</h2>
        <p>
          You are solely responsible for all video files uploaded to the Service. You agree that you will not upload, process, or transmit any media that:
        </p>
        <ul>
          <li>Infringes on any third-party copyright, patent, trademark, trade secret, or other proprietary rights.</li>
          <li>Contains unlawful, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable material.</li>
          <li>Contains software viruses, corrupted files, or any other computer code designed to disrupt, damage, or limit the functioning of the transcoding worker or server infrastructure.</li>
          <li>Violates any applicable local, state, national, or international law or regulation.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. Intellectual Property and Media Ownership</h2>
        <p>
          You retain all ownership rights, title, and interest in and to the media files you upload to the Service. {siteConfig.name} does not claim any copyright or intellectual property rights over your content.
        </p>
        <p>
          By uploading content, you grant the host environment a limited, non-exclusive license solely to copy, transcode, fragment, and serve the media files as required to provide adaptive streaming functionality through the Service.
        </p>
      </section>

      <section className="legal-section">
        <h2>5. Service Availability and Modifications</h2>
        <p>
          The Service is provided on an "as is" and "as available" basis. While designed for resilience using Temporal workflow orchestration and Docker containerization, uninterrupted or error-free operation is not guaranteed.
        </p>
        <p>
          System administrators reserve the right to suspend, terminate, or modify any feature, workflow, or API endpoint of the Service at any time without prior notice.
        </p>
      </section>

      <section className="legal-section">
        <h2>6. Limitation of Liability</h2>
        <p>
          In no event shall the operators, contributors, or developers of {siteConfig.name} be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation:
        </p>
        <ul>
          <li>Loss of data, video files, or transcoded HLS output resulting from hardware failure, storage cleanup, or software bugs.</li>
          <li>Interruption of service, workflow timeouts, or failed transcoding jobs.</li>
          <li>Unauthorized access to media files on unauthenticated network endpoints.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>7. Changes to Terms</h2>
        <p>
          These Terms and Conditions may be revised periodically. Any updates will be published on this page with an updated effective date. Continued use of the Service following revisions constitutes acceptance of the modified terms.
        </p>
      </section>

      <section className="legal-section">
        <h2>8. Contact Information</h2>
        <p>
          If you have questions regarding these Terms and Conditions, please contact the platform administration at:{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
      </section>
    </div>
  );
}
