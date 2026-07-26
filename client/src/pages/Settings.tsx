import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../api/client';
import { getPublicSetting, updateSetting } from '../api/settings';
import type { LoginMode, InfoResponse, Organization } from '../types';

const LOGIN_MODE_LABELS: Record<LoginMode, string> = {
  select: 'Select User (Test)',
  password: 'Password (Production)',
  maintenance: 'System Maintenance',
};

export default function Settings() {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  // Organization management state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgFormOpen, setOrgFormOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgAdminEmail, setOrgAdminEmail] = useState('');
  const [orgAdminPassword, setOrgAdminPassword] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgError, setOrgError] = useState('');
  const [orgSuccess, setOrgSuccess] = useState('');
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);

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

      try {
        const infoRes = await apiClient.get<InfoResponse>('/info');
        setLoginModeOverride(infoRes.data.loginModeOverride);
      } catch {
        // ignore
      }
    }

    fetchLoginMode();
  }, []);

  // Fetch organizations for super admins
  useEffect(() => {
    if (!isSuperAdmin) return;

    async function fetchOrgs() {
      setOrgsLoading(true);
      try {
        const res = await apiClient.get<Organization[]>('/organizations?includeUserCount=true');
        setOrganizations(res.data);
      } catch {
        // ignore
      } finally {
        setOrgsLoading(false);
      }
    }

    fetchOrgs();
  }, [isSuperAdmin, orgSuccess]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (!orgSlug || orgSlug === generateSlug(orgName)) {
      setOrgSlug(generateSlug(value));
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError('');
    setOrgSuccess('');
    setOrgSaving(true);

    try {
      const payload: Record<string, string> = {
        name: orgName.trim(),
        slug: orgSlug.trim().toLowerCase(),
      };
      if (orgAdminEmail.trim()) {
        payload.adminEmail = orgAdminEmail.trim();
        payload.adminName = orgAdminEmail.trim();
        payload.adminPassword = orgAdminPassword || 'changeme123';
      }
      await apiClient.post('/organizations', payload);
      setOrgSuccess(`Organization "${orgName}" created successfully.`);
      setOrgFormOpen(false);
      setOrgName('');
      setOrgSlug('');
      setOrgAdminEmail('');
      setOrgAdminPassword('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setOrgError(axiosErr.response?.data?.message || 'Failed to create organization.');
    } finally {
      setOrgSaving(false);
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete "${orgName}" and ALL associated data? This cannot be undone.`)) {
      return;
    }

    setDeletingOrgId(orgId);
    setOrgError('');
    setOrgSuccess('');
    try {
      await apiClient.delete(`/organizations/${orgId}`);
      setOrganizations((prev) => prev.filter((o) => o.id !== orgId));
      setOrgSuccess(`Organization "${orgName}" deleted.`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setOrgError(axiosErr.response?.data?.message || 'Failed to delete organization.');
    } finally {
      setDeletingOrgId(null);
    }
  };

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
        {/* ── Organizations — Super Admin Only ─────────────────── */}
        {isSuperAdmin && (
          <div className="surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[--text]">Organizations</h3>
              <button
                type="button"
                className="primary-button text-sm"
                onClick={() => setOrgFormOpen(!orgFormOpen)}
              >
                {orgFormOpen ? 'Cancel' : '+ New Organization'}
              </button>
            </div>

            {orgSuccess && (
              <div
                className="mb-4 p-3 rounded-sm text-sm"
                style={{ background: '#e6fff0', color: '#1e8c52', border: '1px solid #96e0b0' }}
              >
                {orgSuccess}
              </div>
            )}

            {orgError && (
              <div
                className="mb-4 p-3 rounded-sm text-sm"
                style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}
              >
                {orgError}
              </div>
            )}

            {/* Create Organization Form */}
            {orgFormOpen && (
              <form onSubmit={handleCreateOrg} className="mb-6 p-4 bg-[--app-bg] rounded-sm border border-[--border]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field">
                    <label className="field-label">Organization Name *</label>
                    <input
                      className="input-control"
                      placeholder="Acme Corporation"
                      value={orgName}
                      onChange={(e) => handleOrgNameChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Slug *</label>
                    <input
                      className="input-control"
                      placeholder="acme-corporation"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value)}
                      required
                    />
                    <span className="text-xs text-[--text-muted]">URL-friendly identifier</span>
                  </div>
                  <div className="field">
                    <label className="field-label">Admin Email (optional)</label>
                    <input
                      type="email"
                      className="input-control"
                      placeholder="admin@acme.local"
                      value={orgAdminEmail}
                      onChange={(e) => setOrgAdminEmail(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Admin Password (optional)</label>
                    <input
                      type="password"
                      className="input-control"
                      placeholder="Default: changeme123"
                      value={orgAdminPassword}
                      onChange={(e) => setOrgAdminPassword(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="primary-button mt-4" disabled={orgSaving}>
                  {orgSaving ? 'Creating...' : 'Create Organization'}
                </button>
              </form>
            )}

            {/* Organization List */}
            {orgsLoading ? (
              <p className="text-sm text-[--text-muted]">Loading organizations...</p>
            ) : organizations.length === 0 ? (
              <p className="text-sm text-[--text-muted]">No organizations found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border] text-left text-[--text-muted]">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Slug</th>
                      <th className="py-2 pr-4 font-medium">Users</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map((org) => (
                      <tr key={org.id} className="border-b border-[--border]">
                        <td className="py-2 pr-4">{org.name}</td>
                        <td className="py-2 pr-4 text-[--text-muted]">{org.slug}</td>
                        <td className="py-2 pr-4">{org.userCount ?? '-'}</td>
                        <td className="py-2 pr-4">
                          <span className={`badge ${org.isActive ? 'badge-green' : 'badge-red'}`}>
                            {org.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            className="text-xs px-3 py-1 rounded-sm border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                            disabled={deletingOrgId === org.id}
                            onClick={() => handleDeleteOrg(org.id, org.name)}
                          >
                            {deletingOrgId === org.id ? '...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Login Mode — admin only ──────────────────────────── */}
        {isAdmin && (
          <div className="surface p-6">
            <h3 className="text-lg font-semibold text-[--text] mb-4">Login Mode</h3>

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

        {/* ── Profile ──────────────────────────────────────────── */}
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
              {user?.organizationName && (
                <span className="badge badge-green ml-2">{user.organizationName}</span>
              )}
            </div>
            {!user?.organizationId && user?.role === 'super_admin' && (
              <p className="text-xs text-[--text-muted] mb-4">
                As a Super Admin, you have access to all organizations.
              </p>
            )}
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* ── Change Password ──────────────────────────────────── */}
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