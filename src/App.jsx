import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Home,
  BarChart2,
  Settings,
  Search,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  Clipboard,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreHorizontal,
  FileText,
  Users,
  List,
  User,
  Shield,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Folder,
  Plus,
  Calendar,
  MapPin,
  Trash2,
  DollarSign,
  Briefcase,
  Truck,
  Tag,
  Edit,
  AlertTriangle,
  Phone,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  Filter,
  RotateCcw,
  ChevronDown,
  PieChart,
  Activity,
  Hourglass,
  Trophy,
  Crown,
  SlidersHorizontal,
  StickyNote,
  Bell,
  Mail,
  Save,
  Moon,
  Camera,
  ListPlus,
  XCircle,
  GripVertical,
  Check,
  Palette,
  CalendarDays,
  Gift,
  Wallet,
  ThumbsDown,
  Layers,
  ChevronUp,
  Loader2,
  Wifi,
  WifiOff,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Image as ImageIcon,
  Receipt,
  UploadCloud,
  HardDrive,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Share2,
  Copy,
  Printer,
  Link as LinkIcon,
  PackageCheck,
  Facebook,
  Instagram,
  MessageCircle,
  Music2,
  LayoutList,      
  Table as TableIcon, 
  Pipette,
  Bot, 
  Send,
  LayoutGrid
} from 'lucide-react';
import FinanceView from './FinanceView';
import CalendarView from './CalendarView';

import AnalyticsView from './AnalyticsView';
import PlansView from './PlansView';
import SettingsView from './SettingsView';

// --- CONFIGURATION ---
// นำ Web App URL ที่ได้จากการ Deploy Apps Script มาวางที่นี่
// [UPDATED] อัปเดต URL ให้ตรงกับที่คุณให้มาล่าสุด
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw2WJ4tt7l__0U6XYtgHbyl0W1iGjm6oHXa9-2twBKfa1xP2-SBj2hMwaHUYp7ew_Ih/exec"; 
// ---------------------

// Constants & Utilities
import { themeColors, colorPresets, systemStatusTypes } from './constants/appConstants';
import { 
  shadeColor, 
  hexToRgbString, 
  processImageUrl, 
  getFileId, 
  generateTrackingToken, 
  getNowDateString, 
  formatDate, 
  formatPhoneNumber, 
  renderDeliveryTime 
} from './utils/formatters';

// Shared Global Components
import { StoreIcon, LineIcon, XIcon, WeChatIcon, TelegramIcon } from './components/icons/SocialIcons';
import ImageViewer from './components/common/ImageViewer';
import ShopFooter from './components/common/ShopFooter';
import Toast from './components/common/Toast';
import LoadingOverlay from './components/common/LoadingOverlay';
import ViewOnlyField from './components/common/ViewOnlyField';
import ModernDateTimePicker from './components/common/ModernDateTimePicker';
import DateFilterControl from './components/common/DateFilterControl';
import SortableHeader from './components/common/SortableHeader';
import LoginScreen from './components/auth/LoginScreen';
import CustomerQuotationView from './components/customer/CustomerQuotationView';
import CustomerTrackingView from './components/customer/CustomerTrackingView';
import SharePreviewModal from './components/modals/SharePreviewModal';

const navItems = [

  { name: 'Calendar', icon: Calendar, label: 'ปฏิทินงาน', shortLabel: 'ปฏิทิน' },
  { name: 'Analytics', icon: BarChart2, label: 'วิเคราะห์ประสิทธิภาพ', shortLabel: 'วิเคราะห์' },
  { name: 'Plans', icon: List, label: 'รายการแผนงาน', shortLabel: 'แผนงาน' },
  { name: 'Finance', icon: Wallet, label: 'การเงิน', shortLabel: 'การเงิน' },
  { name: 'Settings', icon: Settings, label: 'ตั้งค่า', shortLabel: 'ตั้งค่า' },
];

// --- URL Routing Helpers for Direct Page Links (e.g. /plans, /finance, /calendar) ---
const TAB_ROUTES = {

  Calendar: 'calendar',
  Analytics: 'analytics',
  Plans: 'plans',
  Finance: 'finance',
  Settings: 'settings',
};

const ROUTE_TO_TAB = {


  calendarview: 'Calendar',
  calendar: 'Calendar',
  analyticsview: 'Analytics',
  analytics: 'Analytics',
  plansview: 'Plans',
  plans: 'Plans',
  financeview: 'Finance',
  finance: 'Finance',
  settingsview: 'Settings',
  settings: 'Settings',
};

const getBasePath = () => {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname || '';
  if (pathname.startsWith('/dreamPJ')) {
    return '/dreamPJ';
  }
  return '';
};

const getTabFromUrl = () => {
  if (typeof window === 'undefined') return 'Calendar';

  // 1. Pathname segment (e.g. /PlansView or /dreamPJ/PlansView)
  const pathname = window.location.pathname || '';
  const segments = pathname.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i].toLowerCase();
    if (ROUTE_TO_TAB[seg]) {
      return ROUTE_TO_TAB[seg];
    }
  }

  // 2. Query param (e.g. ?tab=PlansView or ?page=PlansView)
  const searchParams = new URLSearchParams(window.location.search);
  const tabQuery = (searchParams.get('tab') || searchParams.get('page') || '').toLowerCase();
  if (tabQuery && ROUTE_TO_TAB[tabQuery]) {
    return ROUTE_TO_TAB[tabQuery];
  }

  // 3. Hash (e.g. #/PlansView or #PlansView)
  const hash = (window.location.hash || '').replace(/^#\/?/, '').toLowerCase();
  if (hash && ROUTE_TO_TAB[hash]) {
    return ROUTE_TO_TAB[hash];
  }

  return 'Calendar';
};

const updateUrlForTab = (tabName) => {
  if (typeof window === 'undefined') return;
  const routeName = TAB_ROUTES[tabName] || tabName;
  const basePath = getBasePath();
  const search = window.location.search || '';
  const cleanSearch = search.includes('~and~') ? '' : search;
  const targetPath = `${basePath}/${routeName}${cleanSearch}`;

  const currentPath = window.location.pathname;
  const expectedPath = `${basePath}/${routeName}`;
  if (currentPath.toLowerCase() !== expectedPath.toLowerCase() || window.location.href.includes('~and~')) {
    window.history.replaceState({ tab: tabName }, '', targetPath);
  }
};

const App = () => {
  // --- 1. STATE DECLARATIONS (Moved to top to fix ReferenceError) ---
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('nexus_sidebar_collapsed');
    return saved === 'true';
  });
  
  // Mobile Profile Menu
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Settings Loaded State
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(() => {
      return !!localStorage.getItem('nexus_shop_info');
  });

  // Shop Info State
  const [shopInfo, setShopInfo] = useState(() => {
      try {
          const saved = localStorage.getItem('nexus_shop_info');
          return saved ? JSON.parse(saved) : {
              shopName: '',
              phone: '',
              email: '',
              address: '',
              line: '',
              facebook: '',
              instagram: '',
              tiktok: '',
              twitter: '', 
              wechat: '',  
              telegram: '',
              logo: '',
              themeColor: 'indigo',
              themeMode: 'gradient',
              customColorValue: '#000000'
          };
      } catch (e) {
          return {
              shopName: '',
              phone: '',
              email: '',
              address: '',
              line: '',
              facebook: '',
              instagram: '',
              tiktok: '',
              twitter: '', 
              wechat: '',  
              telegram: '',
              logo: '',
              themeColor: 'indigo',
              themeMode: 'gradient',
              customColorValue: '#000000'
          };
      }
  });

  // Tracking & Quotation IDs
  const [trackingId, setTrackingId] = useState(() => {
      if (typeof window !== 'undefined') {
          return new URLSearchParams(window.location.search).get('tracking');
      }
      return null;
  });
  
  const [quotationId, setQuotationId] = useState(() => {
      if (typeof window !== 'undefined') {
          return new URLSearchParams(window.location.search).get('quotation');
      }
      return null;
  });

  // Image Loading State
  const [areImagesLoaded, setAreImagesLoaded] = useState(() => {
      const params = new URLSearchParams(window.location.search);
      return !(params.has('tracking') || params.has('quotation'));
  });

  const [activeTab, setActiveTab] = useState(() => {
    return getTabFromUrl();
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isSaving, setIsSaving] = useState(false); 
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nexus_auth') === 'true';
    }
    return false;
  });
  
  // Auth Users
  const [authorizedUsers, setAuthorizedUsers] = useState(() => {
    const defaultUsers = [
        {
          username: 'admin',
          password: 'password1234',
          name: 'Admin User',
          role: 'System Administrator',
          email: 'admin@nexusplan.com',
          phone: '-'
        },
        {
          username: 'john',
          password: 'password1234', 
          name: 'John Smith',
          role: 'Project Manager',
          email: 'john.smith@nexusplan.com',
          phone: '081-234-5678'
        }
    ];

    try {
        const saved = localStorage.getItem('nexus_authorized_users');
        return saved ? JSON.parse(saved) : defaultUsers;
    } catch (e) {
        return defaultUsers;
    }
  });

  const [loginError, setLoginError] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: '', email: '', phone: '' });
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Drive Settings
  const [driveFolderId, setDriveFolderId] = useState('');
  const [assetsDriveFolderId, setAssetsDriveFolderId] = useState(''); 
  const [driveFolders, setDriveFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus_drive_folders');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 'f_ref', name: 'รูปภาพอ้างอิงงาน', folderId: '', type: 'reference' },
      { id: 'f_slips', name: 'สลิปโอนเงินลูกค้า', folderId: '', type: 'slips' },
      { id: 'f_assets', name: 'ไฟล์ตกแต่งและ Assets', folderId: '', type: 'assets' }
    ];
  });

  const getFolderIdByType = (type) => {
    const found = driveFolders.find(f => f.type === type && f.folderId && f.folderId.trim() !== '');
    if (found) return found.folderId.trim();
    if (type === 'reference') return driveFolderId;
    if (type === 'assets') return assetsDriveFolderId;
    return driveFolderId || '';
  }; 
  
  // Chatbot Tokens
  const [lineBotToken, setLineBotToken] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [webAppUrl, setWebAppUrl] = useState(''); 
  const [deployUrl, setDeployUrl] = useState(GOOGLE_SCRIPT_URL);

  // Helper for Cache Loading
  const loadFromCache = (key, defaultValue) => {
      try {
          const saved = localStorage.getItem(`nexus_${key}`);
          return saved ? JSON.parse(saved) : defaultValue;
      } catch(e) {
          return defaultValue;
      }
  };

  const [projectCategories, setProjectCategories] = useState(() => loadFromCache('project_categories', []));
  const [expenseCategories, setExpenseCategories] = useState(() => loadFromCache('expense_categories', []));
  const [dealStatuses, setDealStatuses] = useState(() => loadFromCache('deal_statuses', []));
  const [transportStatuses, setTransportStatuses] = useState(() => loadFromCache('transport_statuses', []));

  // Upload States
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // UI States
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
  
  // Share Data
  const [shareData, setShareData] = useState(null);

  // Editing States
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, fromModal: false });
  const [isDeleteClosing, setIsDeleteClosing] = useState(false);

  // Delete Confirmations
  const [deleteLogoConfirm, setDeleteLogoConfirm] = useState(false);
  const [isDeleteLogoClosing, setIsDeleteLogoClosing] = useState(false);
  const [deleteProfileConfirm, setDeleteProfileConfirm] = useState(false);
  const [isDeleteProfileClosing, setIsDeleteProfileClosing] = useState(false);

  const [previewImage, setPreviewImage] = useState(null);

  // Filters & Sort
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState('all'); 
  const [filterDate, setFilterDate] = useState(''); 
  const [filterDateRange, setFilterDateRange] = useState({ start: '', end: '' });
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTransport, setFilterTransport] = useState('all');

  // Autocomplete Data
  const [savedArtists, setSavedArtists] = useState([]);
  const [savedCustomers, setSavedCustomers] = useState([]);
  const [savedRecipients, setSavedRecipients] = useState([]);

  // Form States
  const [currentId, setCurrentId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDateTime, setProjectDateTime] = useState('');
  const [paymentDate, setPaymentDate] = useState(''); // [ADDED] วันที่รับชำระเงิน (สำหรับออกใบเสร็จและคำนวณรายได้)
  const [artistName, setArtistName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSocial, setCustomerSocial] = useState('');
  const [customerLine, setCustomerLine] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerAddress, setCustomerAddress] = useState(''); 
  const [projectCategory, setProjectCategory] = useState('');
  const [deliveryStart, setDeliveryStart] = useState('');
  const [deliveryEnd, setDeliveryEnd] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [locationName, setLocationName] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedSlips, setUploadedSlips] = useState([]);
  const [note, setNote] = useState('');
  const [wage, setWage] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [transportStatus, setTransportStatus] = useState('');
  const [dealStatus, setDealStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('unpaid'); // [ADDED] unpaid, deposit, paid, refunded
  const [depositAmount, setDepositAmount] = useState(0); // [ADDED] ยอดเงินมัดจำ
  const [isMobileNavExpanded, setIsMobileNavExpanded] = useState(false); // Pull-up Bottom Sheet for Mobile Nav
  const navSheetRef = useRef(null);
  const expandSectionRef = useRef(null);
  const backdropRef = useRef(null);
  const handlePillRef = useRef(null);
  const rafIdRef = useRef(null);
  const isScrolledRef = useRef(false);
  const headerRef = useRef(null);
  const filterSentinelsRef = useRef({});
  const navDragStateRef = useRef({
    startY: 0,
    startTime: 0,
    isDragging: false,
    currentH: 0
  });

  const EXPAND_TARGET_H = 76; // Height of secondary icon row in px

  // Sync visual position of the SINGLE nav box and backdrop with state changes
  useEffect(() => {
    const expandEl = expandSectionRef.current;
    const backdropEl = backdropRef.current;
    if (navDragStateRef.current.isDragging) return;

    if (expandEl) {
      expandEl.style.transition = 'height 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      if (isMobileNavExpanded) {
        expandEl.style.height = `${EXPAND_TARGET_H}px`;
        expandEl.style.opacity = '1';
        expandEl.style.pointerEvents = 'auto';
      } else {
        expandEl.style.height = '0px';
        expandEl.style.opacity = '0';
        expandEl.style.pointerEvents = 'none';
      }
    }
    if (backdropEl) {
      backdropEl.style.transition = 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      if (isMobileNavExpanded) {
        backdropEl.style.opacity = '1';
        backdropEl.style.visibility = 'visible';
        backdropEl.style.pointerEvents = 'auto';
      } else {
        backdropEl.style.opacity = '0';
        backdropEl.style.pointerEvents = 'none';
        setTimeout(() => {
          if (!navDragStateRef.current.isDragging && !isMobileNavExpanded && backdropEl) {
            backdropEl.style.visibility = 'hidden';
          }
        }, 280);
      }
    }
  }, [isMobileNavExpanded]);

  const wasDraggingNavRef = useRef(false);

  // Handles dragging the single unified nav box up/down smoothly (No second box, no lag)
  const handleBottomNavPointerDown = (e) => {
    if (navDragStateRef.current.isDragging) return;
    if (e.button !== undefined && e.button !== 0) return;
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    if (clientY === null || clientX === null) return;

    const startX = clientX;
    const startY = clientY;
    const startTime = Date.now();
    let isTracking = true;
    let hasTriggeredDrag = false;

    wasDraggingNavRef.current = false;

    const onPointerMove = (moveEvent) => {
      if (!isTracking) return;
      const curY = moveEvent.clientY ?? (moveEvent.touches && moveEvent.touches[0] ? moveEvent.touches[0].clientY : null);
      const curX = moveEvent.clientX ?? (moveEvent.touches && moveEvent.touches[0] ? moveEvent.touches[0].clientX : null);
      if (curY === null || curX === null) return;

      const diffY = curY - startY;
      const diffX = curX - startX;

      if (hasTriggeredDrag) {
        if (navDragStateRef.current.isDragging) {
          let nextH = 0;
          if (isMobileNavExpanded) {
            // Dragging down from expanded (diffY > 0 collapses)
            const pulledDown = diffY;
            nextH = Math.max(0, Math.min(EXPAND_TARGET_H, EXPAND_TARGET_H - pulledDown));
          } else {
            // Dragging up from collapsed (diffY < 0 expands)
            const pulledUp = -diffY;
            if (pulledUp <= EXPAND_TARGET_H) {
              nextH = Math.max(0, pulledUp);
            } else {
              nextH = EXPAND_TARGET_H + (pulledUp - EXPAND_TARGET_H) * 0.25;
            }
          }
          navDragStateRef.current.currentH = nextH;

          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
              rafIdRef.current = null;
              if (expandSectionRef.current && navDragStateRef.current.isDragging) {
                expandSectionRef.current.style.height = `${navDragStateRef.current.currentH}px`;
                const progress = Math.min(1, navDragStateRef.current.currentH / EXPAND_TARGET_H);
                expandSectionRef.current.style.opacity = progress.toFixed(3);
              }
              if (backdropRef.current && navDragStateRef.current.isDragging) {
                const progress = Math.min(1, navDragStateRef.current.currentH / EXPAND_TARGET_H);
                backdropRef.current.style.opacity = progress.toFixed(3);
                backdropRef.current.style.visibility = progress > 0.05 ? 'visible' : 'hidden';
              }
              if (handlePillRef.current && navDragStateRef.current.isDragging) {
                // Squeeze animation: narrow and slightly taller like squeezed rubber pill, darker slate color without colored tint
                const progress = Math.min(1, Math.max(0, navDragStateRef.current.currentH / EXPAND_TARGET_H));
                const scaleX = (0.75 - progress * 0.1).toFixed(2);
                const scaleY = (1.3 + progress * 0.15).toFixed(2);
                handlePillRef.current.style.transform = `scale(${scaleX}, ${scaleY})`;
                handlePillRef.current.style.backgroundColor = '#64748b'; // slate-500 (เข้มขึ้นตามธรรมชาติ ไม่ใส่สี)
                handlePillRef.current.style.boxShadow = 'none';
              }
            });
          }
        }
        if (moveEvent.cancelable) {
          moveEvent.preventDefault();
        }
        return;
      }

      // Check gesture threshold:
      // Collapsed: drag up (diffY < -6)
      // Expanded: drag down (diffY > 6)
      const isVertical = Math.abs(diffY) > Math.abs(diffX) * 0.7;
      const shouldTrigger = isMobileNavExpanded
        ? (diffY > 6 && isVertical)
        : (diffY < -6 && isVertical);

      if (shouldTrigger) {
        hasTriggeredDrag = true;
        wasDraggingNavRef.current = true;

        const expandEl = expandSectionRef.current;
        const backdropEl = backdropRef.current;

        navDragStateRef.current = {
          startY: startY,
          startTime: startTime,
          isDragging: true,
          currentH: isMobileNavExpanded ? EXPAND_TARGET_H : 0
        };

        if (expandEl) {
          expandEl.style.transition = 'none';
          expandEl.style.pointerEvents = 'auto';
        }
        if (backdropEl) {
          backdropEl.style.transition = 'none';
          backdropEl.style.visibility = 'visible';
        }
        if (handlePillRef.current) {
          handlePillRef.current.style.transition = 'none';
          handlePillRef.current.style.transform = 'scale(0.75, 1.3)';
          handlePillRef.current.style.backgroundColor = '#64748b';
          handlePillRef.current.style.boxShadow = 'none';
        }

        if (moveEvent.cancelable) {
          moveEvent.preventDefault();
        }
      }
    };

    const onPointerUp = (upEvent) => {
      isTracking = false;
      cleanup();

      if (!hasTriggeredDrag) {
        wasDraggingNavRef.current = false;
        return;
      }

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      const endY = upEvent.clientY ?? (upEvent.changedTouches && upEvent.changedTouches[0] ? upEvent.changedTouches[0].clientY : startY);
      const diffY = endY - startY;
      const timeDiff = Math.max(1, Date.now() - startTime);

      const expandEl = expandSectionRef.current;
      const backdropEl = backdropRef.current;

      if (expandEl) {
        expandEl.style.transition = 'height 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      }
      if (backdropEl) {
        backdropEl.style.transition = 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      }
      if (handlePillRef.current) {
        handlePillRef.current.style.transition = 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.25s ease, box-shadow 0.25s ease';
        handlePillRef.current.style.transform = 'scale(1, 1)';
        handlePillRef.current.style.backgroundColor = '';
        handlePillRef.current.style.boxShadow = 'none';
      }

      let shouldExpand;
      if (!isMobileNavExpanded) {
        const pulledUp = -diffY;
        const velocity = pulledUp / timeDiff;
        shouldExpand = velocity > 0.25 || pulledUp > 25;
      } else {
        const pulledDown = diffY;
        const velocity = pulledDown / timeDiff;
        shouldExpand = !(velocity > 0.25 || pulledDown > 25);
      }

      if (shouldExpand) {
        if (expandEl) {
          expandEl.style.height = `${EXPAND_TARGET_H}px`;
          expandEl.style.opacity = '1';
          expandEl.style.pointerEvents = 'auto';
        }
        if (backdropEl) {
          backdropEl.style.opacity = '1';
          backdropEl.style.pointerEvents = 'auto';
          backdropEl.style.visibility = 'visible';
        }
        setIsMobileNavExpanded(true);
      } else {
        if (expandEl) {
          expandEl.style.height = '0px';
          expandEl.style.opacity = '0';
          expandEl.style.pointerEvents = 'none';
        }
        if (backdropEl) {
          backdropEl.style.opacity = '0';
          backdropEl.style.pointerEvents = 'none';
        }
        setIsMobileNavExpanded(false);
      }

      navDragStateRef.current.isDragging = false;
      setTimeout(() => {
        wasDraggingNavRef.current = false;
      }, 120);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('touchcancel', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);
    window.addEventListener('mousemove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
  };
  const [expenses, setExpenses] = useState([{ category: '', detail: '', price: 0 }]);
  const [quotationItems, setQuotationItems] = useState([{ category: '', detail: '', price: 0 }]);
  const [customerSupportItems, setCustomerSupportItems] = useState([{ denomination: 20, quantity: 0, price: 0 }]);
  
  const [allActivities, setAllActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingSettings, setIsSyncingSettings] = useState(false); // [ADDED] State สำหรับบอกสถานะการซิงค์ข้อมูลตั้งค่า

  // Refs
  const mainRef = useRef(null);
  const tabScrollPositions = useRef({});
  const part3Ref = useRef(null);


  // --- 2. EFFECTS ---

  useEffect(() => {
    localStorage.setItem('nexus_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Title Effect
  useEffect(() => {
    // ถ้าอยู่ในโหมดติดตามหรือเสนอราคา ให้ข้ามการตั้งชื่อตาม Tab หลักไปเลย
    if (trackingId) {
        document.title = "กำลังตรวจสอบสถานะ..."; 
        return;
    }
    if (quotationId) {
        document.title = "กำลังโหลดใบเสนอราคา...";
        return;
    }

    const appTitle = shopInfo?.shopName || 'NexusPlan';
    const currentTab = navItems.find(item => item.name === activeTab);
    
    if (currentTab) {
      document.title = `${currentTab.label} - ${appTitle}`;
    } else {
      document.title = `${appTitle} Dashboard`;
    }
  }, [activeTab, trackingId, quotationId, shopInfo]);

  // Synchronize URL path with activeTab (e.g. /PlansView, /FinanceView)
  useEffect(() => {
    if (!trackingId && !quotationId) {
      updateUrlForTab(activeTab);
    }
  }, [activeTab, trackingId, quotationId]);

  // Listen for browser Back/Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const tabFromUrl = getTabFromUrl();
      setActiveTab(tabFromUrl);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    setVisibleCount(20);
    setIsLoadingMore(false);
  }, [activeTab, searchTerm, dateFilterMode, filterDate, filterDateRange, filterCategory, filterStatus, filterTransport, sortConfig]);

  useEffect(() => {
    const auth = localStorage.getItem('nexus_auth');
    const savedProfile = localStorage.getItem('nexus_profile');
    if (auth && savedProfile) {
        setIsLoggedIn(true);
        setUserProfile(JSON.parse(savedProfile));
    }
  }, []);

  useLayoutEffect(() => {
      let theme;
      const isGradient = shopInfo.themeMode === 'gradient';

      // [ADDED] Logic for Custom Color Calculation
      if (shopInfo.themeColor === 'custom' && shopInfo.customColorValue) {
          const mainColor = shopInfo.customColorValue;
          theme = {
              main: mainColor,
              hover: shadeColor(mainColor, -0.1), // Darken 10%
              light: shadeColor(mainColor, 0.93), // Very light tint (93%)
              textLight: mainColor,
              gradientFrom: mainColor,
              gradientTo: shadeColor(mainColor, -0.25), // Darken 25% for gradient end
              shadow: `rgba(${hexToRgbString(mainColor)}, 0.4)`
          };
      } else {
          theme = themeColors[shopInfo.themeColor] || themeColors.indigo;
      }
      
      const styleId = 'nexus-theme-styles';
      let style = document.getElementById(styleId);
      if (!style) {
          style = document.createElement('style');
          style.id = styleId;
          document.head.appendChild(style);
      }

      // Generate CSS to override Tailwind 'indigo' classes
      const css = `
          :root {
              --theme-main: ${theme.main};
              --theme-hover: ${theme.hover};
              --theme-light: ${theme.light};
              --theme-text-light: ${theme.textLight};
              --theme-shadow: ${theme.shadow};
          }
          
          /* Backgrounds */
          .bg-indigo-600 { background-color: var(--theme-main) !important; }
          .hover\\:bg-indigo-700:hover { background-color: var(--theme-hover) !important; }
          .bg-indigo-50 { background-color: var(--theme-light) !important; }
          .bg-indigo-100 { background-color: var(--theme-light) !important; filter: brightness(0.95); } /* Adjusted logic for 100 */
          
          /* Texts */
          .text-indigo-600 { color: var(--theme-main) !important; }
          .text-indigo-700 { color: var(--theme-hover) !important; }
          .text-indigo-500 { color: var(--theme-text-light) !important; }
          
          /* Borders */
          .border-indigo-100, .border-indigo-200 { border-color: ${theme.light} !important; filter: brightness(0.9); }
          .border-indigo-600 { border-color: var(--theme-main) !important; }
          .hover\\:border-indigo-300:hover { border-color: var(--theme-text-light) !important; opacity: 0.8; }

          /* Shadows */
          .shadow-indigo-200 { --tw-shadow-color: ${theme.shadow} !important; }
          
          /* Gradients */
          .from-indigo-600 { --tw-gradient-from: ${theme.gradientFrom} !important; var(--tw-gradient-to, ${theme.gradientFrom}) !important; }
          .to-violet-600 { --tw-gradient-to: ${theme.gradientTo} !important; }
          .bg-gradient-to-r {
              ${!isGradient 
                  ? `background-image: none !important; background-color: var(--theme-main) !important;` 
                  : (theme.isRainbow 
                      ? `background-image: linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899) !important;` 
                      : `background-image: linear-gradient(to right, var(--tw-gradient-from), var(--tw-gradient-to)) !important;`)
              }
          }
      `;
      style.textContent = css;

  }, [shopInfo.themeColor, shopInfo.themeMode, shopInfo.customColorValue]);

  // Scroll Restore
  useLayoutEffect(() => {
    const isMobile = window.innerWidth < 768;
    const savedPosition = tabScrollPositions.current[activeTab] || 0;
    if (isMobile) {
      window.scrollTo(0, savedPosition);
    } else if (mainRef.current) {
      mainRef.current.scrollTop = savedPosition;
    }
    
    const sentinel = filterSentinelsRef.current[activeTab];
    let shouldBeScrolled = false;
    if (sentinel && sentinel.getClientRects().length > 0) {
      const targetTop = isMobile
        ? (headerRef.current ? headerRef.current.getBoundingClientRect().bottom : 56)
        : (mainRef.current ? mainRef.current.getBoundingClientRect().top : 0);
      const marginOffset = isMobile ? 8 : 12;
      shouldBeScrolled = sentinel.getBoundingClientRect().top <= targetTop - marginOffset + 1;
    }
    isScrolledRef.current = shouldBeScrolled;
    setIsScrolled(shouldBeScrolled);
  }, [activeTab]);

  useEffect(() => {
    if (isAddModalOpen && viewOnlyMode && part3Ref.current) {
      setTimeout(() => {
        part3Ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [isAddModalOpen, viewOnlyMode]);

  // --- 3. FUNCTION DEFINITIONS ---

  // [MODIFIED] เพิ่มโหมด showSyncIndicator และระบบ Smart Diffing ลดการ Re-render
  const fetchSettings = async (showSyncIndicator = false) => {
    if (!GOOGLE_SCRIPT_URL) {
        setIsSettingsLoaded(true);
        return;
    }
    
    if (showSyncIndicator) setIsSyncingSettings(true);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000));
    
    try {
        const fetchPromise = fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" }, 
            body: JSON.stringify({ action: 'getSettings' })
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (response === 'timeout') {
            console.warn('Settings fetch timed out, using defaults.');
        } else {
            const result = await response.json();
            if (result.status === 'success' && result.data) {
                const data = result.data;
                
                // [ADDED] Helper ตรวจสอบข้อมูลก่อน อัปเดต State เฉพาะจุดที่มีการเปลี่ยนแปลงเท่านั้น (แก้ปัญหาหน้าเว็บกระตุก/โหลดช้า)
                const updateIfChanged = (setter, newValue, cacheKey) => {
                    setter(prev => {
                        if (JSON.stringify(prev) !== JSON.stringify(newValue)) {
                            if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(newValue));
                            return newValue;
                        }
                        return prev; // ถ้าข้อมูลเดิม ระบบจะไม่ Re-render หน้าจอ
                    });
                };

                // ใช้ Helper จัดการการเปลี่ยนแปลง
                if (data.project_categories) updateIfChanged(setProjectCategories, data.project_categories, 'nexus_project_categories');
                if (data.expense_categories) updateIfChanged(setExpenseCategories, data.expense_categories, 'nexus_expense_categories');
                if (data.deal_statuses) updateIfChanged(setDealStatuses, data.deal_statuses, 'nexus_deal_statuses');
                if (data.transport_statuses) updateIfChanged(setTransportStatuses, data.transport_statuses, 'nexus_transport_statuses');
                if (data.shop_info) updateIfChanged(setShopInfo, data.shop_info, 'nexus_shop_info');

                if (data.drive_folder_id !== undefined) setDriveFolderId(data.drive_folder_id);
                if (data.assets_drive_folder_id !== undefined) setAssetsDriveFolderId(data.assets_drive_folder_id);
                if (data.drive_folders) {
                  let folders = data.drive_folders;
                  if (typeof folders === 'string') {
                    try { folders = JSON.parse(folders); } catch (e) {}
                  }
                  if (Array.isArray(folders) && folders.length > 0) {
                    setDriveFolders(folders);
                    localStorage.setItem('nexus_drive_folders', JSON.stringify(folders));
                  }
                } else if (data.drive_folder_id || data.assets_drive_folder_id) {
                  setDriveFolders(prev => prev.map(f => {
                    if (f.type === 'reference' && data.drive_folder_id && !f.folderId) {
                      return { ...f, folderId: data.drive_folder_id };
                    }
                    if (f.type === 'assets' && data.assets_drive_folder_id && !f.folderId) {
                      return { ...f, folderId: data.assets_drive_folder_id };
                    }
                    return f;
                  }));
                }
                
                // Load Chatbot Tokens from settings
                if (data.line_bot_token !== undefined) setLineBotToken(data.line_bot_token);
                if (data.telegram_bot_token !== undefined) setTelegramBotToken(data.telegram_bot_token);
                if (data.telegram_chat_id !== undefined) setTelegramChatId(data.telegram_chat_id);
                if (data.web_app_url !== undefined) setWebAppUrl(data.web_app_url);
                
                if (data.app_credentials) {
                    let creds = data.app_credentials;
                    if (!Array.isArray(creds)) {
                        creds = [{
                            username: creds.username,
                            password: creds.password,
                            name: 'Admin',
                            role: 'Administrator',
                            email: 'admin@nexusplan.com',
                            phone: '-'
                        }];
                    }
                    updateIfChanged(setAuthorizedUsers, creds, 'nexus_authorized_users');

                    // Sync current logged-in user profile with latest data from server
                    const currentLocalProfile = localStorage.getItem('nexus_profile');
                    if (currentLocalProfile) {
                        const currentObj = JSON.parse(currentLocalProfile);
                        const updatedUser = creds.find(u => u.username.toLowerCase() === currentObj.username.toLowerCase());
                        
                        if (updatedUser) {
                            if (updatedUser.image !== currentObj.image || updatedUser.name !== currentObj.name || updatedUser.role !== currentObj.role) {
                                const newProfile = {
                                    ...currentObj,
                                    name: updatedUser.name,
                                    role: updatedUser.role,
                                    email: updatedUser.email,
                                    phone: updatedUser.phone,
                                    image: updatedUser.image
                                };
                                setUserProfile(newProfile);
                                localStorage.setItem('nexus_profile', JSON.stringify(newProfile));
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
    } finally {
        setIsSettingsLoaded(true); 
        if (showSyncIndicator) setIsSyncingSettings(false); // [ADDED] ปิดสถานะซิงค์ข้อมูล
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // [MODIFIED] เรียกใช้งานพร้อมสั่งให้แสดง Indicator
  useEffect(() => {
    if (activeTab === 'Settings') {
      fetchSettings(true); 
    }
  }, [activeTab]);

  // [MODIFIED] เพิ่มพารามิเตอร์ isSilent เพื่อให้โหลดข้อมูลเบื้องหลังได้โดยไม่ขึ้นหน้าต่างโหลดกระตุก
  const fetchProjects = async (isSilent = false) => {
    if (!GOOGLE_SCRIPT_URL) return;
    if (!isSilent) setIsLoading(true);
    
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));

    try {
      const fetchPromise = fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { "Content-Type": "text/plain;charset=utf-8" }, // [FIX] เพิ่ม Header
          body: JSON.stringify({ action: 'read' })
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const result = await response.json();
      
      if (result.status === 'success') {
        const uniqueItems = Array.from(
            result.data.reduce((map, item) => {
                if (item.id) map.set(item.id, item);
                return map;
            }, new Map()).values()
        );

        setAllActivities(uniqueItems);
        
        const artists = [...new Set(uniqueItems.map(item => item.artist).filter(Boolean))].sort();
        setSavedArtists(artists);

        const customersMap = new Map();
        uniqueItems.forEach(item => {
            if (item.customer) {
                const existing = customersMap.get(item.customer) || {};
                const info = item.customerInfo || {};
                
                customersMap.set(item.customer, {
                    name: item.customer,
                    social: info.social || existing.social || '',
                    line: info.line || existing.line || '',
                    phone: info.phone || existing.phone || '',
                    email: info.email || existing.email || '',
                    taxId: info.taxId || existing.taxId || '', 
                    address: info.address || existing.address || ''
                });
            }
        });
        setSavedCustomers(Array.from(customersMap.values()));

        const recipientsMap = new Map();
        uniqueItems.forEach(item => {
            if (item.recipient && !recipientsMap.has(item.recipient)) {
                recipientsMap.set(item.recipient, {
                    name: item.recipient,
                    phone: item.recipientPhone || ''
                });
            }
        });
        setSavedRecipients(Array.from(recipientsMap.values()));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (!isSilent) showToast("การเชื่อมต่อล่าช้า ระบบกำลังทำงานในโหมด Offline", "error");
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn || trackingId || quotationId) {
        fetchProjects();

        // [MODIFIED] เปลี่ยนจากการดึงข้อมูลทุก 1 นาที เป็นการดึงข้อมูลเมื่อสลับแท็บกลับมาหน้าเว็บ (Window Focus)
        // ช่วยประหยัด Quota ของ Google Apps Script ได้มหาศาล และข้อมูลยังสดใหม่เสมอเมื่อใช้งาน
        const onFocus = () => {
            fetchProjects(true); // Silent fetch ไม่ให้หน้าจอกระตุก
        };

        window.addEventListener('focus', onFocus);
        
        return () => window.removeEventListener('focus', onFocus);
    }
  }, [isLoggedIn, trackingId, quotationId]);

  useEffect(() => {
      if ((trackingId || quotationId) && allActivities.length > 0) {
          const targetToken = trackingId || quotationId;
          const foundItem = allActivities.find(item => 
              generateTrackingToken(item.id, item.rawDateTime) === targetToken
          );

          const timer = setTimeout(() => {
              setAreImagesLoaded(true);
          }, 3000);

          if (foundItem && foundItem.image) {
              const img = new Image();
              img.src = processImageUrl(foundItem.image);
              img.onload = () => {
                  clearTimeout(timer);
                  setAreImagesLoaded(true);
              };
              img.onerror = () => {
                  clearTimeout(timer);
                  setAreImagesLoaded(true);
              };
          } else {
              clearTimeout(timer);
              setAreImagesLoaded(true); 
          }
          
          return () => clearTimeout(timer);
      } else if (!trackingId && !quotationId) {
          setAreImagesLoaded(true); 
      } else if ((trackingId || quotationId) && !isLoading && allActivities.length === 0) {
          setAreImagesLoaded(true);
      }
  }, [allActivities, trackingId, quotationId, isLoading]);

  // [MODIFIED] Fix Race Condition in Settings Save (Partial Update)
  const saveSystemSettings = async (key, value) => {
      if (!GOOGLE_SCRIPT_URL) return;
      setIsSaving(true);
      
      const partialData = (typeof key === 'object') ? key : { [key]: value };

      if (shopInfo.logo && shopInfo.logo.startsWith('data:image')) {
          showToast("กำลังประมวลผลรูปภาพ กรุณารอสักครู่...", "error");
          setIsSaving(false);
          return;
      }

      // [FIX] We only send partialData to Backend. The backend must handle merging.
      // Removed fullPayload to prevent old data from overriding new data from other users.
      const payloadToSend = { ...partialData };

      try {
          await fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({
                  action: 'saveSettings',
                  data: payloadToSend // [FIX] Send only the changed keys
              })
          });
          
          // Update Local State & Cache
          if (partialData.app_credentials) {
              setAuthorizedUsers(partialData.app_credentials);
              localStorage.setItem('nexus_authorized_users', JSON.stringify(partialData.app_credentials));
          }
          if (partialData.project_categories) localStorage.setItem('nexus_project_categories', JSON.stringify(partialData.project_categories));
          if (partialData.expense_categories) localStorage.setItem('nexus_expense_categories', JSON.stringify(partialData.expense_categories));
          if (partialData.deal_statuses) localStorage.setItem('nexus_deal_statuses', JSON.stringify(partialData.deal_statuses));
          if (partialData.transport_statuses) localStorage.setItem('nexus_transport_statuses', JSON.stringify(partialData.transport_statuses));

          if (partialData.drive_folders) {
              setDriveFolders(partialData.drive_folders);
              localStorage.setItem('nexus_drive_folders', JSON.stringify(partialData.drive_folders));
          }
          if (partialData.drive_folder_id) {
              setDriveFolderId(partialData.drive_folder_id);
          }
          if (partialData.assets_drive_folder_id) { 
              setAssetsDriveFolderId(partialData.assets_drive_folder_id);
          }
          if (partialData.line_bot_token !== undefined) {
              setLineBotToken(partialData.line_bot_token);
          }
          if (partialData.telegram_bot_token !== undefined) {
              setTelegramBotToken(partialData.telegram_bot_token);
          }
          if (partialData.telegram_chat_id !== undefined) { 
              setTelegramChatId(partialData.telegram_chat_id);
          }
          if (partialData.web_app_url !== undefined) { 
              setWebAppUrl(partialData.web_app_url);
          }
          if (partialData.shop_info) {
              setShopInfo(partialData.shop_info);
              localStorage.setItem('nexus_shop_info', JSON.stringify(partialData.shop_info));
          }
          showToast("บันทึกการตั้งค่าสำเร็จ", "success");
      } catch (error) {
          console.error("Error saving settings:", error);
          showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error");
      } finally {
          setIsSaving(false);
      }
  };

  const handleFetchTelegramId = async () => {
    if (!GOOGLE_SCRIPT_URL) return;
    showToast("กำลังดึง Chat ID ล่าสุด...", "info");
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // [FIX] เพิ่ม Header
        body: JSON.stringify({ action: 'getLatestChatId' })
      });
      const result = await response.json();
      if (result.status === 'success' && result.chatId) {
        setTelegramChatId(result.chatId);
        showToast("ดึง Chat ID เรียบร้อย: " + result.chatId, "success");
      } else {
        showToast("ไม่พบ Chat ID ล่าสุด (ลองพิมพ์ /id หาบอทก่อน)", "error");
      }
    } catch (error) {
      showToast("เกิดข้อผิดพลาดในการดึง ID", "error");
    }
  };

  const handleAddUser = () => {
      if (!newUser.username || !newUser.password || !newUser.name) {
          showToast("กรุณากรอก Username, Password และชื่อ", "error");
          return;
      }
      if (authorizedUsers.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
          showToast("ชื่อผู้ใช้นี้มีอยู่แล้ว", "error");
          return;
      }

      const updatedUsers = [...authorizedUsers, newUser];
      saveSystemSettings('app_credentials', updatedUsers);
      setAuthorizedUsers(updatedUsers);
      setNewUser({ username: '', password: '', name: '', role: '', email: '', phone: '' });
      setIsAddingUser(false);
      showToast("เพิ่มผู้ใช้งานเรียบร้อยแล้ว");
  };

  const handleDeleteUser = (usernameToDelete) => {
      if (authorizedUsers.length <= 1) {
          showToast("ไม่สามารถลบผู้ใช้งานคนสุดท้ายได้", "error");
          return;
      }
      
      const updatedUsers = authorizedUsers.filter(u => u.username !== usernameToDelete);
      saveSystemSettings('app_credentials', updatedUsers);
      setAuthorizedUsers(updatedUsers);
      showToast("ลบผู้ใช้งานเรียบร้อยแล้ว");
  };

  const handleLogin = async (user, pass, remember) => {
      setIsLoading(true);
      setLoginError('');
      
      let foundUser = authorizedUsers.find(u => 
          u.username.toLowerCase() === user.toLowerCase() && u.password === pass
      );

      if (!foundUser && GOOGLE_SCRIPT_URL) {
          try {
              const response = await fetch(GOOGLE_SCRIPT_URL, {
                  method: 'POST',
                  headers: { "Content-Type": "text/plain;charset=utf-8" },
                  body: JSON.stringify({ action: 'getSettings' })
              });
              
              const result = await response.json();
              if (result.status === 'success' && result.data && result.data.app_credentials) {
                  let latestUsers = result.data.app_credentials;
                  if (!Array.isArray(latestUsers)) latestUsers = [latestUsers];
                  
                  setAuthorizedUsers(latestUsers);
                  localStorage.setItem('nexus_authorized_users', JSON.stringify(latestUsers));
                  
                  foundUser = latestUsers.find(u => 
                      u.username.toLowerCase() === user.toLowerCase() && u.password === pass
                  );
              }
          } catch (e) {
              console.error("Login verification error:", e);
          }
      }

      if (foundUser) {
          setIsLoggedIn(true);
          setUserProfile({
              name: foundUser.name,
              role: foundUser.role,
              email: foundUser.email,
              phone: foundUser.phone,
              username: foundUser.username,
              image: foundUser.image 
          });

          const targetTab = getTabFromUrl() || activeTab || 'Calendar';
          setActiveTab(targetTab); 

          if (remember) {
              localStorage.setItem('nexus_auth', 'true');
              localStorage.setItem('nexus_profile', JSON.stringify({
                  name: foundUser.name,
                  role: foundUser.role,
                  email: foundUser.email,
                  phone: foundUser.phone,
                  username: foundUser.username,
                  image: foundUser.image
              }));
          }
          showToast(`ยินดีต้อนรับคุณ ${foundUser.name}`, "success");
      } else {
          setLoginError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
          showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "error");
      }
      setIsLoading(false);
  };

  const handleLogout = () => {
      setIsLoggedIn(false);
      setUserProfile(null);
      setActiveTab('Calendar');
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', getBasePath() || '/');
      }
      localStorage.removeItem('nexus_auth');
      localStorage.removeItem('nexus_profile');
      showToast("ออกจากระบบแล้ว");
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const closeToast = () => {
    setToast({ ...toast, show: false });
  };

  const getPageTitle = (tabName) => {
    const tab = navItems.find(t => t.name === tabName);
    return tab ? tab.label : 'ProjectPlan';
  };

  const totalExpenses = expenses.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  const profit = (parseFloat(wage) || 0) - totalExpenses;
  const totalSupport = customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  const getDealStatusInfo = (value) => {
    return dealStatuses.find(s => s.value === value) || { label: value, color: 'bg-slate-100 text-slate-500' };
  };

  const getTransportStatusInfo = (value) => {
    return transportStatuses.find(s => s.value === value) || { label: value, color: 'bg-slate-100 text-slate-500' };
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    tabScrollPositions.current[activeTab] = scrollTop;
    const sentinel = filterSentinelsRef.current[activeTab];
    let shouldBeScrolled = false;
    if (sentinel && sentinel.getClientRects().length > 0 && mainRef.current) {
      const sentinelRect = sentinel.getBoundingClientRect();
      const mainRect = mainRef.current.getBoundingClientRect();
      const marginOffset = window.innerWidth < 768 ? 8 : 12;
      shouldBeScrolled = sentinelRect.top <= mainRect.top - marginOffset + 1;
    }
    if (isScrolledRef.current !== shouldBeScrolled) {
      isScrolledRef.current = shouldBeScrolled;
      setIsScrolled(shouldBeScrolled);
    }

    if (activeTab === 'Plans' || activeTab === 'Analytics') {
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        if (visibleCount < filteredAndSortedActivities.length && !isLoadingMore) {
           setIsLoadingMore(true);
           setTimeout(() => {
              setVisibleCount(prev => prev + 5);
              setIsLoadingMore(false);
           }, 1000);
        }
      }
    }
  };

  // --- Image Handling Logic ---
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024; // Resize if width > 1024
          const scaleSize = MAX_WIDTH / img.width;
          
          if (scaleSize < 1) {
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
          } else {
              canvas.width = img.width;
              canvas.height = img.height;
          }
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Compress quality to 0.7
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // [ADDED] Helper for Phone Formatting
  const formatPhoneNumber = (value) => {
    if (!value) return '';
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    }
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  // [ADDED] Handle Profile Image Upload
  const handleProfileImageUpload = async (file) => {
      if (!file) return;
      
      if (!assetsDriveFolderId || typeof assetsDriveFolderId !== 'string' || assetsDriveFolderId.trim() === '') {
          if (GOOGLE_SCRIPT_URL) {
             showToast("กรุณาระบุ Assets Folder ID ในตั้งค่าก่อนอัปโหลดรูปโปรไฟล์", "error");
             return;
          }
      }

      setIsUploadingProfile(true);
      try {
          if (!file.type.startsWith('image/')) {
              throw new Error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น');
          }

          let processedFile = file;
          let base64Data = "";
          
          if (file.size > 2 * 1024 * 1024) { 
               base64Data = await compressImage(file);
          } else {
               base64Data = await toBase64(file);
          }

          const tempProfile = { ...userProfile, image: base64Data };
          setUserProfile(tempProfile);

          if (GOOGLE_SCRIPT_URL) {
              const mimeType = base64Data.split(',')[0].match(/:(.*?);/)[1];
              const extension = mimeType.includes('png') ? 'png' : 'jpg';
              const fileName = `profile_${userProfile.username}_${Date.now()}.${extension}`;

              const response = await fetch(GOOGLE_SCRIPT_URL, {
                  method: 'POST',
                  headers: { "Content-Type": "text/plain;charset=utf-8" }, // [FIX] เพิ่ม Header
                  body: JSON.stringify({
                      action: 'uploadAsset', 
                      data: {
                          fileData: base64Data, 
                          mimeType: mimeType,
                          fileName: fileName,
                          folderId: assetsDriveFolderId.trim()
                      }
                  })
              });

              const result = await response.json();
              if (result.status === 'success' && result.url) {
                  let newImageUrl = result.url;
                  if (result.fileId) {
                      newImageUrl = `https://drive.google.com/uc?export=view&id=${result.fileId}`;
                  }
                  
                  const finalProfile = { ...userProfile, image: newImageUrl };
                  setUserProfile(finalProfile);
                  localStorage.setItem('nexus_profile', JSON.stringify(finalProfile));

                  const updatedUsers = authorizedUsers.map(u => 
                      u.username.toLowerCase() === userProfile.username.toLowerCase() 
                      ? { ...u, image: newImageUrl } 
                      : u
                  );
                  setAuthorizedUsers(updatedUsers);

                  await saveSystemSettings('app_credentials', updatedUsers);
                  
                  showToast("อัปเดตรูปโปรไฟล์สำเร็จ", "success");
              } else {
                  throw new Error(result.message || "Upload failed");
              }
          } else {
              const updatedProfile = { ...userProfile, image: base64Data };
              setUserProfile(updatedProfile);
              localStorage.setItem('nexus_profile', JSON.stringify(updatedProfile));
              
              const updatedUsers = authorizedUsers.map(u => 
                  u.username.toLowerCase() === userProfile.username.toLowerCase() 
                  ? { ...u, image: base64Data } 
                  : u
              );
              setAuthorizedUsers(updatedUsers);
              showToast("เปลี่ยนรูปโปรไฟล์ (Offline)", "success");
          }

      } catch (error) {
          console.error(error);
          showToast("เกิดข้อผิดพลาด: " + error.message, "error");
      } finally {
          setIsUploadingProfile(false);
      }
  };

  const requestDeleteProfile = () => {
      if (userProfile?.image) {
          setDeleteProfileConfirm(true);
      }
  };

  const closeDeleteProfileModal = () => {
      setIsDeleteProfileClosing(true);
      setTimeout(() => {
          setDeleteProfileConfirm(false);
          setIsDeleteProfileClosing(false);
      }, 300);
  };

  const executeDeleteProfile = async () => {
      const fileId = getFileId(userProfile?.image);

      const updatedProfile = { ...userProfile, image: '' };
      setUserProfile(updatedProfile);
      localStorage.setItem('nexus_profile', JSON.stringify(updatedProfile));

      const updatedUsers = authorizedUsers.map(u => 
          u.username.toLowerCase() === userProfile.username.toLowerCase() 
          ? { ...u, image: '' } 
          : u
      );
      setAuthorizedUsers(updatedUsers);

      if (GOOGLE_SCRIPT_URL) {
          try {
              await saveSystemSettings('app_credentials', updatedUsers);
              
              if (fileId) {
                  fetch(GOOGLE_SCRIPT_URL, {
                      method: 'POST',
                      headers: { "Content-Type": "text/plain;charset=utf-8" }, // [FIX] เพิ่ม Header
                      body: JSON.stringify({ action: 'deleteFile', id: fileId })
                  }).catch(err => console.error("Failed to delete profile image from Drive:", err));
              }

              showToast("ลบรูปโปรไฟล์เรียบร้อยแล้ว", "success");
          } catch (error) {
              console.error("Error deleting profile image:", error);
              showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
          }
      } else {
          showToast("ลบรูปโปรไฟล์เรียบร้อยแล้ว (Offline)", "success");
      }
      closeDeleteProfileModal();
  };

  const handleLogoUpload = async (file) => {
      if (!file) return;
      
      if (!assetsDriveFolderId || typeof assetsDriveFolderId !== 'string' || assetsDriveFolderId.trim() === '') {
          if (GOOGLE_SCRIPT_URL) {
             showToast("กรุณาระบุ Assets Folder ID ในตั้งค่าก่อนอัปโหลดโลโก้", "error");
             return;
          }
      }

      setIsUploadingLogo(true);
      try {
          if (!file.type.startsWith('image/')) {
              throw new Error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น');
          }

          let processedFile = file;
          let base64Data = "";
          
          if (file.size > 2 * 1024 * 1024) { 
               base64Data = await compressImage(file);
          } else {
               base64Data = await toBase64(file);
          }

          const tempShopInfo = { ...shopInfo, logo: base64Data };
          setShopInfo(tempShopInfo);

          if (GOOGLE_SCRIPT_URL) {
              const mimeType = base64Data.split(',')[0].match(/:(.*?);/)[1];
              const extension = mimeType.includes('png') ? 'png' : 'jpg';
              const fileName = `shop_logo_${Date.now()}.${extension}`;

              const response = await fetch(GOOGLE_SCRIPT_URL, {
                  method: 'POST',
                  headers: { "Content-Type": "text/plain;charset=utf-8" }, // [FIX] เพิ่ม Header
                  body: JSON.stringify({
                      action: 'uploadAsset', 
                      data: {
                          fileData: base64Data, 
                          mimeType: mimeType,
                          fileName: fileName,
                          folderId: assetsDriveFolderId.trim() 
                      }
                  })
              });

              const result = await response.json();
              if (result.status === 'success' && result.url) {
                  let newLogoUrl = result.url;
                  if (result.fileId) {
                      newLogoUrl = `https://drive.google.com/uc?export=view&id=${result.fileId}`;
                  } else if (newLogoUrl.includes('id=')) {
                      const idMatch = newLogoUrl.match(/id=([a-zA-Z0-9_-]+)/);
                      if (idMatch && idMatch[1]) {
                          newLogoUrl = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
                      }
                  }
                  
                  const finalShopInfo = { ...shopInfo, logo: newLogoUrl };
                  setShopInfo(finalShopInfo);
                  await saveSystemSettings('shop_info', finalShopInfo);
                  
                  showToast("อัปเดตโลโก้ร้านค้าสำเร็จ", "success");
              } else {
                  throw new Error(result.message || "Upload failed");
              }
          } else {
              const updatedShopInfo = { ...shopInfo, logo: base64Data };
              setShopInfo(updatedShopInfo);
              showToast("เปลี่ยนโลโก้ร้านค้า (Offline)", "success");
          }

      } catch (error) {
          console.error(error);
          showToast("เกิดข้อผิดพลาด: " + error.message, "error");
          setShopInfo(prev => ({ ...prev, logo: '' })); 
      } finally {
          setIsUploadingLogo(false);
      }
  };

  const requestDeleteLogo = () => {
      if (shopInfo.logo) {
          setDeleteLogoConfirm(true);
      }
  };

  const closeDeleteLogoModal = () => {
      setIsDeleteLogoClosing(true);
      setTimeout(() => {
          setDeleteLogoConfirm(false);
          setIsDeleteLogoClosing(false);
      }, 300);
  };

  const executeDeleteLogo = async () => {
      const fileId = getFileId(shopInfo.logo);

      const tempShopInfo = { ...shopInfo, logo: '' };
      setShopInfo(tempShopInfo);

      if (GOOGLE_SCRIPT_URL) {
          try {
              await saveSystemSettings('shop_info', tempShopInfo);
              
              if (fileId) {
                  fetch(GOOGLE_SCRIPT_URL, {
                      method: 'POST',
                      headers: { "Content-Type": "text/plain;charset=utf-8" }, // [FIX] เพิ่ม Header
                      body: JSON.stringify({ action: 'deleteFile', id: fileId })
                  }).catch(err => console.error("Failed to delete logo from Drive:", err));
              }

              showToast("ลบโลโก้เรียบร้อยแล้ว", "success");
          } catch (error) {
              console.error("Error deleting logo settings:", error);
              showToast("เกิดข้อผิดพลาดในการบันทึกการลบ", "error");
          }
      } else {
          showToast("ลบโลโก้เรียบร้อยแล้ว (Offline)", "success");
      }
      closeDeleteLogoModal();
  };

  const handleImageUpload = async (file) => {
      setIsSaving(true);
      try {
          if (!file.type.startsWith('image/')) {
              throw new Error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น');
          }
          
          let processedFile = file;
          if (file.size > 5 * 1024 * 1024) {
               showToast("กำลังลดขนาดไฟล์รูปภาพ...", "success");
               processedFile = await compressImage(file);
          } else {
               processedFile = await toBase64(file);
          }
          
          setUploadedImage(processedFile);
          showToast("อัพโหลดรูปภาพพร้อมบันทึก", "success");
      } catch (error) {
          console.error(error);
          showToast(error.message || "เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ", "error");
      } finally {
          setIsSaving(false);
      }
  };

  const onDrop = (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleImageUpload(file);
  };

  const onDragOverImg = (e) => {
      e.preventDefault();
  };

  const handleSlipUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsSaving(true);
    try {
      const fileList = Array.from(files);
      const newSlips = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file.type || !file.type.startsWith('image/')) continue;
        let base64Data = '';
        if (file.size > 2 * 1024 * 1024) {
          base64Data = await compressImage(file);
        } else {
          base64Data = await toBase64(file);
        }
        newSlips.push({
          id: `slip_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          url: base64Data,
          name: file.name,
          createdAt: new Date().toISOString()
        });
      }
      if (newSlips.length > 0) {
        setUploadedSlips(prev => [...prev, ...newSlips]);
        showToast(`เพิ่มสลิป ${newSlips.length} รูปเรียบร้อย`, 'success');
      }
    } catch (err) {
      console.error("Slip upload error:", err);
      showToast('เกิดข้อผิดพลาดในการอัปโหลดสลิป', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSlip = (slipKey) => {
    setUploadedSlips(prev => prev.filter(s => {
      const id = typeof s === 'object' ? s.id : s;
      const url = typeof s === 'object' ? s.url : s;
      return id !== slipKey && url !== slipKey;
    }));
  };

  const filteredAndSortedActivities = useMemo(() => {
    let items = allActivities.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        (item.name || '').toLowerCase().includes(searchLower) ||
        (item.id || '').toLowerCase().includes(searchLower) ||
        (item.artist || '').toLowerCase().includes(searchLower) ||
        (item.customer || '').toLowerCase().includes(searchLower) ||
        (item.note && item.note.toLowerCase().includes(searchLower));

      let matchesDate = true;
      const effectiveDate = item.paymentDate || item.rawDateTime; // [MODIFIED] Fallback to rawDateTime
      if (effectiveDate) {
          const itemDateStr = effectiveDate.split('T')[0];
          if (dateFilterMode === 'date' && filterDate) {
              matchesDate = itemDateStr === filterDate;
          } else if (dateFilterMode === 'month' && filterDate) {
              matchesDate = effectiveDate.startsWith(filterDate);
          } else if (dateFilterMode === 'year' && filterDate) {
              matchesDate = effectiveDate.startsWith(filterDate);
          } else if (dateFilterMode === 'range' && filterDateRange.start && filterDateRange.end) {
              matchesDate = itemDateStr >= filterDateRange.start && itemDateStr <= filterDateRange.end;
          } else if (dateFilterMode === 'week' && filterDate) {
              const itemDate = new Date(itemDateStr);
              const weekStart = new Date(filterDate);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              weekStart.setHours(0,0,0,0);
              weekEnd.setHours(23,59,59,999);
              itemDate.setHours(12,0,0,0);
              matchesDate = itemDate >= weekStart && itemDate <= weekEnd;
          }
      }
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchesStatus = filterStatus === 'all' || item.dealStatus === filterStatus;
      
      let matchesTransport = true;
      if (filterTransport === 'active_only') {
          matchesTransport = 
            item.transportStatus !== 'delivered' && 
            item.transportStatus !== 'completed' && 
            item.transportStatus !== 'issue' && 
            item.transportStatus !== 'cancelled';
      } else {
          matchesTransport = filterTransport === 'all' || item.transportStatus === filterTransport;
      }

      return matchesSearch && matchesDate && matchesCategory && matchesStatus && matchesTransport;
    });

    if (sortConfig.key !== null) {
      items.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (!aValue) aValue = '';
        if (!bValue) bValue = '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
              return sortConfig.direction === 'asc'
                ? aValue.localeCompare(bValue, 'th', { numeric: true })
                : bValue.localeCompare(aValue, 'th', { numeric: true });
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return items;
  }, [allActivities, sortConfig, searchTerm, filterDate, filterDateRange, dateFilterMode, filterCategory, filterStatus, filterTransport]);

  const analyticsData = useMemo(() => {
    // [MODIFIED] Calculate financials ONLY for projects with dealStatus === 'completed'
    // This now checks both the direct value 'completed' AND custom statuses with type 'completed'
    const financialItems = filteredAndSortedActivities.filter(item => {
        // 1. Check if it matches the system default 'completed' value
        if (item.dealStatus === 'completed') return true;
        
        // 2. Check if it matches a custom status that has the type 'completed'
        const statusDef = dealStatuses.find(s => s.value === item.dealStatus);
        if (statusDef && statusDef.type === 'completed') return true;
        
        return false;
    });

    const currentRevenue = financialItems.reduce((sum, item) => sum + (item.wage || 0), 0);
    
    const currentSupport = financialItems.reduce((sum, item) => {
        const itemSupport = item.customerSupport ? item.customerSupport.reduce((s, e) => s + (parseFloat(e.price) || 0), 0) : 0;
        return sum + itemSupport;
    }, 0);

    const currentCost = financialItems.reduce((sum, item) => {
        const itemCost = item.expenses ? item.expenses.reduce((s, e) => s + (parseFloat(e.price) || 0), 0) : 0;
        return sum + itemCost;
    }, 0);
    
    const currentProfit = currentRevenue - currentCost; 

    // Counts remain based on ALL filtered items (as requested)
    const totalProjects = filteredAndSortedActivities.length;
    const completedProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'confirmed' && a.transportStatus === 'delivered').length;
    const activeProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'confirmed' && a.transportStatus !== 'delivered' && a.transportStatus !== 'issue').length;
    const pendingProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'pending').length;
    const issueProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'cancelled' || a.transportStatus === 'issue').length;
    const declinedProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'declined').length;
    
    // Expense Breakdown (Financial -> Use financialItems)
    const expenseBreakdown = {};
    financialItems.forEach(item => {
        if (item.expenses) {
        item.expenses.forEach(ex => {
            if (ex.category) {
            expenseBreakdown[ex.category] = (expenseBreakdown[ex.category] || 0) + parseFloat(ex.price);
            }
        });
        }
    });
    const allExpensesList = Object.entries(expenseBreakdown)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
    const maxExpense = Math.max(...allExpensesList.map(e => e.amount), 1);
    
    // Artist Revenue (Financial -> Use financialItems)
    const artistRevenue = {};
    financialItems.forEach(item => {
        const name = item.artist || 'Unknown';
        artistRevenue[name] = (artistRevenue[name] || 0) + (item.wage || 0);
    });
    const topPerformers = Object.entries(artistRevenue)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
    const maxPerformerRevenue = Math.max(...topPerformers.map(p => p.amount), 1);
    
    // Customer Revenue (Financial -> Use financialItems)
    const customerRevenue = {};
    financialItems.forEach(item => {
        const name = item.customer || 'Unknown';
        customerRevenue[name] = (customerRevenue[name] || 0) + (item.wage || 0);
    });
    const topCustomers = Object.entries(customerRevenue)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
    const maxCustomerRevenue = Math.max(...topCustomers.map(p => p.amount), 1);
    
    // Customer Project Counts (Count -> Use filteredAndSortedActivities)
    const customerProjectCounts = {};
    filteredAndSortedActivities.forEach(item => {
        if (item.dealStatus !== 'cancelled' && item.transportStatus !== 'issue') {
            const name = item.customer || 'Unknown';
            customerProjectCounts[name] = (customerProjectCounts[name] || 0) + 1;
        }
    });
    const topCustomerByProjects = Object.entries(customerProjectCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    const maxCustomerProjectCount = Math.max(...topCustomerByProjects.map(p => p.count), 1);

    // Category Stats (Count -> Use filteredAndSortedActivities)
    const categoryStats = {};
    filteredAndSortedActivities.forEach(item => {
        categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
    });
    const categoryData = Object.entries(categoryStats).map(([name, count]) => ({ name, count }));

    return {
        currentRevenue, currentSupport, currentCost, currentProfit,
        totalProjects, completedProjects, activeProjects, pendingProjects, issueProjects, declinedProjects,
        allExpensesList, maxExpense,
        topPerformers, maxPerformerRevenue,
        topCustomers, maxCustomerRevenue,
        topCustomerByProjects, maxCustomerProjectCount,
        categoryData
    };
  }, [filteredAndSortedActivities, dealStatuses]); // [FIXED] Added dealStatuses to dependency array

    // Sync scroll on mobile window scroll
  useEffect(() => {
    const handleWindowScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      tabScrollPositions.current[activeTab] = scrollTop;
      const sentinel = filterSentinelsRef.current[activeTab];
      let shouldBeScrolled = false;
      if (sentinel && sentinel.getClientRects().length > 0 && headerRef.current) {
        const sentinelRect = sentinel.getBoundingClientRect();
        const headerBottom = headerRef.current.getBoundingClientRect().bottom;
        const marginOffset = window.innerWidth < 768 ? 8 : 12;
        shouldBeScrolled = sentinelRect.top <= headerBottom - marginOffset + 1;
      }
      if (isScrolledRef.current !== shouldBeScrolled) {
        isScrolledRef.current = shouldBeScrolled;
        setIsScrolled(shouldBeScrolled);
      }

      if (activeTab === 'Plans' || activeTab === 'Analytics') {
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;
        if (scrollTop + clientHeight >= scrollHeight - 150) {
          if (visibleCount < filteredAndSortedActivities.length && !isLoadingMore) {
            setIsLoadingMore(true);
            setTimeout(() => {
              setVisibleCount(prev => prev + 5);
              setIsLoadingMore(false);
            }, 1000);
          }
        }
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleWindowScroll);
    };
  }, [activeTab, visibleCount, filteredAndSortedActivities.length, isLoadingMore]);

  const getDealType = (val) => dealStatuses.find(s => s.value === val)?.type || 'pending';
  const getTransportType = (val) => transportStatuses.find(s => s.value === val)?.type || 'pending';



  const resetFilters = () => {
    setSearchTerm('');
    setDateFilterMode('all');
    setFilterDate('');
    setFilterDateRange({ start: '', end: '' });
    setFilterCategory('all');
    setFilterStatus('all');
    setFilterTransport('all');
  };

  const stats = useMemo(() => {
    const total = allActivities.length;
    
    const completed = allActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return tType === 'completed' && (dType === 'active' || dType === 'completed');
    }).length;

    const active = allActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return dType === 'active' && tType !== 'completed' && tType !== 'cancelled';
    }).length;

    const pending = allActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        return dType === 'pending';
    }).length;

    const issues = allActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return dType === 'cancelled' || tType === 'cancelled';
    }).length;

    return [
      { title: 'งานทั้งหมด', value: total, change: 'รวมทั้งหมด', isPositive: true, icon: Folder, color: 'text-indigo-600', bg: 'bg-indigo-50', onClick: resetFilters },
      { title: 'งานเสร็จสิ้น', value: completed, change: 'ปิดจ๊อบแล้ว', isPositive: true, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => { setFilterStatus('confirmed'); setFilterTransport('delivered'); } },
      { title: 'กำลังดำเนินการ', value: active, change: 'Active Now', isPositive: true, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => { setFilterStatus('confirmed'); setFilterTransport('active_only'); } },
      { title: 'ยกเลิก/มีปัญหา', value: issues, change: 'ต้องตรวจสอบ', isPositive: false, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', onClick: () => { setFilterStatus('cancelled'); setFilterTransport('all'); } },
    ];
  }, [allActivities, dealStatuses, transportStatuses]);

  const closeModal = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setIsAddModalOpen(false);
      setIsModalClosing(false);
    }, 300); 
  };

  const closeDeleteModal = () => {
    setIsDeleteClosing(true);
    setTimeout(() => {
      setDeleteConfirm({ ...deleteConfirm, show: false });
      setIsDeleteClosing(false);
    }, 300);
  };

  const handleCustomerChange = (e) => {
    const value = e.target.value;
    setCustomerName(value);
    const existingCustomer = savedCustomers.find(c => c.name === value);
    if (existingCustomer) {
      setCustomerSocial(existingCustomer.social || '');
      setCustomerLine(existingCustomer.line || '');
      setCustomerPhone(formatPhoneNumber(existingCustomer.phone || '')); // [MODIFIED] Format phone
      setCustomerEmail(existingCustomer.email || '');
      setCustomerTaxId(existingCustomer.taxId || '');
      setCustomerAddress(existingCustomer.address || ''); 
    }
  };

  const handleRecipientChange = (e) => {
    const value = e.target.value;
    setRecipientName(value);
    const existingRecipient = savedRecipients.find(r => r.name === value);
    if (existingRecipient) {
      setRecipientPhone(formatPhoneNumber(existingRecipient.phone || '')); // [MODIFIED] Format phone
    }
  };

  const openModal = (activity = null, viewOnly = false) => {
    setViewOnlyMode(viewOnly);

    if (activity) {
      setEditingId(activity.id);
      setCurrentId(activity.id);
      setProjectName(activity.name);
      setProjectCategory(activity.category);
      setProjectDateTime(activity.rawDateTime || '');
      setPaymentDate(activity.paymentDate || ''); // [ADDED]
      setArtistName(activity.artist);
      setCustomerName(activity.customer);
      if (activity.customerInfo) {
        setCustomerSocial(activity.customerInfo.social || '');
        setCustomerLine(activity.customerInfo.line || '');
        setCustomerPhone(formatPhoneNumber(activity.customerInfo.phone || '')); // [MODIFIED] Format phone
        setCustomerEmail(activity.customerInfo.email || '');
        setCustomerTaxId(activity.customerInfo.taxId || '');
        setCustomerAddress(activity.customerInfo.address || ''); 
      } else {
        setCustomerSocial('');
        setCustomerLine('');
        setCustomerPhone('');
        setCustomerEmail('');
        setCustomerTaxId('');
        setCustomerAddress(''); 
      }
      setDeliveryStart(activity.rawDeliveryStart || '');
      setDeliveryEnd(activity.rawDeliveryEnd || activity.rawDeliveryDateTime || '');

      setRecipientName(activity.recipient || '');
      setRecipientPhone(formatPhoneNumber(activity.recipientPhone || '')); // [MODIFIED] Format phone
      setLocationName(activity.location || '');
      setMapLink(activity.mapLink || '');
      setUploadedImage(activity.image || null); 
      setUploadedSlips(Array.isArray(activity.slips) ? activity.slips : (activity.slip ? [activity.slip] : [])); 
      
      if (activity.quotationItems && activity.quotationItems.length > 0) {
          // [MODIFIED] Map existing items to include quantity, unitPrice, and item date
          const fallbackDate = activity.paymentDate || activity.rawDateTime || getNowDateString();
          const loadedItems = activity.quotationItems.map(item => ({
              ...item,
              quantity: item.quantity !== undefined ? item.quantity : 1,
              unitPrice: item.unitPrice !== undefined ? item.unitPrice : (item.price || 0),
              date: item.date || fallbackDate
          }));
          setQuotationItems(loadedItems);
          const totalWage = activity.quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
          setWage(totalWage);
      } else {
          // [MODIFIED] Initialize with quantity and unitPrice and date
          const initialItems = [];
          const fallbackDate = activity.paymentDate || activity.rawDateTime || getNowDateString();
          if (activity.wage > 0) initialItems.push({ category: 'ค่าบริการ/อุปกรณ์', detail: 'ค่าจ้างเดิม', quantity: 1, unitPrice: activity.wage, price: activity.wage, date: fallbackDate });
          if (activity.deliveryFee > 0) initialItems.push({ category: 'ค่าจัดส่ง', detail: 'ค่าส่งเดิม', quantity: 1, unitPrice: activity.deliveryFee, price: activity.deliveryFee, date: fallbackDate });
          
          if (initialItems.length === 0) initialItems.push({ category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: fallbackDate });
          setQuotationItems(initialItems);
          setWage(activity.wage || 0);
      }

      if (activity.customerSupport && activity.customerSupport.length > 0) {
          const fallbackDate = activity.paymentDate || activity.rawDateTime || getNowDateString();
          const mappedSupport = activity.customerSupport.map(item => {
              if (item.denomination !== undefined) return { ...item, date: item.date || fallbackDate };
              return { denomination: 1, quantity: item.price, price: item.price, date: item.date || fallbackDate }; 
          });
          setCustomerSupportItems(mappedSupport);
      } else {
          setCustomerSupportItems([{ denomination: 20, quantity: 0, price: 0, date: getNowDateString() }]);
      }

      // [MODIFIED] Load Expenses with quantity check and date
      if (activity.expenses && activity.expenses.length > 0) {
          const fallbackDate = activity.paymentDate || activity.rawDateTime || getNowDateString();
          const loadedExpenses = activity.expenses.map(item => ({
              ...item,
              quantity: item.quantity !== undefined ? item.quantity : 1,
              unitPrice: item.unitPrice !== undefined ? item.unitPrice : (item.price || 0),
              date: item.date || fallbackDate
          }));
          setExpenses(loadedExpenses);
      } else {
          setExpenses([{ category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: getNowDateString() }]);
      }

      setNote(activity.note || '');
      setDealStatus(activity.dealStatus);
      setTransportStatus(activity.transportStatus);
      setPaymentStatus(activity.paymentStatus || (activity.dealStatus === 'completed' ? 'paid' : 'unpaid'));
      setDepositAmount(activity.depositAmount || 0);
    } else {
      setEditingId(null);
      let nextIdNumber = 1; 
      if (allActivities.length > 0) {
        const ids = allActivities.map(item => {
          const match = item.id.match(/\d+/); 
          return match ? parseInt(match[0]) : 0;
        });
        const maxId = Math.max(...ids);
        if (maxId > 0) nextIdNumber = maxId + 1;
      }
      setCurrentId(`P-${String(nextIdNumber).padStart(4, '0')}`);
      setProjectName('');
      setProjectCategory(projectCategories[0] || '');
      const now = new Date();
      const localIsoString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      const todayDateStr = getNowDateString();
      setProjectDateTime(localIsoString);
      setPaymentDate(''); // [ADDED]
      setDeliveryStart('');
      setDeliveryEnd('');
      setArtistName('');
      setCustomerName('');
      setCustomerSocial('');
      setCustomerLine('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerTaxId('');
      setCustomerAddress(''); 
      setRecipientName('');
      setRecipientPhone('');
      setLocationName('');
      setMapLink('');
      setUploadedImage(null);
      setUploadedSlips([]);
      setNote('');
      setWage(0);
      setDeliveryFee(0); 
      setExpenses([{ category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: todayDateStr }]); // [MODIFIED] Init
      setQuotationItems([{ category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: todayDateStr }]); // [MODIFIED] Init
      setCustomerSupportItems([{ denomination: 1000, quantity: 0, price: 0, date: todayDateStr }]); 
      setPaymentStatus('unpaid');
      setDepositAmount(0); 
      setDealStatus(dealStatuses.length > 0 ? dealStatuses[0].value : ''); 
      setTransportStatus(transportStatuses.length > 0 ? transportStatuses[0].value : '');
    }
    setIsAddModalOpen(true);
  };

  const handleSaveProject = async () => {
    setIsSaving(true); 
    
    if (customerName) {
      const newCustomerData = {
        name: customerName,
        social: customerSocial,
        line: customerLine,
        phone: customerPhone,
        email: customerEmail,
        taxId: customerTaxId,
        address: customerAddress 
      };
      const existingCustomerIndex = savedCustomers.findIndex(c => c.name === customerName);
      if (existingCustomerIndex === -1) {
        setSavedCustomers([...savedCustomers, newCustomerData]);
      }
    }

    const displayDate = formatDate(projectDateTime);
    const displayDeliveryDate = deliveryStart && deliveryEnd
        ? `${formatDate(deliveryStart)} - ${formatDate(deliveryEnd)}`
        : deliveryEnd ? formatDate(deliveryEnd) : '-';

    const totalQuotation = quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

    // [ADDED] Logic ป้องกัน ID ชนกัน และป้องกันเซฟทับของที่ถูกลบไปแล้ว
    let finalId = currentId;

    if (GOOGLE_SCRIPT_URL) {
        try {
            // โหลดข้อมูลล่าสุดสดๆ ร้อนๆ เสี้ยววินาทีก่อนบันทึก
            const res = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'read' })
            });
            const latestData = await res.json();

            if (latestData.status === 'success') {
                const latestActivities = latestData.data;

                if (!editingId) {
                    // กรณีสร้างใหม่: คำนวณ ID ใหม่ล่าสุดจากฐานข้อมูลจริง เพื่อป้องกัน 2 คนกด Add พร้อมกัน
                    const ids = latestActivities.map(item => {
                        if(!item.id) return 0;
                        const match = item.id.match(/\d+/); 
                        return match ? parseInt(match[0]) : 0;
                    });
                    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
                    finalId = `P-${String(maxId + 1).padStart(4, '0')}`;
                } else {
                    // กรณีแก้ไข: เช็คว่างานนี้ยังอยู่ในระบบไหม (โดนคนอื่นลบไปตัดหน้าหรือเปล่า)
                    const stillExists = latestActivities.some(item => item.id === editingId);
                    if (!stillExists) {
                        showToast("ไม่สามารถบันทึกได้: รายการนี้ถูกลบไปแล้วโดยผู้ใช้อื่น", "error");
                        setIsSaving(false);
                        return; // ยกเลิกการเซฟ
                    }
                }
            }
        } catch (e) {
            console.warn("ไม่สามารถตรวจสอบการชนกันของข้อมูลได้ ทำการบันทึกตามปกติ", e);
        }
    }

    const activityData = {
      id: finalId, // [MODIFIED] ใช้ finalId ที่ผ่านการตรวจสอบแล้วว่าไม่ชนแน่นอน
      name: projectName || 'งานใหม่ (ไม่ได้ระบุชื่อ)',
      category: projectCategory,
      artist: artistName || '-',
      customer: customerName || '-',
      customerInfo: {
        social: customerSocial,
        line: customerLine,
        phone: customerPhone,
        email: customerEmail,
        taxId: customerTaxId,
        address: customerAddress 
      },
      date: displayDate,
      rawDateTime: projectDateTime,
      paymentDate: paymentDate, // [ADDED]
      paymentStatus: paymentStatus || 'unpaid', // [ADDED]
      depositAmount: parseFloat(depositAmount) || 0, // [ADDED]
      deliveryDate: displayDeliveryDate,
      rawDeliveryStart: deliveryStart,
      rawDeliveryEnd: deliveryEnd,
      rawDeliveryDateTime: deliveryEnd, 
      wage: totalQuotation, 
      deliveryFee: 0, 
      quotationItems: quotationItems, 
      dealStatus: dealStatus,
      transportStatus: transportStatus,
      expenses: expenses,
      customerSupport: customerSupportItems,
      note: note,
      recipient: recipientName,
      recipientPhone: recipientPhone,
      location: locationName,
      mapLink: mapLink,
      image: uploadedImage,
      slips: uploadedSlips
    };

    if (GOOGLE_SCRIPT_URL) {
      try {
        // Upload any base64 slips to Google Drive slips folder if configured
        const slipFolderId = getFolderIdByType('slips');
        let finalSlips = Array.isArray(uploadedSlips) ? [...uploadedSlips] : [];
        if (slipFolderId && finalSlips.length > 0) {
          for (let i = 0; i < finalSlips.length; i++) {
            const itemSlip = finalSlips[i];
            const slipUrl = typeof itemSlip === 'object' ? itemSlip.url : itemSlip;
            if (typeof slipUrl === 'string' && slipUrl.startsWith('data:image')) {
              try {
                const mimeType = slipUrl.split(',')[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
                const rawBase64 = slipUrl.substring(slipUrl.indexOf(',') + 1);
                const fileName = `slip_${activityData.id}_${Date.now()}_${i + 1}.png`;
                const uploadRes = await fetch(GOOGLE_SCRIPT_URL, {
                  method: 'POST',
                  headers: { "Content-Type": "text/plain;charset=utf-8" },
                  body: JSON.stringify({
                    action: 'uploadAsset',
                    data: {
                      folderId: slipFolderId,
                      fileData: rawBase64,
                      fileName: fileName,
                      mimeType: mimeType
                    }
                  })
                });
                const resJson = await uploadRes.json();
                if (resJson.status === 'success' && resJson.url) {
                  const fileLink = resJson.fileId 
                    ? `https://drive.google.com/uc?export=view&id=${resJson.fileId}`
                    : resJson.url;
                  finalSlips[i] = typeof itemSlip === 'object' 
                    ? { ...itemSlip, url: fileLink, fileId: resJson.fileId }
                    : fileLink;
                }
              } catch (slipErr) {
                console.warn("Upload slip to Drive error:", slipErr);
              }
            }
          }
          activityData.slips = finalSlips;
        }

        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { "Content-Type": "text/plain;charset=utf-8" }, // [FIX] เพิ่ม Header
          body: JSON.stringify({ action: 'save', data: activityData })
        });
        const result = await response.json();
        if (result.status === 'success') {
          setAllActivities(prev => {
             const exists = prev.some(item => item.id === activityData.id);
             if (exists) {
                 return prev.map(item => item.id === activityData.id ? activityData : item);
             } else {
                 return [activityData, ...prev];
             }
          });

          setIsSaving(false);
          closeModal();
          showToast("บันทึกข้อมูลสำเร็จเรียบร้อย", 'success');
          fetchProjects(); 
          return;
        } else {
          let displayMsg = result.message;
          if (displayMsg && (displayMsg.includes("DriveApp") || displayMsg.includes("permission") || displayMsg.includes("อนุญาต"))) {
             displayMsg = "สิทธิ์ Google Drive ไม่ถูกต้อง: กรุณาเปิด Apps Script > กด Run ฟังก์ชันเพื่อขอสิทธิ์ (Authorize) > และ Deploy ใหม่อีกครั้ง";
          }
          showToast("ไม่สามารถบันทึกข้อมูลได้: " + displayMsg, 'error');
        }
      } catch (error) {
        showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + error.message, 'error');
      }
    } else {
      if (editingId) {
        setAllActivities(allActivities.map(item => item.id === editingId ? activityData : item));
      } else {
        setAllActivities([activityData, ...allActivities]);
      }
      closeModal();
      showToast("บันทึกข้อมูลสำเร็จ (โหมดออฟไลน์)", 'success');
    }
    setIsSaving(false);
  };
  
  const handleDeleteProject = () => {
    if (editingId) {
      setDeleteConfirm({ show: true, id: editingId, fromModal: true });
    }
  };

  const handleDeleteFromTable = (e, id) => {
    e.stopPropagation();
    setDeleteConfirm({ show: true, id, fromModal: false });
  };

  const executeDelete = async () => {
    if (deleteConfirm.id) {
      setIsSaving(true);

      const itemToDelete = allActivities.find(item => item.id === deleteConfirm.id);
      const imageInfo = itemToDelete ? itemToDelete.image : null;

      if (GOOGLE_SCRIPT_URL) {
         try {
           const response = await fetch(GOOGLE_SCRIPT_URL, {
             method: 'POST',
             headers: { "Content-Type": "text/plain;charset=utf-8" }, // [FIX] เพิ่ม Header
             body: JSON.stringify({ 
                action: 'delete', 
                id: deleteConfirm.id,
                image: imageInfo 
             })
           });
           const result = await response.json();
           if (result.status === 'success') {
             await fetchProjects();
             showToast("ลบข้อมูลเรียบร้อยแล้ว", 'success');
           } else {
             showToast("เกิดข้อผิดพลาดในการลบ: " + result.message, 'error');
           }
         } catch(error) {
            showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + error.message, 'error');
         }
      } else {
        setAllActivities(allActivities.filter(item => item.id !== deleteConfirm.id));
        showToast("ลบข้อมูลเรียบร้อยแล้ว (โหมดออฟไลน์)", 'success');
      }
      
      closeDeleteModal();
      if (deleteConfirm.fromModal) {
        closeModal();
      }
      setIsSaving(false);
    }
  };

  const handleEditFromTable = (e, item) => {
    e.stopPropagation();
    openModal(item, false);
  };

  const handleAddExpense = () => {
    setExpenses([...expenses, { category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: getNowDateString() }]); // [MODIFIED] Add with qty and date
  };

  const handleRemoveExpense = (index) => {
    const newExpenses = expenses.filter((_, i) => i !== index);
    setExpenses(newExpenses);
  };

  const handleExpenseChange = (index, field, value) => {
    const newExpenses = [...expenses];
    const item = { ...newExpenses[index] };

    // [MODIFIED] Handle Quantity, Unit Price, and Date changes
    if (field === 'category') item.category = value;
    if (field === 'detail') item.detail = value;
    if (field === 'date') item.date = value;
    
    if (field === 'quantity') {
        const qty = parseFloat(value) || 0;
        item.quantity = qty;
        // Recalculate total price
        item.price = qty * (parseFloat(item.unitPrice) || 0);
    }
    
    if (field === 'unitPrice') {
        const uPrice = parseFloat(value) || 0;
        item.unitPrice = uPrice;
        // Recalculate total price
        item.price = (parseFloat(item.quantity) || 1) * uPrice;
    }

    newExpenses[index] = item;
    setExpenses(newExpenses);
  };

  const handleAddQuotationItem = () => {
    setQuotationItems([...quotationItems, { category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: getNowDateString() }]); // [MODIFIED] Add with qty and date
  };

  const handleRemoveQuotationItem = (index) => {
    const newItems = quotationItems.filter((_, i) => i !== index);
    setQuotationItems(newItems);
  };

  const handleQuotationItemChange = (index, field, value) => {
    const newItems = [...quotationItems];
    const item = { ...newItems[index] };

    // [MODIFIED] Handle Quantity, Unit Price, and Date changes
    if (field === 'category') item.category = value;
    if (field === 'detail') item.detail = value;
    if (field === 'date') item.date = value;

    if (field === 'quantity') {
        const qty = parseFloat(value) || 0;
        item.quantity = qty;
        item.price = qty * (parseFloat(item.unitPrice) || 0);
    }
    
    if (field === 'unitPrice') {
        const uPrice = parseFloat(value) || 0;
        item.unitPrice = uPrice;
        item.price = (parseFloat(item.quantity) || 1) * uPrice;
    }

    newItems[index] = item;
    setQuotationItems(newItems);
  };

  const handleSupportItemChange = (index, field, value) => {
    const newItems = [...customerSupportItems];
    const item = { ...newItems[index] };

    if (field === 'denomination') {
        item.denomination = parseFloat(value) || 0;
        item.price = item.denomination * (parseFloat(item.quantity) || 0);
    } else if (field === 'quantity') {
        item.quantity = parseFloat(value) || 0;
        item.price = (parseFloat(item.denomination) || 0) * item.quantity;
    } else if (field === 'price') {
        item.price = parseFloat(value) || 0;
        if (item.denomination > 0) {
             const qty = item.price / item.denomination;
             item.quantity = Number.isInteger(qty) ? qty : parseFloat(qty.toFixed(2));
        }
    } else if (field === 'detail') {
        // [ADDED] รองรับการแก้ไขค่าในฟิลด์รายละเอียด
        item.detail = value;
    } else if (field === 'date') {
        item.date = value;
    }

    newItems[index] = item;
    setCustomerSupportItems(newItems);
  };

  const handleAddSupportItem = () => {
    setCustomerSupportItems([...customerSupportItems, { denomination: 1000, quantity: 1, price: 1000, date: getNowDateString() }]);
  };

  const handleRemoveSupportItem = (index) => {
    const newItems = customerSupportItems.filter((_, i) => i !== index);
    setCustomerSupportItems(newItems);
  };

  // [REMOVED] handleSendToChatbot function as requested

  const renderTable = (limit = 0, customData = null) => {
    const sourceData = customData || filteredAndSortedActivities;
    const displayLimit = limit > 0 ? limit : visibleCount;
    const items = sourceData.slice(0, displayLimit);

    // [ADDED] Helper to get dot color based on status color class (Consistent with Settings)
    const getStatusDotColor = (info) => {
        if (!info || !info.color) return 'bg-slate-400';
        
        // 1. Try to find exact match in presets (for custom statuses added via Settings)
        const preset = colorPresets.find(p => p.value === info.color);
        if (preset) return preset.dot;

        // 2. Heuristic match for system defaults or manual colors
        if (info.color.includes('emerald') || info.color.includes('green')) return 'bg-emerald-500';
        if (info.color.includes('blue') || info.color.includes('indigo') || info.color.includes('sky')) return 'bg-blue-500';
        if (info.color.includes('amber') || info.color.includes('yellow') || info.color.includes('orange')) return 'bg-amber-500';
        if (info.color.includes('rose') || info.color.includes('red') || info.color.includes('pink')) return 'bg-rose-500';
        if (info.color.includes('purple') || info.color.includes('violet')) return 'bg-violet-500';
        
        return 'bg-slate-400';
    };

    return (
      <div className="w-full">
        {/* Mobile View (Card Layout) - Restored */}
        <div className="md:hidden flex flex-col gap-4 p-2">
          {items.map((item, i) => {
            const itemExpenses = item.expenses ? item.expenses.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0) : 0;
            const itemProfit = (item.wage || 0) - itemExpenses;
            const itemSupport = item.customerSupport ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) : 0;
            const itemReceivable = (item.wage || 0) + itemSupport;

            const dealStatusInfo = getDealStatusInfo(item.dealStatus);
            const transportStatusInfo = getTransportStatusInfo(item.transportStatus);
            const animDelay = (i % 20) * 80;

            return (
              <div 
                key={item.id} 
                onClick={() => openModal(item, true)}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 relative overflow-hidden space-row-animation"
                style={{ animationDelay: `${animDelay}ms` }}
              >
                <div className="flex justify-between items-start">
                   <div className="flex flex-col gap-2">
                      <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg text-sm w-fit shadow-sm border border-indigo-100">{item.id}</span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5" /> {item.date}
                      </div>
                      {item.paymentDate && (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold whitespace-nowrap mt-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          <Wallet className="w-3 h-3" /> จ่าย: {formatDate(item.paymentDate).split(' ')[0]}
                        </div>
                      )}
                   </div>
                   <div className="flex flex-col gap-1.5 items-end">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${dealStatusInfo.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(dealStatusInfo)}`}></span>
                          {dealStatusInfo.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${transportStatusInfo.color}`}>
                          <Truck className="w-3 h-3" />
                          {transportStatusInfo.label}
                        </span>
                   </div>
                </div>
                <div className="h-px bg-slate-100 w-full" />
                <div className="flex flex-col gap-1 mb-2">
                    <h3 className="text-xl font-black text-slate-800 leading-tight">{item.name}</h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-bold border border-slate-200 w-fit flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {item.category}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700 text-sm font-bold">
                                <User className="w-4 h-4 text-indigo-500" /> {item.artist}
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs pl-5">
                                <Briefcase className="w-3 h-3" /> {item.customer}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-start gap-1.5 text-slate-700 text-sm font-bold">
                                <Clock className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" /> 
                                <div className="whitespace-nowrap">{renderDeliveryTime(item)}</div>
                            </div>
                            <div className="flex items-start gap-1.5 text-slate-500 text-xs pl-0.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" /> 
                                {item.mapLink ? (
                                    <a 
                                        href={item.mapLink} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-blue-600 hover:underline line-clamp-2 leading-tight"
                                    >
                                        {item.location || '-'}
                                    </a>
                                ) : (
                                    <span className="line-clamp-2 leading-tight">{item.location || '-'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {(item.recipient || item.recipientPhone) && (
                    <div className="flex justify-between items-start gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex flex-col min-w-0">
                           <div className="flex gap-1">
                               <span className="font-bold text-slate-700 shrink-0">ผู้รับ:</span>
                               <span className="font-medium line-clamp-2 leading-snug break-words">
                                   {item.recipient || '-'}
                               </span>
                           </div>
                        </div>
                        {item.recipientPhone && (
                            <a 
                                href={`tel:${item.recipientPhone}`} 
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-indigo-600 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-colors whitespace-nowrap shrink-0 ml-1"
                            >
                                <Phone className="w-3.5 h-3.5" />
                                <span className="font-bold text-xs">{item.recipientPhone}</span>
                            </a>
                        )}
                    </div>
                )}
                <div className="bg-slate-50 rounded-xl p-3">
                   <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                      <span className="text-xs text-slate-700 font-bold flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> ยอดเรียกเก็บ
                      </span>
                      <span className="text-sm text-indigo-700 font-black">฿{itemReceivable.toLocaleString()}</span>
                   </div>
                   {itemSupport > 0 && (
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-slate-500">เงินศิลปิน (สนับสนุน)</span>
                          <span className="text-xs text-blue-600 font-bold flex items-center gap-1">+ {itemSupport.toLocaleString()}</span>
                       </div>
                   )}
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-500">รายได้ (ค่าจ้าง)</span>
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> {item.wage.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2">
                      <span className="text-xs text-slate-500">ค่าใช้จ่าย</span>
                      <span className="text-xs text-rose-500 font-bold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> {itemExpenses.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">กำไรสุทธิ</span>
                      <span className={`text-sm font-bold ${itemProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {itemProfit >= 0 ? '+' : ''}{itemProfit.toLocaleString()}
                      </span>
                   </div>
                </div>
                {item.note && (
                  <div className="text-xs text-slate-500 bg-yellow-50/50 p-2 rounded-lg border border-yellow-100">
                    <span className="font-bold text-yellow-600 mr-1">หมายเหตุ:</span> {item.note}
                  </div>
                )}
                {/* [MODIFIED] Mobile Action Buttons - Chatbot Button Removed */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                    <button 
                        onClick={(e) => handleDeleteFromTable(e, item.id)} 
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 border border-rose-100 text-rose-600 font-bold hover:bg-rose-100 rounded-xl transition shadow-sm"
                        title="ลบรายการ"
                    >
                        <Trash2 className="w-4 h-4" /> 
                    </button>
                    <button 
                        onClick={(e) => handleEditFromTable(e, item)} 
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Edit className="w-4 h-4" /> แก้ไข
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShareData(item); }} 
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl transition-colors shadow-sm"
                        title="แชร์ให้ลูกค้า"
                    >
                        <Share2 className="w-4 h-4" /> แชร์
                    </button>
                </div>
              </div>
            );
          })}
          {limit === 0 && isLoadingMore && (
             <div className="flex flex-col items-center justify-center py-8 gap-3 opacity-100 transition-opacity duration-300">
                 <div className="p-3 bg-white rounded-full shadow-md border border-slate-100 animate-bounce">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                 </div>
                 <span className="text-xs text-slate-500 font-bold animate-pulse">กำลังโหลดข้อมูลเพิ่มเติม...</span>
             </div>
          )}
        </div>

        <div className="hidden md:block">
            {/* Desktop Table Container with responsive constraints */}
            <div className="overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar">
              {/* [MODIFIED] Removed max-w constraint to let table grow with screen */}
              <div className="min-w-fit w-full">
                {/* [MODIFIED] Changed table-fixed to table-auto for better content adaptation */}
                <table className="w-full min-w-[1280px] table-auto">
                  <thead>
                    <tr className="text-slate-400 text-sm font-semibold border-b border-slate-50">
                      {/* [MODIFIED] Adjusted widths to be relative/min-width for table-auto */}
                      <SortableHeader className="w-[12%] min-w-[120px]" label="รหัส / วันที่" sortKey="id" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[18%] min-w-[200px]" label="โปรเจค / หมวดหมู่" sortKey="name" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[12%] min-w-[150px]" label="ศิลปิน / ลูกค้า" sortKey="artist" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[12%] min-w-[150px]" label="ผู้รับ / เบอร์โทร" sortKey="recipient" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[14%] min-w-[180px]" label="กำหนดส่ง / สถานที่" sortKey="rawDeliveryDateTime" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[10%] min-w-[120px]" label="สถานะ" sortKey="dealStatus" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[10%] min-w-[100px]" label="การเงิน (บาท)" sortKey="wage" alignRight sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[8%] min-w-[100px]" label="หมายเหตุ" sortKey="note" sortConfig={sortConfig} handleSort={handleSort} />
                      <th className="w-[8%] min-w-[100px] px-2 py-4 font-medium text-right whitespace-nowrap">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((item, i) => {
                      const itemExpenses = item.expenses ? item.expenses.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0) : 0;
                      const itemProfit = (item.wage || 0) - itemExpenses;
                      const itemSupport = item.customerSupport ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) : 0;
                      const itemReceivable = (item.wage || 0) + itemSupport;

                      const dealStatusInfo = getDealStatusInfo(item.dealStatus);
                      const transportStatusInfo = getTransportStatusInfo(item.transportStatus);
                      const animDelay = (i % 20) * 50; 

                      return (
                        <tr
                          key={item.id}
                          onClick={() => openModal(item, true)}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer space-row-animation"
                          style={{ animationDelay: `${animDelay}ms` }}
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs w-fit whitespace-nowrap">{item.id}</span>
                              {/* [MODIFIED] Date: whitespace-nowrap to prevent truncation */}
                              <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 whitespace-nowrap">
                                <Clock className="w-3 h-3 shrink-0" />
                                {item.date}
                              </div>
                              {item.paymentDate && (
                                <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] mt-1 whitespace-nowrap font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit">
                                  <Wallet className="w-3 h-3 shrink-0" />
                                  จ่าย: {formatDate(item.paymentDate).split(' ')[0]}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1 w-full">
                              {/* [MODIFIED] Project Name: whitespace-normal break-words to wrap text */}
                              <span className="font-bold text-slate-800 text-sm whitespace-normal break-words leading-tight" title={item.name}>{item.name}</span>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                                <Tag className="w-3 h-3 shrink-0" />
                                {item.category}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1.5 w-full">
                              <div className="flex items-center gap-2 whitespace-normal break-words">
                                <User className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="text-sm font-semibold text-slate-700">{item.artist}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-normal break-words">
                                <Briefcase className="w-3 h-3 shrink-0" />
                                <span>{item.customer}</span>
                              </div>
                            </div>
                          </td>
                          {/* [MODIFIED] Recipient Column: Allow wrapping */}
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1 w-full">
                              <div className="text-sm font-medium text-slate-700 whitespace-normal break-words" title={item.recipient || '-'}>{item.recipient || '-'}</div>
                              {item.recipientPhone && (
                                <a 
                                  href={`tel:${item.recipientPhone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 hover:underline transition-colors w-fit whitespace-nowrap"
                                >
                                  <Phone className="w-3 h-3 shrink-0" />
                                  {item.recipientPhone}
                                </a>
                              )}
                            </div>
                          </td>
                          {/* [MODIFIED] Delivery Column: Prevent wrapping for time, allow wrapping for location */}
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center gap-1.5 text-slate-700 text-sm font-medium whitespace-nowrap">
                                <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                <div>{renderDeliveryTime(item)}</div>
                              </div>
                              <div className="flex items-start gap-1.5 text-xs text-slate-500">
                                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                {item.mapLink ? (
                                  <a 
                                    href={item.mapLink} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()} 
                                    className="text-blue-600 hover:underline whitespace-normal break-words w-full leading-tight"
                                    title={item.location}
                                  >
                                    {item.location || '-'}
                                  </a>
                                ) : (
                                  <span className="whitespace-normal break-words w-full leading-tight" title={item.location}>{item.location || '-'}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-2 items-start w-full">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border w-full max-w-[140px] truncate ${dealStatusInfo.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(dealStatusInfo)}`}></span>
                                <span className="truncate">{dealStatusInfo.label}</span>
                              </span>
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border w-full max-w-[140px] truncate ${transportStatusInfo.color}`}>
                                <Truck className="w-3 h-3 shrink-0" />
                                <span className="truncate">{transportStatusInfo.label}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                              <div className="flex flex-col gap-1 items-end w-full">
                                <span className="text-sm font-black text-slate-800 whitespace-nowrap" title="ยอดเรียกเก็บสุทธิ">
                                  ฿{itemReceivable.toLocaleString()}
                                </span>
                                <div className="text-xs text-slate-400 flex gap-1 items-center justify-end w-full whitespace-nowrap">
                                    {itemSupport > 0 && <span className="text-blue-500" title="เงินศิลปิน (สนับสนุน)">+{itemSupport.toLocaleString()}</span>}
                                    <span className="text-emerald-600" title="รายได้ (ค่าจ้าง)">{item.wage.toLocaleString()}</span>
                                </div>
                                <span className="text-xs text-rose-500 font-medium flex items-center justify-end gap-1 w-full whitespace-nowrap" title="ค่าใช้จ่าย">
                                  <TrendingDown className="w-3 h-3 shrink-0" /> -{itemExpenses.toLocaleString()}
                                </span>
                                <span className={`text-xs font-bold ${itemProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'} border-t border-slate-100 pt-1 mt-1 w-full text-right whitespace-nowrap`} title="กำไรสุทธิ">
                                  {itemProfit >= 0 ? '+' : ''}{itemProfit.toLocaleString()}
                                </span>
                              </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                              <div className="text-sm text-slate-600 whitespace-normal break-words line-clamp-3" title={item.note}>
                                {item.note || '-'}
                              </div>
                          </td>
                          <td className="px-2 py-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setShareData(item); }}
                                className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 rounded-lg transition shadow-sm"
                                title="แชร์"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleEditFromTable(e, item)}
                                className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition shadow-sm"
                                title="แก้ไข"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteFromTable(e, item.id)}
                                className="p-2 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-lg transition shadow-sm"
                                title="ลบรายการ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {limit === 0 && isLoadingMore && (
               <div className="w-full py-8 text-center border-t border-slate-50 bg-slate-50/30 animate-in fade-in slide-in-from-bottom-2">
                   <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-2 bg-white rounded-full shadow-sm border border-slate-200">
                          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      </div>
                      <span className="text-xs text-slate-500 font-bold animate-pulse">กำลังโหลดข้อมูลเพิ่มเติม...</span>
                   </div>
               </div>
            )}
        </div>
      </div>
    );
  };
  
  const renderFilterCard = (tabKey = activeTab) => (
    <>
      <div
        ref={(el) => {
          if (el) filterSentinelsRef.current[tabKey] = el;
        }}
        className="h-px w-full pointer-events-none opacity-0 -mb-px"
      />
      <div
        className={`sticky top-[calc(56px+env(safe-area-inset-top,0px))] md:top-0 z-40 bg-white transition-all duration-200 ease-in-out
          ${isScrolled
            ? 'mx-0 mt-0 py-2.5 sm:py-3 px-4 sm:px-8 lg:px-10 border-b border-slate-100 shadow-sm rounded-b-[2rem] sm:rounded-b-3xl rounded-t-none mb-4'
            : 'mx-4 sm:mx-8 lg:mx-10 mt-2 sm:mt-3 p-3.5 sm:p-5 rounded-[2rem] sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] mb-4'
          }
        `}
      >
      <div className={`flex items-center gap-2 mb-4 text-indigo-600 font-bold transition-all ${isScrolled ? 'scale-90 origin-left opacity-80 translate-y-1' : ''} hidden md:flex`}>
      </div>
      
      <div className="flex flex-col gap-2.5 md:hidden">
         {/* Row 1: Search + Filter Toggle + Reset */}
         <div className="flex items-center gap-2">
            <div className="relative flex-1 bg-slate-50 border border-slate-200/70 rounded-xl h-10 flex items-center hover:bg-slate-100/60 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Search className="w-4 h-4" />
                </div>
                <input
                    type="text"
                    placeholder="ค้นหา..."
                    className="w-full h-full pl-9 pr-8 bg-transparent outline-none text-slate-700 text-xs sm:text-sm font-medium placeholder:text-slate-400 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                    title="ล้างข้อความค้นหา"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
            </div>

            {/* ปุ่มเปิด/ซ่อนตัวกรอง (Icon Only) */}
            <button
              type="button"
              onClick={() => setIsMobileFilterExpanded(!isMobileFilterExpanded)}
              className={`h-10 w-10 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 active:scale-95 border ${
                isMobileFilterExpanded 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200' 
                  : 'bg-slate-50 text-slate-600 border-slate-200/70 hover:bg-slate-100'
              }`}
              title={isMobileFilterExpanded ? "ซ่อนตัวกรอง" : "เปิดตัวกรองเพิ่มเติม"}
              aria-label="ตัวกรอง"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* ปุ่มรีเซ็ตฟิลเตอร์ */}
            <button
              onClick={resetFilters}
              className="h-10 w-10 bg-slate-50 border border-slate-200/70 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 active:scale-95"
              title="ล้างค่าตัวกรองทั้งหมด"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
         </div>

         {/* แผงฟิลเตอร์เมื่อกดเปิด (Mobile Drawer) */}
         {isMobileFilterExpanded && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 fade-in duration-200">
                {/* 1. Date Filter Control (Full Width) */}
                <div className="w-full h-10">
                    <DateFilterControl 
                        mode={dateFilterMode} setMode={setDateFilterMode}
                        date={filterDate} setDate={setFilterDate}
                        range={filterDateRange} setRange={setFilterDateRange}
                    />
                </div>

                {/* 2. Grid of Dropdowns (2 columns for Category & Deal, full width for Transport) */}
                <div className="grid grid-cols-2 gap-2">
                    {/* หมวดหมู่ */}
                    <div className="relative bg-slate-50 border border-slate-200/70 rounded-xl h-10 flex items-center hover:border-slate-300 transition-colors">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                      <select
                          className="w-full h-full pl-8 pr-6 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none cursor-pointer"
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                      >
                          <option value="all">ทุกหมวดหมู่</option>
                          {projectCategories.map((cat, i) => (
                            <option key={i} value={cat}>{cat}</option>
                          ))}
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* สถานะดีล */}
                    <div className="relative bg-slate-50 border border-slate-200/70 rounded-xl h-10 flex items-center hover:border-slate-300 transition-colors">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      <select
                          className="w-full h-full pl-8 pr-6 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none cursor-pointer"
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                      >
                          <option value="all">ทุกสถานะ (ดีล)</option>
                          {dealStatuses.map((status, i) => (
                            <option key={i} value={status.value}>{status.label}</option>
                          ))}
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* ขนส่ง (เต็มแถว 2 คอลัมน์) */}
                    <div className="col-span-2 relative bg-slate-50 border border-slate-200/70 rounded-xl h-10 flex items-center hover:border-slate-300 transition-colors">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Truck className="w-3.5 h-3.5" />
                      </div>
                      <select
                          className="w-full h-full pl-8 pr-6 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none cursor-pointer"
                          value={filterTransport}
                          onChange={(e) => setFilterTransport(e.target.value)}
                      >
                          <option value="all">ขนส่ง: ทั้งหมด</option>
                          <option value="active_only">กำลังดำเนินการ (Active)</option>
                          {transportStatuses.map((status, i) => (
                            <option key={i} value={status.value}>{status.label}</option>
                          ))}
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>
            </div>
         )}
      </div>
      
      <div className="hidden md:flex flex-col gap-3">
          <div className="flex gap-3 h-[48px]">
              <div className="relative flex-[2] bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <Search className="w-5 h-5" />
                   </div>
                   <input
                        type="text"
                        placeholder="ค้นหาชื่องาน, ศิลปิน, รหัส..."
                        className="w-full h-full pl-12 pr-4 bg-transparent outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400 rounded-2xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                   />
              </div>

              <div className="flex-1 min-w-[300px]">
                   <DateFilterControl 
                        mode={dateFilterMode} setMode={setDateFilterMode}
                        date={filterDate} setDate={setFilterDate}
                        range={filterDateRange} setRange={setFilterDateRange}
                   />
              </div>
          </div>

          <div className="flex gap-3 h-[48px]">
              {/* ... Desktop Filters ... */}
              <div className="relative flex-1 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors"><Tag className="w-4 h-4" /></div>
                   <select
                        className="w-full h-full pl-11 pr-8 bg-transparent outline-none text-slate-700 text-sm font-bold appearance-none cursor-pointer rounded-2xl"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                   >
                        <option value="all">ทุกหมวดหมู่</option>
                        {projectCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                   </select>
                   <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative flex-1 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors"><Briefcase className="w-4 h-4" /></div>
                   <select
                        className="w-full h-full pl-11 pr-8 bg-transparent outline-none text-slate-700 text-sm font-bold appearance-none cursor-pointer rounded-2xl"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                   >
                        <option value="all">ทุกสถานะ (ดีล)</option>
                        {dealStatuses.map((s, i) => <option key={i} value={s.value}>{s.label}</option>)}
                   </select>
                   <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative flex-1 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors"><Truck className="w-4 h-4" /></div>
                   <select
                        className="w-full h-full pl-11 pr-8 bg-transparent outline-none text-slate-700 text-sm font-bold appearance-none cursor-pointer rounded-2xl"
                        value={filterTransport}
                        onChange={(e) => setFilterTransport(e.target.value)}
                   >
                        <option value="all">ขนส่ง (ทั้งหมด)</option>
                        <option value="active_only">กำลังดำเนินการ (Active)</option> {/* Added Option */}
                        {transportStatuses.map((s, i) => <option key={i} value={s.value}>{s.label}</option>)}
                   </select>
                   <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                  onClick={resetFilters}
                  className="px-5 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center justify-center shadow-sm"
                  title="ล้างค่าตัวกรอง"
              >
                  <RotateCcw className="w-5 h-5" />
              </button>
          </div>
      </div>
    </div>
    </>
  );

  const renderContent = () => {
    // 1. ถ้ามี Tracking ID ให้แสดงหน้า Tracking View โดยไม่ต้อง Login
    if (trackingId) {
        // [MODIFIED] Check isSettingsLoaded AND areImagesLoaded to ensure theme & images are ready before text
        // ป้องกันการแสดงผลด้วยสี Indigo ก่อนที่ธีมจะโหลดเสร็จ และป้องกันรูปกระพริบ
        if ((isLoading && allActivities.length === 0) || !isSettingsLoaded || !areImagesLoaded) {
            return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                    <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
                    <p className="text-slate-500 font-bold text-lg animate-pulse">กำลังค้นหาข้อมูลพัสดุ...</p>
                </div>
            );
        }
        
        // [FIX] Match against generated token instead of direct ID for security
        const trackData = allActivities.find(item => 
            generateTrackingToken(item.id, item.rawDateTime) === trackingId
        );
        
        if (!trackData) {
             return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 px-4 text-center">
                    <div className="p-4 bg-slate-200 rounded-full text-slate-500 mb-4">
                       <Search className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">ไม่พบข้อมูลงาน</h2>
                    <p className="text-slate-500 mb-6">รหัสติดตาม: <span className="font-mono font-bold text-indigo-600 break-all">{trackingId}</span> ไม่ถูกต้อง หรือถูกลบไปแล้ว</p>
                    {/* [REMOVED] Back to Home button for security */}
                </div>
             );
        }

        // [MODIFIED] Pass dealStatuses and transportStatuses props
        return <CustomerTrackingView data={trackData} shopInfo={shopInfo} dealStatuses={dealStatuses} transportStatuses={transportStatuses} />;
    }

    // [NEW] Quotation View Logic
    if (quotationId) {
        // [MODIFIED] Check isSettingsLoaded AND areImagesLoaded to ensure theme & images are ready before text
        if ((isLoading && allActivities.length === 0) || !isSettingsLoaded || !areImagesLoaded) {
            return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                    <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
                    <p className="text-slate-500 font-bold text-lg animate-pulse">กำลังโหลดใบเสนอราคา...</p>
                </div>
            );
        }
        
        const quoteData = allActivities.find(item => 
            generateTrackingToken(item.id, item.rawDateTime) === quotationId
        );
        
        if (!quoteData) {
             return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 px-4 text-center">
                    <div className="p-4 bg-slate-200 rounded-full text-slate-500 mb-4">
                       <FileText className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">ไม่พบข้อมูลใบเสนอราคา</h2>
                    <p className="text-slate-500 mb-6">รหัสเอกสาร: <span className="font-mono font-bold text-indigo-600 break-all">{quotationId}</span> ไม่ถูกต้อง หรือถูกลบไปแล้ว</p>
                    {/* [REMOVED] Back to Home button for security */}
                </div>
             );
        }

        // [MODIFIED] Pass dealStatuses prop to resolve labels correctly
        return <CustomerQuotationView data={quoteData} shopInfo={shopInfo} dealStatuses={dealStatuses} />;
    }

    // 2. ถ้าไม่มี Tracking ID ก็เข้า Flow ปกติ (Login -> Dashboard)
    if (!isLoggedIn) {
        // [MODIFIED] Pass shopInfo to LoginScreen
        return <LoginScreen onLogin={handleLogin} isLoading={isLoading} loginError={loginError} shopInfo={shopInfo} />;
    }
    // [MODIFIED] Use isSettingsLoaded to prevent flash of wrong theme
    if ((isLoading && allActivities.length === 0) || !isSettingsLoaded) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] w-full">
            <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
            <p className="text-slate-500 font-bold text-lg animate-pulse">กำลังโหลดข้อมูล...</p>
        </div>
      );
    }
    
    // ... existing no URL check ...
    if (!GOOGLE_SCRIPT_URL) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] w-full px-4 text-center">
            <div className="p-4 bg-amber-50 rounded-full text-amber-500 mb-4">
               <WifiOff className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">ยังไม่ได้เชื่อมต่อฐานข้อมูล</h2>
            <p className="text-slate-500 max-w-md mb-6">
               กรุณานำ URL ที่ได้จากการ Deploy Google Apps Script มาวางในตัวแปร <code>GOOGLE_SCRIPT_URL</code> ในไฟล์ NexusPlan.jsx
            </p>
        </div>
      );
    }

    // [OPTIMIZATION] Destructure Data for Persistent Views
    // เตรียมข้อมูล Analytics ไว้เสมอ (เพราะเราจะ Render ทิ้งไว้แบบ hidden)
    const {
        currentRevenue, currentSupport, currentCost, currentProfit,
        totalProjects, completedProjects, activeProjects, pendingProjects, issueProjects, declinedProjects,
        allExpensesList, maxExpense,
        topPerformers, maxPerformerRevenue,
        topCustomers, maxCustomerRevenue,
        topCustomerByProjects, maxCustomerProjectCount,
        categoryData
    } = analyticsData;

    // [PERFORMANCE FIX] ใช้เทคนิค Persistent Layout (ซ่อน/แสดง) แทนการ Unmount Component เพื่อความลื่นไหลสูงสุด
    return (
      <>
        {/* --- Tab: Calendar --- */}
        <div className={activeTab === 'Calendar' ? 'block h-full' : 'hidden'}>
          <CalendarView 
            activities={allActivities} 
            onEventClick={(item) => openModal(item, true)} 
            dealStatuses={dealStatuses}
            transportStatuses={transportStatuses}
          />
        </div>

        {/* --- Tab 3: Analytics --- */}
        <div className={activeTab === 'Analytics' ? 'block' : 'hidden'}>
          <AnalyticsView
            renderFilterCard={() => renderFilterCard('Analytics')}
            analyticsData={analyticsData}
            dateFilterMode={dateFilterMode}
            resetFilters={resetFilters}
            setFilterStatus={setFilterStatus}
            setFilterTransport={setFilterTransport}
            openModal={openModal}
            renderTable={renderTable}
            filteredAndSortedActivities={filteredAndSortedActivities}
            isActive={activeTab === 'Analytics'}
          />
        </div>

        {/* --- Tab 4: Plans --- */}
        <div className={activeTab === 'Plans' ? 'block' : 'hidden'}>
          <PlansView
            stats={stats}

            renderFilterCard={() => renderFilterCard('Plans')}
            renderTable={renderTable}
            filteredAndSortedActivities={filteredAndSortedActivities}
            onOpenModal={() => openModal()}
          />
        </div>

        {/* --- Tab 5: Finance --- */}
        <div className={activeTab === 'Finance' ? 'block min-h-full pb-24 md:pb-6' : 'hidden'}>
            <FinanceView
                activities={allActivities}
                dealStatuses={dealStatuses}
                transportStatuses={transportStatuses}
                shopInfo={shopInfo}
                onOpenProjectModal={openModal}
                themeColor={shopInfo?.themeColor || 'indigo'}
                dateFilterMode={dateFilterMode}
                setDateFilterMode={setDateFilterMode}
                filterDate={filterDate}
                setFilterDate={setFilterDate}
                filterDateRange={filterDateRange}
                setFilterDateRange={setFilterDateRange}
                isActive={activeTab === 'Finance'}
            />
        </div>

        {/* --- Tab 6: Settings --- */}
        <div className={activeTab === 'Settings' ? 'block' : 'hidden'}>
          <SettingsView
            isSyncingSettings={isSyncingSettings}
            isUploadingProfile={isUploadingProfile}
            handleProfileImageUpload={handleProfileImageUpload}
            userProfile={userProfile}

            requestDeleteProfile={requestDeleteProfile}
            authorizedUsers={authorizedUsers}
            handleDeleteUser={handleDeleteUser}
            isAddingUser={isAddingUser}
            setIsAddingUser={setIsAddingUser}
            newUser={newUser}
            setNewUser={setNewUser}
            handleAddUser={handleAddUser}
            driveFolderId={driveFolderId}
            setDriveFolderId={setDriveFolderId}
            driveFolders={driveFolders}
            setDriveFolders={setDriveFolders}
            saveSystemSettings={saveSystemSettings}
            assetsDriveFolderId={assetsDriveFolderId}
            setAssetsDriveFolderId={setAssetsDriveFolderId}
            lineBotToken={lineBotToken}
            setLineBotToken={setLineBotToken}
            telegramBotToken={telegramBotToken}
            setTelegramBotToken={setTelegramBotToken}
            deployUrl={deployUrl}
            setDeployUrl={setDeployUrl}
            telegramChatId={telegramChatId}
            setTelegramChatId={setTelegramChatId}
            handleFetchTelegramId={handleFetchTelegramId}
            webAppUrl={webAppUrl}
            setWebAppUrl={setWebAppUrl}
            shopInfo={shopInfo}
            setShopInfo={setShopInfo}
            isUploadingLogo={isUploadingLogo}
            handleLogoUpload={handleLogoUpload}
            requestDeleteLogo={requestDeleteLogo}
            isSaving={isSaving}
            themeColors={themeColors}
            projectCategories={projectCategories}
            setProjectCategories={setProjectCategories}
            expenseCategories={expenseCategories}
            setExpenseCategories={setExpenseCategories}
            dealStatuses={dealStatuses}
            setDealStatuses={setDealStatuses}
            transportStatuses={transportStatuses}
            setTransportStatuses={setTransportStatuses}
            handleLogout={handleLogout}
            processImageUrl={processImageUrl}
          />
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#F8FAFC] font-sans text-slate-800 selection:bg-indigo-100 selection:text-indigo-900 md:h-screen md:overflow-hidden">
      
      <style>{`
        @keyframes modalEnter {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); filter: blur(2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }
        @keyframes modalExit {
          0% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(10px); filter: blur(2px); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .modal-animate-in {
          animation: modalEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-animate-out {
          animation: modalExit 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .backdrop-animate-out {
          animation: fadeOut 0.3s forwards;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        /* Fix for Modal Footer to have proper spacing above Safe Area */
        .safe-area-bottom-modal {
          padding-bottom: calc(1rem + env(safe-area-inset-bottom));
        }

        /* --- Space-Themed Staggered Animation (New) --- */
        @keyframes spaceRowEnter {
          0% {
            opacity: 0;
            transform: translateY(20px); /* เลื่อนขึ้นจากด้านล่าง */
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .space-row-animation {
          opacity: 0; /* เริ่มต้นซ่อนไว้เพื่อรอ Animation */
          animation: spaceRowEnter 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; /* ปรับจังหวะให้นุ่มนวล */
          will-change: transform, opacity;
        }
        /* ------------------------------------------------ */
      `}</style>
      
      {/* --- Global Feedback Elements --- */}
      {isSaving && <LoadingOverlay />} 
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      {previewImage && <ImageViewer src={processImageUrl(previewImage)} onClose={() => setPreviewImage(null)} />}
      
      {/* Render SharePreviewModal when shareData exists */}
      {shareData && (
        <SharePreviewModal 
          data={shareData} 
          shopInfo={shopInfo} // [MODIFIED] Pass shopInfo prop to modal
          // [REMOVED] userProfile prop
          onClose={() => setShareData(null)} 
        />
      )}

      {/* --- Desktop Sidebar --- */}
      {/* Only show sidebar if logged in AND NOT in tracking mode */}
      {isLoggedIn && !trackingId && !quotationId && (
        <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300 relative`}>
            {/* ... Sidebar Content ... */}
            <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-slate-400 hover:text-indigo-600 transition-colors z-50"
            >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <div className={`p-6 pb-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            {/* [MODIFIED] Sidebar Logo: Remove shadow and background if logo exists to avoid white box effect */}
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden relative ${shopInfo.logo ? '' : 'bg-indigo-600 shadow-lg shadow-indigo-200'}`}>
                {shopInfo.logo ? (
                    <img 
                        src={processImageUrl(shopInfo.logo)} 
                        alt="App Logo" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => { 
                            e.target.style.display = 'none'; 
                            if(e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                            // If image fails, add background and shadow back
                            e.target.parentElement.classList.add('bg-indigo-600', 'shadow-lg', 'shadow-indigo-200');
                        }}
                    />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${shopInfo.logo ? 'hidden' : 'flex'}`}>
                    <Clipboard className="w-6 h-6 text-white" />
                </div>
            </div>
            {!isSidebarCollapsed && (
                <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight whitespace-nowrap overflow-hidden">
                {shopInfo.shopName || 'ProjectPlan'}
                </h1>
            )}
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => (
                <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-4 px-6'} py-4 text-sm font-bold rounded-[1.2rem] transition-all duration-300 group ${
                    activeTab === item.name
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title={isSidebarCollapsed ? item.label : ''}
                >
                <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === item.name ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
            ))}
            </nav>

            <div className="p-4 border-t border-slate-50">
                <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-4'} cursor-pointer p-2 sm:p-4 rounded-[1.5rem] bg-slate-50 hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 border border-transparent hover:border-slate-100`}>
                {/* [MODIFIED] Profile Image in Sidebar */}
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold ring-4 ring-white shadow-md shrink-0 overflow-hidden">
                    {userProfile?.image ? (
                        <img 
                            src={processImageUrl(userProfile.image)} 
                            alt="Profile" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                    ) : (
                        userProfile?.name?.charAt(0) || 'U'
                    )}
                    {/* Fallback text if image fails loading (hidden by default if img present) */}
                    {userProfile?.image && <div className="hidden w-full h-full items-center justify-center bg-slate-900 text-white">{userProfile?.name?.charAt(0) || 'U'}</div>}
                </div>
                {!isSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{userProfile?.name || 'Guest User'}</p>
                        <p className="text-xs text-slate-500 truncate font-medium">{userProfile?.role || 'Viewer'}</p>
                    </div>
                )}
                </div>
            </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-h-screen md:min-h-0 md:h-full md:overflow-hidden relative">
        {/* Only show header if logged in AND NOT in tracking mode */}
        {isLoggedIn && !trackingId && !quotationId && (
            <header 
              ref={headerRef}
              className="bg-white/95 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 sm:px-8 z-50 shrink-0 sticky top-0 left-0 right-0"
              style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                height: 'calc(56px + env(safe-area-inset-top, 0px))'
              }}
            >
            <div className="flex items-center gap-3 sm:gap-4">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {getPageTitle(activeTab)}
                </h1>
            </div>

            <div className="hidden md:flex">
                <button
                onClick={() => openModal()}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                <Plus className="w-5 h-5" />
                <span>เพิ่มรายการ</span>
                </button>
            </div>

            {/* [ADDED] Mobile Profile Menu Button - Resized to be more compact */}
            <div className="md:hidden relative">
                <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold shadow-sm active:scale-95 transition-all hover:bg-slate-200 overflow-hidden"
                >
                    {userProfile?.image ? (
                        <img 
                            src={processImageUrl(userProfile.image)} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerText = userProfile?.name?.charAt(0) || 'U'; }}
                        />
                    ) : (
                        userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />
                    )}
                </button>
                
                {isProfileMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)}></div>
                        <div className="absolute right-0 top-12 bg-white rounded-xl shadow-xl border border-slate-100 p-1.5 min-w-[160px] z-20 animate-in fade-in zoom-in-95 origin-top-right flex flex-col gap-1">
                            {/* User Info Header */}
                            <div className="px-2 py-2 border-b border-slate-50 mb-1">
                                <p className="text-xs font-bold text-slate-800 truncate">{userProfile?.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{userProfile?.role}</p>
                            </div>

                            {/* Settings Button */}
                            <button 
                                onClick={() => { setActiveTab('Settings'); setIsProfileMenuOpen(false); }}
                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors text-left"
                            >
                                <div className="p-1 bg-slate-100 rounded-md text-slate-600">
                                    <Settings className="w-3.5 h-3.5" />
                                </div>
                                <span>ตั้งค่า</span>
                            </button>

                            {/* [ADDED] Logout Button */}
                            <button 
                                onClick={() => { setIsProfileMenuOpen(false); handleLogout(); }}
                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-rose-50 text-rose-600 text-xs font-bold transition-colors text-left"
                            >
                                <div className="p-1 bg-rose-100 rounded-md text-rose-500">
                                    <LogOut className="w-3.5 h-3.5" />
                                </div>
                                <span>ออกจากระบบ</span>
                            </button>
                        </div>
                    </>
                )}
            </div>

            </header>
        )}

        <main
          ref={mainRef}
          className="flex-1 md:overflow-y-auto bg-[#F8FAFC]"
          onScroll={handleScroll}
        >
          <div className="max-w-[3840px] mx-auto min-h-full flex flex-col">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* --- Mobile Bottom Navigation --- */}
      {/* Only show nav if logged in AND NOT in tracking mode */}
      {isLoggedIn && !trackingId && !quotationId && (
        <>
          {/* Backdrop for Expanded Drawer / Dragging (Fades in/out smoothly, covers entire screen including header & filter with frosted blur) */}
          <div 
            ref={backdropRef}
            onClick={() => {
              setIsMobileNavExpanded(false);
            }}
            className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] select-none pointer-events-none opacity-0 invisible"
            style={{
              transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          />

          {/* Unified Single Navigation Card (กล่องเดียวระบบเดียว ดึงขึ้น-ลง ไม่สร้างกล่องใหม่ ไม่ซ้อนทับ) */}
          <nav 
            ref={navSheetRef}
            id="mobile-bottom-nav"
            onPointerDown={handleBottomNavPointerDown}
            onClickCapture={(e) => {
              if (wasDraggingNavRef.current) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-[2rem] border-t border-slate-200/80 z-[90] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] safe-area-bottom pb-safe select-none will-change-[height] overflow-hidden"
          >
            {/* Unified Pull Handle Bar (ขีดเดียวระบบเดียว พ้นปุ่มสีม่วงชัดเจน มีอนิเมชั่นบีบเมื่อถูกจับลาก) */}
            <div 
              onClick={() => {
                if (!wasDraggingNavRef.current) {
                  setIsMobileNavExpanded(prev => !prev);
                }
              }}
              className="w-full flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none group"
              title={isMobileNavExpanded ? "ลากลงเพื่อย่อ" : "ลากขึ้นเพื่อดูเมนูเพิ่มเติม"}
            >
              <div 
                ref={handlePillRef}
                className="w-12 h-1.5 bg-slate-300 group-hover:bg-slate-400 group-active:scale-x-75 group-active:scale-y-125 group-active:bg-slate-500 rounded-full transition-all duration-200" 
              />
            </div>

            {/* Row 1: Primary Quick Navigation (5 Slots) */}
            <div className="relative grid grid-cols-5 h-13 items-center px-1">
                {/* 1. Calendar */}
                <button
                    onClick={() => {
                      setActiveTab('Calendar');
                      if (isMobileNavExpanded) setIsMobileNavExpanded(false);
                    }}
                    className="relative flex flex-col items-center justify-center h-full w-full group cursor-pointer outline-none z-10 active:scale-95 transition-transform"
                    title="ปฏิทินงาน"
                >
                    <div className={`transition-all duration-200 flex flex-col items-center justify-center ${
                        activeTab === 'Calendar' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                        <Calendar 
                          className={`transition-all duration-200 ${isMobileNavExpanded ? 'w-5.5 h-5.5' : 'w-7 h-7'}`} 
                          strokeWidth={activeTab === 'Calendar' ? 2.5 : 2} 
                        />
                        <span className={`text-[10px] leading-none transition-all duration-200 ${
                          isMobileNavExpanded ? 'opacity-100 max-h-4 mt-0.5' : 'opacity-0 max-h-0 pointer-events-none'
                        } ${activeTab === 'Calendar' ? 'font-bold text-indigo-600' : 'font-medium text-slate-500'}`}>
                          ปฏิทิน
                        </span>
                        {activeTab === 'Calendar' && (
                            <span className={`w-1.5 h-1.5 bg-indigo-600 rounded-full transition-all duration-200 ${isMobileNavExpanded ? 'mt-0.5' : 'mt-1'}`} />
                        )}
                    </div>
                </button>

                {/* 2. Plans */}
                <button
                    onClick={() => {
                      setActiveTab('Plans');
                      if (isMobileNavExpanded) setIsMobileNavExpanded(false);
                    }}
                    className="relative flex flex-col items-center justify-center h-full w-full group cursor-pointer outline-none z-10 active:scale-95 transition-transform"
                    title="แผนงาน"
                >
                    <div className={`transition-all duration-200 flex flex-col items-center justify-center ${
                        activeTab === 'Plans' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                        <List 
                          className={`transition-all duration-200 ${isMobileNavExpanded ? 'w-5.5 h-5.5' : 'w-7 h-7'}`} 
                          strokeWidth={activeTab === 'Plans' ? 2.5 : 2} 
                        />
                        <span className={`text-[10px] leading-none transition-all duration-200 ${
                          isMobileNavExpanded ? 'opacity-100 max-h-4 mt-0.5' : 'opacity-0 max-h-0 pointer-events-none'
                        } ${activeTab === 'Plans' ? 'font-bold text-indigo-600' : 'font-medium text-slate-500'}`}>
                          แผนงาน
                        </span>
                        {activeTab === 'Plans' && (
                            <span className={`w-1.5 h-1.5 bg-indigo-600 rounded-full transition-all duration-200 ${isMobileNavExpanded ? 'mt-0.5' : 'mt-1'}`} />
                        )}
                    </div>
                </button>

                {/* 3. Center Elevated Plus Button */}
                <div className="relative flex justify-center items-center z-20 pointer-events-none">
                     <button
                        onClick={() => openModal()}
                        className="w-11 h-11 bg-indigo-600 rounded-full text-white shadow-md shadow-indigo-300/50 flex items-center justify-center transform active:scale-95 transition-all border-2 border-white pointer-events-auto"
                        title="เพิ่มรายการใหม่"
                     >
                        <Plus className="w-6 h-6" strokeWidth={2.5} />
                     </button>
                </div>

                {/* 4. Finance */}
                <button
                    onClick={() => {
                      setActiveTab('Finance');
                      if (isMobileNavExpanded) setIsMobileNavExpanded(false);
                    }}
                    className="relative flex flex-col items-center justify-center h-full w-full group cursor-pointer outline-none z-10 active:scale-95 transition-transform"
                    title="การเงิน"
                >
                    <div className={`transition-all duration-200 flex flex-col items-center justify-center ${
                        activeTab === 'Finance' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                        <Wallet 
                          className={`transition-all duration-200 ${isMobileNavExpanded ? 'w-5.5 h-5.5' : 'w-7 h-7'}`} 
                          strokeWidth={activeTab === 'Finance' ? 2.5 : 2} 
                        />
                        <span className={`text-[10px] leading-none transition-all duration-200 ${
                          isMobileNavExpanded ? 'opacity-100 max-h-4 mt-0.5' : 'opacity-0 max-h-0 pointer-events-none'
                        } ${activeTab === 'Finance' ? 'font-bold text-indigo-600' : 'font-medium text-slate-500'}`}>
                          การเงิน
                        </span>
                        {activeTab === 'Finance' && (
                            <span className={`w-1.5 h-1.5 bg-indigo-600 rounded-full transition-all duration-200 ${isMobileNavExpanded ? 'mt-0.5' : 'mt-1'}`} />
                        )}
                    </div>
                </button>

                {/* 5. Analytics */}
                <button
                    onClick={() => {
                      setActiveTab('Analytics');
                      if (isMobileNavExpanded) setIsMobileNavExpanded(false);
                    }}
                    className="relative flex flex-col items-center justify-center h-full w-full group cursor-pointer outline-none z-10 active:scale-95 transition-transform"
                    title="วิเคราะห์"
                >
                    <div className={`transition-all duration-200 flex flex-col items-center justify-center ${
                        activeTab === 'Analytics' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                        <BarChart2 
                          className={`transition-all duration-200 ${isMobileNavExpanded ? 'w-5.5 h-5.5' : 'w-7 h-7'}`} 
                          strokeWidth={activeTab === 'Analytics' ? 2.5 : 2} 
                        />
                        <span className={`text-[10px] leading-none transition-all duration-200 ${
                          isMobileNavExpanded ? 'opacity-100 max-h-4 mt-0.5' : 'opacity-0 max-h-0 pointer-events-none'
                        } ${activeTab === 'Analytics' ? 'font-bold text-indigo-600' : 'font-medium text-slate-500'}`}>
                          วิเคราะห์
                        </span>
                        {activeTab === 'Analytics' && (
                            <span className={`w-1.5 h-1.5 bg-indigo-600 rounded-full transition-all duration-200 ${isMobileNavExpanded ? 'mt-0.5' : 'mt-1'}`} />
                        )}
                    </div>
                </button>
            </div>

            {/* Row 2: Secondary Navigation Section (ดึงขึ้นมาจะปรากฏในกล่องเดียวกัน ไร้กรอบสี่เหลี่ยม ไร้ขีดคั่น เป็นชิ้นเดียวกัน) */}
            <div 
              ref={expandSectionRef}
              className="overflow-hidden"
              style={{
                height: isMobileNavExpanded ? '76px' : '0px',
                opacity: isMobileNavExpanded ? 1 : 0,
                pointerEvents: isMobileNavExpanded ? 'auto' : 'none'
              }}
            >
              <div className="pt-1.5 pb-1 grid grid-cols-5 px-1 items-center">
                {/* 1. Settings (ตั้งค่า) */}
                <button
                  onClick={() => {
                    setActiveTab('Settings');
                    setIsMobileNavExpanded(false);
                  }}
                  className="flex flex-col items-center justify-center py-1 group cursor-pointer outline-none active:scale-95 transition-transform"
                  title="ตั้งค่า"
                >
                  <Settings className={`w-6 h-6 transition-colors ${activeTab === 'Settings' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={activeTab === 'Settings' ? 2.5 : 2} />
                  <span className={`text-[10px] mt-0.5 leading-none ${activeTab === 'Settings' ? 'text-indigo-600 font-bold' : 'text-slate-500 font-medium'}`}>
                    ตั้งค่า
                  </span>
                  {activeTab === 'Settings' && (
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-0.5" />
                  )}
                </button>

                {/* 2, 3, 4, 5. Empty slots */}
                <div className="flex items-center justify-center py-1 opacity-0 pointer-events-none" />
                <div className="flex items-center justify-center py-1 opacity-0 pointer-events-none" />
                <div className="flex items-center justify-center py-1 opacity-0 pointer-events-none" />
                <div className="flex items-center justify-center py-1 opacity-0 pointer-events-none" />
              </div>
            </div>
          </nav>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm ${isDeleteClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
            onClick={closeDeleteModal}
          />
          <div className={`bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm relative z-10 ${isDeleteClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">ยืนยันการลบ?</h3>
                <p className="text-sm text-slate-500">คุณต้องการลบรายการนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={closeDeleteModal}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-lg shadow-rose-200"
                >
                  ยืนยันลบ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [ADDED] Logo Delete Confirmation Modal */}
      {deleteLogoConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm ${isDeleteLogoClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
            onClick={closeDeleteLogoModal}
          />
          <div className={`bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm relative z-10 ${isDeleteLogoClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">ยืนยันลบรูปร้านค้า?</h3>
                <p className="text-sm text-slate-500">คุณต้องการลบโลโก้ร้านค้านี้ใช่หรือไม่?</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={closeDeleteLogoModal}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeDeleteLogo}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-lg shadow-rose-200"
                >
                  ลบรูป
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [ADDED] Profile Delete Confirmation Modal */}
      {deleteProfileConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm ${isDeleteProfileClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
            onClick={closeDeleteProfileModal}
          />
          <div className={`bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm relative z-10 ${isDeleteProfileClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">ยืนยันลบรูปโปรไฟล์?</h3>
                <p className="text-sm text-slate-500">คุณต้องการลบรูปโปรไฟล์นี้ใช่หรือไม่?</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={closeDeleteProfileModal}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeDeleteProfile}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-lg shadow-rose-200"
                >
                  ลบรูป
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Add Item Modal - Expanded Version */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           {/* Backdrop */}
           <div
             className={`fixed inset-0 bg-slate-900/60 backdrop-blur-md ${isModalClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
             onClick={closeModal}
           />
           
           {/* Modal Content - Responsive Layout */}
           <div className={`bg-white w-full max-w-4xl sm:rounded-[2.5rem] rounded-xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] ${isModalClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
             
             {/* Header - Compact for Mobile */}
             <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
                 <div className="flex items-center gap-3">
                   <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl">
                      <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
                   </div>
                   <div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                          {editingId ? (viewOnlyMode ? 'รายละเอียด' : 'แก้ไขรายการ') : 'เพิ่มรายการ'}
                        </h3>
                        {currentId && <span className="bg-indigo-50 text-indigo-600 text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-100 w-fit">{currentId}</span>}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium hidden sm:block">
                        {viewOnlyMode ? 'ดูข้อมูลและจัดการต้นทุน' : 'กรอกข้อมูลรายละเอียดงาน'}
                      </p>
                   </div>
                 </div>
                 
                 {/* ส่วนปุ่มปิดและปุ่ม Share (เพิ่มปุ่ม Share ตรงนี้) */}
                 <div className="flex items-center gap-2">
                   {editingId && (
                       <button
                         onClick={() => {
                            // รวบรวมข้อมูลปัจจุบันเพื่อส่งไปยัง Share Modal
                            const currentData = {
                                id: currentId,
                                name: projectName,
                                rawDateTime: projectDateTime,
                                paymentDate: paymentDate, // [ADDED]
                                artist: artistName,
                                customer: customerName,
                                // [MODIFIED] Add customerInfo object to ensure contact details appear in print
                                customerInfo: {
                                    social: customerSocial,
                                    line: customerLine,
                                    phone: customerPhone,
                                    email: customerEmail,
                                    taxId: customerTaxId // [FIX] Added missing Tax ID
                                },
                                rawDeliveryStart: deliveryStart,
                                rawDeliveryEnd: deliveryEnd,
                                rawDeliveryDateTime: deliveryEnd,
                                location: locationName,
                                mapLink: mapLink,
                                recipient: recipientName,
                                recipientPhone: recipientPhone,
                                image: uploadedImage,
                                wage: wage,
                                quotationItems: quotationItems, 
                                customerSupport: customerSupportItems,
                                dealStatus: dealStatus, 
                                transportStatus: transportStatus
                            };
                            setShareData(currentData);
                         }}
                         className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors flex items-center gap-2 group"
                         title="แชร์ข้อมูลให้ลูกค้า"
                       >
                         <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                         <span className="text-xs font-bold hidden sm:inline">แชร์</span>
                       </button>
                   )}
                   <button
                     onClick={closeModal}
                     className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                   >
                     <X className="w-5 h-5 sm:w-6 sm:h-6" />
                   </button>
                 </div>
             </div>

             {/* Scrollable Body - Compact Padding */}
             <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                   {/* ... (Section 1 - Work/Project) ... */}
                   <div className="space-y-6">
                       <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">1</span>
                          <h4 className="font-bold text-slate-800 text-lg">งาน/โปรเจค</h4>
                       </div>
                       
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">ชื่องาน/แผนงาน</label>
                             <input
                               type="text"
                               value={projectName}
                               disabled={viewOnlyMode}
                               onChange={(e) => setProjectName(e.target.value)}
                               className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                             />
                           </div>
                           
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">วันที่ & เวลา</label>
                             <ModernDateTimePicker 
                                value={projectDateTime} 
                                onChange={(e) => setProjectDateTime(e.target.value)} 
                                placeholder="เลือกวันและเวลา..." 
                                disabled={viewOnlyMode} 
                             />
                           </div>

                           <div className="space-y-2">
                             <div className="flex justify-between items-center ml-1">
                               <label className="text-sm font-bold text-emerald-700">วันที่รับชำระเงิน</label>
                               <span className="text-[10px] font-bold text-emerald-500">ใช้คำนวณรายได้ใน Dashboard</span>
                             </div>
                             <ModernDateTimePicker 
                                value={paymentDate} 
                                onChange={(e) => setPaymentDate(e.target.value)} 
                                placeholder="เลือกวันที่รับเงิน (เว้นว่างไว้จะใช้ตามวันที่เปิดโปรเจค)" 
                                disabled={viewOnlyMode} 
                             />
                           </div>

                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">ศิลปิน</label>
                             <input
                               type="text"
                               list="artist-list"
                               placeholder="เลือกหรือพิมพ์..."
                               value={artistName}
                               disabled={viewOnlyMode}
                               onChange={(e) => setArtistName(e.target.value)}
                               className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                             />
                           </div>
                           
                           {/* ส่วนลูกค้า */}
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">ลูกค้า</label>
                             <input
                               type="text"
                               list="customer-list"
                               placeholder="ชื่อลูกค้า (พิมพ์เพื่อค้นหา)"
                               value={customerName}
                               disabled={viewOnlyMode}
                               onChange={handleCustomerChange} 
                               className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium mb-3 ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                             />
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 <input
                                   type="text"
                                   placeholder="IG / FB / TT"
                                   value={customerSocial}
                                   disabled={viewOnlyMode}
                                   onChange={(e) => setCustomerSocial(e.target.value)}
                                   className={`px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                 />
                                 <input
                                   type="text"
                                   placeholder="LINE ID"
                                   value={customerLine}
                                   disabled={viewOnlyMode}
                                   onChange={(e) => setCustomerLine(e.target.value)}
                                   className={`px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                 />
                                 {viewOnlyMode ? (
                                      <ViewOnlyField value={customerPhone} type="tel" icon={Phone} />
                                 ) : (
                                      <input
                                        type="tel"
                                        placeholder="0xx-xxx-xxxx"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))} // [MODIFIED] Apply formatter
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        maxLength={12} // 10 digits + 2 hyphens
                                      />
                                 )}
                                 {viewOnlyMode ? (
                                      <ViewOnlyField value={customerEmail} type="email" icon={Mail} />
                                 ) : (
                                      <input
                                        type="email"
                                        placeholder="อีเมล"
                                        value={customerEmail}
                                        onChange={(e) => setCustomerEmail(e.target.value)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                      />
                                 )}

                                 {/* [ADDED] Customer Tax ID Input */}
                                 {viewOnlyMode ? (
                                      <div className="sm:col-span-2">
                                        <ViewOnlyField value={customerTaxId} type="text" icon={FileText} />
                                      </div>
                                 ) : (
                                      <input
                                        type="text"
                                        placeholder="เลขประจำตัวผู้เสียภาษี (Tax ID)"
                                        value={customerTaxId}
                                        onChange={(e) => setCustomerTaxId(e.target.value)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:col-span-2"
                                      />
                                 )}

                                 {/* [ADDED] Customer Address Input (New Row) */}
                                 {viewOnlyMode ? (
                                      <div className="sm:col-span-2">
                                        <ViewOnlyField value={customerAddress} type="text" icon={MapPin} />
                                      </div>
                                 ) : (
                                      <textarea
                                        rows={2}
                                        placeholder="ที่อยู่ลูกค้า (แสดงบนใบเสร็จ)"
                                        value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:col-span-2 resize-none"
                                      />
                                 )}
                             </div>
                           </div>

                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">หมวดหมู่</label>
                                <div className="relative">
                                  <select
                                    value={projectCategory}
                                    disabled={viewOnlyMode}
                                    onChange={(e) => setProjectCategory(e.target.value)}
                                    className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium appearance-none cursor-pointer ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                  >
                                    {projectCategories.map((cat, i) => (
                                        <option key={i} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                  <div className="absolute right-4 top-3.5 pointer-events-none opacity-50"><ChevronDown className="w-5 h-5" /></div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">สถานะ (ดีล)</label>
                                <div className="relative">
                                  <select
                                    value={dealStatus}
                                    disabled={viewOnlyMode}
                                    onChange={(e) => setDealStatus(e.target.value)}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold appearance-none cursor-pointer ${
                                      getDealStatusInfo(dealStatus).color
                                    } ${viewOnlyMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                                  >
                                     {dealStatuses.map((status, i) => (
                                       <option key={i} value={status.value}>{status.label}</option>
                                      ))}
                                  </select>
                                  <div className="absolute right-4 top-3.5 pointer-events-none opacity-50">
                                     <ChevronDown className="w-5 h-5" />
                                  </div>
                                </div>
                              </div>
                           </div>

                           {/* [ADDED] สถานะการชำระเงิน (Payment Status) */}
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                             <div className="space-y-2">
                               <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-1.5">
                                 <Wallet className="w-4 h-4 text-indigo-600" />
                                 <span>สถานะการชำระเงิน</span>
                               </label>
                               <div className="relative">
                                 <select
                                   value={paymentStatus}
                                   disabled={viewOnlyMode}
                                   onChange={(e) => setPaymentStatus(e.target.value)}
                                   className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold appearance-none cursor-pointer ${
                                     paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                     paymentStatus === 'deposit' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                     paymentStatus === 'refunded' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                     'bg-amber-50 text-amber-700 border-amber-200'
                                   } ${viewOnlyMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                                 >
                                   <option value="unpaid">รอชำระเงิน (Unpaid)</option>
                                   <option value="deposit">ชำระมัดจำแล้ว (Partial / Deposit)</option>
                                   <option value="paid">ชำระครบถ้วนแล้ว (Paid)</option>
                                   <option value="refunded">คืนเงิน / ยกเลิก (Refunded)</option>
                                 </select>
                                 <div className="absolute right-4 top-3.5 pointer-events-none opacity-50">
                                   <ChevronDown className="w-5 h-5" />
                                 </div>
                               </div>
                             </div>

                             {paymentStatus === 'deposit' ? (
                               <div className="space-y-2 animate-in fade-in duration-200">
                                 <label className="text-sm font-bold text-blue-700 ml-1">ยอดเงินมัดจำ (บาท)</label>
                                 <input
                                   type="number"
                                   min="0"
                                   value={depositAmount === 0 ? '' : depositAmount}
                                   disabled={viewOnlyMode}
                                   onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                                   placeholder="ระบุยอดเงินมัดจำ..."
                                   className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-blue-800"
                                 />
                               </div>
                             ) : (
                               <div className="space-y-2">
                                 <label className="text-sm font-bold text-slate-400 ml-1">หมายเหตุสถานะ</label>
                                 <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-500">
                                   {paymentStatus === 'paid' ? 'บันทึกเป็นรายได้ที่ได้รับชำระครบถ้วนแล้ว' :
                                    paymentStatus === 'refunded' ? 'บันทึกเป็นรายการคืนเงินหรือยกเลิก' :
                                    'บันทึกเป็นยอดรอรับชำระเงิน (ค้างรับ)'}
                                 </div>
                               </div>
                             )}
                           </div>
                           {/* Wage Input Removed from here */}
                        </div>
                   </div>

                   {/* ส่วนที่ 2: กำหนดส่ง & รูปภาพ */}
                   <div className="space-y-6">
                       <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">2</span>
                          <h4 className="font-bold text-slate-800 text-lg">กำหนดส่ง & สถานที่ & รูปภาพ</h4>
                       </div>
                       
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">กำหนดส่ง (เริ่ม - สิ้นสุด)</label>
                             <div className="grid grid-cols-2 gap-2">
                                <ModernDateTimePicker 
                                    value={deliveryStart} 
                                    onChange={(e) => {
                                        setDeliveryStart(e.target.value);
                                        // [ADDED] Auto increment End Time by 1 hour
                                        if (e.target.value) {
                                            const startDate = new Date(e.target.value);
                                            if (!isNaN(startDate.getTime())) {
                                                const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
                                                const offset = endDate.getTimezoneOffset() * 60000;
                                                const localISOEnd = new Date(endDate.getTime() - offset).toISOString().slice(0, 16);
                                                setDeliveryEnd(localISOEnd);
                                            }
                                        }
                                    }}
                                    placeholder="เริ่ม..." 
                                    disabled={viewOnlyMode} 
                                />
                                <ModernDateTimePicker 
                                    value={deliveryEnd} 
                                    onChange={(e) => setDeliveryEnd(e.target.value)} 
                                    placeholder="สิ้นสุด..." 
                                    disabled={viewOnlyMode} 
                                />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">สถานที่</label>
                             <div className="relative">
                               <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                               <input
                                 type="text"
                                 placeholder="ระบุชื่อสถานที่"
                                 value={locationName}
                                 disabled={viewOnlyMode}
                                 onChange={(e) => setLocationName(e.target.value)}
                                 className={`w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                               />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">Google Maps Link</label>
                             {viewOnlyMode ? (
                                <ViewOnlyField value={mapLink} type="url" icon={MapPin} />
                             ) : (
                                <input
                                  type="url"
                                  placeholder="https://maps.google.com/..."
                                  value={mapLink}
                                  onChange={(e) => setMapLink(e.target.value)}
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-blue-600"
                                />
                             )}
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">ผู้รับ</label>
                                <input
                                  type="text"
                                  list="recipient-list"
                                  placeholder="ชื่อผู้รับ (พิมพ์เพื่อค้นหา)"
                                  value={recipientName}
                                  disabled={viewOnlyMode}
                                  onChange={handleRecipientChange}
                                  className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">เบอร์โทรผู้รับ</label>
                                {viewOnlyMode ? (
                                    <ViewOnlyField value={recipientPhone} type="tel" icon={Phone} />
                                ) : (
                                    <input
                                      type="tel"
                                      value={recipientPhone}
                                      onChange={(e) => setRecipientPhone(formatPhoneNumber(e.target.value))} // [MODIFIED] Apply formatter
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                                      placeholder="0xx-xxx-xxxx"
                                      maxLength={12}
                                    />
                                )}
                              </div>
                           </div>
                           
                           {/* สถานะงาน (ขนส่ง) เปลี่ยนสีได้ */}
                           <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700 ml-1">สถานะงาน (ขนส่ง)</label>
                              <div className="relative">
                                <select
                                  value={transportStatus}
                                  disabled={viewOnlyMode}
                                  onChange={(e) => setTransportStatus(e.target.value)}
                                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold appearance-none cursor-pointer ${
                                    getTransportStatusInfo(transportStatus).color
                                  } ${viewOnlyMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                   {transportStatuses.map((status, i) => (
                                      <option key={i} value={status.value}>{status.label}</option>
                                   ))}
                                </select>
                                <div className="absolute right-4 top-3.5 pointer-events-none opacity-50">
                                   <ChevronDown className="w-5 h-5" />
                                </div>
                              </div>
                           </div>

                           {/* Image Upload Area Moved Here */}
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                             <label className="text-sm font-bold text-slate-700 ml-1">รูปภาพอ้างอิง</label>
                             {!viewOnlyMode ? (
                               <div 
                                 className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                                 onDrop={onDrop}
                                 onDragOver={onDragOverImg}
                                 onClick={() => document.getElementById('image-upload').click()}
                               >
                                  <input 
                                    type="file" 
                                    id="image-upload" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])}
                                  />
                                  {uploadedImage ? (
                                     <div 
                                        className="relative w-full h-48 rounded-xl overflow-hidden shadow-sm border border-slate-100 group/img"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewImage(uploadedImage);
                                        }}
                                     >
                                         <img 
                                            src={processImageUrl(uploadedImage)} 
                                            alt="Preview" 
                                            className="w-full h-full object-contain bg-slate-50" 
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "https://placehold.co/400x300?text=Image+Load+Error";
                                            }}
                                         />
                                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                              <Maximize2 className="w-6 h-6 text-white" />
                                              <span className="text-white font-bold text-sm">ดูรูปขยาย</span>
                                         </div>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }}
                                            className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm text-rose-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition shadow-sm z-10"
                                         >
                                            <Trash2 className="w-4 h-4" />
                                         </button>
                                     </div>
                                  ) : (
                                     <div className="py-6 flex flex-col items-center">
                                         <div className="p-3 bg-indigo-50 text-indigo-500 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                            <UploadCloud className="w-6 h-6" />
                                         </div>
                                         <p className="text-sm font-bold text-slate-600">คลิกเพื่ออัพโหลด หรือลากไฟล์มาวาง</p>
                                         <p className="text-xs text-slate-400 mt-1">รองรับ JPG, PNG (Max 5MB)</p>
                                     </div>
                                  )}
                               </div>
                             ) : (
                                uploadedImage ? (
                                   <div 
                                        className="w-full h-64 rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50 cursor-zoom-in relative group"
                                        onClick={() => setPreviewImage(uploadedImage)}
                                   >
                                       <img 
                                          src={processImageUrl(uploadedImage)} 
                                          alt="Preview" 
                                          className="w-full h-full object-contain" 
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                              e.target.onerror = null;
                                              e.target.src = "https://placehold.co/400x300?text=Image+Load+Error";
                                          }}
                                       />
                                       <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                           <Maximize2 className="w-4 h-4" />
                                       </div>
                                   </div>
                                ) : (
                                   <div className="w-full px-4 py-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic text-sm flex flex-col items-center gap-2">
                                       <ImageIcon className="w-8 h-8 opacity-50" />
                                       <span>ไม่มีรูปภาพ</span>
                                   </div>
                                )
                             )}
                          </div>

                          {/* Payment Slips Upload Area */}
                          <div className="space-y-2 pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-1.5">
                                <Receipt className="w-4 h-4 text-amber-500" />
                                <span>สลิปโอนเงิน (หลักฐานชำระเงิน)</span>
                                {uploadedSlips.length > 0 && (
                                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {uploadedSlips.length} รูป
                                  </span>
                                )}
                              </label>
                              {!viewOnlyMode && (
                                <button
                                  type="button"
                                  onClick={() => document.getElementById('slip-multi-upload').click()}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  เพิ่มสลิป
                                </button>
                              )}
                            </div>

                            <input
                              type="file"
                              id="slip-multi-upload"
                              className="hidden"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleSlipUpload(e.target.files);
                                  e.target.value = '';
                                }
                              }}
                            />

                            {/* Slips Preview Grid or Upload Prompt */}
                            {uploadedSlips.length > 0 ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                  {uploadedSlips.map((slip, idx) => {
                                    const slipSrc = typeof slip === 'object' ? slip.url : slip;
                                    const slipKey = typeof slip === 'object' ? (slip.id || idx) : idx;
                                    return (
                                      <div
                                        key={slipKey}
                                        className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-[3/4] cursor-pointer shadow-xs hover:shadow-md transition"
                                        onClick={() => setPreviewImage(slipSrc)}
                                      >
                                        <img
                                          src={processImageUrl(slipSrc)}
                                          alt={`สลิป ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = "https://placehold.co/300x400?text=Slip+Error";
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                          <Maximize2 className="w-5 h-5 text-white" />
                                        </div>
                                        {!viewOnlyMode && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveSlip(slipKey);
                                            }}
                                            className="absolute top-1.5 right-1.5 p-1 bg-white/90 backdrop-blur-sm text-rose-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition shadow-sm z-10"
                                            title="ลบสลิป"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs rounded text-[10px] text-white font-medium">
                                          ใบที่ {idx + 1}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {!viewOnlyMode && (
                                    <button
                                      type="button"
                                      onClick={() => document.getElementById('slip-multi-upload').click()}
                                      className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center aspect-[3/4] text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/20 transition group"
                                    >
                                      <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                      <span className="text-xs font-bold mt-1">เพิ่มอีก</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              !viewOnlyMode ? (
                                <div
                                  className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-amber-400 hover:bg-amber-50/20 transition-all cursor-pointer group"
                                  onClick={() => document.getElementById('slip-multi-upload').click()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                      handleSlipUpload(e.dataTransfer.files);
                                    }
                                  }}
                                  onDragOver={(e) => e.preventDefault()}
                                >
                                  <div className="p-2.5 bg-amber-50 text-amber-500 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                    <Receipt className="w-5 h-5" />
                                  </div>
                                  <p className="text-sm font-bold text-slate-600">คลิกเพื่ออัพโหลดสลิป หรือลากไฟล์มาวาง</p>
                                  <p className="text-xs text-slate-400 mt-0.5">เลือกได้หลายรูปพร้อมกัน (JPG, PNG)</p>
                                </div>
                              ) : (
                                <div className="w-full px-4 py-6 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic text-sm flex flex-col items-center gap-1.5">
                                  <Receipt className="w-6 h-6 opacity-40" />
                                  <span>ไม่มีสลิปโอนเงิน</span>
                                </div>
                              )
                            )}
                          </div>

                        </div>
                   </div>
                 </div>

                 {/* ส่วนที่ 3: การเงิน */}
                 <div className="mt-10 space-y-6" ref={part3Ref}>
                     <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">3</span>
                          <h4 className="font-bold text-slate-800 text-lg">การเงิน & เสนอราคา (Quotation)</h4>
                     </div>

                     {/* 3.1: Customer Support (Bank Calculator) */}
                     <div className="space-y-3">
                         <h5 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                            เงินสนับสนุนศิลปิน (Money Order)
                         </h5>
                         <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 p-4">
                              <div className="space-y-3">
                                  {/* Header Row */}
                                  <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-xs font-bold text-indigo-800/60 uppercase tracking-wide">
                                      <div className="col-span-3 text-center sm:text-left">วันที่รับเงิน</div>
                                      <div className="col-span-2">ประเภทแบงค์</div>
                                      <div className="col-span-2 text-center">จำนวน</div>
                                      <div className="col-span-2 text-right">รวมเป็นเงิน</div>
                                      <div className="col-span-2 pl-1">รายละเอียด</div>
                                      <div className="col-span-1"></div>
                                  </div>

                                  {/* Dynamic Rows */}
                                  {customerSupportItems.map((item, idx) => (
                                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center animate-in fade-in slide-in-from-left-2 duration-300 bg-white p-3 sm:p-0 rounded-xl sm:bg-transparent border sm:border-none border-indigo-100 shadow-sm sm:shadow-none">
                                          {/* 1. วันที่รับเงิน */}
                                          <div className="sm:col-span-3">
                                              <span className="sm:hidden text-xs font-bold text-indigo-400 mb-1 block text-left">วันที่รับเงิน</span>
                                              <input
                                                  type="date"
                                                  value={item.date ? item.date.slice(0, 10) : ''}
                                                  disabled={viewOnlyMode}
                                                  onChange={(e) => handleSupportItemChange(idx, 'date', e.target.value)}
                                                  className={`w-full px-2 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-700 ${viewOnlyMode ? 'bg-slate-50 opacity-80 cursor-not-allowed' : ''}`}
                                              />
                                          </div>

                                          {/* 2. ประเภทแบงค์ */}
                                          <div className="sm:col-span-2 relative">
                                              <span className="sm:hidden text-xs font-bold text-indigo-400 mb-1 block text-left">ประเภทแบงค์</span>
                                              <select
                                                  value={item.denomination}
                                                  disabled={viewOnlyMode}
                                                  onChange={(e) => handleSupportItemChange(idx, 'denomination', e.target.value)}
                                                  className={`w-full px-2 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-700 text-center sm:text-left ${viewOnlyMode ? 'bg-slate-50 opacity-80 cursor-not-allowed' : ''}`}
                                              >
                                                  {[1000, 500, 100, 50, 20, 10, 5, 2, 1].map(val => (
                                                      <option key={val} value={val}>{val >= 20 ? `แบงค์ ${val}` : `เหรียญ ${val}`}</option>
                                                  ))}
                                              </select>
                                          </div>
                                          
                                          {/* 3. จำนวน */}
                                          <div className="sm:col-span-2">
                                              <span className="sm:hidden text-xs font-bold text-indigo-400 mb-1 block text-left">จำนวน</span>
                                              <input
                                                  type="number"
                                                  placeholder="จำนวน"
                                                  value={item.quantity === 0 ? '' : item.quantity} 
                                                  disabled={viewOnlyMode}
                                                  onChange={(e) => handleSupportItemChange(idx, 'quantity', e.target.value)}
                                                  className={`w-full px-2 py-2 bg-white border border-indigo-200 rounded-lg text-xs text-center font-bold text-slate-700 ${viewOnlyMode ? 'bg-slate-50 opacity-80 cursor-not-allowed' : ''}`}
                                              />
                                          </div>

                                          {/* 4. รวมเป็นเงิน */}
                                          <div className="sm:col-span-2">
                                              <span className="sm:hidden text-xs font-bold text-indigo-400 mb-1 block text-left">รวมเป็นเงิน (บาท)</span>
                                              <input
                                                  type="number"
                                                  placeholder="0.00"
                                                  value={item.price === 0 ? '' : item.price} 
                                                  disabled={viewOnlyMode}
                                                  onChange={(e) => handleSupportItemChange(idx, 'price', e.target.value)}
                                                  className={`w-full px-2 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-black text-indigo-700 text-center sm:text-right ${viewOnlyMode ? 'opacity-80 cursor-not-allowed' : ''}`}
                                              />
                                          </div>

                                          {/* 5. รายละเอียด */}
                                          <div className="sm:col-span-2">
                                              <span className="sm:hidden text-xs font-bold text-indigo-400 mb-1 block text-left">รายละเอียด</span>
                                              <input
                                                  type="text"
                                                  placeholder="รายละเอียด (ถ้ามี)"
                                                  value={item.detail || ''}
                                                  disabled={viewOnlyMode}
                                                  onChange={(e) => handleSupportItemChange(idx, 'detail', e.target.value)}
                                                  className={`w-full px-2 py-2 bg-white border border-indigo-200 rounded-lg text-xs text-left ${viewOnlyMode ? 'bg-slate-50 opacity-80 cursor-not-allowed' : ''}`}
                                              />
                                          </div>

                                          {/* 6. ปุ่มลบ */}
                                          <div className="sm:col-span-1 flex justify-center sm:justify-end">
                                              {!viewOnlyMode && (
                                                  <button
                                                      onClick={() => handleRemoveSupportItem(idx)}
                                                      className="p-1.5 text-indigo-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                                  >
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </div>

                              <div className="flex justify-between items-center mt-4">
                                  <button
                                      onClick={handleAddSupportItem}
                                      className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 px-3 py-2 rounded-lg transition w-fit"
                                  >
                                      <Plus className="w-4 h-4" />
                                      เพิ่มรายการเงิน
                                  </button>
                                  <div className="text-sm font-bold text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                      รวม: ฿{customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString()}
                                  </div>
                              </div>
                         </div>
                     </div>

                     {/* 3.2: Quotation Items (Replaces Service + Delivery) */}
                     <div className="space-y-3 pt-4 border-t border-slate-100">
                         <h5 className="font-bold text-emerald-700 text-sm flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                            รายการเสนอราคา (Quotation)
                         </h5>
                         <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-4">
                             <div className="space-y-3">
                                {/* Header Row */}
                                <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-xs font-bold text-emerald-800/60 uppercase tracking-wide">
                                   <div className="col-span-3 text-center sm:text-left">วันที่ทำบิล/รับเงิน</div>
                                   <div className="col-span-2">หมวดหมู่</div>
                                   <div className="col-span-3">รายละเอียดรายการ</div>
                                   <div className="col-span-1 text-center">จำนวน</div>
                                   <div className="col-span-2 text-right">ราคา/หน่วย</div>
                                   <div className="col-span-1"></div>
                                </div>

                                {/* Dynamic Rows */}
                                {quotationItems.map((item, idx) => (
                                   <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start animate-in fade-in slide-in-from-left-2 duration-300 bg-white p-3 sm:p-0 rounded-xl sm:bg-transparent border sm:border-none border-emerald-100 shadow-sm sm:shadow-none">
                                       <div className="sm:col-span-3">
                                          <span className="sm:hidden text-xs font-bold text-emerald-500 mb-1 block">วันที่ทำบิล/รับเงิน</span>
                                          <input
                                            type="date"
                                            value={item.date ? item.date.slice(0, 10) : ''}
                                            onChange={(e) => handleQuotationItemChange(idx, 'date', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-semibold text-slate-700"
                                          />
                                       </div>
                                       <div className="sm:col-span-2">
                                          <span className="sm:hidden text-xs font-bold text-emerald-500 mb-1 block">หมวดหมู่</span>
                                          <input
                                            type="text"
                                            list="expense-categories" 
                                            placeholder="ระบุหมวดหมู่..."
                                            value={item.category}
                                            onChange={(e) => handleQuotationItemChange(idx, 'category', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-emerald-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                          />
                                       </div>
                                       <div className="sm:col-span-3">
                                          <span className="sm:hidden text-xs font-bold text-emerald-500 mb-1 block">รายละเอียด</span>
                                          <input
                                            type="text"
                                            placeholder="รายละเอียดเพิ่มเติม..."
                                            value={item.detail}
                                            onChange={(e) => handleQuotationItemChange(idx, 'detail', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-emerald-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                          />
                                       </div>
                                       <div className="sm:col-span-1">
                                          <span className="sm:hidden text-xs font-bold text-emerald-500 mb-1 block">จำนวน</span>
                                          <input
                                            type="number"
                                            placeholder="1"
                                            value={item.quantity}
                                            onChange={(e) => handleQuotationItemChange(idx, 'quantity', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-center text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                          />
                                       </div>
                                       <div className="sm:col-span-2">
                                          <span className="sm:hidden text-xs font-bold text-emerald-500 mb-1 block">ราคา/หน่วย</span>
                                          <input
                                            type="number"
                                            placeholder="0.00"
                                            value={item.unitPrice !== undefined ? item.unitPrice : item.price}
                                            onChange={(e) => handleQuotationItemChange(idx, 'unitPrice', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-right"
                                          />
                                       </div>
                                       <div className="sm:col-span-1 flex justify-center sm:justify-end pt-1">
                                          <button
                                            onClick={() => handleRemoveQuotationItem(idx)}
                                            className="p-1.5 text-emerald-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                       </div>
                                    </div>
                                 ))}
                              </div>

                              <div className="flex justify-between items-center mt-4">
                                  <button
                                    onClick={handleAddQuotationItem}
                                    className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-lg transition w-fit"
                                  >
                                    <Plus className="w-4 h-4" />
                                    เพิ่มรายการเสนอราคา
                                  </button>
                                  <div className="text-sm font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                      รวม: ฿{quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString()}
                                  </div>
                              </div>
                         </div>
                     </div>

                     {/* 3.3: Expenses (Moved to Row 3) */}
                     <div className="space-y-3 pt-4 border-t border-slate-100">
                         <h5 className="font-bold text-rose-700 text-sm flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" />
                            รายจ่ายจริง / ต้นทุนเพิ่ม (Expenses)
                         </h5>
                         <p className="text-[10px] text-slate-400 -mt-1 ml-6">รายการนี้ไม่แสดงให้ลูกค้าเห็น (ใช้สำหรับคำนวณกำไรภายใน)</p>
                         <div className="bg-rose-50/50 rounded-2xl border border-rose-100 p-4">
                             <div className="space-y-3">
                                {/* Header Row */}
                                <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-xs font-bold text-rose-800/60 uppercase tracking-wide">
                                   <div className="col-span-3 text-center sm:text-left">วันที่จ่ายเงิน</div>
                                   <div className="col-span-2">หมวดหมู่</div>
                                   <div className="col-span-3">รายละเอียด</div>
                                   <div className="col-span-1 text-center">จำนวน</div>
                                   <div className="col-span-2 text-right">ราคา/หน่วย</div>
                                   <div className="col-span-1"></div>
                                </div>

                                {expenses.map((item, idx) => (
                                   <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start animate-in fade-in slide-in-from-left-2 duration-300 bg-white p-3 sm:p-0 rounded-xl sm:bg-transparent border sm:border-none border-rose-100 shadow-sm sm:shadow-none">
                                       <div className="sm:col-span-3">
                                          <span className="sm:hidden text-xs font-bold text-rose-400 mb-1 block">วันที่จ่ายเงิน</span>
                                          <input
                                            type="date"
                                            value={item.date ? item.date.slice(0, 10) : ''}
                                            onChange={(e) => handleExpenseChange(idx, 'date', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-rose-200 rounded-lg text-xs font-semibold text-slate-700"
                                          />
                                       </div>
                                       <div className="sm:col-span-2">
                                          <span className="sm:hidden text-xs font-bold text-rose-400 mb-1 block">หมวดหมู่</span>
                                          <input
                                            type="text"
                                            list="expense-categories" 
                                            placeholder="หมวดหมู่..."
                                            value={item.category}
                                            onChange={(e) => handleExpenseChange(idx, 'category', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-rose-500/20"
                                          />
                                       </div>
                                       <div className="sm:col-span-3">
                                          <span className="sm:hidden text-xs font-bold text-rose-400 mb-1 block">รายละเอียด</span>
                                          <input
                                            type="text"
                                            placeholder="รายละเอียด..."
                                            value={item.detail}
                                            onChange={(e) => handleExpenseChange(idx, 'detail', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-rose-500/20"
                                          />
                                       </div>
                                       <div className="sm:col-span-1">
                                          <span className="sm:hidden text-xs font-bold text-rose-400 mb-1 block">จำนวน</span>
                                          <input
                                            type="number"
                                            placeholder="1"
                                            value={item.quantity}
                                            onChange={(e) => handleExpenseChange(idx, 'quantity', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-rose-200 rounded-lg text-xs font-bold text-center text-slate-700 focus:ring-2 focus:ring-rose-500/20"
                                          />
                                       </div>
                                       <div className="sm:col-span-2">
                                          <span className="sm:hidden text-xs font-bold text-rose-400 mb-1 block">ราคา/หน่วย</span>
                                          <input
                                            type="number"
                                            placeholder="0.00"
                                            value={item.unitPrice !== undefined ? item.unitPrice : item.price}
                                            onChange={(e) => handleExpenseChange(idx, 'unitPrice', e.target.value)}
                                            className="w-full px-2 py-2 bg-white border border-rose-200 rounded-lg text-xs font-semibold text-rose-800 focus:ring-2 focus:ring-rose-500/20 text-right"
                                          />
                                       </div>
                                       <div className="sm:col-span-1 flex justify-center sm:justify-end pt-1">
                                          <button
                                            onClick={() => handleRemoveExpense(idx)}
                                            className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                       </div>
                                    </div>
                                 ))}
                              </div>

                              <div className="flex justify-between items-center mt-4">
                                  <button
                                    onClick={handleAddExpense}
                                    className="flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition w-fit"
                                  >
                                    <Plus className="w-4 h-4" />
                                    เพิ่มรายการจ่าย
                                  </button>
                                  <div className="text-sm font-bold text-rose-800 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                                      รวม: ฿{expenses.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString()}
                                  </div>
                              </div>
                         </div>
                     </div>

                     {/* Summary Section - Redesigned (Standard Financial Equation: 1.เงินศิลปิน -> 2.รายได้ -> 3.ค่าใช้จ่าย -> 4.กำไรสุทธิ) */}
                     <div className="mt-6 space-y-2">
                         <div className="flex justify-between items-center px-1">
                             <span className="text-xs font-bold text-slate-500">สรุปการเงินโปรเจกต์</span>
                             <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                 ยอดเรียกเก็บสุทธิ: ฿{((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) + (customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0))).toLocaleString()}
                             </span>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                             {/* 1. เงินศิลปิน */}
                             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-700 mb-1">1. เงินศิลปิน</p>
                                    <p className="text-[10px] text-slate-500 mb-2">(ยอดสนับสนุน ไม่หักกำไร)</p>
                                </div>
                                <p className={`font-black text-slate-800 tracking-tight break-all leading-tight ${(customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                    ฿{(customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toLocaleString()}
                                </p>
                             </div>

                             {/* 2. รายได้ */}
                             <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-bold text-emerald-700 mb-1">2. รายได้</p>
                                    <p className="text-[10px] text-emerald-600 mb-2">(รายการเสนอราคา)</p>
                                </div>
                                <p className={`font-black text-emerald-700 tracking-tight break-all leading-tight ${(quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                    ฿{(quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toLocaleString()}
                                </p>
                             </div>

                             {/* 3. ค่าใช้จ่าย */}
                             <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-bold text-rose-700 mb-1">3. ค่าใช้จ่าย</p>
                                    <p className="text-[10px] text-rose-500 mb-2">(รวมรายจ่ายจริง)</p>
                                </div>
                                <p className={`font-black text-rose-600 tracking-tight break-all leading-tight ${totalExpenses.toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                    ฿{totalExpenses.toLocaleString()}
                                </p>
                             </div>
                             
                             {/* 4. กำไรสุทธิ */}
                             <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-bold text-indigo-100 mb-1">4. กำไรสุทธิ</p>
                                    <p className="text-[10px] text-indigo-200 mb-2">(รายได้ - ค่าใช้จ่าย)</p>
                                </div>
                                <p className={`font-black tracking-tight break-all leading-tight ${((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) - totalExpenses).toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                  {((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) - totalExpenses) >= 0 ? '+' : ''}฿{((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) - totalExpenses).toLocaleString()}
                                </p>
                             </div>
                         </div>
                     </div>

                     {/* Quick Save Button for Finance Section (View Only Mode) */}
                     {viewOnlyMode && (
                        <div className="mt-4 flex justify-end animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 p-2 pl-4 rounded-2xl">
                                <span className="text-xs font-bold text-amber-700">
                                    <AlertCircle className="w-3 h-3 inline mr-1 mb-0.5" />
                                    แก้ไขยอดเงินแล้ว อย่าลืมกดบันทึก
                                </span>
                                <button
                                    onClick={handleSaveProject}
                                    className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    บันทึกยอดเงิน
                                </button>
                            </div>
                        </div>
                     )}
                 </div>
                 
                 {/* ส่วนที่ 4: หมายเหตุ (Note) */}
                 <div className="mt-8 space-y-4">
                     <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">4</span>
                          <h4 className="font-bold text-slate-800 text-lg">หมายเหตุ</h4>
                     </div>
                     <div className="relative">
                         <StickyNote className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                         <textarea
                           rows={3}
                           placeholder="ระบุหมายเหตุเพิ่มเติม..."
                           value={note}
                           disabled={viewOnlyMode}
                           onChange={(e) => setNote(e.target.value)}
                           className={`w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                         />
                     </div>
                 </div>
             </div>

             {/* Footer Actions - Responsive: Mobile (35/65) | PC (Split Left/Right) */}
             <div className="px-4 pt-4 sm:px-8 sm:py-6 border-t border-slate-100 bg-white/90 backdrop-blur-xl sticky bottom-0 z-30 safe-area-bottom-modal">
                 <div className="flex items-center justify-center sm:justify-between gap-3 w-full">
                     
                     {/* Left Side: Delete Button (35% on Mobile, Auto on PC) */}
                     {/* Using a conditional rendering for the wrapper to maintain layout */}
                     {editingId ? (
                        <button
                             onClick={handleDeleteProject}
                             className="w-[35%] sm:w-auto group flex items-center justify-center gap-2 py-3.5 sm:px-6 rounded-2xl text-rose-500 bg-rose-50 hover:bg-rose-100 transition-all duration-300 border border-transparent hover:border-rose-100 active:scale-95 shadow-sm shrink-0"
                             title="ลบรายการ"
                           >
                             <Trash2 className="w-5 h-5 shrink-0" />
                             <span className="font-bold text-sm hidden sm:inline">ลบรายการ</span>
                             <span className="font-bold text-sm sm:hidden">ลบ</span>
                        </button>
                     ) : (
                        <div className="hidden sm:block"></div> /* Spacer for PC alignment if needed */
                     )}

                     {/* Right Side: Main Actions (Remaining width on Mobile, Auto/Right on PC) */}
                     <div className={`${editingId ? 'flex-1' : 'w-full'} sm:flex-none sm:w-auto sm:ml-auto`}>
                         {viewOnlyMode ? (
                            <button
                                onClick={() => setViewOnlyMode(false)}
                                className="w-full sm:w-auto py-3.5 px-6 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-2xl font-bold hover:bg-indigo-100 hover:border-indigo-200 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Edit className="w-5 h-5" />
                                <span>แก้ไข</span>
                            </button>
                         ) : (
                            <button
                                onClick={handleSaveProject}
                                className="w-full sm:w-auto py-3.5 px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Save className="w-5 h-5" />
                                <span>บันทึก</span>
                            </button>
                         )}
                     </div>
                 </div>
             </div>
           </div>
        </div>
      )}

      {/* Datalist for Autocomplete - Artists */}
      <datalist id="artist-list">
        {savedArtists.map((artist, i) => (
          <option key={i} value={artist} />
        ))}
      </datalist>

      {/* Datalist for Autocomplete - Customers */}
      <datalist id="customer-list">
        {savedCustomers.map((customer, i) => (
          <option key={i} value={customer.name} />
        ))}
      </datalist>

      {/* Datalist for Autocomplete - Recipients (New) */}
      <datalist id="recipient-list">
        {savedRecipients.map((recipient, i) => (
          <option key={i} value={recipient.name} />
        ))}
      </datalist>

      {/* Datalist for Autocomplete - Expenses */}
      <datalist id="expense-categories">
        {expenseCategories.map((cat, i) => (
          <option key={i} value={cat} />
        ))}
      </datalist>

    </div>
  );
};

export default App;