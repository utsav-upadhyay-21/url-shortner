import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode";
import Layout from "../components/Layout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

export default function UrlDetails() {
  const { shortCode } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedUrl, setEditedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      try {
        const analytics = await api.analytics(shortCode, token);
        if (cancelled) return;
        setData(analytics.data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };

    loadAnalytics();
    const timer = setInterval(loadAnalytics, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [shortCode, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qrData = await QRCode.toDataURL(
          `${window.location.origin}/${shortCode}`,
          { width: 200, margin: 1 }
        );
        if (!cancelled) setQr(qrData);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shortCode]);

  const startEdit = () => {
    setEditedUrl(data.originalUrl);
    setActionError("");
    setEditing(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      await api.updateUrl(shortCode, editedUrl, token);
      const analytics = await api.analytics(shortCode, token);
      setData(analytics.data);
      setEditing(false);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this short URL?")) return;
    setBusy(true);
    setActionError("");
    try {
      await api.deleteUrl(shortCode, token);
      navigate("/");
    } catch (e) {
      setActionError(e.message);
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Layout>
        <Link to="/" className="btn btn-ghost btn-sm">
          Back
        </Link>
        <p className="error-text">{error}</p>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <p className="empty">Loading...</p>
      </Layout>
    );
  }

  const fmt = (d) => (d ? new Date(d).toLocaleString() : "Never");

  return (
    <Layout>
      <Link to="/" className="btn btn-ghost btn-sm">
        &larr; Back
      </Link>
      <section className="detail">
        <div className="card detail-card">
          <div className="detail-title-row">
            <h2 className="section-title">Analytics</h2>
            <div className="detail-actions">
              {!editing && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={startEdit}>
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleDelete}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
          <dl className="detail-rows">
            <div className={`detail-row ${editing ? "detail-row-edit" : ""}`}>
              <dt>
                {editing ? <label htmlFor="edit-url">Original URL</label> : "Original URL"}
              </dt>
              <dd>
                {editing ? (
                  <form className="edit-inline" onSubmit={handleUpdate}>
                    <input
                      className="input"
                      id="edit-url"
                      type="url"
                      value={editedUrl}
                      onChange={(e) => setEditedUrl(e.target.value)}
                      required
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button className="btn btn-primary btn-sm" disabled={busy}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditing(false)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <a
                    className="link"
                    href={data.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {data.originalUrl}
                  </a>
                )}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Short URL</dt>
              <dd>
                <a
                  className="link"
                  href={`${window.location.origin}/${data.shortCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {`${window.location.origin}/${data.shortCode}`}
                </a>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Clicks</dt>
              <dd>{data.clicks}</dd>
            </div>
            <div className="detail-row">
              <dt>Status</dt>
              <dd>
                <span
                  className={`status ${
                    data.status === "Active" ? "status-active" : "status-inactive"
                  }`}
                >
                  {data.status}
                </span>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Created</dt>
              <dd>{fmt(data.createdAt)}</dd>
            </div>
          </dl>
          {actionError && <p className="error-text">{actionError}</p>}
        </div>
        <div className="card qr-card">
          <h3 className="qr-title">QR Code</h3>
          {qr && (
            <img
              className="qr"
              src={qr}
              alt={`QR code for ${data.shortCode}`}
            />
          )}
        </div>
      </section>
    </Layout>
  );
}
