const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

async function createServiceHarness(mockResponses = {}) {
  const rpcCalls = [];
  const channels = [];

  const client = {
    rpc: async (fnName, params) => {
      rpcCalls.push({ fnName, params });
      if (mockResponses[fnName]) {
        return mockResponses[fnName](params);
      }
      return { data: { success: true, data: { id: 'mock-id' } }, error: null };
    },
    channel: (name) => {
      const ch = {
        name,
        listeners: [],
        statusListeners: [],
        on: (event, filter, callback) => {
          ch.listeners.push({ event, filter, callback });
          return ch;
        },
        subscribe: (statusCallback) => {
          ch.statusListeners.push(statusCallback);
          if (statusCallback) statusCallback('SUBSCRIBED');
          return ch;
        },
        unsubscribe: async () => {
          ch.unsubscribed = true;
          return 'ok';
        }
      };
      channels.push(ch);
      return ch;
    },
    from: (table) => {
      const query = {
        table,
        selectFields: '*',
        filters: {}
      };
      const builder = {
        select: (fields) => {
          query.selectFields = fields;
          return builder;
        },
        eq: (col, val) => {
          query.filters[col] = val;
          return builder;
        },
        single: async () => {
          if (mockResponses[`from_${table}`]) {
            return mockResponses[`from_${table}`](query);
          }
          if (table === 'production_assignments') {
            return {
              data: { id: query.filters.id || 'assign-1', project_id: 'P-0001', source_cash_batch_id: 'batch-1', cash_only: true },
              error: null
            };
          }
          if (table === 'cash_helper_batches') {
            return {
              data: { id: query.filters.id || 'batch-1', project_id: 'P-0001', denomination: 100 },
              error: null
            };
          }
          return { data: {}, error: null };
        }
      };
      return builder;
    },
    removeChannel: async (ch) => {
      ch.unsubscribed = true;
      return 'ok';
    }
  };

  const code = fs.readFileSync(path.resolve(root, 'src/services/productionService.js'), 'utf8');

  // Transpile ESM export/imports for vm execution
  const cjsCode = code
    .replace(/import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"];?/g, (m, imports) => {
      return `const { ${imports} } = injectedDependencies;`;
    })
    .replace(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g, 'async function $1')
    .replace(/export\s+function\s+([a-zA-Z0-9_]+)/g, 'function $1')
    .replace(/export\s+const\s+([a-zA-Z0-9_]+)/g, 'const $1')
    + `\nmodule.exports = {
      listWarehousePeople,
      resolveWarehousePerson,
      createProductionIssue,
      loadProductionProject,
      createProductionAssignment,
      updateProductionAssignment,
      splitProductionAssignment,
      submitProductionWork,
      inspectProductionWork,
      setProductionStatus,
      inspectProductionCash,
      subscribeProductionProject,
      loadProductionWorkDetails,
      loadProductionWorkCards
    };`;

  const sandbox = {
    module: {},
    exports: {},
    console,
    setTimeout,
    clearTimeout,
    crypto: {
      randomUUID: () => 'e0000000-0000-4000-8000-000000000001'
    },
    injectedDependencies: {
      getActiveClient: () => client
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(cjsCode, sandbox);

  return {
    service: sandbox.module.exports,
    rpcCalls,
    channels,
    client
  };
}

test('1. listWarehousePeople: defaults and passes bounded params to warehouse_list_people', async (t) => {
  const { service, rpcCalls } = await createServiceHarness({
    warehouse_list_people: (params) => ({
      data: [{ key: 'staff:1', name: 'Admin', kind: 'staff' }],
      error: null
    })
  });

  const res = await service.listWarehousePeople({ query: 'สม', limit: 25 });
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].fnName, 'warehouse_list_people');
  assert.equal(rpcCalls[0].params.p_query, 'สม');
  assert.equal(rpcCalls[0].params.p_limit, 25);
  assert.equal(res.people.length, 1);
  assert.equal(res.has_more, false);
});

test('2. resolveWarehousePerson: calls warehouse_resolve_person with personKey', async (t) => {
  const { service, rpcCalls } = await createServiceHarness({
    warehouse_resolve_person: (params) => ({
      data: {
        recipient_id: 'a1111111-1111-4111-8111-111111111111',
        name: 'ป้านิด',
        recipient_type: 'casual_helper'
      },
      error: null
    })
  });

  const res = await service.resolveWarehousePerson({ personKey: 'recipient:a1111111-1111-4111-8111-111111111111' });
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].fnName, 'warehouse_resolve_person');
  assert.equal(rpcCalls[0].params.p_person_key, 'recipient:a1111111-1111-4111-8111-111111111111');
  assert.equal(res.name, 'ป้านิด');
});

test('3. createProductionIssue: transforms camelCase issue & work into snake_case RPC parameters', async (t) => {
  const { service, rpcCalls } = await createServiceHarness({
    warehouse_create_production_issue: (params) => ({
      data: {
        success: true,
        data: {
          issue: { id: 'doc-uuid', doc_number: 'ISS-001' },
          assignment: { id: 'assign-uuid', title: 'จัดช่อดอกไม้' }
        }
      },
      error: null
    })
  });

  const res = await service.createProductionIssue({
    issue: {
      projectId: 'P-0001',
      recipientName: 'ช่างสมหมาย',
      dueDate: '2026-11-20T18:00:00Z',
      materialLines: [{ itemId: 'item-1', quantity: 5 }],
      toolUnits: ['SC-01']
    },
    work: {
      title: 'จัดช่อดอกไม้',
      dueAt: '2026-11-20T18:00:00Z',
      lines: [{ description: 'ช่อลิลลี่', requiredQty: 5, unit: 'ช่อ' }]
    },
    idempotencyKey: 'c0000000-0000-4000-8000-000000000001'
  });

  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].fnName, 'warehouse_create_production_issue');
  const params = rpcCalls[0].params;
  assert.equal(params.p_idempotency_key, 'c0000000-0000-4000-8000-000000000001');
  assert.equal(params.p_issue.project_id, 'P-0001');
  assert.equal(params.p_issue.recipient_name, 'ช่างสมหมาย');
  assert.equal(params.p_issue.material_lines[0].item_id, 'item-1');
  assert.equal(params.p_work.title, 'จัดช่อดอกไม้');
  assert.equal(params.p_work.lines[0].required_qty, 5);
  assert.ok(res.success);
});

test('4. loadProductionProject: loads board data and safe projections', async (t) => {
  const { service, rpcCalls } = await createServiceHarness({
    warehouse_load_production_project: (params) => ({
      data: {
        project: { id: 'P-0001', name: 'Floral Gala' },
        assignments: [],
        summary: { assignment_count: 0, completed_count: 0, pending_review_count: 0, problem_count: 0, cancelled_count: 0, ready_for_next_step: true, has_restricted_work: false },
        permissions: { can_check: true, can_manage_cash: false },
        updated_at: new Date().toISOString(),
        has_more: false
      },
      error: null
    })
  });

  const res = await service.loadProductionProject({ projectId: 'P-0001' });
  assert.equal(rpcCalls[0].fnName, 'warehouse_load_production_project');
  assert.equal(rpcCalls[0].params.p_project_id, 'P-0001');
  assert.equal(res.project.id, 'P-0001');
  assert.equal(res.permissions.can_manage_cash, false);
});

test('5. Lifecycle operations: create, update, split, submit, inspect, and set status', async (t) => {
  const { service, rpcCalls } = await createServiceHarness();

  // Create
  await service.createProductionAssignment({
    projectId: 'P-0001',
    title: 'New Task',
    personKey: 'staff:1',
    lines: [{ description: 'Desk Flower', requiredQty: 2, unit: 'ชิ้น' }]
  });
  assert.equal(rpcCalls[0].fnName, 'warehouse_create_assignment');

  // Update
  await service.updateProductionAssignment({
    assignmentId: 'assign-uuid',
    expectedVersion: 1,
    title: 'Updated Task',
    lines: [{ description: 'Desk Flower Deluxe', requiredQty: 3, unit: 'ชิ้น' }],
    reason: 'Upgraded package'
  });
  assert.equal(rpcCalls[1].fnName, 'warehouse_update_assignment');

  // Split
  await service.splitProductionAssignment({
    assignmentId: 'assign-uuid',
    expectedVersion: 2,
    toPersonKey: 'staff:2',
    lineQuantities: [{ lineId: 'line-uuid', quantity: 1 }],
    title: 'Split Task',
    reason: 'Helper fell sick'
  });
  assert.equal(rpcCalls[2].fnName, 'warehouse_split_assignment');

  // Submit
  await service.submitProductionWork({
    assignmentId: 'assign-uuid',
    lines: [{ lineId: 'line-uuid', quantity: 2 }],
    note: 'Delivered batch 1'
  });
  assert.equal(rpcCalls[3].fnName, 'warehouse_submit_work');

  // Inspect
  await service.inspectProductionWork({
    submissionId: 'sub-uuid',
    lines: [{ submissionLineId: 'sub-line-uuid', acceptedQty: 2, rejectedQty: 0 }],
    note: 'Passed inspection'
  });
  assert.equal(rpcCalls[4].fnName, 'warehouse_inspect_work');

  // Set Status
  await service.setProductionStatus({
    assignmentId: 'assign-uuid',
    expectedVersion: 3,
    status: 'completed',
    reason: 'All inspected and verified'
  });
  assert.equal(rpcCalls[5].fnName, 'warehouse_set_assignment_status');
});

test('6. subscribeProductionProject: cleans up subscriptions and debounces events', async (t) => {
  const { service, channels } = await createServiceHarness();

  let updateCount = 0;
  let connectionState = null;

  const unsubscribe = service.subscribeProductionProject(
    'P-0001',
    () => { updateCount++; },
    (state) => { connectionState = state; }
  );

  assert.equal(channels.length, 1);
  const ch = channels[0];
  assert.equal(connectionState, 'SUBSCRIBED');

  // Simulate burst of 5 realtime events within 50ms
  const listener = ch.listeners[0].callback;
  listener({ eventType: 'UPDATE', new: { id: 'assign-1', project_id: 'P-0001', doc_type: 'WORK' } });
  listener({ eventType: 'UPDATE', new: { id: 'assign-1', project_id: 'P-0001', doc_type: 'WORK' } });
  listener({ eventType: 'INSERT', new: { id: 'assign-2', project_id: 'P-0001', doc_type: 'WORK' } });
  listener({ eventType: 'UPDATE', new: { id: 'assign-2', project_id: 'P-0001', doc_type: 'WORK' } });
  listener({ eventType: 'UPDATE', new: { id: 'assign-1', project_id: 'P-0001', doc_type: 'WORK' } });

  assert.equal(updateCount, 0, 'Should not fire synchronously before debounce timeout');

  // Wait 550ms for 500ms debounce
  await new Promise((r) => setTimeout(r, 550));
  assert.equal(updateCount, 1, 'Burst of 5 events must trigger callback exactly once (debounced)');

  // Clean up
  unsubscribe();
  assert.equal(ch.unsubscribed, true, 'Channel must be unsubscribed on cleanup');
});

test('7. inspectProductionCash: calls single-RPC resolver warehouse_inspect_production_cash without retired table REST', async (t) => {
  const { service, rpcCalls } = await createServiceHarness();

  // Test with assignmentId
  await service.inspectProductionCash({
    assignmentId: 'assign-uuid-1',
    noteCount: 20,
    notes: 'Verified 20x 100-baht notes'
  });

  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].fnName, 'warehouse_inspect_production_cash');
  assert.equal(rpcCalls[0].params.p_payload.assignment_id, 'assign-uuid-1');
  assert.equal(rpcCalls[0].params.p_payload.note_count, 20);
  assert.equal(rpcCalls[0].params.p_payload.notes, 'Verified 20x 100-baht notes');

  // Test with direct batchId
  await service.inspectProductionCash({
    batchId: 'batch-2',
    noteCount: 15
  });

  assert.equal(rpcCalls.length, 2);
  assert.equal(rpcCalls[1].fnName, 'warehouse_inspect_production_cash');
  assert.equal(rpcCalls[1].params.p_payload.batch_id, 'batch-2');
  assert.equal(rpcCalls[1].params.p_payload.note_count, 15);
  assert.equal(rpcCalls[1].params.p_payload.notes, 'Prepared notes verified from production hub');
});

test('8. loadProductionWorkDetails and loadProductionWorkCards: bounded queries', async (t) => {
  const { service, rpcCalls } = await createServiceHarness({
    warehouse_get_work_details: (params) => ({
      data: { assignment_id: params.p_assignment_id, submissions: [], total_submissions: 0, has_more: false },
      error: null
    }),
    warehouse_get_work_cards: (params) => ({
      data: [{ id: 'card-1', title: 'Task 1' }],
      error: null
    })
  });

  const details = await service.loadProductionWorkDetails({ assignmentId: 'assign-1', limit: 20 });
  assert.equal(rpcCalls[0].fnName, 'warehouse_get_work_details');
  assert.equal(rpcCalls[0].params.p_assignment_id, 'assign-1');
  assert.equal(rpcCalls[0].params.p_limit, 20);
  assert.equal(details.assignment_id, 'assign-1');

  const cards = await service.loadProductionWorkCards({ projectId: 'P-0001', assignmentIds: ['card-1'] });
  assert.equal(rpcCalls[1].fnName, 'warehouse_get_work_cards');
  assert.equal(rpcCalls[1].params.p_project_id, 'P-0001');
  assert.deepEqual(rpcCalls[1].params.p_assignment_ids, ['card-1']);
  assert.equal(cards.length, 1);
});
