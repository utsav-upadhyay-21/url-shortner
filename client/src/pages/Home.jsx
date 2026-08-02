import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function Home() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [urls, setUrls] = useState([]);
  const [originalUrl, setOriginalUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUrls = async () => {
    try {
      const data = await api.myUrls(token);
      setUrls(data.data || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadUrls();
  }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.createUrl(originalUrl, token);
      setOriginalUrl("");
      await loadUrls();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const shortUrl = (code) => `${window.location.origin}/${code}`;

  return (
    <Layout>
      <section className="hero">
        <div className="blob blob-a" aria-hidden="true" />
        <div className="blob blob-b" aria-hidden="true" />
        <h1>Hello, {user?.name}</h1>
        <p className="hero-sub">Shorten a link and share it anywhere.</p>
        <form className="create-form" onSubmit={handleCreate}>
          <input
            className="input"
            type="url"
            placeholder="Paste a long URL..."
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            required
          />
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Shorten"}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="urls">
        <h2 className="section-title">My URLs</h2>
        {urls.length === 0 && <p className="empty">No URLs yet.</p>}
        <ul className="url-list">
          {urls.map((url) => (
            <li key={url._id}>
              <button
                className="url-item"
                onClick={() => navigate(`/url/${url.shortCode}`)}
              >
                <div className="url-main">
                  <span className="url-short">{shortUrl(url.shortCode)}</span>
                  <span className="url-original">{url.originalUrl}</span>
                </div>
                <span className="clicks">{url.clicks} clicks</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
