// 1. Harness must be required FIRST so JSDOM is fully attached before React DOM loads
const {
  loadProductionComponent,
  setHarness,
  resetHarness
} = require('./helpers/productionUiHarness.cjs');

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { render, fireEvent, act, cleanup } = require('@testing-library/react');

// Helper to flush pending micro/macro tasks
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 60));

test('Plan C — Production UI Safety & Contract Verification Suite', async (suite) => {
  suite.afterEach(() => cleanup());
  const PersonPicker = await loadProductionComponent('src/components/inventory/PersonPicker.jsx');
  const ProductionHubView = await loadProductionComponent('src/components/inventory/ProductionHubView.jsx');

  // ===========================================================================
  // SECTION 1: PersonPicker Component Safety Tests
  // ===========================================================================

  await suite.test('1. PersonPicker: Resolves staff key (staff:<id>) to canonical UUID via server bridge', async () => {
    resetHarness();
    let resolveCalledWith = null;

    setHarness({
      listWarehousePeople: async () => ({
        people: [
          {
            key: 'staff:st-101',
            staff_user_id: 'st-101',
            name: 'พนักงานกิ่งแก้ว',
            kind: 'staff',
            code: 'EMP-01'
          }
        ],
        has_more: false
      }),
      resolveWarehousePerson: async (args) => {
        resolveCalledWith = args;
        return {
          recipient_id: '11111111-1111-4111-8111-111111111111',
          name: 'พนักงานกิ่งแก้ว',
          recipient_type: 'individual'
        };
      }
    });

    let selectedValue = null;
    const { container, unmount } = render(
      React.createElement(PersonPicker, {
        onChange: (val) => { selectedValue = val; }
      })
    );

    // Open dropdown
    const triggerBtn = document.body.querySelector('button[aria-haspopup="listbox"]');
    assert.ok(triggerBtn, 'Dropdown trigger button must exist');

    await act(async () => {
      fireEvent.click(triggerBtn);
      await flushPromises();
    });

    // Select the staff item
    const staffItemBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('พนักงานกิ่งแก้ว')
    );
    assert.ok(staffItemBtn, 'Staff item must be visible in dropdown');

    await act(async () => {
      fireEvent.click(staffItemBtn);
      await flushPromises();
    });

    assert.deepEqual(resolveCalledWith, { personKey: 'staff:st-101' }, 'Must call resolveWarehousePerson with staff key');
    assert.ok(selectedValue, 'onChange must be called with selected person');
    assert.equal(selectedValue.recipient_id, '11111111-1111-4111-8111-111111111111', 'Staff must be resolved to canonical recipient UUID');
    assert.equal(selectedValue.kind, 'staff');

    unmount();
  });

  await suite.test('2. PersonPicker: Refuses selection when staff has missing/unresolvable canonical UUID', async () => {
    resetHarness();
    setHarness({
      listWarehousePeople: async () => ({
        people: [
          {
            key: 'staff:unmapped-999',
            staff_user_id: 'unmapped-999',
            name: 'พนักงานไร้ทะเบียน',
            kind: 'staff'
          }
        ],
        has_more: false
      }),
      resolveWarehousePerson: async () => {
        // Backend returns null or missing recipient_id
        return { recipient_id: null, name: 'พนักงานไร้ทะเบียน' };
      }
    });

    let selectedValue = null;
    const { container, unmount } = render(
      React.createElement(PersonPicker, {
        onChange: (val) => { selectedValue = val; }
      })
    );

    const triggerBtn = document.body.querySelector('button[aria-haspopup="listbox"]');
    await act(async () => {
      fireEvent.click(triggerBtn);
      await flushPromises();
    });

    const staffItemBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('พนักงานไร้ทะเบียน')
    );
    assert.ok(staffItemBtn);

    await act(async () => {
      fireEvent.click(staffItemBtn);
      await flushPromises();
    });

    // Per Plan C: "รายชื่อที่เลือกต้องอ้างอิงรหัสจริง ไม่ใช้ชื่อหรือรหัสจำลองแทน foreign key"
    // PersonPicker must refuse selection when canonical UUID is missing/null
    assert.equal(
      selectedValue === null || (selectedValue && Boolean(selectedValue.recipient_id)),
      true,
      `PersonPicker accepted staff with missing canonical UUID: recipient_id=${selectedValue?.recipient_id}`
    );

    unmount();
  });

  await suite.test('3. PersonPicker: New casual helper creation returns canonical UUID and helperkind casual_helper (never fake Date.now ID)', async () => {
    resetHarness();
    let createRecipientPayload = null;

    setHarness({
      listWarehousePeople: async () => ({ people: [], has_more: false }),
      createRecipient: async (payload) => {
        createRecipientPayload = payload;
        // Authoritative warehouseService.createRecipient returning RPC result shape { success: true, data: { id } }
        return {
          success: true,
          data: {
            id: '22222222-2222-4222-8222-222222222222',
            name: payload.name,
            recipient_type: 'individual'
          }
        };
      }
    });

    let selectedValue = null;
    const { container, unmount } = render(
      React.createElement(PersonPicker, {
        onChange: (val) => { selectedValue = val; }
      })
    );

    // Open dropdown
    const triggerBtn = document.body.querySelector('button[aria-haspopup="listbox"]');
    await act(async () => {
      fireEvent.click(triggerBtn);
      await flushPromises();
    });

    // Click "+ เพิ่มผู้ช่วยงานใหม่หรือทีม"
    const addNewBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('เพิ่มผู้ช่วยงานใหม่')
    );
    assert.ok(addNewBtn, 'Quick add helper button must exist in dropdown');

    await act(async () => {
      fireEvent.click(addNewBtn);
      await flushPromises();
    });

    // Fill new helper name
    const nameInput = document.body.querySelector('input[placeholder*="ป้านิด"]');
    assert.ok(nameInput, 'Helper name input must be present in inline modal');

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'ป้านิด ช่วยทำช่อดอกไม้' } });
      await flushPromises();
    });

    // Submit modal form
    const form = document.body.querySelector('form');
    assert.ok(form, 'Helper creation form must exist');

    await act(async () => {
      fireEvent.submit(form);
      await flushPromises();
    });

    assert.ok(createRecipientPayload, 'createRecipient must be called');
    assert.equal(createRecipientPayload.name, 'ป้านิด ช่วยทำช่อดอกไม้');
    assert.ok(selectedValue, 'onChange must be called after creating helper');

    // Strict validation: Must receive canonical UUID, NEVER fallback Date.now ID
    assert.equal(
      selectedValue.recipient_id,
      '22222222-2222-4222-8222-222222222222',
      `Expected canonical UUID from createRecipient response data.id, but received: ${selectedValue.recipient_id}`
    );
    assert.equal(
      String(selectedValue.recipient_id).startsWith('recipient:'),
      false,
      `Fake Date.now ID was used: ${selectedValue.recipient_id}`
    );
    assert.equal(selectedValue.kind, 'casual_helper', 'New helper kind must be casual_helper');

    unmount();
  });

  await suite.test('4. PersonPicker: State per value does not trigger rerender fetch loop', async () => {
    resetHarness();
    let fetchCount = 0;

    setHarness({
      listWarehousePeople: async () => {
        fetchCount++;
        return { people: [], has_more: false };
      }
    });

    const { rerender, unmount } = render(
      React.createElement(PersonPicker, {
        value: { key: 'staff:st-1', name: 'สมชาย', kind: 'staff' }
      })
    );

    // Re-render multiple times with equivalent or fresh object references
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        rerender(
          React.createElement(PersonPicker, {
            value: { key: 'staff:st-1', name: 'สมชาย', kind: 'staff' }
          })
        );
        await flushPromises();
      });
    }

    assert.equal(fetchCount, 0, 'PersonPicker must not query server on initial render or value prop updates while closed');
    unmount();
  });

  await suite.test('5. PersonPicker: Debounce out-of-order stale query cleanup', async () => {
    resetHarness();
    let queryResolvers = {};

    setHarness({
      listWarehousePeople: ({ query }) => {
        return new Promise((resolve) => {
          queryResolvers[query] = resolve;
        });
      }
    });

    const { container, unmount } = render(React.createElement(PersonPicker));

    // Open dropdown
    const triggerBtn = document.body.querySelector('button[aria-haspopup="listbox"]');
    await act(async () => {
      fireEvent.click(triggerBtn);
      await flushPromises();
    });

    const searchInput = document.body.querySelector('input[placeholder*="พิมพ์ชื่อ"]');
    assert.ok(searchInput);

    // Type query 1: "ดอกไม้"
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'ดอกไม้' } });
      await new Promise((r) => setTimeout(r, 250)); // wait debounce
    });

    // Type query 2: "กรรไกร"
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'กรรไกร' } });
      await new Promise((r) => setTimeout(r, 250)); // wait debounce
    });

    // Query 2 ("กรรไกร") arrives FIRST (fast response)
    await act(async () => {
      if (queryResolvers['กรรไกร']) {
        queryResolvers['กรรไกร']({
          people: [{ key: 'k-scissors', name: 'กรรไกรคม ช่างตัด', kind: 'casual_helper' }],
          has_more: false
        });
      }
      await flushPromises();
    });

    // Query 1 ("ดอกไม้") arrives LATER (stale slow response)
    await act(async () => {
      if (queryResolvers['ดอกไม้']) {
        queryResolvers['ดอกไม้']({
          people: [{ key: 'k-flower', name: 'ดอกไม้สด ช่างจัด', kind: 'casual_helper' }],
          has_more: false
        });
      }
      await flushPromises();
    });

    // Stale query "ดอกไม้" must NOT overwrite active query "กรรไกร"
    const dropdownText = container.textContent;
    assert.ok(dropdownText.includes('กรรไกรคม'), 'Latest query result ("กรรไกรคม") must be preserved in dropdown');
    assert.equal(
      dropdownText.includes('ดอกไม้สด'),
      false,
      'Stale out-of-order query response ("ดอกไม้สด") must be discarded and not overwrite current results'
    );

    unmount();
  });

  await suite.test('6. PersonPicker: Keyboard selection accessibility if existing', async () => {
    resetHarness();
    setHarness({
      listWarehousePeople: async () => ({
        people: [
          { recipient_id: '11111111-1111-4111-8111-111111111111', key: 'rec:1', name: 'ผู้ช่วย 1', kind: 'casual_helper' },
          { recipient_id: '22222222-2222-4222-8222-222222222222', key: 'rec:2', name: 'ผู้ช่วย 2', kind: 'casual_helper' }
        ],
        has_more: false
      })
    });

    let selectedValue = null;
    const { container, unmount } = render(
      React.createElement(PersonPicker, {
        onChange: (val) => { selectedValue = val; }
      })
    );

    const triggerBtn = document.body.querySelector('button[aria-haspopup="listbox"]');
    await act(async () => {
      fireEvent.click(triggerBtn);
      await flushPromises();
    });

    const searchInput = document.body.querySelector('input[placeholder*="พิมพ์ชื่อ"]');
    assert.ok(searchInput);

    // Press ArrowDown and Enter to select
    await act(async () => {
      fireEvent.keyDown(searchInput, { key: 'ArrowDown', code: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
      await flushPromises();
    });

    assert.ok(selectedValue, 'Keyboard navigation (ArrowDown + Enter) must select an item from the list');
    unmount();
  });

  // ===========================================================================
  // SECTION 2: ProductionHubView Safety & Contract Tests
  // ===========================================================================

  await suite.test('7. ProductionHubView: Project selection loads board for selected project', async () => {
    resetHarness();
    let loadedProjectId = null;

    setHarness({
      loadProductionProject: async ({ projectId }) => {
        loadedProjectId = projectId;
        return {
          project: { id: projectId, name: `Project ${projectId}` },
          assignments: [],
          summary: { assignment_count: 0, completed_count: 0, pending_review_count: 0 },
          permissions: { can_check: true, can_manage_cash: true }
        };
      },
      subscribeProductionProject: () => () => {}
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, {
        activities: [
          { id: 'P-1001', name: 'งานดอกไม้ประดับโรงแรม' },
          { id: 'P-1002', name: 'งานซุ้มถ่ายรูปกลางแจ้ง' }
        ],
        initialProjectId: 'P-1001'
      })
    );

    await act(async () => {
      await flushPromises();
    });

    assert.equal(loadedProjectId, 'P-1001', 'Initial project must be loaded');

    // Switch project
    const select = document.body.querySelector('select[aria-label="เลือกโปรเจกต์"]');
    assert.ok(select, 'Project selector select element must exist');

    await act(async () => {
      fireEvent.change(select, { target: { value: 'P-1002' } });
      await flushPromises();
    });

    assert.equal(loadedProjectId, 'P-1002', 'Switching project must trigger loadProductionProject for new project');
    unmount();
  });

  await suite.test('8. ProductionHubView: Project selector does not contain hardcoded fake wedding project fallback', async () => {
    resetHarness();
    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-9999', name: 'งานอีเวนต์จริง' },
        assignments: [],
        summary: {},
        permissions: { can_check: true }
      }),
      subscribeProductionProject: () => () => {}
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, {
        activities: [{ id: 'P-9999', name: 'งานอีเวนต์จริง' }],
        initialProjectId: 'P-9999'
      })
    );

    await act(async () => {
      await flushPromises();
    });

    const options = Array.from(document.body.querySelectorAll('select[aria-label="เลือกโปรเจกต์"] option'));
    const optionTexts = options.map((o) => o.textContent);

    // Hardcoded fake option 'P-0001 (งานแต่งงานหลัก)' must not appear when legitimate activities are provided
    const hasFakeWeddingOption = optionTexts.some((t) => t.includes('งานแต่งงานหลัก'));
    assert.equal(
      hasFakeWeddingOption,
      false,
      `Project selector contains hardcoded fake wedding option: ${optionTexts.join(', ')}`
    );

    unmount();
  });

  await suite.test('9. ProductionHubView: Lists 10+ helpers concurrently with individual deliverables', async () => {
    resetHarness();

    // Create 10 distinct helper assignments
    const mockAssignments = Array.from({ length: 10 }, (_, i) => ({
      id: `asgn-${i + 1}`,
      project_id: 'P-0001',
      title: `งานผลิตช่อดอกไม้ชุดที่ ${i + 1}`,
      responsible_name: `ผู้ช่วยท่านที่ ${i + 1}`,
      status: 'in_progress',
      version: 1,
      lines: [
        {
          id: `line-${i + 1}`,
          description: `ช่อทิวลิปแบบ ${i + 1}`,
          unit: 'ช่อ',
          required_qty: 10,
          accepted_qty: i,
          pending_qty: 1
        }
      ],
      submissions: []
    }));

    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-0001', name: 'Project 1' },
        assignments: mockAssignments,
        summary: { assignment_count: 10, completed_count: 0, pending_review_count: 10 },
        permissions: { can_check: true, can_manage_cash: true }
      }),
      subscribeProductionProject: () => () => {}
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, {
        initialProjectId: 'P-0001'
      })
    );

    await act(async () => {
      await flushPromises();
    });

    // Check that all 10 helpers are rendered in the DOM
    for (let i = 1; i <= 10; i++) {
      const helperName = `ผู้ช่วยท่านที่ ${i}`;
      assert.ok(
        container.textContent.includes(helperName),
        `Helper "${helperName}" must be rendered in the hub view`
      );
    }

    unmount();
  });

  await suite.test('10. ProductionHubView: Accurate display of submitted vs accepted vs pending quantities', async () => {
    resetHarness();

    const mockAssignment = {
      id: 'asgn-breakdown-1',
      project_id: 'P-0001',
      title: 'จัดดอกไม้ตั้งโต๊ะ',
      responsible_name: 'สมหญิง ผู้ช่วย',
      status: 'submitted',
      version: 1,
      lines: [
        {
          id: 'line-brk-1',
          description: 'แจกันดอกไม้ประดับ',
          unit: 'แจกัน',
          required_qty: 10,
          accepted_qty: 4,
          pending_qty: 3
        }
      ],
      submissions: [
        {
          id: 'sub-1',
          submitted_by_name: 'สมหญิง ผู้ช่วย',
          submitted_at: new Date().toISOString(),
          status: 'pending',
          lines: [{ id: 'sub-line-1', line_id: 'line-brk-1', quantity: 3, pending_qty: 3 }]
        }
      ]
    };

    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-0001', name: 'Project 1' },
        assignments: [mockAssignment],
        summary: { assignment_count: 1, pending_review_count: 1 },
        permissions: { can_check: true }
      }),
      subscribeProductionProject: () => () => {}
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, {
        initialProjectId: 'P-0001'
      })
    );

    await act(async () => {
      await flushPromises();
    });

    // Per Plan C:
    // ผ่านตรวจแล้ว = 4
    // ส่งมารอตรวจ = 3
    // ยังขาดตรวจผ่าน = 10 - 4 = 6
    // ผู้ช่วยยังต้องทำส่งเพิ่ม = 10 - 4 - 3 = 3
    const text = container.textContent;
    assert.ok(text.includes('ผ่านตรวจแล้ว') && text.includes('4 แจกัน'), 'ผ่านตรวจแล้ว must show 4');
    assert.ok(text.includes('ส่งมารอตรวจ') && text.includes('3 แจกัน'), 'ส่งมารอตรวจ must show 3');
    assert.ok(text.includes('ยังขาดตรวจผ่าน') && text.includes('6 แจกัน'), 'ยังขาดตรวจผ่าน must show 6');
    assert.ok(text.includes('ผู้ช่วยยังต้องทำส่งเพิ่มอีก 3 แจกัน'), 'ต้องทำส่งเพิ่ม must show 3');

    unmount();
  });

  await suite.test('11. ProductionHubView: Partial submission dispatches proper service payload', async () => {
    resetHarness();
    let submittedPayload = null;

    const mockAssignment = {
      id: 'asgn-submit-1',
      project_id: 'P-0001',
      title: 'งานทำพวงมาลัย',
      responsible_name: 'น้าแดง',
      status: 'in_progress',
      version: 1,
      lines: [
        {
          id: 'line-garland-1',
          description: 'พวงมาลัยข้อพระกร',
          unit: 'พวง',
          required_qty: 10,
          accepted_qty: 2,
          pending_qty: 0
        }
      ],
      submissions: []
    };

    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-0001', name: 'Project 1' },
        assignments: [mockAssignment],
        summary: {},
        permissions: { can_check: true }
      }),
      subscribeProductionProject: () => () => {},
      submitProductionWork: async (payload) => {
        submittedPayload = payload;
        return { success: true };
      }
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, { initialProjectId: 'P-0001' })
    );

    await act(async () => {
      await flushPromises();
    });

    // Click "ส่งงาน"
    const submitWorkBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('ส่งงาน')
    );
    assert.ok(submitWorkBtn, 'Submit work button must exist');

    await act(async () => {
      fireEvent.click(submitWorkBtn);
      await flushPromises();
    });

    // In modal, change quantity to 5 (partial submission out of 8 remaining)
    const qtyInput = document.body.querySelector('input[type="number"]');
    assert.ok(qtyInput, 'Submission quantity input must exist');

    await act(async () => {
      fireEvent.change(qtyInput, { target: { value: '5' } });
      await flushPromises();
    });

    // Submit the modal form
    const form = document.body.querySelector('form');
    assert.ok(form, 'Submit modal form must exist');

    await act(async () => {
      fireEvent.submit(form);
      await flushPromises();
    });

    assert.ok(submittedPayload, 'submitProductionWork must be called');
    assert.equal(submittedPayload.assignmentId, 'asgn-submit-1');
    assert.deepEqual(submittedPayload.lines, [{ lineId: 'line-garland-1', quantity: 5 }]);

    unmount();
  });

  await suite.test('12. ProductionHubView: Staff inspection dispatches proper service payload', async () => {
    resetHarness();
    let inspectPayload = null;

    const mockAssignment = {
      id: 'asgn-inspect-1',
      project_id: 'P-0001',
      title: 'งานทำพวงมาลัย',
      responsible_name: 'น้าแดง',
      status: 'submitted',
      version: 1,
      lines: [
        { id: 'l-1', description: 'พวงมาลัย', unit: 'พวง', required_qty: 5, accepted_qty: 0, pending_qty: 5 }
      ],
      submissions: [
        {
          id: 'sub-pending-1',
          submitted_by_name: 'น้าแดง',
          submitted_at: new Date().toISOString(),
          status: 'pending',
          lines: [{ id: 'sl-1', line_id: 'l-1', quantity: 5, pending_qty: 5 }]
        }
      ]
    };

    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-0001', name: 'Project 1' },
        assignments: [mockAssignment],
        summary: {},
        permissions: { can_check: true }
      }),
      subscribeProductionProject: () => () => {},
      inspectProductionWork: async (payload) => {
        inspectPayload = payload;
        return { success: true };
      }
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, { initialProjectId: 'P-0001' })
    );

    await act(async () => {
      await flushPromises();
    });

    // Click "ตรวจรับ" button on the pending submission card
    const inspectBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.trim() === 'ตรวจรับ' && b.className.includes('bg-amber-600')
    );
    assert.ok(inspectBtn, 'Inspection button on submission card must exist');

    await act(async () => {
      fireEvent.click(inspectBtn);
      await flushPromises();
    });

    // Find accepted and rejected inputs in modal
    const numberInputs = document.body.querySelectorAll('input[type="number"]');
    assert.ok(numberInputs.length >= 2, 'Accepted and Rejected number inputs must exist');

    await act(async () => {
      fireEvent.change(numberInputs[0], { target: { value: '3' } }); // accepted: 3
      fireEvent.change(numberInputs[1], { target: { value: '2' } }); // rejected: 2
      await flushPromises();
    });

    // Submit inspection form
    const form = document.body.querySelector('form');
    assert.ok(form);

    await act(async () => {
      fireEvent.submit(form);
      await flushPromises();
    });

    assert.ok(inspectPayload, 'inspectProductionWork must be called');
    assert.equal(inspectPayload.submissionId, 'sub-pending-1');
    assert.deepEqual(inspectPayload.lines, [
      { submissionLineId: 'sl-1', acceptedQty: 3, rejectedQty: 2 }
    ]);

    unmount();
  });

  await suite.test('13. ProductionHubView: Completion is blocked until 100% accepted with no pending review', async () => {
    resetHarness();
    let statusChangePayload = null;

    const mockIncompleteAssignment = {
      id: 'asgn-incomplete',
      project_id: 'P-0001',
      title: 'งานโครงซุ้มดอกไม้',
      responsible_name: 'สมศักดิ์',
      status: 'in_progress',
      version: 1,
      lines: [
        { id: 'l-inc-1', description: 'โครงไม้ไผ่', unit: 'ชุด', required_qty: 2, accepted_qty: 1, pending_qty: 1 }
      ],
      submissions: []
    };

    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-0001', name: 'Project 1' },
        assignments: [mockIncompleteAssignment],
        summary: {},
        permissions: { can_check: true }
      }),
      subscribeProductionProject: () => () => {},
      setProductionStatus: async (payload) => {
        statusChangePayload = payload;
        return { success: true };
      }
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, { initialProjectId: 'P-0001' })
    );

    await act(async () => {
      await flushPromises();
    });

    // Complete action button on assignment card
    const completeActionBtn = document.body.querySelector('button[aria-label^="\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e40\u0e2a\u0e23\u0e47\u0e08\u0e2a\u0e34\u0e49\u0e19:"]');
    assert.ok(completeActionBtn, 'Complete button on assignment card must exist');
    assert.equal(completeActionBtn.disabled, true, 'Complete button must be disabled when work is not 100% accepted');

    // Attempting to click must NOT invoke status change
    await act(async () => {
      fireEvent.click(completeActionBtn);
      await flushPromises();
    });
    assert.equal(statusChangePayload, null, 'setProductionStatus must not be called when incomplete');

    unmount();
  });

  await suite.test('14. ProductionHubView: Submission failure keeps form state and retries with STABLE idempotency key', async () => {
    resetHarness();
    let createAssignmentCalls = [];

    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-0001', name: 'Project 1' },
        assignments: [],
        summary: {},
        permissions: { can_check: true }
      }),
      subscribeProductionProject: () => () => {},
      listWarehousePeople: async () => ({
        people: [{ key: 'rec:test', name: 'ผู้รับงานทดสอบ', kind: 'casual_helper', recipient_id: '33333333-3333-4333-8333-333333333333' }],
        has_more: false
      }),
      createProductionAssignment: async (payload) => {
        createAssignmentCalls.push(payload);
        if (createAssignmentCalls.length === 1) {
          throw new Error('Connection timeout to database');
        }
        return { success: true };
      }
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, { initialProjectId: 'P-0001' })
    );

    await act(async () => {
      await flushPromises();
    });

    // Open add assignment modal
    const addBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('+ มอบหมายงานใหม่')
    );
    assert.ok(addBtn);

    await act(async () => {
      fireEvent.click(addBtn);
      await flushPromises();
    });

    // Fill form title
    const titleInput = document.body.querySelector('input[placeholder*="ผลิตช่อดอกไม้สด"]');
    assert.ok(titleInput, 'Title input must exist');

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'งานซุ้มประตูใหญ่' } });
      await flushPromises();
    });

    // Select a person in modal
    const pickerTrigger = document.body.querySelector('#person-picker') || document.body.querySelector('button[aria-haspopup="listbox"]');
    assert.ok(pickerTrigger);
    await act(async () => {
      fireEvent.click(pickerTrigger);
      await flushPromises();
    });
    const personOption = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent.includes('ผู้รับงานทดสอบ'));
    if (personOption) {
      await act(async () => {
        fireEvent.click(personOption);
        await flushPromises();
      });
    }

    // Fill line description
    const descInput = document.body.querySelector('input[placeholder*="รายละเอียดชิ้นงาน"]');
    assert.ok(descInput, 'Line description input must exist');

    await act(async () => {
      fireEvent.change(descInput, { target: { value: 'เสาดอกไม้ A' } });
      await flushPromises();
    });

    // Trigger form submit
    const submitBtn = Array.from(document.body.querySelectorAll('button[type="submit"]')).find((b) =>
      b.textContent.includes('สร้างงานมอบหมาย')
    );
    assert.ok(submitBtn, 'Submit button must exist in modal');

    // First submit attempt (fails due to simulated network error)
    await act(async () => {
      fireEvent.click(submitBtn);
      await flushPromises();
    });

    // Verification 1: Form MUST remain open and retain user input on failure
    assert.ok(document.body.querySelector('input[placeholder*="ผลิตช่อดอกไม้สด"]'), 'Form modal must stay open after network failure');
    assert.equal(
      document.body.querySelector('input[placeholder*="ผลิตช่อดอกไม้สด"]')?.value,
      'งานซุ้มประตูใหญ่',
      'Form inputs must be preserved across submission failure'
    );

    // Second submit attempt (retry)
    await act(async () => {
      fireEvent.click(submitBtn);
      await flushPromises();
    });

    // Verification 2: Idempotency Key stability across retries
    // Per requirement: "failurekeepsform and repeatstablekey"
    assert.ok(createAssignmentCalls.length >= 2, 'createProductionAssignment must be called on retry');
    assert.ok(
      createAssignmentCalls[0].idempotencyKey,
      'createProductionAssignment must include an idempotencyKey to prevent duplicate creation on retry'
    );
    assert.equal(
      createAssignmentCalls[0].idempotencyKey,
      createAssignmentCalls[1].idempotencyKey,
      'Repeated submission retry must reuse the exact same idempotency key to prevent double creation'
    );

    unmount();
  });

  await suite.test('15. ProductionHubView: Assignment cancellation preserves history and NEVER calls tool return or movement', async () => {
    resetHarness();
    let statusChangePayload = null;
    let toolReturnCalled = false;
    let dispatchMovementCalled = false;

    const mockAssignment = {
      id: 'asgn-cancel-1',
      project_id: 'P-0001',
      title: 'งานทำพวงหรีด',
      responsible_name: 'น้าแดง',
      status: 'in_progress',
      version: 2,
      lines: [{ id: 'l-c-1', description: 'พวงหรีด', unit: 'พวง', required_qty: 3, accepted_qty: 1, pending_qty: 0 }],
      submissions: []
    };

    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-0001', name: 'Project 1' },
        assignments: [mockAssignment],
        summary: {},
        permissions: { can_check: true }
      }),
      subscribeProductionProject: () => () => {},
      setProductionStatus: async (payload) => {
        statusChangePayload = payload;
        return { success: true };
      },
      returnTools: async () => {
        toolReturnCalled = true;
        return { success: true };
      },
      dispatchWarehouseCommand: async (action) => {
        if (action.includes('movement') || action.includes('return') || action.includes('tool')) {
          dispatchMovementCalled = true;
        }
        return { success: true };
      }
    });

    global.__PROMPT_RETURN_VALUE__ = 'ยกเลิกเนื่องจากลูกค้าเปลี่ยนแบบชิ้นงาน';

    const { container, unmount } = render(
      React.createElement(ProductionHubView, { initialProjectId: 'P-0001' })
    );

    await act(async () => {
      await flushPromises();
    });

    // Click cancel button (XCircle button)
    const cancelBtn = document.body.querySelector('button[title="ยกเลิกชุดงานนี้"]');
    assert.ok(cancelBtn, 'Cancel assignment button must exist');

    await act(async () => {
      fireEvent.click(cancelBtn);
      await flushPromises();
    });

    assert.ok(statusChangePayload, 'setProductionStatus must be called with cancelled');
    assert.equal(statusChangePayload.status, 'cancelled');
    assert.equal(statusChangePayload.reason, 'ยกเลิกเนื่องจากลูกค้าเปลี่ยนแบบชิ้นงาน');

    // Strict rule: "การส่งงานและกดเสร็จสิ้นไม่ตัดวัสดุซ้ำ และไม่คืนเครื่องมือโดยอัตโนมัติ"
    assert.equal(toolReturnCalled, false, 'Cancellation must never trigger automatic tool return');
    assert.equal(dispatchMovementCalled, false, 'Cancellation must never trigger warehouse movement calls');

    unmount();
  });

  // ===========================================================================
  // SECTION 3: Lifecycle, Cleanup & UI Directive Compliance
  // ===========================================================================

  await suite.test('16. ProductionHubView: Lifecycle cleanup unmounts channel and respects isActive prop', async () => {
    resetHarness();
    let unsubscribeCalled = false;
    let subscribeCount = 0;
    let fetchCount = 0;

    setHarness({
      loadProductionProject: async () => {
        fetchCount++;
        return {
          project: { id: 'P-0001', name: 'P-0001' },
          assignments: [],
          summary: {},
          permissions: { can_check: true }
        };
      },
      subscribeProductionProject: () => {
        subscribeCount++;
        return () => {
          unsubscribeCalled = true;
        };
      }
    });

    // Test 1: Unmount cleanup
    const { unmount } = render(
      React.createElement(ProductionHubView, { initialProjectId: 'P-0001' })
    );

    await act(async () => {
      await flushPromises();
    });

    assert.equal(subscribeCount, 1, 'Realtime subscription must be initialized');
    unmount();
    assert.equal(unsubscribeCalled, true, 'Unmounting must call channel unsubscribe cleanup');

    // Test 2: Gated lifecycle when isActive=false (Plan C tab switching)
    // Per directive: "Active/unmount/projectchange cleanup where APIhasisActive, no staleboard crossproject"
    let inactiveFetchCount = 0;
    setHarness({
      loadProductionProject: async () => {
        inactiveFetchCount++;
        return { project: { id: 'P-0001' }, assignments: [], summary: {} };
      },
      subscribeProductionProject: () => () => {}
    });

    const { unmount: unmountInactive } = render(
      React.createElement(ProductionHubView, {
        initialProjectId: 'P-0001',
        isActive: false
      })
    );

    await act(async () => {
      await flushPromises();
    });

    assert.equal(
      inactiveFetchCount,
      0,
      `ProductionHubView must NOT fetch data when isActive=false (fetched ${inactiveFetchCount} times)`
    );

    unmountInactive();
  });

  await suite.test('17. ProductionHubView: Out-of-order slow project fetch does not overwrite newer active project', async () => {
    resetHarness();
    let projectResolvers = {};

    setHarness({
      loadProductionProject: ({ projectId }) => {
        return new Promise((resolve) => {
          projectResolvers[projectId] = resolve;
        });
      },
      subscribeProductionProject: () => () => {}
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, {
        activities: [
          { id: 'P-SLOW', name: 'Slow Project' },
          { id: 'P-FAST', name: 'Fast Project' }
        ],
        initialProjectId: 'P-SLOW'
      })
    );

    await act(async () => {
      await flushPromises();
    });

    // Switch to P-FAST
    const select = document.body.querySelector('select[aria-label="เลือกโปรเจกต์"]');
    assert.ok(select);

    await act(async () => {
      fireEvent.change(select, { target: { value: 'P-FAST' } });
      await flushPromises();
    });

    // P-FAST resolves first
    await act(async () => {
      if (projectResolvers['P-FAST']) {
        projectResolvers['P-FAST']({
          project: { id: 'P-FAST', name: 'Fast Project Board' },
          assignments: [
            { id: 'asgn-fast', title: 'งานโปรเจกต์เร็ว', responsible_name: 'ช่าง A', lines: [] }
          ],
          summary: {},
          permissions: {}
        });
      }
      await flushPromises();
    });

    // P-SLOW resolves later
    await act(async () => {
      if (projectResolvers['P-SLOW']) {
        projectResolvers['P-SLOW']({
          project: { id: 'P-SLOW', name: 'Slow Project Board' },
          assignments: [
            { id: 'asgn-slow', title: 'งานโปรเจกต์ช้า', responsible_name: 'ช่าง B', lines: [] }
          ],
          summary: {},
          permissions: {}
        });
      }
      await flushPromises();
    });

    const text = container.textContent;
    assert.ok(text.includes('งานโปรเจกต์เร็ว'), 'Active project data must be displayed');
    assert.equal(text.includes('งานโปรเจกต์ช้า'), false, 'Stale project response must not leak into current board');

    unmount();
  });

  await suite.test('18. Strict Custom UI Directive: No banned native <input type="datetime-local"> or <input type="date"> pickers', async () => {
    resetHarness();
    setHarness({
      loadProductionProject: async () => ({
        project: { id: 'P-0001', name: 'Project' },
        assignments: [],
        summary: {},
        permissions: { can_check: true }
      }),
      subscribeProductionProject: () => () => {}
    });

    const { container, unmount } = render(
      React.createElement(ProductionHubView, { initialProjectId: 'P-0001' })
    );

    await act(async () => {
      await flushPromises();
    });

    // Open add assignment modal
    const addBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('+ มอบหมายงานใหม่')
    );
    assert.ok(addBtn);

    await act(async () => {
      fireEvent.click(addBtn);
      await flushPromises();
    });

    // Check for banned native date/datetime inputs
    // Directive: "เด็ดขาด ห้ามใช้ <input type="date"> หรือ <input type="datetime-local"> เป็นอันขาด ต้องใช้ <ModernDateTimePicker />"
    const nativeDateInputs = document.body.querySelectorAll('input[type="date"], input[type="datetime-local"]');
    assert.equal(
      nativeDateInputs.length,
      0,
      `Banned native date picker found in DOM: <input type="${nativeDateInputs[0]?.getAttribute('type')}">. Must use <ModernDateTimePicker /> instead.`
    );

    unmount();
  });
});
