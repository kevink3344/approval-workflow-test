import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../api/client';
import { getPublicSetting, updateSetting } from '../api/settings';
import type { LoginMode, InfoResponse } from '../types';

const LOGIN_MODE_LABELS: Record<LoginMode, string> = {
  select: 'Select User (Test)',
  password: 'Password (Production)',
  maintenance: 'System Maintenance',
};

export default function Settings() {
  const { user, isAdmin } = useAuth();

  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login Mode state
  const [loginMode, setLoginMode] = useState<LoginMode>('select');
  const [loginModeSaving, setLoginModeSaving] = useState(false);
  const [loginModeError, setLoginModeError] = useState('');
  const [loginModeOverride, setLoginModeOverride] = useState<LoginMode | null>(null);

  // Maintenance message state
  const [maintenanceDraft, setMaintenanceDraft] = useState('');
  const [maintenanceSaved, setMaintenanceSaved] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  // Fetch login mode on mount
  useEffect(() => {
    async function fetchLoginMode() {
      try {
        const [modeRes, msgRes] = await Promise.all([
          getPublicSetting('login_mode'),
          getPublicSetting('maintenance_message'),
        ]);

        const mode = modeRes.value as LoginMode;
        setLoginMode(mode || 'select');

        if (mode === 'maintenance') {
          setMaintenanceDraft(msgRes.value || '');
        }
      } catch {
        // ignore
      }

      // Fetch info override separately
      try {
        const infoRes = await apiClient.get<InfoResponse>('/info');
        setLoginModeOverride(infoRes.data.loginModeOverride);
      } catch {
        // ignore
      }
    }

    fetchLoginMode();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await apiClient.patch(`/users/${user?.id}`, { name });
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch(`/users/${user?.id}/password`, {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password changed successfully.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoginModeToggle = useCallback(
    async (nextMode: LoginMode) => {
      const prev = loginMode;
      setLoginMode(nextMode);
      setLoginModeSaving(true);
      setLoginModeError('');
      setSuccess('');
      try {
        await updateSetting('login_mode', nextMode);
        // If switching away from maintenance, clear draft
        if (nextMode !== 'maintenance') {
          setMaintenanceDraft('');
          setMaintenanceSaved(false);
        }
      } catch (err: unknown) {
        setLoginMode(prev);
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setLoginModeError(axiosErr.response?.data?.message || 'Failed to update login mode.');
      } finally {
        setLoginModeSaving(false);
      }
    },
    [loginMode],
  );

  const handleMaintenanceSave = useCallback(async () => {
    setMaintenanceSaving(true);
    setMaintenanceSaved(false);
    setLoginModeError('');
    try {
      await updateSetting('maintenance_message', maintenanceDraft);
      setMaintenanceSaved(true);
      setTimeout(() => setMaintenanceSaved(false), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setLoginModeError(axiosErr.response?.data?.message || 'Failed to save maintenance message.');
    } finally {
      setMaintenanceSaving(false);
    }
  }, [maintenanceDraft]);

  return (
    <div>
      <Link
        to="/dashboard"
        className="text-sm text-[--text-muted] hover:text-[--text] no-underline mb-4 inline-block"
      >
        &larr; Back to Dashboard
      </Link>

      <h2 className="text-xl font-semibold text-[--text] mb-6">Settings</h2>

      {error && (
        <div
          className="mb-4 p-4 rounded-sm text-sm"
          style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="mb-4 p-4 rounded-sm text-sm"
          style={{ background: '#e6fff0', color: '#1e8c52', border: '1px solid #96e0b0' }}
        >
          {success}
        </div>
      )}

      <div className="grid gap-6">
        {/* Login Mode — admin only */}
        {isAdmin && (
          <div className="surface p-6">
            <h3 className="text-lg font-semibold text-[--text] mb-4">Login Mode</h3>

            {/* Env override banner */}
            {loginModeOverride && (
              <div
                className="mb-4 p-3 rounded-sm text-sm"
                style={{
                  background: '#fff8e1',
                  color: '#8d6e00',
                  border: '1px solid #ffe082',
                }}
              >
                Login mode is locked to <strong>{LOGIN_MODE_LABELS[loginModeOverride]}</strong> by
                the <code>LOGIN_MODE</code> environment variable. Remove the env var to re-enable
                manual selection.
              </div>
            )}

            {loginModeError && (
              <div
                className="mb-4 p-3 rounded-sm text-sm"
                style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}
              >
                {loginModeError}
              </div>
            )}

            <div className="flex flex-wrap gap-3 mb-4">
              {(Object.keys(LOGIN_MODE_LABELS) as LoginMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    loginMode === mode
                      ? 'primary-button'
                      : 'secondary-button'
                  }
                  disabled={loginModeSaving || !!loginModeOverride}
                  onClick={() => handleLoginModeToggle(mode)}
                >
                  {LOGIN_MODE_LABELS[mode]}
                </button>
              ))}
            </div>

            {loginModeSaving && (
              <span className="text-xs text-[--text-muted]">Saving...</span>
            )}

            {/* Maintenance message editor */}
            {loginMode === 'maintenance' && (
              <div className="mt-4 pt-4 border-t border-[--border]">
                <label className="field-label mb-2 block">Maintenance Message</label>
                <textarea
                  className="input-control mb-3"
                  rows={4}
                  placeholder="Enter a message to display to users during maintenance..."
                  value={maintenanceDraft}
                  onChange={(e) => setMaintenanceDraft(e.target.value)}
                  disabled={!!loginModeOverride}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={maintenanceSaving || !!loginModeOverride}
                    onClick={handleMaintenanceSave}
                  >
                    {maintenanceSaving ? 'Saving...' : 'Save Message'}
                  </button>
                  {maintenanceSaved && (
                    <span className="text-sm" style={{ color: '#1e8c52' }}>
                      Message saved.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile */}
        <div className="surface p-6">
          <h3 className="text-lg font-semibold text-[--text] mb-4">Profile</h3>
          <form onSubmit={handleSaveProfile}>
            <div className="field mb-4">
              <label className="field-label">Full Name</label>
              <input
                className="input-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field mb-4">
              <label className="field-label">Email</label>
              <input className="input-control" value={email} disabled />
              <span className="text-xs text-[--text-muted] mt-1">
                Contact an administrator to change your email address.
              </span>
            </div>
            <div className="field mb-4">
              <label className="field-label">Role</label>
              <span className="badge badge-blue">{user?.role}</span>
            </div>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="surface p-6">
          <h3 className="text-lg font-semibold text-[--text] mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword}>
            <div className="field mb-4">
              <label className="field-label">Current Password</label>
              <input
                type="password"
                className="input-control"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="field mb-4">
              <label className="field-label">New Password</label>
              <input
                type="password"
                className="input-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="field mb-4">
              <label className="field-label">Confirm New Password</label>
              <input
                type="password"
                className="input-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="secondary-button" disabled={saving}>
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}