import { useEffect } from "react";
import { useParams } from "react-router-dom";

export default function Redirect() {
  const { shortCode } = useParams();

  useEffect(() => {
    window.location.replace(`/api/url/${shortCode}`);
  }, [shortCode]);

  return (
    <div className="auth-page">
      <p className="empty">Redirecting...</p>
    </div>
  );
}
