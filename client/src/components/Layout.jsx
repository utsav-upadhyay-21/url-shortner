import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="header">
        <div className="page header-inner">
          <Link to="/" className="brand">
            Smart URL
          </Link>
          <div className="header-actions">
            {user && <span className="header-user">{user.name}</span>}
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
