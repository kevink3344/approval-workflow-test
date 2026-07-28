import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import apiClient from '../api/client';
import { getPublicSetting, updateSetting } from '../api/settings';
import LoadingSpinner from '../components/LoadingSpinner';
import CollapsibleSection from '../components/CollapsibleSection';
import type { LoginMode, InfoResponse, Organization, UserListItem, WorkflowCategory } from '../types';

const LOGIN_MODE_LABELS: Record<LoginMode, string> = {
  select: 'Select User (Test)',
  password: 'Password (Production)',
  maintenance: 'System Maintenance',
};

export default function Settings() {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  // ── Organization management state ──────────────────────────────────
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

  // ── User Management state (admin only) ──────────────────────────────
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // ── Profile state ──────────────────────────────────────────────────
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Login Mode state ───────────────────────────────────────────────
  const [loginMode, setLoginMode] = useState<LoginMode>('select');
  const [loginModeSaving, setLoginModeSaving] = useState(false);
  const [loginModeError, setLoginModeError] = useState('');
  const [loginModeOverride, setLoginModeOverride] = useState<LoginMode | null>(null);
  const [maintenanceDraft, setMaintenanceDraft] = useState('');
  const [maintenanceSaved, setMaintenanceSaved] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  // ── Categories state ───────────────────────────────────────────────
  const { data: categoriesData, loading: categoriesLoading, refetch: categoriesRefetch } = useApi<WorkflowCategory[]>('/categories');
  const categories = categoriesData ?? [];
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [catError, setCatError] = useState('');
  const [catSuccess, setCatSuccess] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Sync profile state when user changes
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

  // ── Fetch users for admins ──────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;

    async function fetchUsers() {
      setUsersLoading(true);
      setUsersError('');
      try {
        const res = await apiClient.get<UserListItem[]>('/admin/users');
        setUsers(res.data);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setUsersError(axiosErr.response?.data?.message || 'Failed to load users.');
      } finally {
        setUsersLoading(false);
      }
    }

    fetchUsers();
  }, [isAdmin]);

  // ── Org handlers ───────────────────────────────────────────────────
  const generateSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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

  const handleDeleteOrg = async (orgId: string, orgTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${orgTitle}" and ALL associated data? This cannot be undone.`)) return;
    setDeletingOrgId(orgId);
    setOrgError('');
    setOrgSuccess('');
    try {
      await apiClient.delete(`/organizations/${orgId}`);
      setOrganizations((prev) => prev.filter((o) => o.id !== orgId));
      setOrgSuccess(`Organization "${orgTitle}" deleted.`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setOrgError(axiosErr.response?.data?.message || 'Failed to delete organization.');
    } finally {
      setDeletingOrgId(null);
    }
  };

  // ── User Role handlers ──────────────────────────────────────────────
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      await apiClient.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setUsersError(axiosErr.response?.data?.message || 'Failed to update role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // ── Profile handlers ───────────────────────────────────────────────
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
      await apiClient.patch(`/users/${user?.id}/password`, { currentPassword, newPassword });
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

  // ── Login Mode handlers ────────────────────────────────────────────
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

  // ── Categories handlers ────────────────────────────────────────────
  const clearCatMessages = () => {
    setCatError('');
    setCatSuccess('');
  };

  const handleCatAdd = async () => {
    clearCatMessages();
    if (!newCatName.trim()) {
      setCatError('Category name is required.');
      return;
    }
    setAddingCat(true);
    try {
      await apiClient.post('/categories', { name: newCatName.trim(), sortOrder: categories.length });
      setNewCatName('');
      setCatSuccess(`Category "${newCatName.trim()}" created.`);
      categoriesRefetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setCatError(axiosErr.response?.data?.message || 'Failed to create category.');
    } finally {
      setAddingCat(false);
    }
  };

  const startCatEdit = (cat: WorkflowCategory) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    clearCatMessages();
  };

  const cancelCatEdit = () => {
    setEditingCatId(null);
    setEditCatName('');
  };

  const handleCatSaveEdit = async (catId: string) => {
    clearCatMessages();
    if (!editCatName.trim()) {
      setCatError('Category name is required.');
      return;
    }
    try {
      await apiClient.patch(`/categories/${catId}`, { name: editCatName.trim() });
      setEditingCatId(null);
      setCatSuccess('Category updated.');
      categoriesRefetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setCatError(axiosErr.response?.data?.message || 'Failed to update category.');
    }
  };

  const handleCatToggleActive = async (cat: WorkflowCategory) => {
    clearCatMessages();
    try {
      await apiClient.patch(`/categories/${cat.id}`, { isActive: !cat.isActive });
      setCatSuccess(`Category "${cat.name}" ${cat.isActive ? 'deactivated' : 'activated'}.`);
      categoriesRefetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setCatError(axiosErr.response?.data?.message || 'Failed to toggle category.');
    }
  };

  const handleCatDelete = async (cat: WorkflowCategory) => {
    clearCatMessages();
    if (!window.confirm(`Are you sure you want to delete "${cat.name}"?`)) return;
    try {
      await apiClient.delete(`/categories/${cat.id}`);
      setCatSuccess(`Category "${cat.name}" deleted.`);
      categoriesRefetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setCatError(axiosErr.response?.data?.message || 'Failed to delete category.');
    }
  };

  // ── Categories drag-and-drop handlers ─────────────────────────────
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDropTargetIndex(index); };
  const handleDragLeave = () => setDropTargetIndex(null);

  const handleDrop = async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDropTargetIndex(null);
      return;
    }
    const updated = [...categories];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    const orders = updated.map((cat, i) => ({ id: cat.id, sortOrder: i }));
    try {
      await apiClient.patch('/categories/reorder', { orders });
      categoriesRefetch();
    } catch {
      categoriesRefetch();
    }
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div>
      <Link
        to="/dashboard"
        className="text-sm text-[--text-muted] hover:text-[--text] no-underline mb-4 inline-block"
      >
        &larr; Back to Dashboard
      </Link>

      <h2 className="text-xl font-semibold text-[--text] mb-6">Settings</h2>

      {/* Page-level error/success — always visible */}
      {error && (
        <div className="mb-4 p-4 rounded-sm text-sm" style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 rounded-sm text-sm" style={{ background: '#e6fff0', color: '#1e8c52', border: '1px solid #96e0b0' }}>
          {success}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* ── Organizations — Super Admin Only ─────────────────── */}
        {isSuperAdmin && (
          <CollapsibleSection title="Organizations">
            {orgSuccess && (
              <div className="mb-4 p-3 rounded-sm text-sm" style={{ background: '#e6fff0', color: '#1e8c52', border: '1px solid #96e0b0' }}>
                {orgSuccess}
              </div>
            )}
            {orgError && (
              <div className="mb-4 p-3 rounded-sm text-sm" style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}>
                {orgError}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[--text]">Manage Organizations</span>
              <button
                type="button"
                className="primary-button text-sm"
                onClick={() => setOrgFormOpen(!orgFormOpen)}
              >
                {orgFormOpen ? 'Cancel' : '+ New Organization'}
              </button>
            </div>

            {orgFormOpen && (
              <form onSubmit={handleCreateOrg} className="mb-6 p-4 bg-[--app-bg] rounded-sm border border-[--border]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field">
                    <label className="field-label">Organization Name *</label>
                    <input className="input-control" placeholder="Acme Corporation" value={orgName} onChange={(e) => handleOrgNameChange(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label className="field-label">Slug *</label>
                    <input className="input-control" placeholder="acme-corporation" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} required />
                    <span className="text-xs text-[--text-muted]">URL-friendly identifier</span>
                  </div>
                  <div className="field">
                    <label className="field-label">Admin Email (optional)</label>
                    <input type="email" className="input-control" placeholder="admin@acme.local" value={orgAdminEmail} onChange={(e) => setOrgAdminEmail(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-label">Admin Password (optional)</label>
                    <input type="password" className="input-control" placeholder="Default: changeme123" value={orgAdminPassword} onChange={(e) => setOrgAdminPassword(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="primary-button mt-4" disabled={orgSaving}>
                  {orgSaving ? 'Creating...' : 'Create Organization'}
                </button>
              </form>
            )}

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
          </CollapsibleSection>
        )}

        {/* ── User Management — admin only ────────────────────── */}
        {isAdmin && (
          <CollapsibleSection title="User Management">
            {usersError && (
              <div
                className="mb-4 p-3 rounded-sm text-sm"
                style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}
              >
                {usersError}
              </div>
            )}

            {usersLoading ? (
              <p className="text-sm text-[--text-muted]">Loading users...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border] text-left text-[--text-muted]">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Email</th>
                      <th className="py-2 pr-4 font-medium">Role</th>
                      <th className="py-2 font-medium w-44">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-[--border]">
                        <td className="py-2 pr-4 font-medium">{u.name}</td>
                        <td className="py-2 pr-4 text-[--text-muted]">{u.email}</td>
                        <td className="py-2 pr-4">
                          <span className={`badge ${
                            u.role === 'super_admin' ? 'badge-purple' :
                            u.role === 'admin' ? 'badge-blue' :
                            u.role === 'approver' ? 'badge-green' :
                            'badge-gray'
                          }`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={updatingUserId === u.id}
                            className="input-control text-xs py-1 px-2"
                          >
                            {(isSuperAdmin
                              ? ['user', 'approver', 'admin', 'super_admin']
                              : ['user', 'approver', 'admin']
                            ).map((role) => (
                              <option key={role} value={role}>
                                {role.replace('_', ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-[--text-muted]">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* ── Login Mode — admin only ──────────────────────────── */}
        {isAdmin && (
          <CollapsibleSection title="Login Mode">
            {loginModeOverride && (
              <div className="mb-4 p-3 rounded-sm text-sm" style={{ background: '#fff8e1', color: '#8d6e00', border: '1px solid #ffe082' }}>
                Login mode is locked to <strong>{LOGIN_MODE_LABELS[loginModeOverride]}</strong> by
                the <code>LOGIN_MODE</code> environment variable. Remove the env var to re-enable
                manual selection.
              </div>
            )}
            {loginModeError && (
              <div className="mb-4 p-3 rounded-sm text-sm" style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}>
                {loginModeError}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mb-4">
              {(Object.keys(LOGIN_MODE_LABELS) as LoginMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={loginMode === mode ? 'primary-button' : 'secondary-button'}
                  disabled={loginModeSaving || !!loginModeOverride}
                  onClick={() => handleLoginModeToggle(mode)}
                >
                  {LOGIN_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            {loginModeSaving && <span className="text-xs text-[--text-muted]">Saving...</span>}
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
                  <button type="button" className="primary-button" disabled={maintenanceSaving || !!loginModeOverride} onClick={handleMaintenanceSave}>
                    {maintenanceSaving ? 'Saving...' : 'Save Message'}
                  </button>
                  {maintenanceSaved && <span className="text-sm" style={{ color: '#1e8c52' }}>Message saved.</span>}
                </div>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* ── Categories — admin only ──────────────────────────── */}
        {isAdmin && (
          <CollapsibleSection title="Categories">
            {catError && (
              <div className="mb-4 p-3 text-sm rounded-sm" style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}>
                {catError}
              </div>
            )}
            {catSuccess && (
              <div className="mb-4 p-3 text-sm rounded-sm" style={{ background: '#e6fff0', color: '#1e8c52', border: '1px solid #96e0b0' }}>
                {catSuccess}
              </div>
            )}

            {categoriesLoading ? (
              <LoadingSpinner className="py-8" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border]">
                      <th className="text-left py-3 px-2 font-semibold text-[--text-muted] uppercase tracking-wider text-xs w-8"></th>
                      <th className="text-left py-3 px-3 font-semibold text-[--text-muted] uppercase tracking-wider text-xs">Name</th>
                      <th className="text-left py-3 px-3 font-semibold text-[--text-muted] uppercase tracking-wider text-xs w-28">Status</th>
                      <th className="text-right py-3 px-3 font-semibold text-[--text-muted] uppercase tracking-wider text-xs w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Add row */}
                    <tr className="border-b border-[--border] bg-[--bg]">
                      <td className="py-3 px-2 text-center">
                        <span className="text-xs text-[--text-muted] select-none">+</span>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          className="input-control text-sm w-full"
                          placeholder="New category name..."
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCatAdd(); }}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-[--text-muted]">&mdash;</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button className="primary-button text-xs" onClick={handleCatAdd} disabled={addingCat || !newCatName.trim()}>
                          {addingCat ? 'Adding...' : 'Add'}
                        </button>
                      </td>
                    </tr>

                    {categories.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-sm text-[--text-muted]">
                          No categories yet. Add your first category above.
                        </td>
                      </tr>
                    )}

                    {categories.map((cat, index) => (
                      <tr
                        key={cat.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => { e.preventDefault(); handleDrop(index); }}
                        onDragEnd={handleDragEnd}
                        className={`border-b border-[--border] transition-colors ${
                          dragIndex === index
                            ? 'opacity-40'
                            : dropTargetIndex === index
                            ? 'bg-accent/5 border-t-2 border-t-accent'
                            : 'hover:bg-[--bg]'
                        }`}
                        style={{ cursor: 'grab' }}
                      >
                        <td className="py-3 px-2 text-center">
                          <span className="text-[--text-muted] select-none cursor-grab active:cursor-grabbing" style={{ fontSize: '16px', lineHeight: 1, userSelect: 'none' }} title="Drag to reorder">
                            ⋮⋮
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {editingCatId === cat.id ? (
                            <input
                              className="input-control text-sm w-full"
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCatSaveEdit(cat.id);
                                if (e.key === 'Escape') cancelCatEdit();
                              }}
                              autoFocus
                            />
                          ) : (
                            <span className="text-[--text] font-medium">{cat.name}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            className={`text-xs px-2 py-1 rounded-full border font-medium cursor-pointer transition-colors ${
                              cat.isActive
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                            onClick={(e) => { e.stopPropagation(); handleCatToggleActive(cat); }}
                            title={cat.isActive ? 'Click to deactivate' : 'Click to activate'}
                          >
                            {cat.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {editingCatId === cat.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button className="primary-button text-xs" onClick={() => handleCatSaveEdit(cat.id)}>Save</button>
                              <button className="secondary-button text-xs" onClick={cancelCatEdit}>Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button className="icon-button" style={{ padding: '4px' }} onClick={() => startCatEdit(cat)} title="Edit">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button className="icon-button" style={{ padding: '4px', color: '#ba3040' }} onClick={() => handleCatDelete(cat)} title="Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-[--text-muted] mt-4">
              Drag the <strong>⋮⋮</strong> handle to reorder categories. Categories in use by one or more workflows cannot be deleted &mdash; deactivate them instead.
            </p>
          </CollapsibleSection>
        )}

        {/* ── Profile ──────────────────────────────────────────── */}
        <CollapsibleSection title="Profile">
          <form onSubmit={handleSaveProfile}>
            <div className="field mb-4">
              <label className="field-label">Full Name</label>
              <input className="input-control" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field mb-4">
              <label className="field-label">Email</label>
              <input className="input-control" value={email} disabled />
              <span className="text-xs text-[--text-muted] mt-1">Contact an administrator to change your email address.</span>
            </div>
            <div className="field mb-4">
              <label className="field-label">Role</label>
              <span className="badge badge-blue">{user?.role}</span>
              {user?.organizationName && <span className="badge badge-green ml-2">{user.organizationName}</span>}
            </div>
            {!user?.organizationId && user?.role === 'super_admin' && (
              <p className="text-xs text-[--text-muted] mb-4">As a Super Admin, you have access to all organizations.</p>
            )}
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </CollapsibleSection>

        {/* ── Change Password ──────────────────────────────────── */}
        <CollapsibleSection title="Change Password">
          <form onSubmit={handleChangePassword}>
            <div className="field mb-4">
              <label className="field-label">Current Password</label>
              <input type="password" className="input-control" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="field mb-4">
              <label className="field-label">New Password</label>
              <input type="password" className="input-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div className="field mb-4">
              <label className="field-label">Confirm New Password</label>
              <input type="password" className="input-control" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <button type="submit" className="secondary-button" disabled={saving}>
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </CollapsibleSection>
      </div>
    </div>
  );
}