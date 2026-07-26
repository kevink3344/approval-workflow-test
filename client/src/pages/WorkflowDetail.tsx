import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import apiClient from '../api/client';
import type { Workflow, WorkflowColumn } from '../types';

interface FieldValue {
  columnId: string;
  value: string | null;
}

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: workflow, loading, error } = useApi<Workflow>(`/workflows/${id}`);

  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

  const initFieldValues = () => {
    if (!workflow?.columns) return;
    const vals: Record<string, string> = {};
    for (const col of workflow.columns) {
      vals[col.id] = '';
    }
    setFieldValues(vals);
    setFieldErrors({});
  };

  const handleFieldChange = (columnId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [columnId]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  };

  const handleFileUpload = async (columnId: string, file: File) => {
    setUploadingFiles((prev) => ({ ...prev, [columnId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      handleFieldChange(columnId, res.data.fieldId);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setFieldErrors((prev) => ({
        ...prev,
        [columnId]: axiosErr.response?.data?.message || 'Upload failed.',
      }));
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [columnId]: false }));
    }
  };

  const validateFields = (): boolean => {
    if (!workflow?.columns) return true;
    const errors: Record<string, string> = {};

    for (const col of workflow.columns) {
      const val = fieldValues[col.id] || '';
      if (col.isRequired && !val.trim()) {
        errors[col.id] = 'This field is required.';
      }
      if (col.columnType === 'single_choice' && val && col.options) {
        if (!col.options.includes(val)) {
          errors[col.id] = 'Invalid option selected.';
        }
      }
      if (col.columnType === 'multiple_choice' && val) {
        try {
          const selected: string[] = JSON.parse(val);
          if (!Array.isArray(selected)) {
            errors[col.id] = 'Invalid format.';
          } else if (col.options && selected.some((s) => !col.options!.includes(s))) {
            errors[col.id] = 'Invalid option selected.';
          }
        } catch {
          errors[col.id] = 'Invalid format.';
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenForm = () => {
    // If no custom columns exist, submit directly without showing a form
    if (!hasColumns) {
      handleSubmitRequest();
      return;
    }
    initFieldValues();
    setShowSubmitForm(true);
    setSubmitError('');
    setSuccess('');
  };

  const handleSubmitRequest = async () => {
    setSubmitError('');
    setSuccess('');

    if (!validateFields()) return;

    setSubmitting(true);
    try {
      const fields: FieldValue[] = workflow?.columns?.map((col) => ({
        columnId: col.id,
        value: fieldValues[col.id] || null,
      })) || [];

      await apiClient.post('/approvals', { workflowId: id, fields });
      setSuccess('Approval request submitted successfully!');
      setShowSubmitForm(false);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setSubmitError(axiosErr.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderReadOnlyValue = (column: WorkflowColumn, value: string | null) => {
    if (!value) return <span className="text-[--text-muted] italic">—</span>;

    if (column.columnType === 'single_choice') {
      return <span className="text-[--text]">{value}</span>;
    }

    if (column.columnType === 'multiple_choice') {
      try {
        const arr: string[] = JSON.parse(value);
        return (
          <span className="text-[--text]">
            {arr.join(', ')}
          </span>
        );
      } catch {
        return <span className="text-[--text]">{value}</span>;
      }
    }

    if (column.columnType === 'date') {
      return <span className="text-[--text]">{value}</span>;
    }

    if (column.columnType === 'file') {
      return (
        <a
          href={`/api/uploads/${value}`}
          className="text-link"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          📎 {value.length > 36 ? 'Download File' : value}
        </a>
      );
    }

    return <span className="text-[--text] whitespace-pre-wrap">{value}</span>;
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  if (error) {
    return (
      <div className="surface-muted p-8 text-center">
        <p className="text-[--text-muted] mb-4">{error}</p>
        <Link to="/workflows" className="text-link">
          Back to Workflows
        </Link>
      </div>
    );
  }

  if (!workflow) return null;

  const hasSlots = workflow.slots && workflow.slots.length > 0;
  const hasSteps = workflow.steps && workflow.steps.length > 0;
  const hasColumns = workflow.columns && workflow.columns.length > 0;

  return (
    <div>
      <Link to="/workflows" className="text-sm text-[--text-muted] hover:text-[--text] no-underline mb-4 inline-block">
        &larr; Back to Workflows
      </Link>

      <div className="surface p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[--text]">{workflow.name}</h2>
            <p className="text-sm text-[--text-muted] mt-2">{workflow.description}</p>
          </div>
          <span className="badge badge-slate">{workflow.status}</span>
        </div>

        <p className="text-xs text-[--text-muted]">
          Created {new Date(workflow.createdAt).toLocaleDateString()}
          {hasSlots && <> &middot; {workflow.slots!.length} slot{workflow.slots!.length !== 1 ? 's' : ''}</>}
          {!hasSlots && hasSteps && <> &middot; {workflow.steps!.length} step{workflow.steps!.length !== 1 ? 's' : ''}</>}
          {hasColumns && <> &middot; {workflow.columns!.length} field{workflow.columns!.length !== 1 ? 's' : ''}</>}
        </p>
      </div>

      {/* Display Columns (read-only) */}
      {hasColumns && !showSubmitForm && (
        <div className="surface p-6 mb-6">
          <h3 className="text-lg font-semibold text-[--text] mb-4">Custom Fields</h3>
          <div className="space-y-2">
            {workflow.columns!.map((col) => (
              <div key={col.id} className="flex items-baseline gap-2 py-2 px-3 surface-muted">
                <span className="text-sm font-medium text-[--text] w-40 shrink-0">
                  {col.label}
                  {col.isRequired && <span style={{ color: '#ba3040' }}> *</span>}
                </span>
                <span className="text-xs text-[--text-muted] uppercase">{col.columnType}</span>
                {col.options && (
                  <span className="text-xs text-[--text-muted]">
                    ({col.options.length} options)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Slots (new) */}
      {hasSlots && (
        <div className="surface p-6 mb-6">
          <h3 className="text-lg font-semibold text-[--text] mb-4">Approval Slots</h3>
          <div className="space-y-3">
            {workflow.slots!.map((slot) => (
              <div key={slot.id || slot.slotOrder} className="flex items-center gap-4 py-3 px-4 surface-muted">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
                  {slot.slotOrder || 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[--text]">
                    {slot.group?.name || 'Unknown Group'}
                  </p>
                  <p className="text-xs text-[--text-muted]">
                    {slot.group?.memberCount ?? '?'} member{slot.group?.memberCount !== 1 ? 's' : ''} &middot;{' '}
                    {slot.resolutionMode === 'first' ? 'First to Approve' : 'All Must Approve'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Steps (fallback for workflows without slots) */}
      {!hasSlots && hasSteps && (
        <div className="surface p-6 mb-6">
          <h3 className="text-lg font-semibold text-[--text] mb-4">Approval Steps</h3>
          <div className="space-y-3">
            {workflow.steps!
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <div key={step.id} className="flex items-center gap-4 py-3 px-4 surface-muted">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
                    {step.order + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[--text]">{step.approverName || 'Approver'}</p>
                    <p className="text-xs text-[--text-muted]">Step {step.order + 1}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {!hasSlots && !hasSteps && (
        <div className="surface p-6 mb-6">
          <p className="text-sm text-[--text-muted]">No approval steps have been configured for this workflow yet.</p>
        </div>
      )}

      {/* Dynamic Submission Form */}
      {showSubmitForm && hasColumns && (
        <div className="surface p-6 mb-6">
          <h3 className="text-lg font-semibold text-[--text] mb-4">Complete Request Details</h3>
          <div className="space-y-1">
            {workflow.columns!.map((col) => {
              const val = fieldValues[col.id] || '';
              const err = fieldErrors[col.id];
              const isUploading = uploadingFiles[col.id];

              if (col.columnType === 'text') {
                return (
                  <div key={col.id} className="field mb-3">
                    <label className="field-label">
                      {col.label} {col.isRequired && <span style={{ color: '#ba3040' }}>*</span>}
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      value={val}
                      onChange={(e) => handleFieldChange(col.id, e.target.value)}
                      placeholder={`Enter ${col.label.toLowerCase()}`}
                    />
                    {err && <p className="text-xs mt-1" style={{ color: '#ba3040' }}>{err}</p>}
                  </div>
                );
              }

              if (col.columnType === 'long_text') {
                return (
                  <div key={col.id} className="field mb-3">
                    <label className="field-label">
                      {col.label} {col.isRequired && <span style={{ color: '#ba3040' }}>*</span>}
                    </label>
                    <textarea
                      className="input-control"
                      rows={4}
                      value={val}
                      onChange={(e) => handleFieldChange(col.id, e.target.value)}
                      placeholder={`Enter ${col.label.toLowerCase()}`}
                    />
                    {err && <p className="text-xs mt-1" style={{ color: '#ba3040' }}>{err}</p>}
                  </div>
                );
              }

              if (col.columnType === 'single_choice') {
                return (
                  <div key={col.id} className="field mb-3">
                    <label className="field-label">
                      {col.label} {col.isRequired && <span style={{ color: '#ba3040' }}>*</span>}
                    </label>
                    <select
                      className="input-control"
                      value={val}
                      onChange={(e) => handleFieldChange(col.id, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {(col.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {err && <p className="text-xs mt-1" style={{ color: '#ba3040' }}>{err}</p>}
                  </div>
                );
              }

              if (col.columnType === 'multiple_choice') {
                const selected: string[] = val ? JSON.parse(val) : [];
                const toggleOption = (opt: string) => {
                  if (selected.includes(opt)) {
                    handleFieldChange(col.id, JSON.stringify(selected.filter((o) => o !== opt)));
                  } else {
                    handleFieldChange(col.id, JSON.stringify([...selected, opt]));
                  }
                };
                return (
                  <div key={col.id} className="field mb-3">
                    <label className="field-label">
                      {col.label} {col.isRequired && <span style={{ color: '#ba3040' }}>*</span>}
                    </label>
                    <div className="space-y-1 mt-1">
                      {(col.options || []).map((opt) => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={selected.includes(opt)}
                            onChange={() => toggleOption(opt)}
                          />
                          <span className="text-sm text-[--text]">{opt}</span>
                        </label>
                      ))}
                    </div>
                    {err && <p className="text-xs mt-1" style={{ color: '#ba3040' }}>{err}</p>}
                  </div>
                );
              }

              if (col.columnType === 'date') {
                return (
                  <div key={col.id} className="field mb-3">
                    <label className="field-label">
                      {col.label} {col.isRequired && <span style={{ color: '#ba3040' }}>*</span>}
                    </label>
                    <input
                      type="date"
                      className="input-control"
                      value={val}
                      onChange={(e) => handleFieldChange(col.id, e.target.value)}
                    />
                    {err && <p className="text-xs mt-1" style={{ color: '#ba3040' }}>{err}</p>}
                  </div>
                );
              }

              if (col.columnType === 'file') {
                return (
                  <div key={col.id} className="field mb-3">
                    <label className="field-label">
                      {col.label} {col.isRequired && <span style={{ color: '#ba3040' }}>*</span>}
                    </label>
                    <input
                      type="file"
                      className="input-control"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(col.id, file);
                      }}
                      disabled={isUploading}
                    />
                    {isUploading && <p className="text-xs mt-1 text-[--text-muted]">Uploading...</p>}
                    {val && !isUploading && (
                      <p className="text-xs mt-1" style={{ color: '#1e8c52' }}>File uploaded successfully.</p>
                    )}
                    {err && <p className="text-xs mt-1" style={{ color: '#ba3040' }}>{err}</p>}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}

      {/* Submit */}
      {submitError && (
        <div
          className="mb-4 p-4 rounded-sm text-sm"
          style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}
        >
          {submitError}
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

      <div className="flex gap-3">
        {!showSubmitForm ? (
          <>
            <button className="primary-button" onClick={handleOpenForm}>
              Submit Approval Request
            </button>
            {isAdmin && (
              <button className="secondary-button" onClick={() => navigate(`/workflows/${id}/edit`)}>
                Edit Workflow
              </button>
            )}
          </>
        ) : (
          <>
            <button className="primary-button" onClick={handleSubmitRequest} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Confirm Submission'}
            </button>
            <button
              className="secondary-button"
              onClick={() => setShowSubmitForm(false)}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}