import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import apiClient from '../api/client';
import type { Workflow, ApprovalGroup, ApprovalSlotConfig, WorkflowColumn, ColumnType } from '../types';

interface ColumnDraft {
  label: string;
  columnType: ColumnType;
  isRequired: boolean;
  sortOrder: number;
  options: string[] | null;
}

function newColumn(order: number): ColumnDraft {
  return {
    label: '',
    columnType: 'text',
    isRequired: false,
    sortOrder: order,
    options: null,
  };
}

export default function Workflows() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi<Workflow[]>('/workflows');
  const { data: groups } = useApi<ApprovalGroup[]>('/approval-groups');

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState<ApprovalSlotConfig[]>([]);
  const [columns, setColumns] = useState<ColumnDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const addSlot = () => {
    setSlots([...slots, { groupId: '', resolutionMode: 'all' }]);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof ApprovalSlotConfig, value: string) => {
    const updated = slots.map((slot, i) =>
      i === index ? { ...slot, [field]: value } : slot,
    );
    setSlots(updated);
  };

  const addColumn = () => {
    setColumns([...columns, newColumn(columns.length + 1)]);
  };

  const removeColumn = (index: number) => {
    const updated = columns.filter((_, i) => i !== index);
    // Re-index sort orders
    setColumns(updated.map((c, i) => ({ ...c, sortOrder: i + 1 })));
  };

  const updateColumn = (index: number, field: keyof ColumnDraft, value: unknown) => {
    const updated = columns.map((col, i) => {
      if (i !== index) return col;
      const newCol = { ...col, [field]: value };

      // Reset options when switching away from choice types
      if (field === 'columnType') {
        const ct = value as ColumnType;
        if (ct === 'single_choice' || ct === 'multiple_choice') {
          newCol.options = col.options || [];
        } else {
          newCol.options = null;
        }
      }

      return newCol;
    });
    setColumns(updated);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const updated = [...columns];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Fix sort orders
    setColumns(updated.map((c, i) => ({ ...c, sortOrder: i + 1 })));
  };

  const addOption = (colIndex: number, option: string) => {
    const updated = columns.map((col, i) => {
      if (i !== colIndex) return col;
      return { ...col, options: [...(col.options || []), option] };
    });
    setColumns(updated);
  };

  const removeOption = (colIndex: number, optionIndex: number) => {
    const updated = columns.map((col, i) => {
      if (i !== colIndex) return col;
      return { ...col, options: (col.options || []).filter((_, oi) => oi !== optionIndex) };
    });
    setColumns(updated);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSlots([]);
    setColumns([]);
    setShowCreate(false);
    setSubmitError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Validate slots
    if (slots.length === 0) {
      setSubmitError('Please add at least one approval slot.');
      return;
    }
    if (slots.some((s) => !s.groupId)) {
      setSubmitError('Please select a group for each approval slot.');
      return;
    }

    // Validate columns
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (!col.label.trim()) {
        setSubmitError(`Column ${i + 1}: label is required.`);
        return;
      }
      if ((col.columnType === 'single_choice' || col.columnType === 'multiple_choice') && (!col.options || col.options.length < 2)) {
        setSubmitError(`Column ${i + 1} ("${col.label}"): choice columns must have at least 2 options.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await apiClient.post('/workflows', { name, description, slots, columns });
      resetForm();
      refetch();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setSubmitError(axiosErr.response?.data?.message || 'Failed to create workflow.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[--text]">Workflows</h2>
        {isAdmin && (
          <button className="primary-button" onClick={() => setShowCreate(!showCreate)}>
            + New Workflow
          </button>
        )}
      </div>

      {error && (
        <div className="surface-muted p-4 mb-6 text-sm" style={{ color: '#ba3040' }}>
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="surface p-6 mb-6">
          <h3 className="text-lg font-semibold text-[--text] mb-4">Create Workflow</h3>
          {submitError && (
            <div
              className="mb-4 p-3 text-sm rounded-sm"
              style={{ background: '#ffe8ea', color: '#ba3040', border: '1px solid #ffb1b8' }}
            >
              {submitError}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="field mb-4">
              <label className="field-label">Workflow Name</label>
              <input
                className="input-control"
                placeholder="e.g. Expense Report Approval"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field mb-4">
              <label className="field-label">Description</label>
              <textarea
                className="input-control"
                placeholder="Describe what this workflow is for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Slot Builder */}
            <div className="field mb-4">
              <label className="field-label">Approval Slots</label>
              <p className="text-xs text-[--text-muted] mb-2">
                Add approval groups in order. Slot 1 must complete before Slot 2 begins.
              </p>

              {slots.length === 0 && (
                <div className="surface-muted p-4 text-center mb-3">
                  <p className="text-sm text-[--text-muted]">No slots added yet.</p>
                </div>
              )}

              {slots.map((slot, index) => (
                <div
                  key={index}
                  className="surface-muted p-4 mb-3 flex items-start gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm shrink-0 mt-1">
                    {index + 1}
                  </div>
                  <div className="flex-1 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">
                        Approval Group
                      </label>
                      <select
                        className="input-control mt-1"
                        value={slot.groupId}
                        onChange={(e) => updateSlot(index, 'groupId', e.target.value)}
                      >
                        <option value="">Select a group...</option>
                        {groups?.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.members?.length ?? 0} member{(g.members?.length ?? 0) !== 1 ? 's' : ''})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">
                        Resolution Mode
                      </label>
                      <select
                        className="input-control mt-1"
                        value={slot.resolutionMode}
                        onChange={(e) => updateSlot(index, 'resolutionMode', e.target.value)}
                      >
                        <option value="all">All Members Must Approve</option>
                        <option value="first">First to Approve</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-button shrink-0"
                    style={{ color: '#ba3040' }}
                    onClick={() => removeSlot(index)}
                    title="Remove slot"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="secondary-button text-sm"
                onClick={addSlot}
                disabled={!groups || groups.length === 0}
                title={!groups || groups.length === 0 ? 'Create an approval group first' : undefined}
              >
                + Add Slot
              </button>
              {(!groups || groups.length === 0) && (
                <p className="text-xs text-[--text-muted] mt-1">
                  You need to create an approval group first.
                </p>
              )}
            </div>

            {/* Column Builder (NEW) */}
            <div className="field mb-4">
              <label className="field-label">Custom Fields (Columns)</label>
              <p className="text-xs text-[--text-muted] mb-2">
                Define form fields that submitters must complete. Optional — leave empty for no custom fields.
              </p>

              {columns.length === 0 && (
                <div className="surface-muted p-4 text-center mb-3">
                  <p className="text-sm text-[--text-muted]">No custom fields. Submitters won't fill out extra info.</p>
                </div>
              )}

              {columns.map((col, index) => (
                <div
                  key={index}
                  className="surface-muted p-4 mb-3"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="icon-button"
                        style={{ padding: '2px' }}
                        onClick={() => moveColumn(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        style={{ padding: '2px' }}
                        onClick={() => moveColumn(index, 'down')}
                        disabled={index === columns.length - 1}
                        title="Move down"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <span className="text-xs font-semibold text-[--text-muted] ml-1">
                        {col.sortOrder}
                      </span>
                    </div>

                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">
                          Label
                        </label>
                        <input
                          className="input-control mt-1"
                          placeholder="e.g. Reason for Request"
                          value={col.label}
                          onChange={(e) => updateColumn(index, 'label', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">
                          Type
                        </label>
                        <select
                          className="input-control mt-1"
                          value={col.columnType}
                          onChange={(e) => updateColumn(index, 'columnType', e.target.value)}
                        >
                          <option value="text">Text</option>
                          <option value="long_text">Long Text</option>
                          <option value="single_choice">Single Choice</option>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="date">Date</option>
                          <option value="file">File</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={col.isRequired}
                            onChange={(e) => updateColumn(index, 'isRequired', e.target.checked)}
                          />
                          <span className="text-xs text-[--text-muted]">Required</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="icon-button shrink-0 mt-1"
                      style={{ color: '#ba3040' }}
                      onClick={() => removeColumn(index)}
                      title="Remove column"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {/* Options editor for choice types */}
                  {(col.columnType === 'single_choice' || col.columnType === 'multiple_choice') && (
                    <div className="ml-12 bg-[--bg] p-3 rounded-sm">
                      <label className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider mb-2 block">
                        Options
                      </label>
                      {(col.options || []).length === 0 && (
                        <p className="text-xs text-[--text-muted] mb-2">No options added yet.</p>
                      )}
                      <div className="space-y-1 mb-2">
                        {(col.options || []).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <span className="text-sm text-[--text] flex-1">{opt}</span>
                            <button
                              type="button"
                              className="icon-button"
                              style={{ color: '#ba3040', padding: '2px' }}
                              onClick={() => removeOption(index, oi)}
                              title="Remove option"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          id={`option-input-${index}`}
                          type="text"
                          className="input-control text-sm flex-1"
                          placeholder="New option..."
                        />
                        <button
                          type="button"
                          className="secondary-button text-xs"
                          onClick={() => {
                            const input = document.getElementById(
                              `option-input-${index}`,
                            ) as HTMLInputElement;
                            const val = input.value.trim();
                            if (val) {
                              addOption(index, val);
                              input.value = '';
                            }
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="secondary-button text-sm"
                onClick={addColumn}
              >
                + Add Column
              </button>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workflow list */}
      {data && data.length === 0 && (
        <div className="surface p-12 text-center">
          <p className="text-[--text-muted]">No workflows available.</p>
        </div>
      )}

      <div className="grid gap-4">
        {data?.map((wf) => (
          <div
            key={wf.id}
            className="surface p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/workflows/${wf.id}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-[--text]">{wf.name}</h4>
                <p className="text-sm text-[--text-muted] mt-1">{wf.description}</p>
                <p className="text-xs text-[--text-muted] mt-2">
                  {wf.slots && wf.slots.length > 0 ? (
                    <>{wf.slots.length} slot{wf.slots.length !== 1 ? 's' : ''}</>
                  ) : (
                    <>{wf.steps?.length ?? 0} step{(wf.steps?.length ?? 0) !== 1 ? 's' : ''}</>
                  )}
                  {wf.columns && wf.columns.length > 0 && (
                    <> &middot; {wf.columns.length} field{wf.columns.length !== 1 ? 's' : ''}</>
                  )}
                  {' '}&middot; Created {new Date(wf.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="badge badge-slate">{wf.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}