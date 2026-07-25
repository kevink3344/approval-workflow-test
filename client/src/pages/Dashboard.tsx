import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import apiClient from '../api/client';
import type { ApprovalRequest, ApprovalStep, ApprovalRequestField } from '../types';
import { statusBadgeVariant, statusLabel } from '../types';

function renderFieldValue(field: ApprovalRequestField) {
  if (!field.value) return <span className="text-[--text-muted] italic">—</span>;

  if (field.columnType === 'file') {
    return (
      <a
        href={`/api/uploads/${field.id}`}
        className="text-link"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        📎 Download File
      </a>
    );
  }

  if (field.columnType === 'multiple_choice') {
    try {
      const arr: string[] = JSON.parse(field.value);
      return <span>{arr.join(', ')}</span>;
    } catch {
      return <span>{field.value}</span>;
    }
  }

  return <span className="whitespace-pre-wrap">{field.value}</span>;
}

function groupStepsBySlot(steps: ApprovalStep[]): Map<number, ApprovalStep[]> {
  const map = new Map<number, ApprovalStep[]>();
  for (const step of steps) {
    const slot = step.slotOrder || 0;
    if (!map.has(slot)) map.set(slot, []);
    map.get(slot)!.push(step);
  }
  return map;
}

function getSlotResolutionMode(steps: ApprovalStep[]): string {
  if (steps.length === 0) return 'all';
  return steps[0].resolutionMode || 'all';
}

function getSlotLabel(slotOrder: number, resolutionMode: string, groupName?: string): string {
  if (slotOrder === 0) return 'Approval Steps';
  const name = groupName || `Slot ${slotOrder}`;
  const mode = resolutionMode === 'first' ? 'First to Approve' : 'All Must Approve';
  return `${name} (${mode})`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApi<ApprovalRequest[]>('/approvals');
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [actingStepId, setActingStepId] = useState<string | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [actionError, setActionError] = useState('');

  const handleStepAction = async (requestId: string, stepId: string, action: 'approved' | 'rejected') => {
    setActionError('');
    setActingStepId(stepId);
    try {
      const res = await apiClient.patch(`/approvals/${requestId}/step/${stepId}`, {
        action,
        comment: actionComment || undefined,
      });
      setActionComment('');
      setActingStepId(null);
      setSelectedRequest(res.data);
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setActionError(axiosErr.response?.data?.message || 'Failed to act on step.');
      setActingStepId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setActionError('');
    try {
      const res = await apiClient.patch(`/approvals/${requestId}/cancel`);
      setSelectedRequest(res.data);
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setActionError(axiosErr.response?.data?.message || 'Failed to cancel request.');
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div>
      {/* Profile card */}
      <div className="surface p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-lg">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[--text]">{user?.name}</h2>
            <p className="text-sm text-[--text-muted]">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Requests section */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-[--text]">My Requests</h3>
        <Link to="/workflows" className="primary-button no-underline text-sm">
          New Request
        </Link>
      </div>

      {error && (
        <div
          className="mb-6 p-4 surface-muted"
          style={{ color: '#ba3040', borderColor: '#ffb1b8' }}
        >
          {error}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="surface p-12 text-center">
          <p className="text-[--text-muted] mb-4">No approval requests yet.</p>
          <Link to="/workflows" className="primary-button no-underline">
            Create Your First Request
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {data?.map((req) => (
          <div
            key={req.id}
            className="surface p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedRequest(req)}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-[--text]">
                  {req.workflowName}
                </h4>
                <p className="text-xs text-[--text-muted]">
                  Submitted {new Date(req.createdAt).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge
                variant={statusBadgeVariant[req.status]}
                label={statusLabel[req.status]}
              />
            </div>
            <div className="flex items-center gap-2">
              {req.steps.map((step) => (
                <div
                  key={step.id}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${
                    step.status === 'approved'
                      ? 'border-green-500 bg-green-50 text-green-600'
                      : step.status === 'rejected'
                      ? 'border-red-500 bg-red-50 text-red-600'
                      : 'border-gray-300 bg-gray-50 text-gray-400'
                  }`}
                  title={`${step.approverName || 'Approver'}: ${step.status}`}
                >
                  {step.status === 'approved' ? '\u2713' : step.status === 'rejected' ? '\u2717' : step.stepOrder + 1}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => { setSelectedRequest(null); setActionError(''); }}>
          <div className="modal-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[--text]">
                {selectedRequest.workflowName}
              </h3>
              <StatusBadge
                variant={statusBadgeVariant[selectedRequest.status]}
                label={statusLabel[selectedRequest.status]}
              />
            </div>

            <p className="text-sm text-[--text-muted] mb-4">
              Requested by {selectedRequest.requesterName} on{' '}
              {new Date(selectedRequest.createdAt).toLocaleDateString()}
            </p>

            {/* Field Values (Request Details) */}
            {selectedRequest.fields && selectedRequest.fields.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[--text] mb-3">Request Details</h4>
                <div className="space-y-2">
                  {selectedRequest.fields.map((field) => (
                    <div key={field.id} className="flex items-baseline gap-3 py-2 px-3 surface-muted">
                      <span className="text-xs font-semibold text-[--text-muted] w-32 shrink-0">
                        {field.label}
                      </span>
                      <span className="text-sm text-[--text]">
                        {renderFieldValue(field)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {actionError && (
              <div
                className="mb-4 p-3 text-sm rounded-sm"
                style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}
              >
                {actionError}
              </div>
            )}

            {/* Steps grouped by slot */}
            {(() => {
              const slotMap = groupStepsBySlot(selectedRequest.steps);
              const sortedSlots = Array.from(slotMap.entries()).sort((a, b) => a[0] - b[0]);

              return sortedSlots.map(([slotOrder, steps]) => {
                const resolutionMode = getSlotResolutionMode(steps);
                const groupName = steps[0]?.groupName;
                const label = getSlotLabel(slotOrder, resolutionMode, groupName);

                return (
                  <div key={slotOrder} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-[--text]">{label}</h4>
                      {slotOrder > 0 && (
                        <span className="badge badge-blue text-xs">
                          {resolutionMode === 'first' ? 'First to approve' : 'All must approve'}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {steps.map((step) => (
                        <div
                          key={step.id}
                          className="flex items-center justify-between py-3 px-4 surface-muted"
                        >
                          <div>
                            <p className="text-sm font-medium text-[--text]">
                              {step.approverName || step.approverId}
                            </p>
                            <p className="text-xs text-[--text-muted]">
                              {step.status === 'pending' && 'Awaiting action'}
                              {step.status === 'approved' && step.actedAt && `Approved ${new Date(step.actedAt).toLocaleString()}`}
                              {step.status === 'rejected' && step.actedAt && `Rejected ${new Date(step.actedAt).toLocaleString()}`}
                              {step.status === 'skipped' && 'Skipped'}
                              {step.comment && ` — "${step.comment}"`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <StatusBadge
                              variant={
                                step.status === 'approved'
                                  ? 'green'
                                  : step.status === 'rejected'
                                  ? 'red'
                                  : step.status === 'skipped'
                                  ? 'slate'
                                  : 'amber'
                              }
                              label={
                                step.status === 'approved'
                                  ? 'Approved'
                                  : step.status === 'rejected'
                                  ? 'Rejected'
                                  : step.status === 'skipped'
                                  ? 'Skipped'
                                  : 'Pending'
                              }
                            />

                            {/* Action buttons for pending steps assigned to current user */}
                            {step.status === 'pending' && step.approverId === user?.id && (
                              <div className="flex gap-1 ml-2">
                                <button
                                  className="primary-button text-xs py-1 px-2"
                                  style={{ background: '#1e8c52' }}
                                  onClick={() => handleStepAction(selectedRequest.id, step.id, 'approved')}
                                  disabled={actingStepId === step.id}
                                >
                                  Approve
                                </button>
                                <button
                                  className="secondary-button text-xs py-1 px-2"
                                  style={{ color: '#ba3040', borderColor: '#ffb1b8' }}
                                  onClick={() => {
                                    const comment = prompt('Rejection reason (optional):');
                                    setActionComment(comment || '');
                                    handleStepAction(selectedRequest.id, step.id, 'rejected');
                                  }}
                                  disabled={actingStepId === step.id}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}

            <div className="flex justify-end gap-3 mt-6">
              {selectedRequest.status === 'in_review' &&
                selectedRequest.requesterId === user?.id && (
                  <button
                    className="secondary-button"
                    style={{ color: '#ba3040' }}
                    onClick={() => handleCancel(selectedRequest.id)}
                  >
                    Cancel Request
                  </button>
                )}
              <button
                className="secondary-button"
                onClick={() => { setSelectedRequest(null); setActionError(''); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}