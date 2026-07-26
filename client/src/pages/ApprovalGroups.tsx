import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import LoadingSpinner from '../components/LoadingSpinner';
import apiClient from '../api/client';
import type { ApprovalGroup, UserListItem } from '../types';

export default function ApprovalGroups() {
  const { data: groups, loading, error, refetch } = useApi<ApprovalGroup[]>('/approval-groups');
  const { data: users } = useApi<UserListItem[]>('/users');

  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ApprovalGroup | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedMemberIds([]);
    setEditingGroup(null);
    setShowForm(false);
    setSubmitError('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (group: ApprovalGroup) => {
    setName(group.name);
    setDescription(group.description);
    setSelectedMemberIds(group.members?.map((m) => m.id) ?? []);
    setEditingGroup(group);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (selectedMemberIds.length === 0) {
      setSubmitError('Please select at least one member.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingGroup) {
        await apiClient.patch(`/approval-groups/${editingGroup.id}`, {
          name,
          description,
          memberIds: selectedMemberIds,
        });
      } else {
        await apiClient.post('/approval-groups', {
          name,
          description,
          memberIds: selectedMemberIds,
        });
      }
      resetForm();
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setSubmitError(axiosErr.response?.data?.message || 'Failed to save group.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    setSubmitError('');
    setSubmitting(true);
    try {
      await apiClient.delete(`/approval-groups/${groupId}`);
      setDeleteConfirm(null);
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setSubmitError(axiosErr.response?.data?.message || 'Failed to delete group.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[--text]">Approval Groups</h2>
        <button className="primary-button" onClick={openCreate}>
          + New Group
        </button>
      </div>

      {error && (
        <div className="surface-muted p-4 mb-6 text-sm" style={{ color: '#ba3040' }}>
          {error}
        </div>
      )}

      {submitError && (
        <div
          className="mb-4 p-4 rounded-sm text-sm"
          style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}
        >
          {submitError}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="surface p-6 mb-6">
          <h3 className="text-lg font-semibold text-[--text] mb-4">
            {editingGroup ? 'Edit Approval Group' : 'Create Approval Group'}
          </h3>
          <form onSubmit={handleSave}>
            <div className="field mb-4">
              <label className="field-label">Group Name</label>
              <input
                className="input-control"
                placeholder="e.g. Initial Approval"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field mb-4">
              <label className="field-label">Description</label>
              <textarea
                className="input-control"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="field mb-4">
              <label className="field-label">
                Members ({selectedMemberIds.length} selected)
              </label>
              <div className="surface-muted p-2 max-h-48 overflow-y-auto">
                {users && users.length > 0 ? (
                  users.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/50 rounded-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(u.id)}
                        onChange={() => toggleMember(u.id)}
                        className="w-4 h-4"
                      />
                      <div>
                        <p className="text-sm font-medium text-[--text]">{u.name}</p>
                        <p className="text-xs text-[--text-muted]">{u.email} &middot; {u.role}</p>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-[--text-muted] p-3">No users found.</p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? 'Saving...' : editingGroup ? 'Update Group' : 'Create Group'}
              </button>
              <button type="button" className="secondary-button" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Group list */}
      {groups && groups.length === 0 && !showForm && (
        <div className="surface p-12 text-center">
          <p className="text-[--text-muted] mb-4">No approval groups created yet.</p>
          <button className="primary-button" onClick={openCreate}>
            Create Your First Group
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {groups?.map((group) => (
          <div key={group.id} className="surface p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-[--text]">{group.name}</h4>
                {group.description && (
                  <p className="text-sm text-[--text-muted] mt-1">{group.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-3">
                  {group.members?.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-sm"
                      style={{ background: '#eaf3ff', color: '#315dc6' }}
                    >
                      {m.name}
                    </span>
                  ))}
                  {(group.members?.length ?? 0) === 0 && (
                    <span className="text-xs text-[--text-muted] italic">No members</span>
                  )}
                </div>
                <p className="text-xs text-[--text-muted] mt-3">
                  {group.members?.length ?? 0} member{(group.members?.length ?? 0) !== 1 ? 's' : ''} &middot;{' '}
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  className="secondary-button text-xs py-1 px-3"
                  onClick={() => openEdit(group)}
                >
                  Edit
                </button>
                <button
                  className="secondary-button text-xs py-1 px-3"
                  style={{ color: '#ba3040' }}
                  onClick={() => setDeleteConfirm(group.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[--text] mb-4">
              Delete Approval Group?
            </h3>
            <p className="text-sm text-[--text-muted] mb-6">
              This action cannot be undone. If this group is assigned to any workflows, the deletion will be blocked.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="secondary-button"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                style={{ background: '#ba3040' }}
                onClick={() => handleDelete(deleteConfirm)}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}