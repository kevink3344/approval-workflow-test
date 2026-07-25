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
                {isAdmin && (
                  <Link to="/admin" className={navLinkClass('/admin')}>
                    Admin
                  </Link>
                )}
              </nav>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/settings"
                  className="text-sm text-white/70 hover:text-white transition-colors no-underline hidden md:block"
                >
                  {user.name}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-white/60 hover:text-white transition-colors bg-transparent border-0 cursor-pointer hidden md:block"
                >
                  Sign Out
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
          {isAdmin && (
            <Link
              to="/admin"
              className={navLinkClass('/admin')}
              onClick={() => setMobileMenuOpen(false)}
            >
              Admin
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