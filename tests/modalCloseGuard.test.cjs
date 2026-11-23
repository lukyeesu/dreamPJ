const { loadProductionComponent } = require('./helpers/productionUiHarness.cjs');
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { render, fireEvent, act, cleanup } = require('@testing-library/react');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '<div id="root"></div>';
});

test('useModalCloseGuard prompts confirmation on X and Escape in edit mode, preserves data on cancel, and closes immediately in view-only mode', async () => {
  const useModalCloseGuard = await loadProductionComponent('src/hooks/useModalCloseGuard.jsx');

  let closeCount = 0;

  function TestModal({ shouldConfirm = true }) {
    const [open, setOpen] = React.useState(true);
    const [draft, setDraft] = React.useState('งานจัดดอกไม้วันเกิด');
    const handleClose = React.useCallback(() => {
      closeCount += 1;
      setOpen(false);
    }, []);
    const { requestClose, closeConfirmDialog } = useModalCloseGuard({
      isOpen: open,
      onClose: handleClose,
      shouldConfirm,
      listenEscape: true,
    });

    if (!open) return React.createElement('div', { 'data-testid': 'closed' }, 'CLOSED');

    return React.createElement(
      React.Fragment,
      null,
      closeConfirmDialog,
      React.createElement(
        'div',
        { 'data-testid': 'modal-backdrop' },
        React.createElement(
          'div',
          { 'data-testid': 'modal-body' },
          React.createElement('input', {
            'aria-label': 'ชื่องาน',
            value: draft,
            onChange: (e) => setDraft(e.target.value),
          }),
          React.createElement('button', { type: 'button', onClick: requestClose }, 'X'),
          React.createElement('button', { type: 'button', onClick: handleClose }, 'บันทึก')
        )
      )
    );
  }

  // 1. Edit mode (shouldConfirm: true)
  const ui = render(React.createElement(TestModal, { shouldConfirm: true }));

  // Clicking backdrop does NOT close or show confirmation
  await act(async () => {
    fireEvent.click(ui.getByTestId('modal-backdrop'));
  });
  assert.equal(closeCount, 0);
  assert.equal(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'), false);

  // Clicking X opens ConfirmDialog without closing
  await act(async () => {
    fireEvent.click(ui.getByText('X'));
  });
  assert.equal(closeCount, 0);
  assert.ok(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'));

  // Clicking "ยกเลิก" dismisses ConfirmDialog and keeps draft data intact
  await act(async () => {
    fireEvent.click(ui.getByText('ยกเลิก'));
  });
  assert.equal(closeCount, 0);
  assert.equal(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'), false);
  assert.equal(ui.getByLabelText('ชื่องาน').value, 'งานจัดดอกไม้วันเกิด');

  // Pressing Escape opens ConfirmDialog; pressing Escape again cancels ConfirmDialog
  await act(async () => {
    fireEvent.keyDown(window, { key: 'Escape' });
  });
  assert.ok(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'));
  await act(async () => {
    fireEvent.keyDown(window, { key: 'Escape' });
  });
  assert.equal(closeCount, 0);
  assert.equal(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'), false);

  // Clicking X then "ตกลง" closes the modal
  await act(async () => {
    fireEvent.click(ui.getByText('X'));
  });
  await act(async () => {
    fireEvent.click(ui.getByText('ตกลง'));
  });
  assert.equal(closeCount, 1);
  assert.ok(ui.getByTestId('closed'));

  cleanup();
  closeCount = 0;

  // 2. Save button closes immediately without confirmation
  const uiSave = render(React.createElement(TestModal, { shouldConfirm: true }));
  await act(async () => {
    fireEvent.click(uiSave.getByText('บันทึก'));
  });
  assert.equal(closeCount, 1);
  assert.equal(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'), false);

  cleanup();
  closeCount = 0;

  // 3. View-only mode (shouldConfirm: false) closes immediately on X without confirmation
  const uiView = render(React.createElement(TestModal, { shouldConfirm: false }));
  await act(async () => {
    fireEvent.click(uiView.getByText('X'));
  });
  assert.equal(closeCount, 1);
  assert.equal(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'), false);
});

test('useModalCloseGuard closes immediately when nothing was typed/changed, prompts after typing, and closes cleanly if cleared back', async () => {
  const useModalCloseGuard = await loadProductionComponent('src/hooks/useModalCloseGuard.jsx');

  let closeCount = 0;

  function WatchedModal() {
    const [open, setOpen] = React.useState(true);
    const [name, setName] = React.useState('');
    const [defaultDate] = React.useState('23/11/2569 15:09');
    const handleClose = React.useCallback(() => {
      closeCount += 1;
      setOpen(false);
    }, []);
    const { requestClose, closeConfirmDialog } = useModalCloseGuard({
      isOpen: open,
      onClose: handleClose,
      shouldConfirm: true,
      watch: open ? [name, defaultDate] : null,
      listenEscape: true,
    });

    if (!open) return React.createElement('div', { 'data-testid': 'closed' }, 'CLOSED');

    return React.createElement(
      React.Fragment,
      null,
      closeConfirmDialog,
      React.createElement('input', {
        'aria-label': 'ชื่องาน',
        value: name,
        onChange: (e) => setName(e.target.value),
      }),
      React.createElement('button', { type: 'button', onClick: requestClose }, 'X')
    );
  }

  // 1. Nothing typed yet (even with prefilled defaultDate) -> X closes immediately with NO confirmation
  const ui1 = render(React.createElement(WatchedModal));
  await act(async () => {
    fireEvent.click(ui1.getByText('X'));
  });
  assert.equal(closeCount, 1);
  assert.equal(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'), false);

  cleanup();
  closeCount = 0;

  // 2. Type something -> X prompts confirmation; clear it back -> X closes immediately without confirmation
  const ui2 = render(React.createElement(WatchedModal));
  await act(async () => {
    fireEvent.change(ui2.getByLabelText('ชื่องาน'), { target: { value: 'ช่อดอกไม้' } });
  });
  await act(async () => {
    fireEvent.click(ui2.getByText('X'));
  });
  assert.equal(closeCount, 0);
  assert.ok(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'));

  // Cancel dialog
  await act(async () => {
    fireEvent.click(ui2.getByText('ยกเลิก'));
  });
  assert.equal(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'), false);

  // Clear input back to empty -> closes immediately without confirmation
  await act(async () => {
    fireEvent.change(ui2.getByLabelText('ชื่องาน'), { target: { value: '' } });
  });
  await act(async () => {
    fireEvent.click(ui2.getByText('X'));
  });
  assert.equal(closeCount, 1);
  assert.equal(document.body.textContent.includes('ยืนยันการปิดหน้าต่าง'), false);
});

test('All data-entry modals across the app use useModalCloseGuard and do not close on gray backdrop click', () => {
  const guardedFiles = [
    'src/App.jsx',
    'src/Finance.jsx',
    'src/Quotations.jsx',
    'src/Customers.jsx',
    'src/Artists.jsx',
    'src/Locations.jsx',
    'src/Staff.jsx',
    'src/Settings.jsx',
    'src/components/modals/UserProfileModal.jsx',
    'src/components/inventory/ItemFormModal.jsx',
    'src/components/inventory/StockAdjustModal.jsx',
    'src/components/inventory/AddAssetUnitModal.jsx',
    'src/components/inventory/AddRecipientModal.jsx',
    'src/components/inventory/CategoryManageModal.jsx',
  ];

  for (const relPath of guardedFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
    assert.ok(
      src.includes('useModalCloseGuard'),
      `${relPath} must use useModalCloseGuard`
    );
    assert.equal(
      src.includes('handleBackdropClick'),
      false,
      `${relPath} must not wire handleBackdropClick on its form modal backdrop`
    );
  }

  // Verify App.jsx Project Modal backdrop does not have onClick={closeModal}
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  assert.equal(
    /backdrop-animate-in'\}`\}\s*\n\s*onClick=\{closeModal\}/.test(appSrc),
    false,
    'App.jsx project modal backdrop must not close on click'
  );

  // Verify no Temporal Dead Zone (TDZ): every view-only / open state passed into useModalCloseGuard is declared BEFORE the hook call
  const tdzChecks = [
    ['src/App.jsx', 'const [viewOnlyMode,'],
    ['src/Finance.jsx', 'const [isEditTxViewOnly,'],
    ['src/Quotations.jsx', 'const [isViewOnly,'],
    ['src/Quotations.jsx', 'const [isRatesViewOnly,'],
    ['src/Customers.jsx', 'const [isViewOnly,'],
    ['src/Artists.jsx', 'const [isViewOnly,'],
    ['src/Locations.jsx', 'const [isVenueViewOnly,'],
    ['src/Locations.jsx', 'const [isHubViewOnly,'],
    ['src/Staff.jsx', 'const [isViewOnly,'],
    ['src/Settings.jsx', 'const [newRoleForm,'],
    ['src/components/modals/UserProfileModal.jsx', 'const [isEditing,'],
  ];

  for (const [relPath, decl] of tdzChecks) {
    const src = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
    const declIdx = src.indexOf(decl);
    const hookIdx = src.indexOf('useModalCloseGuard({');
    assert.ok(declIdx !== -1, `${relPath} must declare ${decl}`);
    assert.ok(hookIdx !== -1, `${relPath} must call useModalCloseGuard({`);
    assert.ok(
      declIdx < hookIdx,
      `${relPath} declares "${decl}" AFTER useModalCloseGuard (causes runtime ReferenceError / white screen)`
    );
  }
});
