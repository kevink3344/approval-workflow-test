import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getPublicSetting } from '../api/settings';
import apiClient from '../api/client';
import type { LoginMode, UserListItem } from '../types';

export default function Login() {
  const { loginSelect, loginPassword } = useAuth();
  const navigate = useNavigate();

  // Login mode state
  const [loginMode, setLoginMode] = useState<LoginMode | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // Admin override for maintenance mode
  const adminOverride = new URLSearchParams(window.location.search).get('admin') === '1';

  // Password form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Select user state
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Shared state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch login mode and users on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const [modeRes, msgRes] = await Promise.all([
          getPublicSetting('login_mode'),
          getPublicSetting('maintenance_message'),
        ]);
        const mode = modeRes.value as LoginMode;
        setLoginMode(mode || 'select');

        if (mode === 'maintenance') {
          setMaintenanceMessage(msgRes.value || '');
        }
      } catch {
        setLoginMode('select');
      }
    }

    async function fetchUsers() {
      try {
        const res = await apiClient.get<{ users: UserListItem[] }>('/auth/users');
        setUsers(res.data.users);
        if (res.data.users.length > 0) {
          setSelectedUserId(res.data.users[0].id);
        }
      } catch {
        // users endpoint will work even if unauthenticated
      }
    }

    fetchSettings();
    fetchUsers();
  }, []);

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        await loginPassword(email, password);
        navigate('/dashboard');
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Invalid email or password.');
      } finally {
        setLoading(false);
      }
    },
    [email, password, loginPassword, navigate],
  );

  const handleSelectSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedUserId) {
        setError('Please select a user.');
        return;
      }
      setError('');
      setLoading(true);
      try {
        await loginSelect(selectedUserId);
        navigate('/dashboard');
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Failed to sign in.');
      } finally {
        setLoading(false);
      }
    },
    [selectedUserId, loginSelect, navigate],
  );

  // Still loading
  if (loginMode === null) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <p className="text-center text-[--text-muted]">Loading...</p>
        </div>
      </div>
    );
  }

  const showSelectForm = loginMode === 'select';
  const showPasswordForm =
    loginMode === 'password' || (loginMode === 'maintenance' && adminOverride);
  const showMaintenance = loginMode === 'maintenance' && !adminOverride;

  return (
    <div className="login-shell">
      <div className="login-card">
        {/* Maintenance mode banner */}
        {showMaintenance && (
          <div className="mb-6">
            <div
              className="p-4 rounded-sm text-sm text-center mb-4"
              style={{ background: '#fff3e0', color: '#c25d00', border: '1px solid #ffcc80' }}
            >
              <h2 className="text-lg font-semibold mb-2">
                System Maintenance
              </h2>
              {maintenanceMessage ? (
                <p className="whitespace-pre-wrap">{maintenanceMessage}</p>
              ) : (
                <p>
                  The system is currently undergoing scheduled maintenance. Please check back
                  shortly.
                </p>
              )}
            </div>
            <p className="text-xs text-center text-[--text-muted]">
              If you are an administrator,{' '}
              <a href="?admin=1" className="text-link">
                click here
              </a>{' '}
              to sign in.
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="mb-6 p-3 text-sm font-medium rounded-sm"
            style={{
              background: '#ffe8ea',
              color: '#ba3040',
              border: '1px solid #ffb1b8',
            }}
          >
            {error}
          </div>
        )}

        {/* Select User Form */}
        {showSelectForm && (
          <>
            <h1 className="text-2xl font-semibold text-[--text] mb-1 text-center">
              Welcome Back
            </h1>
            <p className="text-sm text-[--text-muted] mb-8 text-center">
              Select your account to sign in
            </p>

            <form onSubmit={handleSelectSubmit}>
              <div className="field mb-6">
                <label htmlFor="userSelect" className="field-label">
                  Select User
                </label>
                <select
                  id="userSelect"
                  className="input-control"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) — {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="primary-button w-full mb-6"
                disabled={loading || users.length === 0}
              >
                {loading ? 'Signing In...' : 'Sign In as Selected User'}
              </button>
            </form>
          </>
        )}

        {/* Password Form */}
        {showPasswordForm && (
          <>
            <h1 className="text-2xl font-semibold text-[--text] mb-1 text-center">
              {adminOverride ? 'Admin Sign In' : 'Welcome Back'}
            </h1>
            <p className="text-sm text-[--text-muted] mb-8 text-center">
              Sign in to your TeamSupportPro account
            </p>

            <form onSubmit={handlePasswordSubmit}>
              <div className="field mb-5">
                <label htmlFor="email" className="field-label">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className="input-control"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="field mb-6">
                <label htmlFor="password" className="field-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input-control"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="primary-button w-full mb-6"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </>
        )}

        {/* Register link — only if not maintenance */}
        {!showMaintenance && (
          <p className="text-center text-sm text-[--text-muted]">
            Don't have an account?{' '}
            <Link to="/register" className="text-link">
              Create one
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}