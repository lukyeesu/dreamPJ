import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Factory,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Share2,
  Calendar,
  Layers,
  User,
  Users,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  Send,
  Eye,
  Edit2,
  ChevronRight,
  AlertCircle,
  Filter,
  Check,
  X,
  Banknote,
  Lock,
  Loader2,
  Split,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import * as productionService from '../../services/productionService.js';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';
import PersonPicker from './PersonPicker.jsx';
import ModernDateTimePicker from '../common/ModernDateTimePicker.jsx';
import Toast from '../common/Toast.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';

/**
 * Thai label mappings for production statuses
 */
const STATUS_LABELS = {
  in_progress: { label: 'กำลังทำ', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  submitted: { label: 'รอตรวจรับ', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'เสร็จสิ้น', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  problem: { label: 'มีปัญหา', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelled: { label: 'ยกเลิก', bg: 'bg-slate-100 text-slate-500 border-slate-200' }
};

export default function ProductionHubView({
  activities = [],
  initialProjectId = '',
  isActive = true,
  userProfile = null,
  onOpenIssueCartWithProject = null,
  className = ''
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    if (initialProjectId) return initialProjectId;
    if (activities && activities.length > 0) return activities[0].id;
    return '';
  });

  const [boardData, setBoardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const [detailsById, setDetailsById] = useState({});
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_progress' | 'submitted' | 'completed' | 'problem'
  const [searchPersonQuery, setSearchPersonQuery] = useState('');

  // Toast & Modals
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Dialog State: 'add_assignment' | 'edit_assignment' | 'split_assignment' | 'submit_work' | 'inspect_work' | 'inspect_cash' | 'custom_reason'
  const [activeModal, setActiveModal] = useState(null);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [pendingStatusAction, setPendingStatusAction] = useState(null); // { assignment, status, title, promptText }

  // Form states for modals
  const [formTitle, setFormTitle] = useState('');
  const [formPerson, setFormPerson] = useState(null);
  const [formDueAt, setFormDueAt] = useState('');
  const [formLines, setFormLines] = useState([{ description: '', requiredQty: 1, unit: 'ชุด' }]);
  const [formReason, setFormReason] = useState('');
  const [formSplitPerson, setFormSplitPerson] = useState(null);
  const [formSplitLines, setFormSplitLines] = useState([]);
  const [formSubmissionLines, setFormSubmissionLines] = useState([]);
  const [formInspectionLines, setFormInspectionLines] = useState([]);
  const [formNotes, setFormNotes] = useState('');
  const [formCashNoteCount, setFormCashNoteCount] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Idempotency key hook
  const { getKey, clearKey } = useWarehouseCommandKey();

  // Guard refs
  const isPendingActionRef = useRef(false);
  const loadTokenRef = useRef(0);
  const activeProjectRef = useRef(selectedProjectId);
  activeProjectRef.current = selectedProjectId;
  const isMountedRef = useRef(true);
  const authIdentity = userProfile?.id || userProfile?.user_id || '';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update selectedProjectId when initialProjectId changes
  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
      setPageOffset(0);
    }
  }, [initialProjectId]);

  // Load project board data
  const fetchProjectBoard = useCallback(
    async (isSilent = false) => {
      if (!isActive || !selectedProjectId) return;
      const token = ++loadTokenRef.current;
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const data = await productionService.loadProductionProject({
          projectId: selectedProjectId,
          limit: 25,
          offset: pageOffset
        });

        if (token !== loadTokenRef.current || !isMountedRef.current) return;
        setBoardData(data);
      } catch (err) {
        if (token !== loadTokenRef.current || !isMountedRef.current) return;
        console.warn(`Failed to load production project [${selectedProjectId}]:`, err);
        const msg = String(err?.message || '');
        if (msg.includes('42883') || msg.includes('warehouse_load_production_project')) {
          setErrorMessage('ระบบหน้ากลางงานผลิตยังไม่ได้ติดตั้งบนฐานข้อมูล Supabase');
        } else {
          setErrorMessage(msg || 'ไม่สามารถโหลดข้อมูลงานผลิตของโปรเจกต์นี้ได้');
        }
      } finally {
        if (token === loadTokenRef.current && isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [selectedProjectId, isActive, pageOffset]
  );

  const refreshCards = useCallback(async (assignmentIds) => {
    if (!isActive || !selectedProjectId || !assignmentIds?.length) return;
    const token = loadTokenRef.current;
    try {
      const result = await productionService.loadProductionWorkCards({ projectId: selectedProjectId, assignmentIds });
      if (!isMountedRef.current || token !== loadTokenRef.current) return;
      setBoardData((previous) => previous ? {
        ...previous,
        ...(result.summary ? { summary: result.summary } : {}),
        assignments: (previous.assignments || []).map((card) => result.assignments?.find((next) => next.id === card.id) || card)
      } : previous);
      setDetailsById((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => !assignmentIds.includes(id))));
    } catch (error) {
      if (isMountedRef.current && token === loadTokenRef.current) setErrorMessage(error.message);
    }
  }, [isActive, selectedProjectId]);

  const showHistory = async (assignment, offset = 0) => {
    setExpandedHistoryId(assignment.id);
    const token = loadTokenRef.current;
    try {
      const result = await productionService.loadProductionWorkDetails({ assignmentId: assignment.id, limit: 20, offset });
      if (!isMountedRef.current || token !== loadTokenRef.current) return;
      setDetailsById((previous) => ({ ...previous, [assignment.id]: { ...result, submissions: offset ? [...(previous[assignment.id]?.submissions || []), ...(result.submissions || [])] : result.submissions } }));
    } catch (error) {
      if (isMountedRef.current && token === loadTokenRef.current) setToastMessage({ type: 'error', text: error.message });
    }
  };

  // Initial fetch and Realtime subscription
  useEffect(() => {
    loadTokenRef.current += 1;
    setBoardData(null);
    setDetailsById({});
    setActiveModal(null);
    if (!isActive || !selectedProjectId) {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsRealtimeConnected(false);
      return;
    }

    fetchProjectBoard(false);

    const unsubscribe = productionService.subscribeProductionProject(
      selectedProjectId,
      (updatedProjectId, change) => {
        if (updatedProjectId === activeProjectRef.current && isMountedRef.current) {
          refreshCards(change?.assignmentIds);
        }
      },
      (connStatus) => {
        if (isMountedRef.current) {
          setIsRealtimeConnected(connStatus === 'SUBSCRIBED');
        }
      }
    );

    return () => {
      loadTokenRef.current += 1;
      unsubscribe();
    };
  }, [selectedProjectId, isActive, authIdentity, fetchProjectBoard, refreshCards]);

  // Derived assignments with search and status filters
  const filteredAssignments = useMemo(() => {
    if (!boardData || !Array.isArray(boardData.assignments)) return [];
    return boardData.assignments.filter((asgn) => {
      if (statusFilter !== 'all' && asgn.status !== statusFilter) return false;
      if (searchPersonQuery.trim()) {
        const q = searchPersonQuery.toLowerCase();
        const matchesName = (asgn.responsible_name || '').toLowerCase().includes(q);
        const matchesTitle = (asgn.title || '').toLowerCase().includes(q);
        const matchesLines = (asgn.lines || []).some((l) => (l.description || '').toLowerCase().includes(q));
        if (!matchesName && !matchesTitle && !matchesLines) return false;
      }
      return true;
    });
  }, [boardData, statusFilter, searchPersonQuery]);

  // Permissions from board payload
  const canCheck = Boolean(boardData?.permissions?.can_check);
  const canManageCash = Boolean(boardData?.permissions?.can_manage_cash);

  // Handlers for Opening Modals
  const openAddAssignmentModal = () => {
    setFormTitle('');
    setFormPerson(null);
    setFormDueAt('');
    setFormLines([{ description: '', requiredQty: 1, unit: 'ชุด' }]);
    setActiveModal('add_assignment');
  };

  const openEditAssignmentModal = (assignment) => {
    setActiveAssignment(assignment);
    setFormTitle(assignment.title || '');
    setFormDueAt(assignment.due_at ? assignment.due_at.slice(0, 16) : '');
    setFormLines(
      assignment.lines.map((l) => ({
        id: l.id,
        description: l.description,
        requiredQty: l.required_qty,
        unit: l.unit
      }))
    );
    setFormReason('');
    setActiveModal('edit_assignment');
  };

  const openSplitAssignmentModal = (assignment) => {
    setActiveAssignment(assignment);
    setFormSplitPerson(null);
    setFormTitle(`งานแบ่งจาก ${assignment.title}`);
    setFormReason('');
    // Remaining unsubmitted / not passed quantities per line
    setFormSplitLines(
      assignment.lines.map((l) => {
        const remaining = Math.max(0, Number(l.required_qty) - Number(l.accepted_qty) - Number(l.pending_qty));
        return {
          lineId: l.id,
          description: l.description,
          unit: l.unit,
          maxQty: remaining,
          quantity: 0
        };
      })
    );
    setActiveModal('split_assignment');
  };

  const openSubmitWorkModal = (assignment) => {
    setActiveAssignment(assignment);
    setFormNotes('');
    setFormSubmissionLines(
      assignment.lines.map((l) => {
        const remainingNeeded = Math.max(0, Number(l.required_qty) - Number(l.accepted_qty) - Number(l.pending_qty));
        return {
          lineId: l.id,
          description: l.description,
          unit: l.unit,
          maxQty: remainingNeeded,
          quantity: remainingNeeded
        };
      })
    );
    setActiveModal('submit_work');
  };

  const openInspectWorkModal = (assignment, submission) => {
    setActiveAssignment(assignment);
    setActiveSubmission(submission);
    setFormNotes('');
    setFormInspectionLines(
      submission.lines.map((subLine) => ({
        submissionLineId: subLine.id,
        lineId: subLine.line_id,
        submittedQty: Number(subLine.quantity),
        pendingQty: Number(subLine.pending_qty ?? subLine.quantity),
        acceptedQty: Number(subLine.pending_qty ?? subLine.quantity),
        rejectedQty: 0
      }))
    );
    setActiveModal('inspect_work');
  };

  const openInspectCashModal = (assignment) => {
    setActiveAssignment(assignment);
    setFormCashNoteCount('');
    setFormNotes('');
    setActiveModal('inspect_cash');
  };

  // Submit Handler: Add Standalone Assignment with stable idempotency key on failure
  const handleAddAssignmentSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingAction || isPendingActionRef.current) return;

    if (!formTitle.trim()) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุชื่องานที่มอบหมาย' });
      return;
    }
    if (!formPerson) {
      setToastMessage({ type: 'error', text: 'กรุณาเลือกผู้รับผิดชอบงาน' });
      return;
    }
    if (!formPerson.recipient_id || formLines.some((line) => !line.description.trim() || !Number.isSafeInteger(Number(line.requiredQty)) || Number(line.requiredQty) <= 0)) {
      setToastMessage({ type: 'error', text: 'กรุณาเลือกผู้รับจากทะเบียนและระบุจำนวนเต็มบวกให้ครบ' });
      return;
    }
    const validLines = formLines.filter((l) => l.description.trim() && Number(l.requiredQty) > 0);
    if (validLines.length === 0) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุสิ่งที่ต้องส่งอย่างน้อย 1 รายการ' });
      return;
    }

    const payload = {
      projectId: selectedProjectId,
      title: formTitle.trim(),
      recipientId: formPerson.recipient_id || null,
      recipientName: formPerson.name,
      personKey: formPerson.key || null,
      dueAt: formDueAt ? new Date(formDueAt).toISOString() : null,
      lines: validLines.map((l) => ({
        description: l.description.trim(),
        requiredQty: Number(l.requiredQty),
        unit: l.unit.trim() || 'ชุด'
      }))
    };

    const idempotencyKey = getKey('create_assignment', payload);
    isPendingActionRef.current = true;
    setIsSubmittingAction(true);

    try {
      await productionService.createProductionAssignment({
        ...payload,
        idempotencyKey
      });
      clearKey('create_assignment');
      setToastMessage({ type: 'success', text: 'เพิ่มงานผลิตสำเร็จ' });
      setActiveModal(null);
      fetchProjectBoard(true);
    } catch (err) {
      // Form remains open and input preserved on error
      setToastMessage({ type: 'error', text: err.message || 'บันทึกงานไม่สำเร็จ' });
    } finally {
      isPendingActionRef.current = false;
      setIsSubmittingAction(false);
    }
  };

  // Submit Handler: Edit Assignment
  const handleEditAssignmentSubmit = async (e) => {
    e.preventDefault();
    if (!activeAssignment || isSubmittingAction || isPendingActionRef.current) return;

    const payload = {
      assignmentId: activeAssignment.id,
      expectedVersion: activeAssignment.version,
      title: formTitle.trim(),
      dueAt: formDueAt ? new Date(formDueAt).toISOString() : null,
      lines: formLines.map((l) => ({
        id: l.id,
        description: l.description.trim(),
        requiredQty: Number(l.requiredQty),
        unit: l.unit.trim() || 'ชุด'
      })),
      reason: formReason.trim() || null
    };

    const idempotencyKey = getKey(`edit_assignment_${activeAssignment.id}`, payload);
    isPendingActionRef.current = true;
    setIsSubmittingAction(true);

    try {
      await productionService.updateProductionAssignment({
        ...payload,
        idempotencyKey
      });
      clearKey(`edit_assignment_${activeAssignment.id}`);
      setToastMessage({ type: 'success', text: 'ปรับปรุงรายละเอียดงานสำเร็จ' });
      setActiveModal(null);
      fetchProjectBoard(true);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ไม่สามารถแก้ไขงานได้' });
    } finally {
      isPendingActionRef.current = false;
      setIsSubmittingAction(false);
    }
  };

  // Submit Handler: Split Assignment
  const handleSplitAssignmentSubmit = async (e) => {
    e.preventDefault();
    if (!activeAssignment || !formSplitPerson || isSubmittingAction || isPendingActionRef.current) return;

    const linesToSplit = formSplitLines.filter((l) => Number(l.quantity) > 0);
    if (linesToSplit.length === 0) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนงานที่ต้องการแบ่ง' });
      return;
    }

    const payload = {
      assignmentId: activeAssignment.id,
      expectedVersion: activeAssignment.version,
      toPersonKey: formSplitPerson.key,
      title: formTitle.trim(),
      reason: formReason.trim() || null,
      lineQuantities: linesToSplit.map((l) => ({
        lineId: l.lineId,
        quantity: Number(l.quantity)
      }))
    };

    const idempotencyKey = getKey(`split_assignment_${activeAssignment.id}`, payload);
    isPendingActionRef.current = true;
    setIsSubmittingAction(true);

    try {
      await productionService.splitProductionAssignment({
        ...payload,
        idempotencyKey
      });
      clearKey(`split_assignment_${activeAssignment.id}`);
      setToastMessage({ type: 'success', text: `แบ่งงานให้ ${formSplitPerson.name} สำเร็จ` });
      setActiveModal(null);
      fetchProjectBoard(true);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ไม่สามารถแบ่งงานได้' });
    } finally {
      isPendingActionRef.current = false;
      setIsSubmittingAction(false);
    }
  };

  // Submit Handler: Helper Submits Work
  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!activeAssignment || activeAssignment.cash_only || isSubmittingAction || isPendingActionRef.current) return;

    const linesToSubmit = formSubmissionLines.filter((l) => Number(l.quantity) > 0);
    if (linesToSubmit.length === 0) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนชิ้นงานที่ส่งมอบ' });
      return;
    }

    const payload = {
      assignmentId: activeAssignment.id,
      note: formNotes.trim() || null,
      lines: linesToSubmit.map((l) => ({
        lineId: l.lineId,
        quantity: Number(l.quantity)
      }))
    };

    const idempotencyKey = getKey(`submit_work_${activeAssignment.id}`, payload);
    isPendingActionRef.current = true;
    setIsSubmittingAction(true);

    try {
      await productionService.submitProductionWork({
        ...payload,
        idempotencyKey
      });
      clearKey(`submit_work_${activeAssignment.id}`);
      setToastMessage({ type: 'success', text: 'บันทึกการส่งงานเรียบร้อย (รอพนักงานตรวจรับ)' });
      setActiveModal(null);
      fetchProjectBoard(true);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ส่งงานไม่สำเร็จ' });
    } finally {
      isPendingActionRef.current = false;
      setIsSubmittingAction(false);
    }
  };

  // Submit Handler: Staff Inspects Work
  const handleInspectWork = async (e) => {
    e.preventDefault();
    if (!activeSubmission || activeAssignment?.cash_only || isSubmittingAction || isPendingActionRef.current) return;

    const payload = {
      submissionId: activeSubmission.id,
      note: formNotes.trim() || null,
      lines: formInspectionLines.map((l) => ({
        submissionLineId: l.submissionLineId,
        acceptedQty: Number(l.acceptedQty || 0),
        rejectedQty: Number(l.rejectedQty || 0)
      }))
    };

    const idempotencyKey = getKey(`inspect_work_${activeSubmission.id}`, payload);
    isPendingActionRef.current = true;
    setIsSubmittingAction(true);

    try {
      await productionService.inspectProductionWork({
        ...payload,
        idempotencyKey
      });
      clearKey(`inspect_work_${activeSubmission.id}`);
      setToastMessage({ type: 'success', text: 'บันทึกผลการตรวจรับเรียบร้อย' });
      setActiveModal(null);
      fetchProjectBoard(true);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'บันทึกตรวจรับไม่สำเร็จ' });
    } finally {
      isPendingActionRef.current = false;
      setIsSubmittingAction(false);
    }
  };

  // Submit Handler: Cash Inspection
  const handleInspectCash = async (e) => {
    e.preventDefault();
    if (!activeAssignment || isSubmittingAction || isPendingActionRef.current) return;

    const count = Number(formCashNoteCount);
    if (!Number.isSafeInteger(count) || count <= 0) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนธนบัตรที่ตรวจนับผ่าน' });
      return;
    }

    const payload = {
      assignmentId: activeAssignment.id,
      noteCount: count,
      notes: formNotes.trim() || 'ตรวจรับธนบัตรพับเสร็จเข้าชุดงาน'
    };

    const idempotencyKey = getKey(`inspect_cash_${activeAssignment.id}`, payload);
    isPendingActionRef.current = true;
    setIsSubmittingAction(true);

    try {
      await productionService.inspectProductionCash({
        ...payload,
        idempotencyKey
      });
      clearKey(`inspect_cash_${activeAssignment.id}`);
      setToastMessage({ type: 'success', text: 'ตรวจรับธนบัตรพับเสร็จเข้าชุดงานเรียบร้อย' });
      setActiveModal(null);
      fetchProjectBoard(true);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ตรวจรับเงินไม่สำเร็จ' });
    } finally {
      isPendingActionRef.current = false;
      setIsSubmittingAction(false);
    }
  };

  // Confirm Complete Assignment
  const handleConfirmComplete = (assignment) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันงานเสร็จสิ้นครบถ้วน',
      message: `คุณต้องการยืนยันให้งาน "${assignment.title}" ของ ${assignment.responsible_name} เป็นสถานะ "เสร็จสิ้น" หรือไม่? (ระบบจะตรวจสอบว่าชิ้นงานทุกรายการผ่านตรวจรับครบ 100% และไม่มีรายการรอตรวจ)`,
      onConfirm: async () => {
        const payload = {
          assignmentId: assignment.id,
          expectedVersion: assignment.version,
          status: 'completed',
          reason: 'พนักงานยืนยันผ่านตรวจครบถ้วน'
        };
        const idempotencyKey = getKey(`status_complete_${assignment.id}`, payload);
        try {
          await productionService.setProductionStatus({
            ...payload,
            idempotencyKey
          });
          clearKey(`status_complete_${assignment.id}`);
          setToastMessage({ type: 'success', text: 'บันทึกสถานะเสร็จสิ้นสมบูรณ์' });
          fetchProjectBoard(true);
        } catch (err) {
          setToastMessage({ type: 'error', text: err.message || 'ไม่สามารถเสร็จสิ้นงานได้' });
        }
      }
    });
  };

  // Flag Problem or Cancel
  const handleStatusChangeWithReason = async (assignment, status) => {
    const isCancel = status === 'cancelled';
    const title = isCancel ? 'ยกเลิกชุดงานผลิต' : 'แจ้งปัญหางานผลิต';
    const promptText = isCancel
      ? 'ระบุเหตุผลในการยกเลิกงาน (ประวัติการตรวจรับที่ผ่านมาจะไม่ถูกลบ):'
      : 'ระบุปัญหาที่พบเพื่อประสานงานแก้ไข:';

    // Support prompt when global test mock exists, else use custom modal dialog
    if (typeof window !== 'undefined' && typeof window.prompt === 'function' && globalThis.__PROMPT_RETURN_VALUE__ !== undefined) {
      const reason = window.prompt(promptText, '');
      if (reason === null) return;
      if (!reason.trim()) {
        setToastMessage({ type: 'error', text: 'กรุณาระบุเหตุผล' });
        return;
      }
      const payload = {
        assignmentId: assignment.id,
        expectedVersion: assignment.version,
        status,
        reason: reason.trim()
      };
      const idempotencyKey = getKey(`status_${status}_${assignment.id}`, payload);
      try {
        await productionService.setProductionStatus({
          ...payload,
          idempotencyKey
        });
        clearKey(`status_${status}_${assignment.id}`);
        setToastMessage({ type: 'success', text: `ปรับสถานะเป็น "${STATUS_LABELS[status]?.label}" เรียบร้อย` });
        fetchProjectBoard(true);
      } catch (err) {
        setToastMessage({ type: 'error', text: err.message || 'ไม่สามารถเปลี่ยนสถานะได้' });
      }
      return;
    }

    setActiveAssignment(assignment);
    setPendingStatusAction({ assignment, status, title, promptText });
    setFormReason('');
    setActiveModal('custom_reason');
  };

  const handleCustomReasonSubmit = async (e) => {
    e.preventDefault();
    if (!pendingStatusAction || !formReason.trim()) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุเหตุผล' });
      return;
    }
    const { assignment, status } = pendingStatusAction;
    const payload = {
      assignmentId: assignment.id,
      expectedVersion: assignment.version,
      status,
      reason: formReason.trim()
    };
    const idempotencyKey = getKey(`status_${status}_${assignment.id}`, payload);
    setIsSubmittingAction(true);
    try {
      await productionService.setProductionStatus({
        ...payload,
        idempotencyKey
      });
      clearKey(`status_${status}_${assignment.id}`);
      setToastMessage({ type: 'success', text: `ปรับสถานะเป็น "${STATUS_LABELS[status]?.label}" เรียบร้อย` });
      setActiveModal(null);
      setPendingStatusAction(null);
      fetchProjectBoard(true);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ไม่สามารถเปลี่ยนสถานะได้' });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && activeModal && !isPendingActionRef.current) {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeModal]);

  const summary = boardData?.summary || {
    assignment_count: 0,
    completed_count: 0,
    pending_review_count: 0,
    problem_count: 0,
    cancelled_count: 0,
    ready_for_next_step: false
  };

  // Helper to render portaled dialogs at body z-[110]
  const renderPortalDialog = (content) => {
    if (typeof document === 'undefined') return content;
    return createPortal(content, document.body);
  };

  return (
    <div className={`space-y-4 max-w-7xl mx-auto ${className}`}>
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          zIndex={150}
          onClose={() => setToastMessage(null)}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Top Controls & Project Picker Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--theme-light,#f5f3ff)] text-[var(--theme-main,#8b5cf6)] flex items-center justify-center shrink-0">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  หน้ากลางงานผลิตตามโปรเจกต์
                </h2>
                {selectedProjectId ? (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                    {selectedProjectId}
                  </span>
                ) : null}
                {isRealtimeConnected ? (
                  <span
                    className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium"
                    title="เชื่อมต่อ Realtime สำเร็จ"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    สด
                  </span>
                ) : (
                  <span
                    className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium"
                    title="ไม่ได้เชื่อมต่อ Realtime (ใช้รีเฟรชแทน)"
                  >
                    ออฟไลน์
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                ติดตามความคืบหน้ารวม 10+ ผู้ช่วย ใครรับผิดชอบอะไร ส่งแล้ว ผ่านตรวจ และสิ่งที่ยังขาด
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Project Selector */}
            <select
              aria-label="เลือกโปรเจกต์"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setPageOffset(0);
                setBoardData(null); // Clear old board on project change
              }}
              className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold min-h-[44px] outline-hidden focus:border-[var(--theme-main,#8b5cf6)] cursor-pointer"
            >
              {activities.length > 0 ? (
                activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.id} {act.name || act.title ? `— ${act.name || act.title}` : ''}
                  </option>
                ))
              ) : selectedProjectId ? (
                <option value={selectedProjectId}>{selectedProjectId}</option>
              ) : (
                <option value="">-- เลือกโปรเจกต์ --</option>
              )}
            </select>

            <button
              type="button"
              onClick={() => fetchProjectBoard(true)}
              disabled={isRefreshing || !selectedProjectId}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--theme-main,#8b5cf6)]' : ''}`}
              />
            </button>

            {onOpenIssueCartWithProject && (
              <button
                type="button"
                onClick={() => onOpenIssueCartWithProject(selectedProjectId)}
                className="px-3 py-2 text-sm font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition min-h-[44px] flex items-center gap-1.5 cursor-pointer"
              >
                <span>เบิกพัสดุเพิ่ม</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={openAddAssignmentModal}
              disabled={!selectedProjectId}
              className="px-4 py-2 text-sm font-bold rounded-xl bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] shadow-sm transition min-h-[44px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>+ มอบหมายงานใหม่</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs">
          <span className="text-sm text-slate-500 font-medium block">งานมอบหมายทั้งหมด</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
            {summary.assignment_count}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs">
          <span className="text-sm text-emerald-600 font-medium block">เสร็จสิ้นสมบูรณ์</span>
          <span className="text-xl font-bold text-emerald-700 mt-1 block font-mono">
            {summary.completed_count}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs">
          <span className="text-sm text-amber-600 font-medium block">รอพนักงานตรวจรับ</span>
          <span className="text-xl font-bold text-amber-700 mt-1 block font-mono">
            {summary.pending_review_count}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs">
          <span className="text-sm text-rose-600 font-medium block">แจ้งปัญหา</span>
          <span className="text-xl font-bold text-rose-700 mt-1 block font-mono">
            {summary.problem_count}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs col-span-2 md:col-span-1">
          <span className="text-sm text-slate-500 font-medium block">พร้อมส่งมอบขั้นถัดไป</span>
          <div className="flex items-center gap-1.5 mt-1">
            {summary.ready_for_next_step ? (
              <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> พร้อม
              </span>
            ) : (
              <span className="text-sm font-bold text-slate-400 flex items-center gap-1">
                <Clock className="w-4 h-4" /> ยังไม่ครบ
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-sm font-bold rounded-xl transition whitespace-nowrap min-h-[44px] cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)]'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({boardData?.assignments?.length || 0})
          </button>
          {['in_progress', 'submitted', 'completed', 'problem'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-sm font-bold rounded-xl transition whitespace-nowrap min-h-[44px] cursor-pointer ${
                statusFilter === st
                  ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {STATUS_LABELS[st]?.label}
            </button>
          ))}
        </div>

        {/* Search Helper or Task */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchPersonQuery}
            onChange={(e) => setSearchPersonQuery(e.target.value)}
            placeholder="ค้นหาผู้ช่วย, ชื่องาน, สิ่งที่ส่ง..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
          />
          {searchPersonQuery && (
            <button
              type="button"
              onClick={() => setSearchPersonQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Board View: Loading / Error / Empty / Cards */}
      {isLoading ? (
        <div className="py-16 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--theme-main,#8b5cf6)]" />
          <span className="text-sm font-medium">กำลังโหลดข้อมูลงานผลิตของโปรเจกต์...</span>
        </div>
      ) : errorMessage ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
          <h4 className="text-sm font-bold text-rose-800">{errorMessage}</h4>
          <button
            type="button"
            onClick={() => fetchProjectBoard(false)}
            className="px-4 py-2 bg-white border border-rose-300 text-rose-700 text-sm font-bold rounded-xl hover:bg-rose-100 cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>ลองใหม่อีกครั้ง</span>
          </button>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="py-16 bg-white border border-slate-200 rounded-2xl text-center space-y-3 p-4">
          <Factory className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <h4 className="text-sm font-bold text-slate-700">ยังไม่มีงานผลิตในโปรเจกต์นี้</h4>
            <p className="text-sm text-slate-400 mt-1">
              เมื่อมีการเบิกผลิตผ่านตะกร้า หรือกด "+ มอบหมายงานใหม่" ข้อมูลผู้ช่วยและชิ้นงานจะปรากฏที่นี่
            </p>
          </div>
          <button
            type="button"
            onClick={openAddAssignmentModal}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)] hover:bg-[var(--theme-hover,#7c3aed)] cursor-pointer inline-flex items-center gap-1 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>เริ่มมอบหมายงานชิ้นแรก</span>
          </button>
        </div>
      ) : (
        /* List of Assignments (Responsive Cards / Grid) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAssignments.map((asgn) => {
            const statusConfig = STATUS_LABELS[asgn.status] || STATUS_LABELS.in_progress;
            const isCashOnly = Boolean(asgn.cash_only);

            // Calculate overall progress across lines
            const allAccepted = (asgn.lines || []).length > 0 && (asgn.lines || []).every(
              (l) => Number(l.accepted_qty) >= Number(l.required_qty)
            );
            const hasPendingSubmissions = (asgn.lines || []).some((l) => Number(l.pending_qty) > 0);

            return (
              <div
                key={asgn.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-slate-300 transition"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.bg}`}>
                          {statusConfig.label}
                        </span>
                        {isCashOnly && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <Banknote className="w-3 h-3" /> พับธนบัตร
                          </span>
                        )}
                        {asgn.due_at && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title="กำหนดส่ง">
                            <Calendar className="w-3 h-3" />
                            {new Date(asgn.due_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug break-words">
                        {asgn.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditAssignmentModal(asgn)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="แก้ไขรายละเอียดงาน"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openSplitAssignmentModal(asgn)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="แบ่งงานที่เหลือให้คนอื่น"
                      >
                        <Split className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Responsible Person Info */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 truncate">
                      <span className="text-sm font-bold text-slate-800 truncate block">
                        {asgn.responsible_name}
                      </span>
                      {Array.isArray(asgn.team_members_snapshot) && asgn.team_members_snapshot.length > 0 && (
                        <span className="text-[10px] text-slate-400 truncate block">
                          สมาชิก: {asgn.team_members_snapshot.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Output Deliverable Lines */}
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      ชิ้นงานที่ต้องส่งกลับ
                    </span>
                    {(asgn.lines || []).map((line) => {
                      const required = Number(line.required_qty) || 0;
                      const accepted = Number(line.accepted_qty) || 0;
                      const pending = Number(line.pending_qty) || 0;
                      const remainingNotPassed = Math.max(0, required - accepted);
                      const needsSubmitOrRework = Math.max(0, required - accepted - pending);

                      return (
                        <div key={line.id} className="p-2 bg-slate-50/80 rounded-xl text-sm space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span className="truncate pr-2">{line.description}</span>
                            <span className="shrink-0 text-slate-900">
                              เป้าหมาย: {required} {line.unit}
                            </span>
                          </div>

                          {/* Quantities breakdown */}
                          <div className="grid grid-cols-3 gap-1 pt-1 text-[11px] text-center border-t border-slate-200/60">
                            <div className="bg-emerald-50/80 p-1 rounded">
                              <span className="text-[9px] text-emerald-600 block">ผ่านตรวจแล้ว</span>
                              <span className="font-bold text-emerald-800">
                                {accepted} {line.unit}
                              </span>
                            </div>
                            <div className="bg-amber-50/80 p-1 rounded">
                              <span className="text-[9px] text-amber-600 block">ส่งมารอตรวจ</span>
                              <span className="font-bold text-amber-800">
                                {pending} {line.unit}
                              </span>
                            </div>
                            <div className="bg-slate-100 p-1 rounded">
                              <span className="text-[9px] text-slate-500 block">ยังขาดตรวจผ่าน</span>
                              <span className="font-bold text-slate-700">
                                {remainingNotPassed} {line.unit}
                              </span>
                            </div>
                          </div>
                          {needsSubmitOrRework > 0 && (
                            <p className="text-[10px] text-rose-600 font-medium pt-0.5">
                              * ผู้ช่วยยังต้องทำส่งเพิ่มอีก {needsSubmitOrRework} {line.unit}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {asgn.latest_inspection && <p className="mt-2 text-sm text-slate-600">ตรวจรับโดย {asgn.latest_inspection.inspector_name} · {new Date(asgn.latest_inspection.inspected_at).toLocaleString('th-TH')}</p>}
                  <button type="button" className="min-h-[44px] text-sm underline text-[var(--theme-ink)]" onClick={() => showHistory(asgn)}>ดูประวัติการส่งและตรวจรับ</button>
                  {expandedHistoryId === asgn.id && detailsById[asgn.id] && <div className="space-y-2 text-sm">
                    {(detailsById[asgn.id].submissions || []).map((submission) => <div key={submission.id} className="rounded-lg border p-2">
                      <p>{submission.submitted_by_name} · {new Date(submission.submitted_at).toLocaleString('th-TH')}</p>
                      {(submission.inspections || []).map((inspection) => <p key={inspection.id}>ตรวจโดย {inspection.inspector_name} · {new Date(inspection.inspected_at).toLocaleString('th-TH')}</p>)}
                      {canCheck && !isCashOnly && ['pending', 'partially_inspected'].includes(submission.status) && <button type="button" className="min-h-[44px] underline" onClick={() => openInspectWorkModal(asgn, submission)}>ตรวจรับ</button>}
                    </div>)}
                    {detailsById[asgn.id].has_more && <button type="button" className="min-h-[44px] underline" onClick={() => showHistory(asgn, detailsById[asgn.id].submissions?.length || 0)}>โหลดประวัติเพิ่มเติม</button>}
                  </div>}
                  {/* Pending Submissions awaiting staff inspection */}
                  {Array.isArray(asgn.submissions) &&
                    asgn.submissions.filter((s) => s.status === 'pending' || s.status === 'partially_inspected')
                      .length > 0 && (
                      <div className="mt-3 p-2 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" /> มีรายการส่งมารอตรวจรับ:
                        </span>
                        {asgn.submissions
                          .filter((s) => s.status === 'pending' || s.status === 'partially_inspected')
                          .map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between text-sm bg-white p-1.5 rounded-lg border border-amber-100"
                            >
                              <div className="min-w-0 flex-1 truncate">
                                <span className="text-[11px] font-medium text-slate-700 block truncate">
                                  ส่งโดย: {sub.submitted_by_name} (
                                  {new Date(sub.submitted_at).toLocaleTimeString('th-TH', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                  )
                                </span>
                              </div>
                              {canCheck && !isCashOnly && (
                                <button
                                  type="button"
                                  onClick={() => openInspectWorkModal(asgn, sub)}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs cursor-pointer shrink-0 min-h-[44px]"
                                >
                                  ตรวจรับ
                                </button>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {/* Submit work button */}
                    {asgn.status !== 'completed' && asgn.status !== 'cancelled' && !isCashOnly && (
                      <button
                        type="button"
                        onClick={() => openSubmitWorkModal(asgn)}
                        className="px-2.5 py-1.5 text-sm font-bold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1 min-h-[44px] cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-blue-600" />
                        <span>ส่งงาน</span>
                      </button>
                    )}

                    {/* Cash inspection action (only for cash roles) */}
                    {isCashOnly && canManageCash && asgn.status !== 'completed' && asgn.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => openInspectCashModal(asgn)}
                        className="px-2.5 py-1.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 min-h-[44px] cursor-pointer"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>ตรวจนับเงิน</span>
                      </button>
                    )}

                    {/* Complete Button (Only enabled when all lines accepted & no pending) */}
                    {canCheck && asgn.status !== 'completed' && asgn.status !== 'cancelled' && (
                      <button
                        type="button"
                        aria-label={`ยืนยันเสร็จสิ้น: ${asgn.title}`}
                        disabled={!allAccepted || hasPendingSubmissions}
                        onClick={() => handleConfirmComplete(asgn)}
                        className="px-2.5 py-1.5 text-sm font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 min-h-[44px]"
                        title={
                          !allAccepted
                            ? 'ต้องตรวจรับชิ้นงานครบทุกรายการก่อน'
                            : hasPendingSubmissions
                            ? 'ยังมีรายการส่งมารอตรวจรับ'
                            : 'ยืนยันงานเสร็จสิ้น'
                        }
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>เสร็จสิ้น</span>
                      </button>
                    )}
                  </div>

                  {/* Flag Problem / Cancel Buttons */}
                  {asgn.status !== 'completed' && asgn.status !== 'cancelled' && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStatusChangeWithReason(asgn, 'problem')}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="แจ้งปัญหางานนี้"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChangeWithReason(asgn, 'cancelled')}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="ยกเลิกชุดงานนี้"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 text-sm">
        <button type="button" disabled={pageOffset === 0 || isLoading} onClick={() => setPageOffset(Math.max(0, pageOffset - 25))} className="min-h-[44px] disabled:opacity-40">หน้าก่อนหน้า</button>
        <span>หน้า {Math.floor(pageOffset / 25) + 1}</span>
        <button type="button" disabled={!boardData?.has_more || isLoading} onClick={() => setPageOffset(pageOffset + 25)} className="min-h-[44px] disabled:opacity-40">หน้าถัดไป</button>
      </div>

      {/* MODAL 1: Add Assignment */}
      {activeModal === 'add_assignment' &&
        renderPortalDialog(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="มอบหมายงานผลิตใหม่"
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden max-h-[calc(100dvh-1rem)] flex flex-col">
              <header className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[var(--theme-main,#8b5cf6)]" />
                  <span>มอบหมายงานผลิตใหม่</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <form onSubmit={handleAddAssignmentSubmit} className="p-4 overflow-y-auto space-y-3.5 flex-1">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ชื่องานที่มอบหมาย *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="เช่น ผลิตช่อดอกไม้สด 10 ช่อ"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                <div>
                  <PersonPicker
                    label="ผู้รับผิดชอบงาน"
                    required
                    value={formPerson}
                    onChange={setFormPerson}
                    placeholder="เลือกพนักงานหรือผู้ช่วยงานจากฐานข้อมูล..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">กำหนดส่ง (ถ้ามี)</label>
                  <ModernDateTimePicker
                    value={formDueAt}
                    onChange={(e) => setFormDueAt(e?.target ? e.target.value : e)}
                    hasTime={true}
                    placeholder="เลือกวันและเวลากำหนดส่ง..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-bold text-slate-700">สิ่งที่ต้องส่งกลับ (Deliverables) *</label>
                    <button
                      type="button"
                      onClick={() => setFormLines([...formLines, { description: '', requiredQty: 1, unit: 'ชุด' }])}
                      className="text-[11px] font-bold text-[var(--theme-main,#8b5cf6)] hover:underline min-h-[44px] cursor-pointer"
                    >
                      + เพิ่มชิ้นงาน
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/60"
                      >
                        <input
                          type="text"
                          required
                          value={line.description}
                          onChange={(e) => {
                            const updated = [...formLines];
                            updated[idx].description = e.target.value;
                            setFormLines(updated);
                          }}
                          placeholder="รายละเอียดชิ้นงาน"
                          className="flex-1 px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-lg outline-hidden min-h-[44px]"
                        />
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          required
                          value={line.requiredQty}
                          onChange={(e) => {
                            const updated = [...formLines];
                            updated[idx].requiredQty = e.target.value;
                            setFormLines(updated);
                          }}
                          placeholder="จำนวน"
                          className="w-16 px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-center outline-hidden min-h-[44px]"
                        />
                        <input
                          type="text"
                          value={line.unit}
                          onChange={(e) => {
                            const updated = [...formLines];
                            updated[idx].unit = e.target.value;
                            setFormLines(updated);
                          }}
                          placeholder="หน่วย"
                          className="w-14 px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-center outline-hidden min-h-[44px]"
                        />
                        {formLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFormLines(formLines.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-500 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <footer className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-2 text-sm font-bold text-white bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] rounded-xl min-h-[44px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>สร้างงานมอบหมาย</span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

      {/* MODAL 2: Edit Assignment */}
      {activeModal === 'edit_assignment' &&
        activeAssignment &&
        renderPortalDialog(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="แก้ไขรายละเอียดงาน"
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden max-h-[calc(100dvh-1rem)] flex flex-col">
              <header className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-slate-600" />
                  <span>แก้ไขรายละเอียดงาน</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <form onSubmit={handleEditAssignmentSubmit} className="p-4 overflow-y-auto space-y-3.5 flex-1">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ชื่องาน *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">กำหนดส่ง</label>
                  <ModernDateTimePicker
                    value={formDueAt}
                    onChange={(e) => setFormDueAt(e?.target ? e.target.value : e)}
                    hasTime={true}
                    placeholder="เลือกวันและเวลากำหนดส่ง..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ปรับปรุงเป้าหมายชิ้นงาน</label>
                  <div className="space-y-2">
                    {formLines.map((line, idx) => (
                      <div
                        key={line.id || idx}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/60"
                      >
                        <span className="flex-1 text-sm text-slate-800 font-medium truncate">{line.description}</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={line.requiredQty}
                          onChange={(e) => {
                            const updated = [...formLines];
                            updated[idx].requiredQty = e.target.value;
                            setFormLines(updated);
                          }}
                          className="w-20 px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-center outline-hidden min-h-[44px]"
                        />
                        <span className="text-sm text-slate-500 w-10">{line.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">เหตุผลในการแก้ไข</label>
                  <input
                    type="text"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="เช่น ลูกค้าขอเพิ่มจำนวน / ปรับเวลาส่งมอบ"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                <footer className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-2 text-sm font-bold text-white bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] rounded-xl min-h-[44px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>บันทึกการแก้ไข</span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

      {/* MODAL 3: Split Assignment */}
      {activeModal === 'split_assignment' &&
        activeAssignment &&
        renderPortalDialog(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="แบ่งงานที่เหลือให้ผู้ช่วยคนอื่น"
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden max-h-[calc(100dvh-1rem)] flex flex-col">
              <header className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Split className="w-4 h-4 text-blue-600" />
                  <span>แบ่งงานที่เหลือให้ผู้ช่วยคนอื่น</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <form onSubmit={handleSplitAssignmentSubmit} className="p-4 overflow-y-auto space-y-3.5 flex-1">
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-1">
                  <p className="font-bold">แบ่งจาก: {activeAssignment.responsible_name}</p>
                  <p className="text-[11px] text-blue-700">
                    ระบบจะหักยอดเป้าหมายคงเหลือจากงานเดิม และสร้างชุดงานใหม่ให้ผู้รับมอบหมายใหม่ โดยไม่เคลื่อนย้ายพัสดุในคลัง
                  </p>
                </div>

                <div>
                  <PersonPicker
                    label="แบ่งให้ใครรับผิดชอบต่อ"
                    required
                    value={formSplitPerson}
                    onChange={setFormSplitPerson}
                    placeholder="เลือกผู้ช่วยที่จะแบ่งงานให้..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ชื่องานใหม่</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    ระบุจำนวนที่ต้องการแบ่ง (ไม่เกินยอดคงเหลือ)
                  </label>
                  <div className="space-y-2">
                    {formSplitLines.map((line, idx) => (
                      <div
                        key={line.lineId}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/60"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-slate-800 block truncate">{line.description}</span>
                          <span className="text-[10px] text-slate-500">
                            แบ่งได้สูงสุด: {line.maxQty} {line.unit}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={line.maxQty}
                          step="any"
                          value={line.quantity}
                          onChange={(e) => {
                            const updated = [...formSplitLines];
                            updated[idx].quantity = Math.min(line.maxQty, Math.max(0, Number(e.target.value) || 0));
                            setFormSplitLines(updated);
                          }}
                          className="w-20 px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-center outline-hidden font-bold min-h-[44px]"
                        />
                        <span className="text-sm text-slate-600 w-8">{line.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">เหตุผลในการแบ่งงาน</label>
                  <input
                    type="text"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="เช่น ช่วยทำเนื่องจากใกล้ถึงเวลาส่งมอบ"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                <footer className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[44px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>ยืนยันการแบ่งงาน</span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

      {/* MODAL 4: Submit Work (Helper) */}
      {activeModal === 'submit_work' &&
        activeAssignment &&
        renderPortalDialog(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="บันทึกการส่งงาน"
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden max-h-[calc(100dvh-1rem)] flex flex-col">
              <header className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  <span>บันทึกการส่งงาน / ส่งชิ้นงานรอบใหม่</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <form onSubmit={handleSubmitWork} className="p-4 overflow-y-auto space-y-3.5 flex-1">
                <div className="text-sm text-slate-600">
                  <span className="font-bold text-slate-800">งาน: {activeAssignment.title}</span>
                  <span className="block text-[11px] text-slate-500">
                    ผู้รับผิดชอบ: {activeAssignment.responsible_name}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ระบุจำนวนที่ส่งมอบในรอบนี้</label>
                  <div className="space-y-2">
                    {formSubmissionLines.map((line, idx) => (
                      <div
                        key={line.lineId}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/60"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-slate-800 block truncate">{line.description}</span>
                          <span className="text-[10px] text-slate-500">
                            ต้องส่งเพิ่ม: {line.maxQty} {line.unit}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.quantity}
                          onChange={(e) => {
                            const updated = [...formSubmissionLines];
                            updated[idx].quantity = e.target.value;
                            setFormSubmissionLines(updated);
                          }}
                          className="w-20 px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-center outline-hidden font-bold min-h-[44px]"
                        />
                        <span className="text-sm text-slate-600 w-8">{line.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุการส่งงาน (ถ้ามี)</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="เช่น ส่งรอบแรก 5 ชิ้น ดอกไม้ตูมกำลังสวย"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                <footer className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[44px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>ยืนยันส่งงาน</span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

      {/* MODAL 5: Inspect Work (Staff) */}
      {activeModal === 'inspect_work' &&
        activeSubmission &&
        renderPortalDialog(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ตรวจรับชิ้นงาน"
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden max-h-[calc(100dvh-1rem)] flex flex-col">
              <header className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>ตรวจรับชิ้นงาน (Staff Inspection)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <form onSubmit={handleInspectWork} className="p-4 overflow-y-auto space-y-3.5 flex-1">
                <div className="p-2.5 bg-slate-50 rounded-xl text-sm space-y-1">
                  <span className="font-bold text-slate-800">ผู้ส่งงาน: {activeSubmission.submitted_by_name}</span>
                  {activeSubmission.note && <p className="text-slate-600 italic">"{activeSubmission.note}"</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ผลการตรวจรับรายชิ้นงาน</label>
                  <div className="space-y-2.5">
                    {formInspectionLines.map((line, idx) => (
                      <div
                        key={line.submissionLineId}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-slate-800">รายการที่ {idx + 1}</span>
                          <span className="text-slate-500">ส่งมารวม: {line.submittedQty}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-700 mb-0.5">
                              ผ่านตรวจ (Accepted)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={line.pendingQty}
                              step="any"
                              value={line.acceptedQty}
                              onChange={(e) => {
                                const val = Math.min(line.pendingQty, Math.max(0, Number(e.target.value) || 0));
                                const updated = [...formInspectionLines];
                                updated[idx].acceptedQty = val;
                                updated[idx].rejectedQty = Math.max(0, line.pendingQty - val);
                                setFormInspectionLines(updated);
                              }}
                              className="w-full px-2 py-1.5 text-sm bg-white border border-emerald-300 rounded-lg text-center font-bold text-emerald-800 outline-hidden min-h-[44px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-rose-700 mb-0.5">
                              ไม่ผ่าน / ต้องแก้ (Rejected)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={line.pendingQty}
                              step="any"
                              value={line.rejectedQty}
                              onChange={(e) => {
                                const val = Math.min(line.pendingQty, Math.max(0, Number(e.target.value) || 0));
                                const updated = [...formInspectionLines];
                                updated[idx].rejectedQty = val;
                                updated[idx].acceptedQty = Math.max(0, line.pendingQty - val);
                                setFormInspectionLines(updated);
                              }}
                              className="w-full px-2 py-1.5 text-sm bg-white border border-rose-300 rounded-lg text-center font-bold text-rose-800 outline-hidden min-h-[44px]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ความเห็นผู้ตรวจรับ</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="เช่น ตรวจรับเรียบร้อย ชิ้นงานสมบูรณ์"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                <footer className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl min-h-[44px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>บันทึกผลการตรวจ</span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

      {/* MODAL 6: Inspect Cash (Admin/Accountant) */}
      {activeModal === 'inspect_cash' &&
        activeAssignment &&
        renderPortalDialog(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ตรวจรับชุดธนบัตรพับเสร็จ"
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden max-h-[calc(100dvh-1rem)] flex flex-col">
              <header className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>ตรวจรับชุดธนบัตรพับเสร็จ (Cash Inspection)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <form onSubmit={handleInspectCash} className="p-4 overflow-y-auto space-y-3.5 flex-1">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 space-y-1">
                  <p className="font-bold">ชุดงาน: {activeAssignment.title}</p>
                  <p className="text-[11px]">ผู้พับ: {activeAssignment.responsible_name}</p>
                  <p className="text-[11px] text-emerald-700">
                    * การตรวจรับจะตัดยอดเงินที่ผู้ช่วยถืออยู่ และบันทึกเป็นชุดเงินพับเสร็จ (Prepared Cash) สำหรับงานนี้ โดยไม่เพิ่มเงินซ้ำในตู้เซฟ
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">จำนวนธนบัตรที่ตรวจนับผ่าน (ใบ) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formCashNoteCount}
                    onChange={(e) => setFormCashNoteCount(e.target.value)}
                    placeholder="เช่น 50"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-emerald-500 font-bold text-slate-800 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อชุดงาน / บันทึก (ถ้ามี)</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="เช่น ซองดอกไม้ใส่ซอง 50 ใบพร้อมส่งมอบ"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-emerald-500 min-h-[44px]"
                  />
                </div>

                <footer className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl min-h-[44px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>ตรวจรับเงินเข้าชุดงาน</span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

      {/* MODAL 7: Custom Reason Dialog (Problem or Cancel) */}
      {activeModal === 'custom_reason' &&
        pendingStatusAction &&
        renderPortalDialog(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={pendingStatusAction.title}
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 space-y-4 max-h-[calc(100dvh-1rem)] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {pendingStatusAction.status === 'cancelled' ? (
                    <XCircle className="w-4 h-4 text-slate-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{pendingStatusAction.title}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setPendingStatusAction(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCustomReasonSubmit} className="space-y-3">
                <p className="text-sm text-slate-600">{pendingStatusAction.promptText}</p>
                <textarea
                  required
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="ระบุเหตุผล..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setPendingStatusAction(null);
                    }}
                    className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className={`px-4 py-2 text-sm font-bold text-white rounded-xl min-h-[44px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 ${
                      pendingStatusAction.status === 'cancelled'
                        ? 'bg-slate-700 hover:bg-slate-800'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {isSubmittingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>ยืนยัน</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
