import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import StreamPage from "./pages/StreamPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/stream/:videoId" element={<StreamPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="*"
          element={
            <div className="container" style={{ padding: "4rem 0", textAlign: "center" }}>
              <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>404 - Not Found</h1>
              <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
                The requested page does not exist.
              </p>
              <a href="/" className="btn btn--primary">
                Return to Catalog
              </a>
            </div>
          }
        />
      </Routes>
    </Layout>
  );
}
