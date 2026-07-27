import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const navLinkClass = (path: string) =>
    `px-4 py-2 text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-white bg-white/15 rounded-sm'
        : 'text-white/70 hover:text-white hover:bg-white/10 rounded-sm'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fb]">
      {/* Header */}
      <header className="app-header sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="text-lg font-semibold tracking-wide no-underline text-white">
              TeamSupportPro
            </Link>

            {user && (
              <nav className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                  Dashboard
                </Link>
                <Link to="/workflows" className={navLinkClass('/workflows')}>
                  Workflows
                </Link>
                {isAdmin && (
                  <Link to="/approval-groups" className={navLinkClass('/approval-groups')}>
                    Approval Groups
                  </Link>
                )}
              </nav>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Notification bell (placeholder) */}
                <button
                  className="icon-button text-white/60 hover:text-white transition-colors bg-transparent border-0 cursor-pointer hidden md:flex items-center justify-center w-9 h-9 rounded-sm hover:bg-white/10"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </button>

                {/* Settings icon */}
                <Link
                  to="/settings"
                  className="hidden md:flex items-center justify-center w-9 h-9 rounded-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  title="Settings"
                  aria-label="Settings"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </Link>

                {/* Username */}
                <span className="hidden md:block text-sm text-white/80 font-medium">
                  {user.name}
                </span>

                {/* Logout icon */}
                <button
                  onClick={handleLogout}
                  className="hidden md:flex items-center justify-center w-9 h-9 rounded-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-0 cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm text-white/70 hover:text-white transition-colors no-underline"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-sm text-white/70 hover:text-white transition-colors no-underline"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden icon-button text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && user && (
        <div className="md:hidden bg-navy-800 border-t border-white/10 px-4 py-3 flex flex-col gap-2">
          <Link
            to="/dashboard"
            className={navLinkClass('/dashboard')}
            onClick={() => setMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            to="/workflows"
            className={navLinkClass('/workflows')}
            onClick={() => setMobileMenuOpen(false)}
          >
            Workflows
          </Link>
          {isAdmin && (
            <Link
              to="/approval-groups"
              className={navLinkClass('/approval-groups')}
              onClick={() => setMobileMenuOpen(false)}
            >
              Approval Groups
            </Link>
          )}
          <Link
            to="/settings"
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors no-underline"
            onClick={() => setMobileMenuOpen(false)}
          >
            Settings
          </Link>
          <button
            onClick={() => {
              handleLogout();
              setMobileMenuOpen(false);
            }}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors bg-transparent border-0 cursor-pointer text-left"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-[--border] py-4 px-6 text-center text-xs text-[--text-muted]">
        &copy; {new Date().getFullYear()} TeamSupportPro. All rights reserved.
      </footer>
    </div>
  );
}