import { getActiveClient } from './supabaseClient.js';

let productionEpoch = 0;
async function productionRPC(client, name, parameters) {
  const epoch = productionEpoch;
  const response = await client.rpc(name, parameters);
  if (epoch !== productionEpoch) throw new Error('Auth session expired or changed during production request');
  return response;
}

/**
 * Generate a standard UUID v4 for request idempotency
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * List active staff and casual helpers/teams for dropdown pickers (PII-free)
 */
export async function listWarehousePeople({ query = '', limit = 20 } = {}) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable. Operations require confirmed server connectivity.');
  }

  const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const cleanQuery = typeof query === 'string' ? query.trim() : '';

  const { data, error } = await productionRPC(client,'warehouse_list_people', {
    p_query: cleanQuery,
    p_limit: boundedLimit
  });

  if (error) {
    console.error('Failed to list warehouse people:', error);
    throw new Error(error.message || 'Failed to list warehouse people');
  }

  const peopleList = Array.isArray(data) ? data : [];
  return {
    people: peopleList,
    has_more: peopleList.length >= boundedLimit
  };
}

/**
 * Resolve personKey ('staff:<id>' | 'recipient:<uuid>') into a canonical recipient record
 */
export async function resolveWarehousePerson({ personKey }) {
  if (!personKey || typeof personKey !== 'string') {
    throw new Error('personKey is strictly required (expected format staff:<id> or recipient:<uuid>)');
  }

  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const { data, error } = await productionRPC(client,'warehouse_resolve_person', {
    p_person_key: personKey
  });

  if (error) {
    console.error('Failed to resolve warehouse person:', error);
    throw new Error(error.message || 'Failed to resolve person');
  }

  return data;
}

/**
 * Create an atomic material/tool issue and link/replace default work output deliverables
 */
export async function createProductionIssue({ issue, work, idempotencyKey = null }) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const key = idempotencyKey || generateIdempotencyKey();

  // Normalize camelCase issue into core snake_case payload
  const issuePayload = {
    issue_type: 'PRODUCTION_ISSUE',
    project_id: issue.projectId || issue.project_id,
    recipient_name: issue.recipientName || issue.recipient_name,
    recipient_id: issue.recipientId || issue.recipient_id || null,
    due_date: issue.dueDate || issue.due_date || null,
    notes: issue.notes || null,
    material_lines: (issue.materialLines || issue.material_lines || []).map((l) => ({
      item_id: l.itemId || l.item_id,
      quantity: Number(l.quantity)
    })),
    tool_units: issue.toolUnits || issue.tool_units || []
  };

  // Normalize camelCase work deliverables
  let workPayload = null;
  if (work) {
    workPayload = {
      title: work.title || undefined,
      due_at: work.dueAt || work.due_at || undefined,
      lines: Array.isArray(work.lines)
        ? work.lines.map((l) => ({
            description: l.description,
            required_qty: Number(l.requiredQty ?? l.required_qty ?? 1),
            unit: l.unit || 'ชุด'
          }))
        : undefined
    };
  }

  const { data, error } = await productionRPC(client,'warehouse_create_production_issue', {
    p_issue: issuePayload,
    p_work: workPayload,
    p_idempotency_key: key
  });

  if (error) {
    console.error('Production issue creation failed:', error);
    throw new Error(error.message || 'Failed to create production issue');
  }

  return data;
}

/**
 * Load project production board data, assignments, progress, and safe summary projections
 * Defaults to 25 tasks, bounded at max 50.
 */
export async function loadProductionProject({ projectId, limit = 25, offset = 0 } = {}) {
  if (!projectId) {
    throw new Error('projectId is strictly required to load project production board');
  }

  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const boundedLimit = Math.min(Math.max(Number(limit) || 25, 1), 50);
  const cleanOffset = Math.max(Number(offset) || 0, 0);

  const { data, error } = await productionRPC(client,'warehouse_load_production_project', {
    p_project_id: projectId,
    p_limit: boundedLimit,
    p_offset: cleanOffset
  });

  if (error) {
    console.error(`Failed to load production project [${projectId}]:`, error);
    throw new Error(error.message || `Failed to load project: ${projectId}`);
  }

  return data;
}

/**
 * Load detailed receipts & submissions on demand for a single work assignment
 */
export async function loadProductionWorkDetails({ assignmentId, limit = 20, offset = 0 } = {}) {
  if (!assignmentId) {
    throw new Error('assignmentId is required to load work details');
  }

  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const cleanOffset = Math.max(Number(offset) || 0, 0);

  const { data, error } = await productionRPC(client,'warehouse_get_work_details', {
    p_assignment_id: assignmentId,
    p_limit: boundedLimit,
    p_offset: cleanOffset
  });

  if (error) {
    console.error(`Failed to load work details [${assignmentId}]:`, error);
    throw new Error(error.message || `Failed to load work details: ${assignmentId}`);
  }

  return data || { assignment_id: assignmentId, submissions: [], total_submissions: 0, has_more: false };
}

/**
 * Load targeted work cards to refresh only changed tasks without a full board re-fetch (max 25)
 */
export async function loadProductionWorkCards({ projectId, assignmentIds = [] } = {}) {
  if (!projectId) {
    throw new Error('projectId is required to load work cards');
  }

  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const targetIds = (Array.isArray(assignmentIds) ? assignmentIds : []).slice(0, 25);
  if (targetIds.length === 0) {
    return [];
  }

  const { data, error } = await productionRPC(client,'warehouse_get_work_cards', {
    p_project_id: projectId,
    p_assignment_ids: targetIds
  });

  if (error) {
    console.error(`Failed to load work cards for project [${projectId}]:`, error);
    throw new Error(error.message || 'Failed to load targeted work cards');
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Create a standalone production task (without material issue)
 */
export async function createProductionAssignment({
  projectId,
  title,
  recipientId = null,
  recipientName = null,
  personKey = null,
  dueAt = null,
  lines = [],
  idempotencyKey = null
}) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const key = idempotencyKey || generateIdempotencyKey();

  const payload = {
    project_id: projectId,
    title,
    recipient_id: recipientId,
    recipient_name: recipientName,
    person_key: personKey,
    due_at: dueAt,
    lines: lines.map((l) => ({
      description: l.description,
      required_qty: Number(l.requiredQty ?? l.required_qty ?? 1),
      unit: l.unit || 'ชุด'
    }))
  };

  const { data, error } = await productionRPC(client,'warehouse_create_assignment', {
    p_payload: payload,
    p_idempotency_key: key
  });

  if (error) {
    console.error('Failed to create production assignment:', error);
    throw new Error(error.message || 'Failed to create assignment');
  }

  return data;
}

/**
 * Update assignment title, due date, or remaining quantities with optimistic lock
 */
export async function updateProductionAssignment({
  assignmentId,
  expectedVersion,
  title,
  dueAt = null,
  lines = null,
  reason = null,
  idempotencyKey = null
}) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const key = idempotencyKey || generateIdempotencyKey();

  const payload = {
    assignment_id: assignmentId,
    expected_version: expectedVersion,
    title,
    due_at: dueAt,
    reason,
    lines: Array.isArray(lines)
      ? lines.map((l) => ({
          id: l.id || null,
          description: l.description,
          required_qty: Number(l.requiredQty ?? l.required_qty),
          unit: l.unit || 'ชุด'
        }))
      : undefined
  };

  const { data, error } = await productionRPC(client,'warehouse_update_assignment', {
    p_payload: payload,
    p_idempotency_key: key
  });

  if (error) {
    console.error('Failed to update production assignment:', error);
    throw new Error(error.message || 'Failed to update assignment');
  }

  return data;
}

/**
 * Split unsubmitted remaining work to another person into a child assignment
 */
export async function splitProductionAssignment({
  assignmentId,
  expectedVersion,
  toPersonKey,
  lineQuantities,
  title = null,
  reason = null,
  idempotencyKey = null
}) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const key = idempotencyKey || generateIdempotencyKey();

  const payload = {
    assignment_id: assignmentId,
    expected_version: expectedVersion,
    to_person_key: toPersonKey,
    title,
    reason,
    line_quantities: lineQuantities.map((l) => ({
      line_id: l.lineId || l.line_id,
      quantity: Number(l.quantity)
    }))
  };

  const { data, error } = await productionRPC(client,'warehouse_split_assignment', {
    p_payload: payload,
    p_idempotency_key: key
  });

  if (error) {
    console.error('Failed to split production assignment:', error);
    throw new Error(error.message || 'Failed to split assignment');
  }

  return data;
}

/**
 * Helper submits partial or full work for inspection
 */
export async function submitProductionWork({
  assignmentId,
  lines,
  note = null,
  idempotencyKey = null
}) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const key = idempotencyKey || generateIdempotencyKey();

  const payload = {
    assignment_id: assignmentId,
    note,
    lines: lines.map((l) => ({
      line_id: l.lineId || l.line_id,
      quantity: Number(l.quantity)
    }))
  };

  const { data, error } = await productionRPC(client,'warehouse_submit_work', {
    p_payload: payload,
    p_idempotency_key: key
  });

  if (error) {
    console.error('Failed to submit production work:', error);
    throw new Error(error.message || 'Failed to submit work');
  }

  return data;
}

/**
 * Staff inspects a submission (accept/reject per submission line)
 */
export async function inspectProductionWork({
  submissionId,
  lines,
  note = null,
  idempotencyKey = null
}) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const key = idempotencyKey || generateIdempotencyKey();

  const payload = {
    submission_id: submissionId,
    note,
    lines: lines.map((l) => ({
      submission_line_id: l.submissionLineId || l.submission_line_id,
      accepted_qty: Number(l.acceptedQty ?? l.accepted_qty ?? 0),
      rejected_qty: Number(l.rejectedQty ?? l.rejected_qty ?? 0),
      notes: l.notes || null
    }))
  };

  const { data, error } = await productionRPC(client,'warehouse_inspect_work', {
    p_payload: payload,
    p_idempotency_key: key
  });

  if (error) {
    console.error('Failed to inspect production work:', error);
    throw new Error(error.message || 'Failed to inspect work');
  }

  return data;
}

/**
 * Change assignment status (in_progress, submitted, completed, problem, cancelled)
 */
export async function setProductionStatus({
  assignmentId,
  expectedVersion,
  status,
  reason = null,
  idempotencyKey = null
}) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const key = idempotencyKey || generateIdempotencyKey();

  const payload = {
    assignment_id: assignmentId,
    expected_version: expectedVersion,
    status,
    reason
  };

  const { data, error } = await productionRPC(client,'warehouse_set_assignment_status', {
    p_payload: payload,
    p_idempotency_key: key
  });

  if (error) {
    console.error('Failed to set production assignment status:', error);
    throw new Error(error.message || 'Failed to update assignment status');
  }

  return data;
}

/**
 * Active subscriptions registry to clear pending timers/channels on user/project switch
 */
const activeProductionSubscriptions = new Map();

/**
 * Clear all active production subscriptions and timers on switch
 */
export function resetProductionSession() {
  productionEpoch++;
  for (const unsub of activeProductionSubscriptions.values()) {
    try {
      unsub();
    } catch { /* Continue cleaning other subscriptions when one channel has already closed. */ }
  }
  activeProductionSubscriptions.clear();
}

/**
 * Staff inspects cash work using canonical single-RPC resolver warehouse_inspect_production_cash
 * Resolves assignment/batch and processes cash receipt in one transaction (zero REST queries to retired tables).
 * Preserves JS arguments: { assignmentId, batchId, noteCount, notes, idempotencyKey }.
 */
export async function inspectProductionCash({
  assignmentId = null,
  batchId = null,
  noteCount,
  notes = null,
  idempotencyKey = null
}) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  if (!assignmentId && !batchId) {
    throw new Error('Either assignmentId or batchId must be provided to inspect production cash');
  }

  const count = Number(noteCount);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('noteCount must be a positive integer');
  }

  const key = idempotencyKey || generateIdempotencyKey();
  const noteText = notes || 'Prepared notes verified from production hub';

  // Execute canonical single-RPC resolver (no REST queries on retired tables)
  const { data, error } = await productionRPC(client,'warehouse_inspect_production_cash', {
    p_payload: {
      assignment_id: assignmentId || null,
      batch_id: batchId || null,
      note_count: count,
      notes: noteText
    },
    p_idempotency_key: key
  });

  if (error) {
    console.error('Failed to inspect production cash:', error);
    throw new Error(error.message || 'Failed to inspect production cash');
  }

  return data;
}

/**
 * Subscribe to realtime project events on inventory_documents (not retired production_assignments)
 * Debounces 500ms batching WORK IDs and invokes callback onChange(projectId, { assignmentIds }).
 * Ignores COMMAND records and inactive instances.
 * 
 * Callback signature: onChange(projectId, { assignmentIds })
 * Note: Existing UI can safely ignore the second parameter until adapted.
 */
export function subscribeProductionProject(projectId, onChange, onConnectionChange = null) {
  const client = getActiveClient();
  if (!client || !projectId) {
    return () => {};
  }

  // Cleanup existing subscription on same project if present
  if (activeProductionSubscriptions.has(projectId)) {
    try {
      activeProductionSubscriptions.get(projectId)();
    } catch { /* A stale subscription must not prevent replacing it. */ }
    activeProductionSubscriptions.delete(projectId);
  }

  let active = true;
  let debounceTimer = null;
  const pendingAssignmentIds = new Set();
  const channelName = `production-project-${projectId}-${generateIdempotencyKey().slice(0, 8)}`;

  const channel = client.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory_documents',
        filter: `project_id=eq.${projectId}`
      },
      (payload) => {
        const record = payload?.new || payload?.old || {};
        // Ignore internal technical command records
        if (!active || !['WORK', 'SUBMISSION', 'INSPECTION', 'WORK_EVENT'].includes(record.doc_type)) return;

        let targetId = null;
        if (record.doc_type === 'WORK') {
          targetId = record.id;
        } else if (record.parent_document_id) {
          targetId = record.parent_document_id;
        } else if (record.source_document_id) {
          targetId = record.source_document_id;
        }

        if (targetId) {
          pendingAssignmentIds.add(targetId);
        }

        if (!targetId) return;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          if (!active) return;
          const assignmentIds = Array.from(pendingAssignmentIds);
          pendingAssignmentIds.clear();
          try {
            if (typeof onChange === 'function') {
              onChange(projectId, { assignmentIds });
            }
          } catch (err) {
            console.error('Error in subscribeProductionProject onChange callback:', err);
          }
        }, 500);
      }
    )
    .subscribe((status) => {
      if (typeof onConnectionChange === 'function') {
        try {
          onConnectionChange(status);
        } catch (err) {
          console.error('Error in onConnectionChange callback:', err);
        }
      }
    });

  const unsubscribe = () => {
    active = false;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingAssignmentIds.clear();
    if (activeProductionSubscriptions.get(projectId) === unsubscribe) activeProductionSubscriptions.delete(projectId);
    try {
      if (client.removeChannel) {
        client.removeChannel(channel);
      } else if (channel.unsubscribe) {
        channel.unsubscribe();
      }
    } catch (err) {
      console.warn('Error unsubscribing production project channel:', err);
    }
  };

  activeProductionSubscriptions.set(projectId, unsubscribe);
  return unsubscribe;
}
