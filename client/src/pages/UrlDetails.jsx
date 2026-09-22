import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import Layout from "../components/Layout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

const CHART_COLORS = ["#6750a4", "#7d5260", "#625b71", "#006d6f", "#904d60", "#4a6267", "#7c5800"];

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
  const [toggling, setToggling] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const analytics = await api.analytics(shortCode, token);
      setData(analytics.data);
    } catch (e) {
      setError(e.message);
    }
  }, [shortCode, token]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const analytics = await api.analytics(shortCode, token);
        if (!cancelled) setData(analytics.data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };
    run();
    const timer = setInterval(run, 5000);
    return () => { cancelled = true; clearInterval(timer); };
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
    return () => { cancelled = true; };
  }, [shortCode]);

  const handleToggleAnalytics = async () => {
    setToggling(true);
    setActionError("");
    try {
      await api.toggleAnalytics(shortCode, token);
      await loadAnalytics();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setToggling(false);
    }
  };

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
      await loadAnalytics();
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
        <Link to="/" className="btn btn-ghost btn-sm">Back</Link>
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

  const hasClickData =
    (data.clicksByDate && data.clicksByDate.length > 0) ||
    (data.clicksByBrowser && data.clicksByBrowser.length > 0) ||
    (data.clicksByCountry && data.clicksByCountry.length > 0);

  return (
    <Layout>
      <Link to="/" className="btn btn-ghost btn-sm">&larr; Back</Link>
      <section className="detail">
        <div className="card detail-card">
          <div className="detail-title-row">
            <h2 className="section-title">Analytics</h2>
            <div className="detail-actions">
              {!editing && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={startEdit}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={busy}>Delete</button>
                </>
              )}
            </div>
          </div>
          <dl className="detail-rows">
            <div className={`detail-row ${editing ? "detail-row-edit" : ""}`}>
              <dt>{editing ? <label htmlFor="edit-url">Original URL</label> : "Original URL"}</dt>
              <dd>
                {editing ? (
                  <form className="edit-inline" onSubmit={handleUpdate}>
                    <input className="input" id="edit-url" type="url" value={editedUrl} onChange={(e) => setEditedUrl(e.target.value)} required autoFocus />
                    <div className="edit-actions">
                      <button className="btn btn-primary btn-sm" disabled={busy}>Save</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <a className="link" href={data.originalUrl} target="_blank" rel="noopener noreferrer">{data.originalUrl}</a>
                )}
              </dd>
            </div>
            <div className="detail-row">
              <dt>Short URL</dt>
              <dd>
                <a className="link" href={`${window.location.origin}/${data.shortCode}`} target="_blank" rel="noopener noreferrer">
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
                <span className={`status ${data.status === "Active" ? "status-active" : "status-inactive"}`}>{data.status}</span>
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
          {qr && <img className="qr" src={qr} alt={`QR code for ${data.shortCode}`} />}
        </div>
      </section>

      <section className="analytics-section">
        <div className="card analytics-toggle-card">
          <div className="analytics-toggle-row">
            <div>
              <h3 className="analytics-toggle-title">Click Analytics</h3>
              <p className="analytics-toggle-sub">
                {data.analyticsEnabled ? "Tracking visitor details for this link" : "Analytics tracking is disabled"}
              </p>
            </div>
            <button
              className={`toggle-switch ${data.analyticsEnabled ? "toggle-on" : ""}`}
              onClick={handleToggleAnalytics}
              disabled={toggling}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>

        {data.analyticsEnabled && (
          <>
            <div className="charts-grid">
              {data.clicksByDate && data.clicksByDate.length > 0 && (
                <div className="card chart-card chart-card-wide">
                  <h3 className="chart-title">Clicks Over Time</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.clicksByDate}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0dde6" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#79747e" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#79747e" />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Line type="monotone" dataKey="clicks" stroke="#6750a4" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {data.clicksByDevice && data.clicksByDevice.length > 0 && (
                <div className="card chart-card">
                  <h3 className="chart-title">Devices</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={data.clicksByDevice} dataKey="clicks" nameKey="device" cx="50%" cy="50%" outerRadius={80} label={({ device, percent }) => `${device} ${(percent * 100).toFixed(0)}%`}>
                        {data.clicksByDevice.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {data.clicksByBrowser && data.clicksByBrowser.length > 0 && (
                <div className="card chart-card">
                  <h3 className="chart-title">Browsers</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={data.clicksByBrowser} dataKey="clicks" nameKey="browser" cx="50%" cy="50%" outerRadius={80} label={({ browser, percent }) => `${browser} ${(percent * 100).toFixed(0)}%`}>
                        {data.clicksByBrowser.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {data.clicksByCountry && data.clicksByCountry.length > 0 && (
                <div className="card chart-card">
                  <h3 className="chart-title">Locations</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={data.clicksByCountry} dataKey="clicks" nameKey="country" cx="50%" cy="50%" outerRadius={80} label={({ country, percent }) => `${country} ${(percent * 100).toFixed(0)}%`}>
                        {data.clicksByCountry.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {data.clicksByOs && data.clicksByOs.length > 0 && (
                <div className="card chart-card">
                  <h3 className="chart-title">Operating Systems</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={data.clicksByOs} dataKey="clicks" nameKey="os" cx="50%" cy="50%" outerRadius={80} label={({ os, percent }) => `${os} ${(percent * 100).toFixed(0)}%`}>
                        {data.clicksByOs.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {data.clicksByReferrer && data.clicksByReferrer.length > 0 && (
              <div className="card referrers-card">
                <h3 className="chart-title">Top Referrers</h3>
                <div className="referrer-list">
                  {data.clicksByReferrer.map((r, i) => (
                    <div className="referrer-row" key={i}>
                      <span className="referrer-url">{r.referrer}</span>
                      <span className="clicks">{r.clicks}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.recentClicks && data.recentClicks.length > 0 && (
              <div className="card recent-clicks-card">
                <h3 className="chart-title">Recent Clicks</h3>
                <div className="clicks-table-wrap">
                  <table className="clicks-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Browser</th>
                        <th>OS</th>
                        <th>Device</th>
                        <th>Country</th>
                        <th>City</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentClicks.map((c, i) => (
                        <tr key={i}>
                          <td>{fmt(c.timestamp)}</td>
                          <td>{c.browser}</td>
                          <td>{c.os}</td>
                          <td>{c.device}</td>
                          <td>{c.country}</td>
                          <td>{c.city}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!hasClickData && (
              <div className="card empty-analytics-card">
                <p className="empty">No click data yet. Share your link to start tracking!</p>
              </div>
            )}
          </>
        )}
      </section>
    </Layout>
  );
}
