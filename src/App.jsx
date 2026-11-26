import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback, startTransition } from 'react';
import { createPortal } from 'react-dom';
import PersistentPage from './components/common/PersistentPage';
import HeaderFilterPortal from './components/common/HeaderFilterPortal';
import DbCombobox from './components/common/DbCombobox';
import StatusDropdown from './components/common/StatusDropdown';
import { useModalCloseGuard } from './hooks/useModalCloseGuard';
import { resolveInventoryImageFolder } from './services/inventoryImageService.js';
import {
  Home,
  BarChart2,
  Settings as SettingsIcon,
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
  ArrowLeft,
  ArrowUpRight,
  Folder,
  Plus,
  Calendar as CalendarIcon,
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
  LayoutGrid,
  Sparkles,
  Package,
  ShoppingBag,
  Banknote,
  UserCheck,
  Calculator,
  QrCode,
  RefreshCw
} from 'lucide-react';
import Finance from './Finance';
import Calendar from './Calendar';
import Analytics from './Analytics';
import Plans from './Plans';
import Settings from './Settings';
import Locations from './Locations';
import Artists from './Artists';
import Customers from './Customers';
import Inventory from './Inventory';
import Quotations from './Quotations';
import Staff from './Staff';

// --- CONFIGURATION ---
// Google Apps Script API URL สำหรับอัปโหลดรูปภาพและสลิปเข้า Google Drive เท่านั้น (ไม่ใช้เก็บข้อมูลแล้ว)
const GOOGLE_DRIVE_UPLOAD_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || '';
const GOOGLE_SCRIPT_URL = GOOGLE_DRIVE_UPLOAD_URL; // สำหรับฟังก์ชันอัปโหลดรูปภาพเดิม
// ---------------------

// Supabase & IndexedDB Zero-Egress Sync Engine (ข้อมูลทั้งหมด 100% จัดเก็บและซิงก์ผ่าน Supabase)
import { 
  loadProjectsLocalFirst,
  loadProjectsScoped,
  saveProjectSync, 
  deleteProjectSync, 
  subscribeToRealtimeProjects,
  subscribeToRealtimeSettings,
  loadSettingsFromSupabase,
  loadPublicBrandingFromSupabase,
  fetchPublicProjectByToken,
  saveSettingsToSupabase,
  extractGoogleDriveFolderId,
  loadLocationsLocalFirst,
  saveLocationSync,
  loadCustomersLocalFirst,
  loadArtistsLocalFirst,
  loadArtistsAndCustomersSummaryStats,
  fetchProjectDetailOnDemand,
  fetchServerAnalytics,
  fetchServerProjectStats,
  loadProjectsPaginated,
  loadProjectsByMonth,
  subscribeToStaffRealtime,
  subscribeToRolesRealtime,
  subscribeToMasterDataRealtime,
  subscribeToLocalSyncChannel,
  allocateNextProjectCodeSync,
  syncDeletedRecords,
  resetProjectLoadCache,
  DEFAULT_STAFF_MEMBERS,
  DEFAULT_PAYMENT_STATUSES
} from './services/syncService';

const BANKNOTE_DENOMINATION_OPTIONS = [
  { value: 1000, label: 'แบงค์ 1,000', color: 'bg-amber-50 text-amber-800 border-amber-200', dotColor: 'bg-amber-600' },
  { value: 500, label: 'แบงค์ 500', color: 'bg-purple-50 text-purple-700 border-purple-200', dotColor: 'bg-purple-500' },
  { value: 100, label: 'แบงค์ 100', color: 'bg-rose-50 text-rose-700 border-rose-200', dotColor: 'bg-rose-500' },
  { value: 50, label: 'แบงค์ 50', color: 'bg-blue-50 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
  { value: 20, label: 'แบงค์ 20', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' }
];
import { db, clearAllLocalDatabase } from './services/db';
import { loadWarehouseStock } from './services/warehouseService';
import {
  syncExpenseLinesToWarehouse,
  syncSupportCashToWarehouse,
  shouldAutoSyncExpenseLine
} from './utils/financeInventoryBridge';


// Constants & Utilities
import { themeColors, colorPresets, systemStatusTypes } from './constants/appConstants';
import { applyThemeVariables, broadcastShopInfoSync } from './utils/themeManager';
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
import ResetPasswordView from './components/auth/ResetPasswordView';
import CustomerQuotationView from './components/customer/CustomerQuotationView';
import CustomerTrackingView from './components/customer/CustomerTrackingView';
import SharePreviewModal from './components/modals/SharePreviewModal';
import VenueDetailModal from './components/modals/VenueDetailModal';
import VenueDirectoryModal from './components/modals/VenueDirectoryModal';
import BatchDeliveryBanner from './components/common/BatchDeliveryBanner';
import UserProfileModal from './components/modals/UserProfileModal';
import { supabase, getActiveClient } from './services/supabaseClient';

const navItems = [
  { name: 'Calendar', icon: CalendarIcon, label: 'ปฏิทินงาน', shortLabel: 'ปฏิทิน' },
  { name: 'Plans', icon: List, label: 'แผนงาน', shortLabel: 'แผนงาน' },
  { name: 'Finance', icon: Wallet, label: 'การเงิน', shortLabel: 'การเงิน' },
  { name: 'Quotations', icon: Calculator, label: 'คำนวณราคา', shortLabel: 'คำนวณราคา' },
  { name: 'Inventory', icon: Package, label: 'คลังพัสดุ', shortLabel: 'คลังพัสดุ' },
  { name: 'Locations', icon: MapPin, label: 'สถานที่จัดส่ง', shortLabel: 'สถานที่' },
  { name: 'Artists', icon: Sparkles, label: 'ข้อมูลศิลปิน', shortLabel: 'ศิลปิน' },
  { name: 'Customers', icon: Users, label: 'รายชื่อลูกค้า', shortLabel: 'ลูกค้า' },
  { name: 'Staff', icon: UserCheck, label: 'ข้อมูลพนักงาน', shortLabel: 'พนักงาน' },
  { name: 'Analytics', icon: BarChart2, label: 'วิเคราะห์ธุรกิจ', shortLabel: 'วิเคราะห์' },
  { name: 'Settings', icon: SettingsIcon, label: 'ตั้งค่าระบบ', shortLabel: 'ตั้งค่า' },
];

// --- URL Routing Helpers for Direct Page Links (e.g. /plans, /finance, /calendar) ---
const TAB_ROUTES = {
  Calendar: 'calendar',
  Plans: 'plans',
  Finance: 'finance',
  Quotations: 'quotations',
  Inventory: 'inventory',
  Locations: 'location',
  Artists: 'artists',
  Customers: 'customers',
  Staff: 'staff',
  Analytics: 'analytics',
  Settings: 'settings',
};

const ROUTE_TO_TAB = {
  calendarview: 'Calendar',
  calendar: 'Calendar',
  plansview: 'Plans',
  plans: 'Plans',
  financeview: 'Finance',
  finance: 'Finance',
  quotationsview: 'Quotations',
  quotations: 'Quotations',
  quote: 'Quotations',
  pricing: 'Quotations',
  'project-pricing': 'Quotations',
  'calc-price': 'Quotations',
  inventoryview: 'Inventory',
  inventory: 'Inventory',
  locationsview: 'Locations',
  locationview: 'Locations',
  location: 'Locations',
  locations: 'Locations',
  venuesview: 'Locations',
  venues: 'Locations',
  venue: 'Locations',
  artistsview: 'Artists',
  artists: 'Artists',
  customersview: 'Customers',
  customers: 'Customers',
  staffview: 'Staff',
  staff: 'Staff',
  employees: 'Staff',
  analyticsview: 'Analytics',
  analytics: 'Analytics',
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
    if (typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024) {
      return true;
    }
    const saved = localStorage.getItem('nexus_sidebar_collapsed');
    return saved === 'true';
  });

  // Auto-collapse sidebar when crossing into tablet viewports (768px - 1023px)
  useEffect(() => {
    let lastBand = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
    const handleResize = () => {
      const curBand = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
      if (curBand !== lastBand) {
        lastBand = curBand;
        if (curBand === 'tablet') {
          sidebarOpIdRef.current += 1;
          sidebarDragCleanupRef.current?.();
          if (sidebarAnimRafRef.current) {
            cancelAnimationFrame(sidebarAnimRafRef.current);
            sidebarAnimRafRef.current = null;
          }
          clearTimeout(sidebarAnimationTimerRef.current);
          sidebarAnimationTimerRef.current = null;
          isSidebarAnimatingRef.current = false;
          isDraggingSidebarRef.current = false;
          sidebarTargetCollapsedRef.current = true;
          sidebarCurrentWidthRef.current = SIDEBAR_COLLAPSED_W;
          sidebarCurrentProgressRef.current = 0;
          document.body?.classList.remove('is-dragging-sidebar', 'is-sidebar-animating');
          if (sidebarRef.current) {
            sidebarRef.current.style.transition = 'none';
            sidebarRef.current.style.width = `${SIDEBAR_COLLAPSED_W}px`;
            sidebarRef.current.style.setProperty('--sidebar-p', '0');
          }
          if (mainShellRef.current) {
            mainShellRef.current.style.setProperty('--sidebar-layout-w', `${SIDEBAR_COLLAPSED_W}px`);
            mainShellRef.current.style.transform = '';
          }
          setIsSidebarCollapsed(true);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Profile Menu & Modal States
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileProfileMenuOpen, setIsMobileProfileMenuOpen] = useState(false);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [settingsDefaultCategory, setSettingsDefaultCategory] = useState('permissions');

  // Role-Based Permissions Matrix
  const [permissionMatrix, setPermissionMatrix] = useState(() => {
    try {
      const saved = localStorage.getItem('f2u_role_permissions');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    const handlePermissionsUpdated = (e) => {
      if (e.detail) setPermissionMatrix(e.detail);
      else {
        try {
          const saved = localStorage.getItem('f2u_role_permissions');
          if (saved) setPermissionMatrix(JSON.parse(saved));
        } catch (err) {}
      }
    };
    window.addEventListener('f2u_permissions_updated', handlePermissionsUpdated);
    return () => window.removeEventListener('f2u_permissions_updated', handlePermissionsUpdated);
  }, []);

  // Settings Loaded State
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(() => {
      return !!localStorage.getItem('nexus_shop_info');
  });

  // Shop Info State
  const [shopInfo, setShopInfo] = useState(() => {
      try {
          const saved = localStorage.getItem('nexus_shop_info');
          if (saved) {
              const parsed = JSON.parse(saved);
              // Auto-migrate legacy default 'indigo' to 'violet' (Flower2U brand theme #8B5CF6)
              if (!parsed.themeColor || parsed.themeColor === 'indigo') {
                  parsed.themeColor = 'violet';
              }
              if (!parsed.shopName || parsed.shopName === 'NexusPlan' || parsed.shopName === 'ProjectPlan') {
                  parsed.shopName = 'Flower2you';
              }
              return parsed;
          }
          return {
              shopName: 'Flower2you',
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
              themeColor: 'violet',
              themeMode: 'gradient',
              customColorValue: '#000000'
          };
      } catch (e) {
          return {
              shopName: 'Flower2you',
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
              themeColor: 'violet',
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

  const [resetToken, setResetToken] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('reset_token') || null;
      }
      return null;
  });

  const handleExitResetPassword = useCallback(() => {
      if (typeof window !== 'undefined') {
          const basePath = getBasePath();
          window.history.replaceState({}, '', basePath || '/');
      }
      setResetToken(null);
  }, []);

  // Image Loading State
  const [areImagesLoaded, setAreImagesLoaded] = useState(() => {
      const params = new URLSearchParams(window.location.search);
      return !(params.has('tracking') || params.has('quotation'));
  });

  const [activeTab, setActiveTab] = useState(() => {
    return getTabFromUrl();
  });
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([getTabFromUrl() || 'Calendar']));
  const lastFocusSyncRef = useRef(0);
  const lastMasterSyncRef = useRef(0);

  const allowedTabSetRef = useRef(null);

  const handleSelectTab = useCallback((tabName) => {
    if (!tabName || tabName === activeTab) return;
    if (allowedTabSetRef.current && allowedTabSetRef.current.size > 0 && !allowedTabSetRef.current.has(tabName)) {
      return;
    }
    startTransition(() => {
      setVisitedTabs(prev => {
        if (prev.has(tabName)) return prev;
        const next = new Set(prev);
        next.add(tabName);
        return next;
      });
      setActiveTab(tabName);
    });
  }, [activeTab]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isSaving, setIsSaving] = useState(false); 
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isScopeLoading, setIsScopeLoading] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nexus_auth') === 'true' || sessionStorage.getItem('nexus_auth') === 'true';
    }
    return false;
  });
  
  // Auth Users (Synced with real Flower2U Supabase staff; legacy NexusPlan mockups purged)
  const [authorizedUsers, setAuthorizedUsers] = useState(() => {
    const defaultUsers = DEFAULT_STAFF_MEMBERS.map((s) => ({
      username: s.username,
      password: s.password,
      name: s.name,
      role: s.role,
      email: s.email,
      phone: s.phone,
      staffCode: s.staff_code,
      image: s.avatar_url || ''
    }));

    try {
      const saved = localStorage.getItem('nexus_authorized_users');
      if (!saved) return defaultUsers;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return defaultUsers;
      const cleaned = parsed.filter(
        (u) => u && !String(u.email || '').toLowerCase().endsWith('@nexusplan.com')
      );
      return cleaned.length > 0 ? cleaned : defaultUsers;
    } catch (e) {
      return defaultUsers;
    }
  });

  const [loginError, setLoginError] = useState('');
  const [userProfile, setUserProfile] = useState(null);

  const allowedNavItems = useMemo(() => {
    const rawRole = String(userProfile?.role || '').trim();
    const roleLower = rawRole.toLowerCase();
    if (!rawRole || roleLower === 'admin') return navItems;

    // Look up role permissions in permissionMatrix (exact or case-insensitive)
    let allowed = permissionMatrix?.[rawRole]?.allowed_pages;
    if (!Array.isArray(allowed) && permissionMatrix && typeof permissionMatrix === 'object') {
      const matchedKey = Object.keys(permissionMatrix).find((k) => k.toLowerCase() === roleLower);
      if (matchedKey && Array.isArray(permissionMatrix[matchedKey]?.allowed_pages)) {
        allowed = permissionMatrix[matchedKey].allowed_pages;
      }
    }
    // Fall back to allowedPages from login profile if permissionMatrix hasn't synced yet
    if (!Array.isArray(allowed) && Array.isArray(userProfile?.allowedPages)) {
      allowed = userProfile.allowedPages;
    }
    if (!Array.isArray(allowed)) return navItems;

    const normalizedAllowed = new Set(
      allowed.map((page) => (page === 'Venues' ? 'Locations' : page))
    );
    return navItems.filter((item) => normalizedAllowed.has(item.name));
  }, [userProfile?.role, userProfile?.allowedPages, permissionMatrix]);

  const allowedTabSet = useMemo(
    () => new Set(allowedNavItems.map((item) => item.name)),
    [allowedNavItems]
  );

  useEffect(() => {
    allowedTabSetRef.current = isLoggedIn ? allowedTabSet : null;
  }, [isLoggedIn, allowedTabSet]);

  // Enforce page-level access: redirect away if activeTab is not permitted for the current role
  useEffect(() => {
    if (!isLoggedIn || trackingId || quotationId || resetToken) return;
    if (allowedNavItems.length === 0) return;
    if (!allowedTabSet.has(activeTab)) {
      const fallbackTab = allowedNavItems[0].name;
      setVisitedTabs((prev) => {
        if (prev.has(fallbackTab)) return prev;
        const next = new Set(prev);
        next.add(fallbackTab);
        return next;
      });
      setActiveTab(fallbackTab);
    }
  }, [isLoggedIn, trackingId, quotationId, resetToken, activeTab, allowedNavItems, allowedTabSet]);
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
    if (type === 'profiles' || type === 'artists' || type === 'inventory') {
      const assetsFolder = driveFolders.find(f => f.type === 'assets' && f.folderId && f.folderId.trim() !== '');
      return assetsFolder ? assetsFolder.folderId.trim() : (assetsDriveFolderId || '');
    }
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
  const [paymentStatuses, setPaymentStatuses] = useState(() => {
    const cached = loadFromCache('payment_statuses', DEFAULT_PAYMENT_STATUSES);
    return Array.isArray(cached) && cached.length > 0 ? cached : DEFAULT_PAYMENT_STATUSES;
  });

  // Upload States
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // UI States
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
  const [isDesktopFilterExpanded, setIsDesktopFilterExpanded] = useState(false);
  
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

  // Filters & Sort (Decoupled per Tab for Plans, Finance, and Analytics)
  const getNowYearMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const [plansFilter, setPlansFilter] = useState(() => ({
    search: '',
    dateMode: 'month',
    date: getNowYearMonth(),
    dateRange: { start: '', end: '' },
    category: 'all',
    status: 'all',
    transport: 'all',
    sortConfig: { key: 'id', direction: 'desc' }
  }));

  const [financeFilter, setFinanceFilter] = useState(() => ({
    search: '',
    dateMode: 'month',
    date: getNowYearMonth(),
    dateRange: { start: '', end: '' },
    category: 'all',
    status: 'all',
    transport: 'all',
    sortConfig: { key: 'id', direction: 'desc' }
  }));

  const [analyticsFilter, setAnalyticsFilter] = useState(() => ({
    search: '',
    dateMode: 'month',
    date: getNowYearMonth(),
    dateRange: { start: '', end: '' },
    category: 'all',
    status: 'all',
    transport: 'all',
    sortConfig: { key: 'id', direction: 'desc' }
  }));

  const getTabFilter = (tabKey) => {
    if (tabKey === 'Analytics') return analyticsFilter;
    if (tabKey === 'Finance') return financeFilter;
    return plansFilter;
  };

  const updateTabFilter = (tabKey, updates) => {
    const updater = (prev) => ({ ...prev, ...(typeof updates === 'function' ? updates(prev) : updates) });
    if (tabKey === 'Analytics') {
      setAnalyticsFilter(updater);
    } else if (tabKey === 'Finance') {
      setFinanceFilter(updater);
    } else {
      setPlansFilter(updater);
    }
  };

  const resetTabFilter = (tabKey) => {
    const defaultState = {
      search: '',
      dateMode: 'month',
      date: getNowYearMonth(),
      dateRange: { start: '', end: '' },
      category: 'all',
      status: 'all',
      transport: 'all',
      sortConfig: { key: 'id', direction: 'desc' }
    };
    if (tabKey === 'Analytics') {
      setAnalyticsFilter(defaultState);
    } else if (tabKey === 'Finance') {
      setFinanceFilter(defaultState);
    } else {
      setPlansFilter(defaultState);
    }
  };

  // Dynamic getters & setters dynamically mapped to the active tab
  const activeTabFilter = getTabFilter(activeTab);
  const searchTerm = activeTabFilter.search;
  const dateFilterMode = activeTabFilter.dateMode;
  const filterDate = activeTabFilter.date;
  const filterDateRange = activeTabFilter.dateRange;
  const filterCategory = activeTabFilter.category;
  const filterStatus = activeTabFilter.status;
  const filterTransport = activeTabFilter.transport;
  const sortConfig = activeTabFilter.sortConfig;

  const setSearchTerm = (s) => updateTabFilter(activeTab, { search: s });
  const setDateFilterMode = (m) => updateTabFilter(activeTab, { dateMode: m });
  const setFilterDate = (d) => updateTabFilter(activeTab, { date: d });
  const setFilterDateRange = (r) => updateTabFilter(activeTab, { dateRange: r });
  const setFilterCategory = (c) => updateTabFilter(activeTab, { category: c });
  const setFilterStatus = (s) => updateTabFilter(activeTab, { status: s });
  const setFilterTransport = (t) => updateTabFilter(activeTab, { transport: t });
  const setSortConfig = (sc) => updateTabFilter(activeTab, { sortConfig: sc });
  const resetFilters = () => resetTabFilter(activeTab);

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
  const [uploadedImages, setUploadedImages] = useState([]);
  const uploadedImagesRef = useRef([]);
  uploadedImagesRef.current = uploadedImages;
  const pendingPreUploadedFileIdsRef = useRef(new Set());
  const inFlightRefUploadsRef = useRef(new Map());
  const removedRefIdsRef = useRef(new Set());
  const modalSessionIdRef = useRef(0);
  const uploadedImage = uploadedImages.length > 0 
    ? (typeof uploadedImages[0] === 'object' ? uploadedImages[0].url : uploadedImages[0]) 
    : null;
  const setUploadedImage = (img) => {
    if (!img) setUploadedImages([]);
    else if (Array.isArray(img)) setUploadedImages(img);
    else setUploadedImages([img]);
  };
  const [uploadedSlips, setUploadedSlips] = useState([]);
  // Venue Intelligence & Directory States
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [selectedVenueForModal, setSelectedVenueForModal] = useState(null);
  const [isVenueDirectoryOpen, setIsVenueDirectoryOpen] = useState(false);
  // Inventory, Loans & Customers States
  const [inventoryItems, setInventoryItems] = useState([]);
  const [assetLoans] = useState([]);
  const [pendingGameInventoryAction, setPendingGameInventoryAction] = useState(null);
  const [syncSupportToCashVault, setSyncSupportToCashVault] = useState(true);
  const [syncExpensesToWarehouse, setSyncExpensesToWarehouse] = useState(true);

  // Lazy-load non-cash catalog items for seamless Finance/Project <-> Inventory auto-matching
  useEffect(() => {
    if (!isLoggedIn) {
      setInventoryItems([]);
      return;
    }
    if (inventoryItems.length > 0) return;
    if (activeTab !== 'Finance' && activeTab !== 'Quotations' && !isAddModalOpen) return;

    let cancelled = false;
    (async () => {
      try {
        const cached = await db.inventory_items.toArray();
        if (!cancelled && Array.isArray(cached) && cached.length > 0) {
          setInventoryItems(cached);
          return;
        }
        const page = await loadWarehouseStock({ limit: 150, offset: 0 });
        if (!cancelled && page && Array.isArray(page.items)) {
          setInventoryItems(page.items);
        }
      } catch {
        // Silent fallback if warehouse RPC is not initialized yet
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, activeTab, isAddModalOpen, inventoryItems.length]);

  const handleOpenProjectInventoryBag = useCallback((e, project) => {
    if (e) e.stopPropagation();
    if (!project || !project.id) return;
    setPendingGameInventoryAction({ projectId: project.id, mode: 'project' });
    startTransition(() => {
      setVisitedTabs((prev) => {
        if (prev.has('Inventory')) return prev;
        const next = new Set(prev);
        next.add('Inventory');
        return next;
      });
      setActiveTab('Inventory');
    });
  }, []);
  const [customerList, setCustomerList] = useState([]);
  const [artistList, setArtistList] = useState([]);
  const [customerSummaryStats, setCustomerSummaryStats] = useState({});
  const [artistSummaryStats, setArtistSummaryStats] = useState({});
  // Contextual Create Modal Controllers (Single Unified Header Button)
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
  const [isCreateArtistOpen, setIsCreateArtistOpen] = useState(false);
  const [isCreateInventoryOpen, setIsCreateInventoryOpen] = useState(false);
  const [isInventoryHistoryOpen, setIsInventoryHistoryOpen] = useState(false);
  const [isCreateVenueOpen, setIsCreateVenueOpen] = useState(false);
  const [isCreateQuotationOpen, setIsCreateQuotationOpen] = useState(false);
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [isHeaderOverflowOpen, setIsHeaderOverflowOpen] = useState(false);
  const [headerFilterMeta, setHeaderFilterMeta] = useState({
    hasFilters: false,
    isFilterOpen: false,
    activeFilterCount: 0,
    isDirty: false
  });

  const SIDEBAR_COLLAPSED_W = 80;
  const SIDEBAR_EXPANDED_W = 256;
  const sidebarRef = useRef(null);
  const mainShellRef = useRef(null);
  const sidebarOpIdRef = useRef(0);
  const isDraggingSidebarRef = useRef(false);
  const isSidebarAnimatingRef = useRef(false);
  const sidebarHasDraggedRef = useRef(false);
  const suppressSidebarClickRef = useRef(false);
  const suppressSidebarClickUntilRef = useRef(0);
  const sidebarStartWidthRef = useRef(isSidebarCollapsed ? 80 : 256);
  const sidebarCurrentWidthRef = useRef(isSidebarCollapsed ? 80 : 256);
  const sidebarCurrentProgressRef = useRef(isSidebarCollapsed ? 0 : 1);
  const sidebarDragStartXRef = useRef(0);
  const sidebarDragStartYRef = useRef(0);
  const sidebarRafIdRef = useRef(null);
  const sidebarAnimRafRef = useRef(null);
  const sidebarAnimationTimerRef = useRef(null);
  const sidebarGestureActiveRef = useRef(false);
  const sidebarDragCleanupRef = useRef(null);
  const sidebarTargetCollapsedRef = useRef(isSidebarCollapsed);

  useEffect(() => () => {
    sidebarOpIdRef.current += 1;
    sidebarDragCleanupRef.current?.();
    clearTimeout(sidebarAnimationTimerRef.current);
    if (sidebarRafIdRef.current) cancelAnimationFrame(sidebarRafIdRef.current);
    if (sidebarAnimRafRef.current) cancelAnimationFrame(sidebarAnimRafRef.current);
    document.body?.classList.remove('is-dragging-sidebar', 'is-sidebar-animating');
  }, []);

  const enterSidebarGpuMotionMode = useCallback((liveWidth) => {
    if (mainShellRef.current) {
      mainShellRef.current.style.setProperty('--sidebar-layout-w', `${SIDEBAR_COLLAPSED_W}px`);
      const dx = Math.max(0, liveWidth - SIDEBAR_COLLAPSED_W);
      mainShellRef.current.style.transform = `translate3d(${dx.toFixed(2)}px, 0, 0)`;
    }
  }, []);

  const applySidebarMotionFrame = useCallback((width) => {
    const clampedW = Math.max(SIDEBAR_COLLAPSED_W, Math.min(SIDEBAR_EXPANDED_W, width));
    const progress = Math.max(
      0,
      Math.min(1, (clampedW - SIDEBAR_COLLAPSED_W) / (SIDEBAR_EXPANDED_W - SIDEBAR_COLLAPSED_W))
    );
    sidebarCurrentWidthRef.current = clampedW;
    sidebarCurrentProgressRef.current = progress;
    if (sidebarRef.current) {
      sidebarRef.current.style.width = `${clampedW.toFixed(2)}px`;
      sidebarRef.current.style.setProperty('--sidebar-p', progress.toFixed(4));
    }
    if (mainShellRef.current) {
      const dx = clampedW - SIDEBAR_COLLAPSED_W;
      mainShellRef.current.style.transform = `translate3d(${dx.toFixed(2)}px, 0, 0)`;
    }
  }, []);

  const commitSidebarRestLayout = useCallback((collapsed) => {
    const w = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;
    const p = collapsed ? 0 : 1;
    sidebarCurrentWidthRef.current = w;
    sidebarCurrentProgressRef.current = p;
    if (sidebarRef.current) {
      sidebarRef.current.style.transition = 'none';
      sidebarRef.current.style.width = `${w}px`;
      sidebarRef.current.style.setProperty('--sidebar-p', String(p));
    }
    if (mainShellRef.current) {
      mainShellRef.current.style.setProperty('--sidebar-layout-w', `${w}px`);
      mainShellRef.current.style.transform = '';
    }
  }, []);

  const attachSidebarRef = useCallback((node) => {
    sidebarRef.current = node;
    if (!node) return;
    if (!isDraggingSidebarRef.current && !isSidebarAnimatingRef.current) {
      const collapsed = sidebarTargetCollapsedRef.current;
      const w = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;
      const p = collapsed ? 0 : 1;
      sidebarCurrentWidthRef.current = w;
      sidebarCurrentProgressRef.current = p;
      node.style.transition = 'none';
      node.style.width = `${w}px`;
      node.style.setProperty('--sidebar-p', String(p));
    }
  }, []);

  const attachMainShellRef = useCallback((node) => {
    mainShellRef.current = node;
    if (!node) return;
    if (!isDraggingSidebarRef.current && !isSidebarAnimatingRef.current) {
      const w = sidebarTargetCollapsedRef.current ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;
      node.style.setProperty('--sidebar-layout-w', `${w}px`);
      node.style.transform = '';
    }
  }, []);

  const animateSidebarSmoothly = useCallback((expanded, releaseVelocityX = 0) => {
    const opId = ++sidebarOpIdRef.current;
    const nextCollapsed = !expanded;
    sidebarTargetCollapsedRef.current = nextCollapsed;
    try {
      localStorage.setItem('nexus_sidebar_collapsed', String(nextCollapsed));
    } catch {}

    clearTimeout(sidebarAnimationTimerRef.current);
    sidebarAnimationTimerRef.current = null;
    if (sidebarRafIdRef.current) {
      cancelAnimationFrame(sidebarRafIdRef.current);
      sidebarRafIdRef.current = null;
    }
    if (sidebarAnimRafRef.current) {
      cancelAnimationFrame(sidebarAnimRafRef.current);
      sidebarAnimRafRef.current = null;
    }

    const asideEl = sidebarRef.current;
    const targetW = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;

    const completeCommit = () => {
      if (opId !== sidebarOpIdRef.current) return;
      sidebarAnimRafRef.current = null;
      sidebarAnimationTimerRef.current = null;
      isSidebarAnimatingRef.current = false;
      isDraggingSidebarRef.current = false;
      document.body?.classList.remove('is-sidebar-animating', 'is-dragging-sidebar');
      sidebarRef.current?.classList.remove('is-dragging-sidebar');
      commitSidebarRestLayout(nextCollapsed);
      startTransition(() => {
        if (opId === sidebarOpIdRef.current) {
          setIsSidebarCollapsed(() => sidebarTargetCollapsedRef.current);
        }
      });
    };

    if (!asideEl) {
      completeCommit();
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    const fromW = Number.isFinite(sidebarCurrentWidthRef.current)
      ? sidebarCurrentWidthRef.current
      : (asideEl.getBoundingClientRect().width || SIDEBAR_COLLAPSED_W);
    const dist = Math.abs(targetW - fromW);

    asideEl.classList.remove('is-dragging-sidebar');
    document.body?.classList.remove('is-dragging-sidebar');

    if (prefersReducedMotion || dist < 0.5) {
      completeCommit();
      return;
    }

    const fullSpan = SIDEBAR_EXPANDED_W - SIDEBAR_COLLAPSED_W;
    const velocityBoost = Math.min(0.45, Math.abs(releaseVelocityX || 0) * 0.25);
    const baseDuration = (dist / fullSpan) * 215 * (1 - velocityBoost);
    const durationMs = Math.max(110, Math.min(220, Math.round(baseDuration)));

    isSidebarAnimatingRef.current = true;
    document.body?.classList.add('is-sidebar-animating');
    asideEl.style.transition = 'none';
    enterSidebarGpuMotionMode(fromW);
    applySidebarMotionFrame(fromW);

    const startTime = performance.now();
    const deltaW = targetW - fromW;

    const step = (now) => {
      if (opId !== sidebarOpIdRef.current) return;
      const t = Math.min(1, Math.max(0, (now - startTime) / durationMs));
      // Smooth quintic/quartic ease-out matching cubic-bezier(0.22, 1, 0.36, 1)
      const eased = 1 - Math.pow(1 - t, 3.2);
      applySidebarMotionFrame(fromW + deltaW * eased);
      if (t < 1) {
        sidebarAnimRafRef.current = requestAnimationFrame(step);
      } else {
        completeCommit();
      }
    };

    sidebarAnimRafRef.current = requestAnimationFrame(step);
  }, [applySidebarMotionFrame, commitSidebarRestLayout, enterSidebarGpuMotionMode]);

  const expandSidebarSmoothly = useCallback(() => animateSidebarSmoothly(true), [animateSidebarSmoothly]);
  const collapseSidebarSmoothly = useCallback(() => animateSidebarSmoothly(false), [animateSidebarSmoothly]);

  const toggleDesktopSidebar = useCallback(() => {
    if (sidebarTargetCollapsedRef.current) {
      expandSidebarSmoothly();
    } else {
      collapseSidebarSmoothly();
    }
  }, [expandSidebarSmoothly, collapseSidebarSmoothly]);

  useLayoutEffect(() => {
    if (!sidebarRef.current) return;
    if (isDraggingSidebarRef.current || isSidebarAnimatingRef.current) {
      return;
    }
    commitSidebarRestLayout(sidebarTargetCollapsedRef.current);
  }, [isSidebarCollapsed, allowedNavItems.length, commitSidebarRestLayout]);

  useEffect(() => {
    const handleSidebarShortcut = (e) => {
      if (window.innerWidth < 768) return;
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key !== 'b' && e.key !== 'B' && e.code !== 'KeyB') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      e.preventDefault();
      toggleDesktopSidebar();
    };
    window.addEventListener('keydown', handleSidebarShortcut);
    return () => window.removeEventListener('keydown', handleSidebarShortcut);
  }, [toggleDesktopSidebar]);

  const handleSidebarClickCapture = useCallback((e) => {
    if (
      isDraggingSidebarRef.current ||
      (suppressSidebarClickRef.current && performance.now() < suppressSidebarClickUntilRef.current)
    ) {
      suppressSidebarClickRef.current = false;
      suppressSidebarClickUntilRef.current = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // --- Deterministic Pointer-Driven Sidebar Gesture Engine (Zero Competing Handlers / Zero Mid-Flight Self-Bounce) ---
  const handleSidebarDragStart = useCallback((e) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.isPrimary === false) return;
    if (e.target?.closest?.('input, textarea, select, .no-drag, [data-sidebar-no-drag="true"]')) return;

    // Clean up any lingering listeners from an interrupted gesture before starting fresh
    sidebarDragCleanupRef.current?.();
    suppressSidebarClickRef.current = false;
    suppressSidebarClickUntilRef.current = 0;
    sidebarGestureActiveRef.current = true;

    const startX = e.clientX;
    const startY = e.clientY;
    sidebarDragStartXRef.current = startX;
    sidebarDragStartYRef.current = startY;

    const downWidth = Number.isFinite(sidebarCurrentWidthRef.current)
      ? sidebarCurrentWidthRef.current
      : (sidebarTargetCollapsedRef.current ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W);
    const wasAnimatingAtDown = isSidebarAnimatingRef.current;

    sidebarStartWidthRef.current = downWidth;
    sidebarCurrentWidthRef.current = downWidth;
    sidebarHasDraggedRef.current = false;
    isDraggingSidebarRef.current = false;

    let activeDragOpId = 0;
    let dragAnchorX = startX;
    let dragAnchorWidth = downWidth;
    let isDetermined = false;

    const eventTime = (event) => {
      const ts = event?.nativeEvent?.timeStamp ?? event?.timeStamp;
      return Number.isFinite(ts) && ts > 0 ? ts : performance.now();
    };

    const gestureStartedAt = eventTime(e);
    let motionSamples = [{ x: startX, time: gestureStartedAt }];

    const recordMotion = (x, time) => {
      const previous = motionSamples[motionSamples.length - 1];
      if (!previous) {
        motionSamples = [{ x, time }];
        return;
      }
      if (x === previous.x) return;
      if (time - previous.time > 90) {
        motionSamples = [{ x, time }];
        return;
      }
      if (
        motionSamples.length > 1 &&
        Math.sign(x - previous.x) !== Math.sign(previous.x - motionSamples[motionSamples.length - 2].x)
      ) {
        if (Math.abs(x - previous.x) < 6) return;
        motionSamples = [previous];
      }
      motionSamples.push({ x, time });
      while (motionSamples.length > 2 && motionSamples[1].time < time - 90) {
        motionSamples.shift();
      }
    };

    const applyWidthImmediate = (width) => {
      applySidebarMotionFrame(width);
    };

    const cleanup = () => {
      sidebarGestureActiveRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onPointerCancel);
      if (sidebarRafIdRef.current) {
        cancelAnimationFrame(sidebarRafIdRef.current);
        sidebarRafIdRef.current = null;
      }
      sidebarDragCleanupRef.current = null;
    };

    const engageDragAt = (curX) => {
      activeDragOpId = ++sidebarOpIdRef.current;
      clearTimeout(sidebarAnimationTimerRef.current);
      sidebarAnimationTimerRef.current = null;
      if (sidebarAnimRafRef.current) {
        cancelAnimationFrame(sidebarAnimRafRef.current);
        sidebarAnimRafRef.current = null;
      }
      const liveW = Number.isFinite(sidebarCurrentWidthRef.current)
        ? sidebarCurrentWidthRef.current
        : downWidth;

      if (wasAnimatingAtDown || isSidebarAnimatingRef.current) {
        dragAnchorWidth = liveW;
        dragAnchorX = curX;
      } else {
        dragAnchorWidth = downWidth;
        dragAnchorX = startX;
      }

      sidebarStartWidthRef.current = liveW;
      sidebarCurrentWidthRef.current = liveW;
      isSidebarAnimatingRef.current = false;
      isDraggingSidebarRef.current = true;
      sidebarHasDraggedRef.current = true;

      if (isProfileMenuOpen) {
        setIsProfileMenuOpen(false);
      }

      document.body?.classList.remove('is-sidebar-animating');
      document.body?.classList.add('is-dragging-sidebar');
      if (sidebarRef.current) {
        sidebarRef.current.classList.add('is-dragging-sidebar');
        sidebarRef.current.style.transition = 'none';
      }
      enterSidebarGpuMotionMode(liveW);
      applySidebarMotionFrame(liveW);
    };

    const onPointerMove = (moveEv) => {
      if (moveEv.isPrimary === false) return;
      const curX = moveEv.clientX;
      const curY = moveEv.clientY;
      const deltaX = curX - startX;
      const deltaY = curY - startY;
      const now = eventTime(moveEv);
      recordMotion(curX, now);

      if (!isDraggingSidebarRef.current && !isDetermined) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
          cleanup();
          return;
        }
        if (Math.abs(deltaX) > 8) {
          isDetermined = true;
          engageDragAt(curX);
        }
      }

      if (isDraggingSidebarRef.current) {
        if (activeDragOpId !== sidebarOpIdRef.current) {
          cleanup();
          return;
        }
        if (moveEv.cancelable) moveEv.preventDefault();

        const rawTargetW = dragAnchorWidth + (curX - dragAnchorX);
        const clampedW = Math.max(SIDEBAR_COLLAPSED_W, Math.min(SIDEBAR_EXPANDED_W, rawTargetW));
        sidebarCurrentWidthRef.current = clampedW;

        if (!sidebarRafIdRef.current) {
          const scheduledOpId = activeDragOpId;
          sidebarRafIdRef.current = requestAnimationFrame(() => {
            sidebarRafIdRef.current = null;
            if (scheduledOpId !== sidebarOpIdRef.current || !isDraggingSidebarRef.current) return;
            applyWidthImmediate(sidebarCurrentWidthRef.current);
          });
        }
      }
    };

    const finishGesture = (endEv, isCanceled) => {
      const hadPendingRaf = Boolean(sidebarRafIdRef.current);
      cleanup();

      const lastPoint = motionSamples[motionSamples.length - 1];
      const endX = Number.isFinite(endEv?.clientX) ? endEv.clientX : lastPoint.x;
      const endY = Number.isFinite(endEv?.clientY) ? endEv.clientY : startY;
      const totalDeltaX = endX - startX;
      const totalDeltaY = endY - startY;

      if (
        !isCanceled &&
        !sidebarHasDraggedRef.current &&
        Math.abs(totalDeltaX) > 8 &&
        Math.abs(totalDeltaX) >= Math.abs(totalDeltaY)
      ) {
        engageDragAt(endX);
        const clampedW = Math.max(
          SIDEBAR_COLLAPSED_W,
          Math.min(SIDEBAR_EXPANDED_W, dragAnchorWidth + (endX - dragAnchorX))
        );
        sidebarCurrentWidthRef.current = clampedW;
        applyWidthImmediate(clampedW);
      } else if (hadPendingRaf && sidebarHasDraggedRef.current && activeDragOpId === sidebarOpIdRef.current) {
        applyWidthImmediate(sidebarCurrentWidthRef.current);
      }

      document.body?.classList.remove('is-dragging-sidebar');
      sidebarRef.current?.classList.remove('is-dragging-sidebar');
      isDraggingSidebarRef.current = false;

      if (!sidebarHasDraggedRef.current) {
        return;
      }

      if (activeDragOpId && activeDragOpId !== sidebarOpIdRef.current) {
        return;
      }

      // Arm capture-phase click suppressor so releasing over Logo / nav button never double-toggles
      suppressSidebarClickRef.current = true;
      suppressSidebarClickUntilRef.current = performance.now() + 350;
      sidebarHasDraggedRef.current = false;

      const now = eventTime(endEv);
      recordMotion(endX, now);
      const first = motionSamples[0];
      const last = motionSamples[motionSamples.length - 1];
      const recentDeltaX = last.x - first.x;
      const dt = Math.max(1, last.time - first.time);
      const velocityX = isCanceled ? 0 : recentDeltaX / dt;
      const isFlick =
        !isCanceled &&
        now - last.time <= 90 &&
        Math.abs(recentDeltaX) >= 14 &&
        Math.abs(velocityX) >= 0.28;

      const curW = sidebarCurrentWidthRef.current;

      let shouldExpand;
      if (isFlick) {
        shouldExpand = velocityX > 0;
      } else if (downWidth < 120) {
        shouldExpand = curW >= 132;
      } else if (downWidth > 216) {
        shouldExpand = curW >= 204;
      } else {
        shouldExpand = curW >= 168;
      }

      animateSidebarSmoothly(shouldExpand, isFlick ? velocityX : 0);
    };

    const onPointerUp = (endEv) => finishGesture(endEv, false);
    const onPointerCancel = (cancelEv) => finishGesture(cancelEv, true);

    sidebarDragCleanupRef.current = () => {
      cleanup();
      document.body?.classList.remove('is-dragging-sidebar');
      sidebarRef.current?.classList.remove('is-dragging-sidebar');
      isDraggingSidebarRef.current = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onPointerCancel);
  }, [
    isProfileMenuOpen,
    animateSidebarSmoothly,
    applySidebarMotionFrame,
    enterSidebarGpuMotionMode
  ]);

  useEffect(() => {
    const handleFilterSync = (e) => {
      const d = e?.detail;
      if (!d) return;
      setHeaderFilterMeta((prev) => {
        if (
          prev.hasFilters === d.hasFilters &&
          prev.isFilterOpen === d.isFilterOpen &&
          prev.activeFilterCount === d.activeFilterCount &&
          prev.isDirty === d.isDirty
        ) {
          return prev;
        }
        return d;
      });
    };
    window.addEventListener('header-filter-state-sync', handleFilterSync);
    return () => window.removeEventListener('header-filter-state-sync', handleFilterSync);
  }, []);

  useEffect(() => {
    setIsHeaderOverflowOpen(false);
    if (activeTab === 'Settings') {
      setHeaderFilterMeta({ hasFilters: false, isFilterOpen: false, activeFilterCount: 0, isDirty: false });
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isHeaderOverflowOpen) return undefined;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIsHeaderOverflowOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isHeaderOverflowOpen]);
  // Active drag states for modal & file dropzones
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [isDraggingSlip, setIsDraggingSlip] = useState(false);
  const refDragCounterRef = useRef(0);
  const slipDragCounterRef = useRef(0);
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

  const EXPAND_TARGET_H = 156; // Height of secondary 4-column 2-row icon grid in px

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
    const shopName = shopInfo?.shopName || 'NexusPlan';
    if (resetToken) {
      document.title = `ตั้งค่ารหัสผ่านใหม่ - ${shopName}`;
      return;
    }
    // ถ้าอยู่ในโหมดติดตามหรือเสนอราคา ให้ข้ามการตั้งชื่อตาม Tab หลักไปเลย
    if (trackingId) {
        document.title = "กำลังตรวจสอบสถานะ..."; 
        return;
    }
    if (quotationId) {
        document.title = "กำลังโหลดใบเสนอราคา...";
        return;
    }

    const appTitle = shopName;
    const currentTab = navItems.find(item => item.name === activeTab);
    
    if (currentTab) {
      document.title = `${currentTab.label} - ${appTitle}`;
    } else {
      document.title = `${appTitle} Dashboard`;
    }
  }, [activeTab, trackingId, quotationId, resetToken, shopInfo]);

  // Synchronize URL path with activeTab (e.g. /PlansView, /FinanceView)
  useEffect(() => {
    if (!trackingId && !quotationId && !resetToken) {
      updateUrlForTab(activeTab);
    }
  }, [activeTab, trackingId, quotationId, resetToken]);

  // Listen for browser Back/Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const tabFromUrl = getTabFromUrl();
      if (tabFromUrl) {
        setVisitedTabs(prev => new Set([...prev, tabFromUrl]));
        startTransition(() => {
          setActiveTab(tabFromUrl);
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    setVisibleCount(20);
    setIsLoadingMore(false);
  }, [activeTab, searchTerm, dateFilterMode, filterDate, filterDateRange, filterCategory, filterStatus, filterTransport, sortConfig]);

  useEffect(() => {
    const auth = (typeof window !== 'undefined') && (
      localStorage.getItem('nexus_auth') === 'true' || sessionStorage.getItem('nexus_auth') === 'true'
    );
    const savedProfile = (typeof window !== 'undefined') && (
      localStorage.getItem('nexus_profile') || sessionStorage.getItem('nexus_profile')
    );
    if (auth && savedProfile) {
        setIsLoggedIn(true);
        try {
          const profile = JSON.parse(savedProfile);
          setUserProfile(profile);

          // 🛡️ ประสานงานเซสชัน Supabase Auth สำหรับ RLS สิทธิ์ authenticated
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && profile.username) {
              const authEmail = (profile.email && profile.email.includes('@'))
                ? profile.email.trim()
                : `${(profile.username || '').toLowerCase()}@flower2u.internal`;
              const authPass = sessionStorage.getItem('nexus_auth_pass') || '100000';
              supabase.auth.signInWithPassword({ email: authEmail, password: authPass }).catch(() => {});
            }
          });
        } catch (e) {}
    }
  }, []);

  // Dynamic Theme Engine: Uses sub-millisecond CSS variables for silky smooth 60-120fps live updates
  useLayoutEffect(() => {
    applyThemeVariables(shopInfo.themeColor, shopInfo.themeMode, shopInfo.customColorValue);
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
        ? (headerRef.current ? headerRef.current.getBoundingClientRect().bottom : 72)
        : (mainRef.current ? mainRef.current.getBoundingClientRect().top : 0);
      const marginOffset = isMobile ? 8 : 12;
      shouldBeScrolled = sentinel.getBoundingClientRect().top <= targetTop - marginOffset + 1;
    }
    isScrolledRef.current = shouldBeScrolled;
    setIsScrolled(prev => (prev !== shouldBeScrolled ? shouldBeScrolled : prev));
  }, [activeTab]);

  useEffect(() => {
    if (isAddModalOpen && viewOnlyMode && part3Ref.current) {
      setTimeout(() => {
        part3Ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [isAddModalOpen, viewOnlyMode]);

  // --- 3. FUNCTION DEFINITIONS ---

  const lastSettingsSyncRef = useRef(0);
  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;
  const refreshActiveProjectScopeRef = useRef(null);
  refreshActiveProjectScopeRef.current = () => {
    if (activeTab === 'Plans') {
      loadProjectsScoped({
        mode: plansFilter.dateMode,
        date: plansFilter.date,
        range: { start: plansFilter.dateRange?.start, end: plansFilter.dateRange?.end },
        dateField: 'project'
      }, (projects, deletedIds) => {
        applyProjectsData(projects, deletedIds);
      });
    } else if (activeTab === 'Finance') {
      loadProjectsScoped({
        mode: financeFilter.dateMode,
        date: financeFilter.date,
        range: { start: financeFilter.dateRange?.start, end: financeFilter.dateRange?.end },
        includeDetails: financeFilter.dateMode !== 'year' && financeFilter.dateMode !== 'all',
        dateField: 'payment'
      }, (projects, deletedIds) => {
        applyProjectsData(projects, deletedIds);
      });
    }
  };

  // [MODIFIED] โหลดการตั้งค่าตรงจาก Supabase (แทน Google Apps Script) พร้อม Smart Diffing
  const fetchSettings = async (showSyncIndicator = false) => {
    if (showSyncIndicator) setIsSyncingSettings(true);
    
    try {
        const data = await loadSettingsFromSupabase();
        if (data) {
            lastSettingsSyncRef.current = Date.now();
            // Helper ตรวจสอบข้อมูลก่อน อัปเดต State เฉพาะจุดที่มีการเปลี่ยนแปลงเท่านั้น
            const updateIfChanged = (setter, newValue, cacheKey) => {
                setter(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(newValue)) {
                        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(newValue));
                        return newValue;
                    }
                    return prev;
                });
            };

            if (data.shopInfo) {
                applyThemeVariables(data.shopInfo.themeColor, data.shopInfo.themeMode, data.shopInfo.customColorValue);
                updateIfChanged(setShopInfo, data.shopInfo, 'nexus_shop_info');
            }
            if (data.referenceFolderId !== undefined) setDriveFolderId(data.referenceFolderId);
            if (data.assetsFolderId !== undefined) setAssetsDriveFolderId(data.assetsFolderId);
            if (data.driveFolders) {
                setDriveFolders(data.driveFolders);
                localStorage.setItem('nexus_drive_folders', JSON.stringify(data.driveFolders));
            }
            if (data.lineBotToken !== undefined) setLineBotToken(data.lineBotToken);
            if (data.telegramBotToken !== undefined) setTelegramBotToken(data.telegramBotToken);
            if (data.telegramChatId !== undefined) setTelegramChatId(data.telegramChatId);

            if (data.projectCategories && Array.isArray(data.projectCategories)) {
                updateIfChanged(setProjectCategories, data.projectCategories, 'nexus_project_categories');
            }
            if (data.expenseCategories && Array.isArray(data.expenseCategories)) {
                updateIfChanged(setExpenseCategories, data.expenseCategories, 'nexus_expense_categories');
            }
            if (data.dealStatuses && Array.isArray(data.dealStatuses)) {
                updateIfChanged(setDealStatuses, data.dealStatuses, 'nexus_deal_statuses');
            }
            if (data.transportStatuses && Array.isArray(data.transportStatuses)) {
                updateIfChanged(setTransportStatuses, data.transportStatuses, 'nexus_transport_statuses');
            }
            if (data.paymentStatuses && Array.isArray(data.paymentStatuses) && data.paymentStatuses.length > 0) {
                updateIfChanged(setPaymentStatuses, data.paymentStatuses, 'nexus_payment_statuses');
            }

            // Authoritative role permissions sync (prevents resurrecting deleted custom roles)
            if (data.roles) {
                let nextRolesMatrix = null;
                if (Array.isArray(data.roles) && data.roles.length > 0) {
                    nextRolesMatrix = {};
                    data.roles.forEach((r) => {
                        if (!r?.name) return;
                        nextRolesMatrix[r.name] = {
                            label: r.label || r.name,
                            code: r.code || '99',
                            description: r.description || '',
                            allowed_pages: Array.isArray(r.allowed_pages) ? r.allowed_pages : [],
                            can_edit_pricing: !!r.can_edit_pricing,
                            can_delete_project: !!r.can_delete_project,
                            can_borrow_tools: r.can_borrow_tools !== undefined ? !!r.can_borrow_tools : true,
                            can_manage_users: !!r.can_manage_users,
                            is_system_role: !!r.is_system_role
                        };
                    });
                } else if (!Array.isArray(data.roles) && typeof data.roles === 'object' && Object.keys(data.roles).length > 0) {
                    nextRolesMatrix = data.roles;
                }
                if (nextRolesMatrix) {
                    updateIfChanged(setPermissionMatrix, nextRolesMatrix, 'f2u_role_permissions');
                }
            }

            if (data.appCredentials && Array.isArray(data.appCredentials) && data.appCredentials.length > 0) {
                updateIfChanged(setAuthorizedUsers, data.appCredentials, 'nexus_authorized_users');

                // Sync current logged-in user profile with latest data from server
                const currentStoredProfile = localStorage.getItem('nexus_profile') || sessionStorage.getItem('nexus_profile');
                if (currentStoredProfile) {
                    const currentObj = JSON.parse(currentStoredProfile);
                    const updatedUser = data.appCredentials.find(u => (u.username || '').toLowerCase() === (currentObj.username || '').toLowerCase());
                    
                    if (updatedUser) {
                        const nextAllowedPages = Array.isArray(updatedUser.allowedPages)
                            ? updatedUser.allowedPages
                            : (updatedUser.role !== currentObj.role ? undefined : currentObj.allowedPages);
                        const hasProfileChanged = (
                            updatedUser.image !== currentObj.image ||
                            updatedUser.name !== currentObj.name ||
                            updatedUser.role !== currentObj.role ||
                            updatedUser.email !== currentObj.email ||
                            updatedUser.phone !== currentObj.phone ||
                            JSON.stringify(nextAllowedPages) !== JSON.stringify(currentObj.allowedPages)
                        );
                        if (hasProfileChanged) {
                            const newProfile = {
                                ...currentObj,
                                name: updatedUser.name,
                                role: updatedUser.role,
                                email: updatedUser.email,
                                phone: updatedUser.phone,
                                image: updatedUser.image,
                                allowedPages: nextAllowedPages
                            };
                            setUserProfile(newProfile);
                            const serialized = JSON.stringify(newProfile);
                            const hasLocal = Boolean(localStorage.getItem('nexus_profile'));
                            const hasSession = Boolean(sessionStorage.getItem('nexus_profile'));
                            if (hasLocal || !hasSession) localStorage.setItem('nexus_profile', serialized);
                            if (hasSession) sessionStorage.setItem('nexus_profile', serialized);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error fetching settings from Supabase:", error);
    } finally {
        setIsSettingsLoaded(true); 
        if (showSyncIndicator) setIsSyncingSettings(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchSettings();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pub = await loadPublicBrandingFromSupabase();
        if (!cancelled && pub) {
          if (pub.shopInfo) {
            applyThemeVariables(pub.shopInfo.themeColor, pub.shopInfo.themeMode, pub.shopInfo.customColorValue);
            setShopInfo(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(pub.shopInfo)) {
                localStorage.setItem('nexus_shop_info', JSON.stringify(pub.shopInfo));
                return pub.shopInfo;
              }
              return prev;
            });
          }
          if (Array.isArray(pub.dealStatuses)) {
            setDealStatuses(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(pub.dealStatuses)) {
                localStorage.setItem('nexus_deal_statuses', JSON.stringify(pub.dealStatuses));
                return pub.dealStatuses;
              }
              return prev;
            });
          }
          if (Array.isArray(pub.transportStatuses)) {
            setTransportStatuses(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(pub.transportStatuses)) {
                localStorage.setItem('nexus_transport_statuses', JSON.stringify(pub.transportStatuses));
                return pub.transportStatuses;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error('Error loading public branding:', err);
      } finally {
        if (!cancelled) setIsSettingsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  // [MODIFIED] เรียกใช้งานพร้อมสั่งให้แสดง Indicator (จำกัด Freshness Guard 2 นาที)
  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeTab === 'Settings' && Date.now() - lastSettingsSyncRef.current >= 120000) {
      fetchSettings(true);
    }
  }, [isLoggedIn, activeTab]);

  // ฟังก์ชันกระจายข้อมูลโปรเจกต์ไปยัง State ที่เกี่ยวข้อง (รวมข้อมูลอย่างฉลาด และกวาดล้างไอดีที่ถูกลบ)
  const applyProjectsData = useCallback((projects, deletedIds = []) => {
    if (!Array.isArray(projects)) return;

    const deletedSet = new Set(Array.isArray(deletedIds) ? deletedIds : []);

    setAllActivities(prev => {
      const map = new Map();
      prev.forEach(p => {
        if (p && p.id && !deletedSet.has(p.id)) {
          map.set(p.id, p);
        }
      });
      projects.forEach(p => {
        if (p && p.id && !deletedSet.has(p.id)) {
          map.set(p.id, p);
        }
      });
      const uniqueItems = Array.from(map.values());

      if (uniqueItems.length === prev.length && uniqueItems.every((item, i) => JSON.stringify(item) === JSON.stringify(prev[i]))) return prev;
      return uniqueItems;
    });
  }, []);

  useEffect(() => {
    const artists = [...new Set([
      ...(Array.isArray(artistList) ? artistList.map(a => a?.name).filter(Boolean) : []),
      ...allActivities.map(item => item.artist).filter(a => a && a !== '-')
    ])].sort();
    setSavedArtists(artists);

    const customersMap = new Map();
    if (Array.isArray(customerList)) {
      customerList.forEach(cust => {
        if (cust && cust.name) {
          customersMap.set(cust.name, {
            name: cust.name,
            social: cust.social_account || cust.social || '',
            line: cust.line_id || cust.line || '',
            phone: cust.phone || '',
            email: cust.email || '',
            taxId: cust.tax_id || cust.taxId || '',
            address: cust.billing_address || cust.address || ''
          });
        }
      });
    }
    allActivities.forEach(item => {
      if (item.customer && item.customer !== '-') {
        const existing = customersMap.get(item.customer) || {};
        const info = item.customerInfo || {};
        customersMap.set(item.customer, {
          name: item.customer,
          social: existing.social || info.social || '',
          line: existing.line || info.line || '',
          phone: existing.phone || info.phone || '',
          email: existing.email || info.email || '',
          taxId: existing.taxId || info.taxId || '',
          address: existing.address || info.address || ''
        });
      }
    });
    setSavedCustomers(Array.from(customersMap.values()));

    const recipientsMap = new Map();
    allActivities.forEach(item => {
      if (item.recipient && !recipientsMap.has(item.recipient)) {
        recipientsMap.set(item.recipient, {
          name: item.recipient,
          phone: item.recipientPhone || ''
        });
      }
    });
    setSavedRecipients(Array.from(recipientsMap.values()));

  }, [allActivities, customerList, artistList]);

  // ดึงข้อมูลผ่านระบบ Local-First (อ่านจาก IndexedDB 0ms ทันที แล้วแอบซิงก์ส่วนต่างจาก Supabase)
  const fetchProjects = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    
    try {
      // Fetch a compact server-side aggregate rather than all project rows.
      fetchServerProjectStats().then(s => { if (s) setServerStats(s); }).catch(() => {});

      // ซิงก์กวาดล้างรายการที่ถูกลบจากเครื่องอื่น (Tombstone Sync) ทันที
      syncDeletedRecords((deletedIds) => {
        applyProjectsData([], deletedIds);
      }).catch(() => {});

      // Master dropdown data changes less often than project status; explicit refresh bypasses this window.
      if (!isSilent || Date.now() - lastMasterSyncRef.current >= 300000) {
        lastMasterSyncRef.current = Date.now();
        loadLocationsLocalFirst((locations) => {
          if (Array.isArray(locations) && typeof setDeliveryLocations === 'function') setDeliveryLocations(locations);
        });
        loadCustomersLocalFirst((custs) => {
          if (Array.isArray(custs) && typeof setCustomerList === 'function') setCustomerList(custs);
        });
        loadArtistsLocalFirst((arts) => {
          if (Array.isArray(arts) && typeof setArtistList === 'function') setArtistList(arts);
        });
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      if (!isSilent) showToast("การเชื่อมต่อล่าช้า ระบบกำลังทำงานในโหมด Offline", "error");
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  // Lazy-load Artist & Customer summary stats ONLY when visiting Artists or Customers tabs
  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeTab !== 'Artists' && activeTab !== 'Customers') return;
    let cancelled = false;
    loadArtistsAndCustomersSummaryStats(({ artistStats, customerStats } = {}) => {
      if (cancelled) return;
      if (artistStats) setArtistSummaryStats(artistStats);
      if (customerStats) setCustomerSummaryStats(customerStats);
    });
    return () => { cancelled = true; };
  }, [isLoggedIn, activeTab]);

  // Public single-project lookup for unauthenticated ?tracking= / ?quotation= links (Zero-Egress)
  useEffect(() => {
    const publicToken = trackingId || quotationId;
    if (!publicToken || isLoggedIn) return;
    let cancelled = false;
    setIsLoading(true);
    fetchPublicProjectByToken(publicToken)
      .then((pubProj) => {
        if (cancelled) return;
        if (pubProj && !pubProj.error && pubProj.id) {
          setAllActivities([pubProj]);
        } else {
          setAllActivities([]);
        }
      })
      .catch((err) => {
        console.error('Public project lookup error:', err);
        if (!cancelled) setAllActivities([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isLoggedIn, trackingId, quotationId]);

  useEffect(() => {
    if (isLoggedIn) {
        lastFocusSyncRef.current = Date.now();
        fetchProjects();

        // เปิดรับ Realtime Live Sync จาก Supabase สำหรับโปรเจกต์
        const unsubscribe = subscribeToRealtimeProjects((updatedProjects, deletedIds) => {
          console.log('⚡ Realtime projects received in App:', updatedProjects?.length);
          applyProjectsData(updatedProjects, deletedIds);
        });

        // เปิดรับ Realtime Live Sync สำหรับการตั้งค่าร้าน, สถานะ, หมวดหมู่ และโฟลเดอร์ Drive
        const unsubSettings = subscribeToRealtimeSettings((updatedShopInfo, rawSettings) => {
          const syncStateAndCache = (setter, nextVal, storageKey) => {
            setter(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(nextVal)) {
                if (storageKey) localStorage.setItem(storageKey, JSON.stringify(nextVal));
                return nextVal;
              }
              return prev;
            });
          };
          if (updatedShopInfo) {
            applyThemeVariables(updatedShopInfo.themeColor, updatedShopInfo.themeMode, updatedShopInfo.customColorValue);
            syncStateAndCache(setShopInfo, updatedShopInfo, 'nexus_shop_info');
          }
          if (rawSettings && typeof rawSettings === 'object') {
            if (Array.isArray(rawSettings.payment_statuses) && rawSettings.payment_statuses.length > 0) {
              syncStateAndCache(setPaymentStatuses, rawSettings.payment_statuses, 'nexus_payment_statuses');
            }
            if (Array.isArray(rawSettings.deal_statuses)) {
              syncStateAndCache(setDealStatuses, rawSettings.deal_statuses, 'nexus_deal_statuses');
            }
            if (Array.isArray(rawSettings.transport_statuses)) {
              syncStateAndCache(setTransportStatuses, rawSettings.transport_statuses, 'nexus_transport_statuses');
            }
            if (Array.isArray(rawSettings.project_categories)) {
              syncStateAndCache(setProjectCategories, rawSettings.project_categories, 'nexus_project_categories');
            }
            if (Array.isArray(rawSettings.expense_categories)) {
              syncStateAndCache(setExpenseCategories, rawSettings.expense_categories, 'nexus_expense_categories');
            }
            if (Array.isArray(rawSettings.drive_folders)) {
              const normalizedFolders = rawSettings.drive_folders.map(f => ({
                ...f,
                folderId: extractGoogleDriveFolderId(f?.folderId)
              }));
              syncStateAndCache(setDriveFolders, normalizedFolders, 'nexus_drive_folders');
              const ref = normalizedFolders.find(f => f.type === 'reference');
              const ass = normalizedFolders.find(f => f.type === 'assets');
              if (ref) setDriveFolderId(ref.folderId);
              if (ass) setAssetsDriveFolderId(ass.folderId);
            }
            if (rawSettings.reference_folder_id !== undefined) {
              setDriveFolderId(extractGoogleDriveFolderId(rawSettings.reference_folder_id));
            }
            if (rawSettings.assets_folder_id !== undefined) {
              setAssetsDriveFolderId(extractGoogleDriveFolderId(rawSettings.assets_folder_id));
            }
          }
        });

        const applyRealtimeStaffProfile = (staffRow) => {
          const liveProfile = userProfileRef.current;
          if (!liveProfile || !staffRow) return;
          const curStaffCode = liveProfile.staffCode || liveProfile.id;
          const curUsername = (liveProfile.username || '').toLowerCase();
          const targetStaffCode = staffRow.staff_code || staffRow.id;
          const targetUsername = (staffRow.username || '').toLowerCase();
          const isMatch = (targetStaffCode && String(targetStaffCode) === String(curStaffCode)) ||
                          (targetUsername && targetUsername === curUsername);
          if (!isMatch) return;

          const nextRole = staffRow.role || liveProfile.role;
          const nextName = staffRow.full_name || staffRow.name || liveProfile.name;
          const nextEmail = staffRow.email ?? liveProfile.email;
          const nextPhone = staffRow.phone ?? liveProfile.phone;
          const nextImage = staffRow.profile_image_url || staffRow.avatar_url || staffRow.image || liveProfile.image;
          const nextAllowedPages = Array.isArray(staffRow.allowed_pages)
            ? staffRow.allowed_pages
            : (nextRole !== liveProfile.role ? undefined : liveProfile.allowedPages);

          const hasChanged = (
            nextRole !== liveProfile.role ||
            nextName !== liveProfile.name ||
            nextEmail !== liveProfile.email ||
            nextPhone !== liveProfile.phone ||
            nextImage !== liveProfile.image ||
            JSON.stringify(nextAllowedPages) !== JSON.stringify(liveProfile.allowedPages)
          );
          if (!hasChanged) return;

          const nextProfile = {
            ...liveProfile,
            role: nextRole,
            name: nextName,
            email: nextEmail,
            phone: nextPhone,
            image: nextImage,
            allowedPages: nextAllowedPages
          };
          setUserProfile(nextProfile);
          const serialized = JSON.stringify(nextProfile);
          if (localStorage.getItem('nexus_profile')) localStorage.setItem('nexus_profile', serialized);
          if (sessionStorage.getItem('nexus_profile')) sessionStorage.setItem('nexus_profile', serialized);
        };

        // เปิดรับ Realtime Roles & Permissions ข้ามอุปกรณ์
        const unsubRoles = typeof subscribeToRolesRealtime === 'function'
          ? subscribeToRolesRealtime((newMatrix) => {
              if (newMatrix && typeof newMatrix === 'object') {
                setPermissionMatrix(prev => {
                  if (JSON.stringify(prev) !== JSON.stringify(newMatrix)) {
                    localStorage.setItem('f2u_role_permissions', JSON.stringify(newMatrix));
                    return newMatrix;
                  }
                  return prev;
                });
              }
            })
          : null;

        // เปิดรับ Realtime Master Data (สถานที่จัดส่ง / ศิลปิน / ลูกค้า) ข้ามอุปกรณ์
        const unsubMaster = typeof subscribeToMasterDataRealtime === 'function'
          ? subscribeToMasterDataRealtime({
              onLocationsChange: setDeliveryLocations,
              onArtistsChange: setArtistList,
              onCustomersChange: setCustomerList
            })
          : null;

        // เปิดรับ Realtime Cross-Tab / Multi-Window Sync ผ่าน LocalSyncChannel
        const unsubLocalSync = typeof subscribeToLocalSyncChannel === 'function'
          ? subscribeToLocalSyncChannel((msg) => {
              if (!msg || typeof msg !== 'object') return;
              if (msg.type === 'SHOP_INFO_SYNC' && msg.shopInfo) {
                const s = msg.shopInfo;
                applyThemeVariables(s.themeColor, s.themeMode, s.customColorValue);
                setShopInfo(prev => (JSON.stringify(prev) !== JSON.stringify(s) ? s : prev));
              } else if (msg.type === 'PERMISSIONS_UPDATED' && msg.permissions) {
                setPermissionMatrix(prev => {
                  if (JSON.stringify(prev) !== JSON.stringify(msg.permissions)) {
                    localStorage.setItem('f2u_role_permissions', JSON.stringify(msg.permissions));
                    return msg.permissions;
                  }
                  return prev;
                });
              } else if (msg.type === 'STAFF_UPDATED' && msg.staff) {
                applyRealtimeStaffProfile(msg.staff);
              } else if (msg.type === 'RECORD_DELETED' && msg.id) {
                if (msg.table === 'projects') {
                  applyProjectsData([], [msg.id]);
                } else if (msg.table === 'artists') {
                  setArtistList(prev => prev.filter(item => String(item?.id) !== String(msg.id)));
                } else if (msg.table === 'customers') {
                  setCustomerList(prev => prev.filter(item => String(item?.id) !== String(msg.id)));
                } else if (msg.table === 'delivery_locations') {
                  setDeliveryLocations(prev => prev.filter(item => String(item?.id) !== String(msg.id)));
                }
              }
            })
          : null;

        // 🛡️ SECURITY DIRECTIVE: ตรวจจับสัญญาณเตะพนักงานที่ถูกระงับ/แบนทันทีแบบ Real-Time (Cross-Tab)
        let kickBc = null;
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            kickBc = new BroadcastChannel('flower2u_staff_kick');
            kickBc.onmessage = async (event) => {
              if (event.data?.type === 'FORCE_KICK_BANNED') {
                const liveProfile = userProfileRef.current;
                const targetStaffId = event.data?.staffId;
                const targetUsername = (event.data?.username || '').toLowerCase();
                const curStaffCode = liveProfile?.staffCode || liveProfile?.id;
                const curUsername = (liveProfile?.username || '').toLowerCase();
                if ((targetStaffId && String(targetStaffId) === String(curStaffCode)) ||
                    (targetUsername && targetUsername === curUsername)) {
                  console.warn('🚨 Account suspended by Admin. Purging all storage and kicking immediately.');
                  await handleLogout(event.data?.reason || 'บัญชีของคุณถูกระงับการใช้งานโดยผู้ดูแลระบบ');
                }
              }
            };
          }
        } catch (bcErr) {}

        // 🛡️ SECURITY DIRECTIVE: ตรวจจับสัญญาณแบนพนักงานข้ามเครือข่าย/ข้ามเครื่องผ่าน Supabase Realtime + แจ้ง Staff.jsx
        const unsubStaff = subscribeToStaffRealtime(async (staffRow, eventType) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('f2u:staff-realtime', { detail: { staffRow, eventType } }));
          }
          if (!staffRow || eventType === 'DELETE') return;
          const liveProfile = userProfileRef.current;
          const curStaffCode = liveProfile?.staffCode || liveProfile?.id;
          const curUsername = (liveProfile?.username || '').toLowerCase();
          const targetStaffCode = staffRow.staff_code || staffRow.id;
          const targetUsername = (staffRow.username || '').toLowerCase();
          
          if ((targetStaffCode && String(targetStaffCode) === String(curStaffCode)) ||
              (targetUsername && targetUsername === curUsername)) {
            const isSuspended = staffRow.is_banned_permanent || 
                                staffRow.is_active === false || 
                                (staffRow.banned_until && new Date(staffRow.banned_until) > new Date());
            if (isSuspended) {
              console.warn('🚨 Realtime ban detected from server. Purging all storage and kicking immediately.');
              await handleLogout('บัญชีของคุณถูกระงับการใช้งานโดยผู้ดูแลระบบ');
            } else {
              applyRealtimeStaffProfile(staffRow);
            }
          }
        });

        const handleLocalStaffUpdated = (e) => {
          if (e?.detail) applyRealtimeStaffProfile(e.detail);
        };
        window.addEventListener('f2u_staff_updated', handleLocalStaffUpdated);

        const onStorage = (e) => {
          if (e.key === 'nexus_shop_info' && e.newValue) {
            try {
              const parsed = JSON.parse(e.newValue);
              applyThemeVariables(parsed.themeColor, parsed.themeMode, parsed.customColorValue);
              setShopInfo(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(parsed)) {
                  return parsed;
                }
                return prev;
              });
            } catch (err) {}
          }
        };
        window.addEventListener('storage', onStorage);

        const onFocus = () => {
            const now = Date.now();
            if (now - lastFocusSyncRef.current < 300000) return;
            lastFocusSyncRef.current = now;
            fetchProjects(true);
            if (typeof refreshActiveProjectScopeRef !== 'undefined') {
              refreshActiveProjectScopeRef.current?.();
            }
        };

        window.addEventListener('focus', onFocus);
        
        return () => {
          window.removeEventListener('focus', onFocus);
          window.removeEventListener('storage', onStorage);
          window.removeEventListener('f2u_staff_updated', handleLocalStaffUpdated);
          if (kickBc) kickBc.close();
          if (typeof unsubLocalSync === 'function') unsubLocalSync();
          if (typeof unsubRoles === 'function') unsubRoles();
          if (typeof unsubMaster === 'function') unsubMaster();
          if (typeof unsubStaff === 'function') unsubStaff();
          if (typeof unsubscribe === 'function') unsubscribe();
          if (typeof unsubSettings === 'function') unsubSettings();
        };
    }
  }, [isLoggedIn]);

  // 🛡️ SECURITY DIRECTIVE: เมื่อไม่อยู่ในสถานะ Login ให้ล้าง IndexedDB ในเครื่องทันที
  useEffect(() => {
    if (!isLoggedIn && !trackingId && !quotationId && !resetToken) {
      resetProjectLoadCache();
      clearAllLocalDatabase().catch(() => {});
    }
  }, [isLoggedIn, trackingId, quotationId, resetToken]);

  // 🛡️ SECURITY SHIELD: ป้องกันการกดเปิด DevTools และคลิกขวาตรวจสอบโค้ดในหน้า Login
  useEffect(() => {
    if (isLoggedIn || resetToken) return;
    
    const handleKeyDown = (e) => {
      // ดัก F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // ดัก Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // ดัก Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault(); // ป้องกันการกด Inspect ผ่านคลิกขวา
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [isLoggedIn, resetToken]);

  // จัดการการเปลี่ยนเดือนในหน้าปฏิทินแบบ Memoized (ป้องกัน Infinite Fetch Loop)
  const handleCalendarMonthChange = useCallback((ym) => {
    if (isLoggedIn && ym) {
      loadProjectsScoped({ mode: 'month', date: ym }, (projects, deletedIds) => {
        applyProjectsData(projects, deletedIds);
      });
    }
  }, [isLoggedIn, applyProjectsData]);

  // 🎯 ZERO-EGRESS SCOPED LOADERS แยกอิสระตามแต่ละแท็บ (Plans, Finance, Analytics)
  // 1. แท็บแผนงาน (Plans): ดึงเฉพาะข้อมูลของเดือน/วันที่หน้า Plans เลือก (เฉพาะเมื่อ Login แล้ว)
  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'Plans') return;
    let cancelled = false;
    setIsScopeLoading(true);
    loadProjectsScoped({
      mode: plansFilter.dateMode,
      date: plansFilter.date,
      range: { start: plansFilter.dateRange?.start, end: plansFilter.dateRange?.end },
      dateField: 'project'
    }, (projects, deletedIds) => {
      if (cancelled) return;
      applyProjectsData(projects, deletedIds);
      setIsScopeLoading(false);
    }).finally(() => {
      if (!cancelled) setIsScopeLoading(false);
    });
    return () => { cancelled = true; };
  }, [isLoggedIn, activeTab, plansFilter.dateMode, plansFilter.date, plansFilter.dateRange?.start, plansFilter.dateRange?.end, applyProjectsData]);

  // 2. แท็บการเงิน (Finance): ดึงเฉพาะข้อมูลของเดือน/วันที่หน้า Finance เลือก (ละเว้นตารางลูกตอนดูรายปี/ทั้งหมด)
  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeTab === 'Finance') {
      let cancelled = false;
      loadProjectsScoped({
        mode: financeFilter.dateMode,
        date: financeFilter.date,
        range: { start: financeFilter.dateRange?.start, end: financeFilter.dateRange?.end },
        includeDetails: financeFilter.dateMode !== 'year' && financeFilter.dateMode !== 'all',
        dateField: 'payment'
      }, (projects, deletedIds) => {
        if (!cancelled) applyProjectsData(projects, deletedIds);
      });
      return () => { cancelled = true; };
    }
  }, [isLoggedIn, activeTab, financeFilter.dateMode, financeFilter.date, financeFilter.dateRange?.start, financeFilter.dateRange?.end, applyProjectsData]);

  // 3. แท็บวิเคราะห์ (Analytics): ยิง Server Pushdown RPC ล้วน 100% (ไม่ดึงโปรเจกต์ดิบลง IndexedDB)
  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeTab === 'Analytics') {
      let cancelled = false;
      setIsAnalyticsLoading(true);
      setServerAnalytics(null);

      fetchServerAnalytics({
        mode: analyticsFilter.dateMode,
        date: analyticsFilter.date,
        range: { start: analyticsFilter.dateRange?.start, end: analyticsFilter.dateRange?.end },
        category: analyticsFilter.category,
        dealStatus: analyticsFilter.status,
        transportStatus: analyticsFilter.transport,
        search: analyticsFilter.search,
      })
        .then((res) => {
          if (!cancelled && res) {
            setServerAnalytics(res);
          }
        })
        .catch((err) => {
          console.warn('[Analytics] Server RPC failed:', err);
        })
        .finally(() => {
          if (!cancelled) setIsAnalyticsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [
    isLoggedIn,
    activeTab,
    analyticsFilter.dateMode,
    analyticsFilter.date,
    analyticsFilter.dateRange?.start,
    analyticsFilter.dateRange?.end,
    analyticsFilter.category,
    analyticsFilter.status,
    analyticsFilter.transport,
    analyticsFilter.search,
  ]);
  useEffect(() => {
      if ((trackingId || quotationId) && allActivities.length > 0) {
          const targetToken = trackingId || quotationId;
          const foundItem = allActivities.find(item => 
              item.trackingToken === targetToken ||
              generateTrackingToken(item.id, item.rawDateTime) === targetToken ||
              (!isLoggedIn && allActivities.length === 1 && item.id)
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

  // [MODIFIED] บันทึกการตั้งค่าลง Supabase โดยตรง (100% Zero Sheets)
  const saveSystemSettings = async (key, value, options = {}) => {
      setIsSaving(true);
      
      const partialData = (typeof key === 'object') ? key : { [key]: value };

      if (shopInfo.logo && shopInfo.logo.startsWith('data:image')) {
          showToast("กำลังประมวลผลรูปภาพ กรุณารอสักครู่...", "error");
          setIsSaving(false);
          return;
      }

      try {
          await saveSettingsToSupabase(partialData);
          
          // Update Local State & Cache
          if (partialData.app_credentials) {
              setAuthorizedUsers(partialData.app_credentials);
              localStorage.setItem('nexus_authorized_users', JSON.stringify(partialData.app_credentials));
          }
          if (partialData.project_categories) {
              setProjectCategories(partialData.project_categories);
              localStorage.setItem('nexus_project_categories', JSON.stringify(partialData.project_categories));
          }
          if (partialData.expense_categories) {
              setExpenseCategories(partialData.expense_categories);
              localStorage.setItem('nexus_expense_categories', JSON.stringify(partialData.expense_categories));
          }
          if (partialData.deal_statuses) {
              setDealStatuses(partialData.deal_statuses);
              localStorage.setItem('nexus_deal_statuses', JSON.stringify(partialData.deal_statuses));
          }
          if (partialData.transport_statuses) {
              setTransportStatuses(partialData.transport_statuses);
              localStorage.setItem('nexus_transport_statuses', JSON.stringify(partialData.transport_statuses));
          }
          if (partialData.payment_statuses) {
              setPaymentStatuses(partialData.payment_statuses);
              localStorage.setItem('nexus_payment_statuses', JSON.stringify(partialData.payment_statuses));
          }

          if (partialData.drive_folders) {
              const normalizedFolders = partialData.drive_folders.map(f => ({
                  ...f,
                  folderId: extractGoogleDriveFolderId(f?.folderId)
              }));
              setDriveFolders(normalizedFolders);
              localStorage.setItem('nexus_drive_folders', JSON.stringify(normalizedFolders));
              const ref = normalizedFolders.find(f => f.type === 'reference');
              const ass = normalizedFolders.find(f => f.type === 'assets');
              if (ref) setDriveFolderId(ref.folderId);
              if (ass) setAssetsDriveFolderId(ass.folderId);
          }
          if (partialData.drive_folder_id !== undefined) {
              setDriveFolderId(extractGoogleDriveFolderId(partialData.drive_folder_id));
          }
          if (partialData.assets_drive_folder_id !== undefined) { 
              setAssetsDriveFolderId(extractGoogleDriveFolderId(partialData.assets_drive_folder_id));
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
              applyThemeVariables(partialData.shop_info.themeColor, partialData.shop_info.themeMode, partialData.shop_info.customColorValue);
              // ซิงค์ไปยังแท็บอื่น / หน้าจออื่นบนเบราว์เซอร์เดียวกันทันที (Multi-Window / Multi-Screen Sync)
              broadcastShopInfoSync(partialData.shop_info);
          }
          if (!options.silent) {
              showToast("บันทึกการตั้งค่าเรียบร้อยแล้ว", "success");
          }
      } catch (error) {
          console.error("Error saving settings:", error);
          if (!options.silent) {
              showToast("บันทึกการตั้งค่าไม่สำเร็จ: " + error.message, "error");
          }
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
      
      const inputTrimmed = (user || '').trim();
      const inputLower = inputTrimmed.toLowerCase();

      // 1. ตรวจสอบสิทธิ์ผ่าน Server-Side RPC บน Supabase ก่อนเป็นอันดับแรก (ปลอดภัย 100%)
      let foundUser = null;
      try {
        const client = getActiveClient();
        const { data: rpcRes, error: rpcErr } = await client.rpc('verify_staff_login', {
          p_identifier: inputTrimmed,
          p_password: String(pass || '')
        });
        if (!rpcErr && rpcRes && rpcRes.success && rpcRes.user) {
          foundUser = {
            name: rpcRes.user.name,
            role: rpcRes.user.role || 'admin',
            roleKey: rpcRes.user.role || 'admin',
            roleCode: rpcRes.user.roleCode || '11',
            roleLabel: rpcRes.user.roleLabel || 'ผู้ดูแลระบบ',
            allowedPages: rpcRes.user.allowedPages || [],
            email: rpcRes.user.email || '',
            phone: rpcRes.user.phone || '',
            username: rpcRes.user.username,
            staffCode: rpcRes.user.staffCode,
            image: rpcRes.user.image || ''
          };
        }
      } catch (rpcEx) {
        console.warn('RPC verify_staff_login notice:', rpcEx);
      }

      // 2. หาก RPC ไม่พบ ให้ตรวจสอบกับ authorizedUsers / credentials เดิม
      if (!foundUser) {
        const matchUser = (u) => {
            const matchUName = u.username && u.username.toLowerCase() === inputLower;
            const matchId = (u.staffCode || u.id) && String(u.staffCode || u.id).toLowerCase() === inputLower;
            return (matchUName || matchId) && String(u.password) === String(pass);
        };

        foundUser = authorizedUsers.find(matchUser);

        if (!foundUser) {
            try {
                const supaSettings = await loadSettingsFromSupabase();
                if (supaSettings && supaSettings.appCredentials && supaSettings.appCredentials.length > 0) {
                    const latestUsers = supaSettings.appCredentials;
                    setAuthorizedUsers(latestUsers);
                    localStorage.setItem('nexus_authorized_users', JSON.stringify(latestUsers));
                    foundUser = latestUsers.find(matchUser);
                }
            } catch (e) {
                console.error("Login verification error via Supabase:", e);
            }
        }
      }

      if (foundUser) {
          // 🛡️ SECURITY DIRECTIVE: ล้างแคชเก่าใน IndexedDB ก่อนเริ่มเซสชันใหม่
          resetProjectLoadCache();
          await clearAllLocalDatabase();
          await db.open().catch(() => {});

          // เข้าสู่ระบบ Supabase Auth เพื่อรับ Token สิทธิ์ authenticated สำหรับ RLS
          try {
            const authEmail = (foundUser.email && foundUser.email.includes('@'))
              ? foundUser.email.trim()
              : `${(foundUser.username || '').toLowerCase()}@flower2u.internal`;
            const rawPass = String(pass || '123456');
            const authPass = rawPass.length >= 6 ? rawPass : rawPass.padEnd(6, '0');
            sessionStorage.setItem('nexus_auth_pass', authPass);
            await supabase.auth.signInWithPassword({ email: authEmail, password: authPass });
          } catch (e) {
            console.warn('Supabase Auth sign-in notice:', e?.message);
          }

          setIsLoggedIn(true);
          setUserProfile({
              name: foundUser.name,
              role: foundUser.role,
              email: foundUser.email,
              phone: foundUser.phone,
              username: foundUser.username,
              image: foundUser.image,
              staffCode: foundUser.staffCode,
              allowedPages: foundUser.allowedPages
          });

          const targetTab = getTabFromUrl() || activeTab || 'Calendar';
          setActiveTab(targetTab); 

          const profileJson = JSON.stringify({
              name: foundUser.name,
              role: foundUser.role,
              email: foundUser.email,
              phone: foundUser.phone,
              username: foundUser.username,
              image: foundUser.image,
              staffCode: foundUser.staffCode,
              allowedPages: foundUser.allowedPages
          });

          if (remember) {
              localStorage.setItem('nexus_auth', 'true');
              localStorage.setItem('nexus_profile', profileJson);
          } else {
              sessionStorage.setItem('nexus_auth', 'true');
              sessionStorage.setItem('nexus_profile', profileJson);
          }

          showToast(`ยินดีต้อนรับคุณ ${foundUser.name}`, "success");
      } else {
          setLoginError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
          showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "error");
      }
      setIsLoading(false);
  };

  const handleLogout = async (kickReason = "ออกจากระบบแล้ว") => {
      resetProjectLoadCache();
      try {
        await supabase.auth.signOut();
      } catch (e) {}
      setIsLoggedIn(false);
      setUserProfile(null);
      handleSelectTab('Calendar');

      localStorage.removeItem('nexus_auth');
      localStorage.removeItem('nexus_profile');
      sessionStorage.removeItem('nexus_auth');
      sessionStorage.removeItem('nexus_profile');
      sessionStorage.removeItem('nexus_auth_pass');

      // 🛡️ SECURITY DIRECTIVE: ล้างข้อมูลแคช IndexedDB ทั้งหมด และทำลายฐานข้อมูลทิ้งทันทีเมื่อออกจากระบบ
      try {
        await clearAllLocalDatabase();
      } catch (e) {}

      // ล้างข้อมูลในหน่วยความจำ Memory State ทั้งหมดทันที
      setAllActivities([]);
      setCustomerList([]);
      setArtistList([]);
      setCustomerSummaryStats({});
      setArtistSummaryStats({});
      setInventoryItems([]);
      setDeliveryLocations([]);
      setServerAnalytics(null);
      setServerStats(null);
      showToast(kickReason);

      // 🛡️ HARD RELOAD (Full Document Navigation): บังคับรีโหลดเพื่อเคลียร์แคช DevTools ในหน่วยความจำ 100%
      setTimeout(() => {
        window.location.replace(getBasePath() || '/');
      }, 150);
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

  const getPaymentStatusInfo = (value) => {
    return paymentStatuses.find(s => s.value === value)
      || DEFAULT_PAYMENT_STATUSES.find(s => s.value === value)
      || { label: value || 'รอชำระเงิน', color: 'bg-amber-50 text-amber-700 border-amber-200' };
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

    if (activeTab === 'Plans') {
      if (scrollTop + clientHeight >= scrollHeight - 250) {
        if (visibleCount < filteredAndSortedActivities.length) {
          setVisibleCount(prev => Math.min(prev + 20, filteredAndSortedActivities.length));
        }
      }
    }
  };

  // --- Image Handling Logic ---
  const compressImage = (file, optionsOrMaxWidth = 1024, qualityArg = 0.75) => {
    const maxWidth = typeof optionsOrMaxWidth === 'object' && optionsOrMaxWidth !== null
      ? (optionsOrMaxWidth.maxWidth || 1024)
      : (Number(optionsOrMaxWidth) || 1024);
    const quality = typeof optionsOrMaxWidth === 'object' && optionsOrMaxWidth !== null
      ? (optionsOrMaxWidth.quality ?? 0.75)
      : (Number(qualityArg) || 0.75);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scaleSize = maxWidth / img.width;
          
          if (scaleSize < 1) {
              canvas.width = maxWidth;
              canvas.height = Math.max(1, Math.round(img.height * scaleSize));
          } else {
              canvas.width = img.width;
              canvas.height = img.height;
          }
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const isAlphaCapable =
            file?.type === 'image/png' ||
            file?.type === 'image/webp' ||
            /\.(png|webp)$/i.test(file?.name || '');
          let hasTransparency = false;
          if (isAlphaCapable) {
            try {
              const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
              for (let p = 3; p < data.length; p += 4) {
                if (data[p] < 255) {
                  hasTransparency = true;
                  break;
                }
              }
            } catch {
              hasTransparency = file?.type === 'image/png';
            }
          }

          const dataUrl = hasTransparency
            ? canvas.toDataURL('image/png')
            : canvas.toDataURL('image/jpeg', quality);
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

  // [MODIFIED] Handle Profile Image Upload (Always compresses & never saves Base64 on Drive failure)
  const handleProfileImageUpload = async (file) => {
      if (!file) return null;
      const previousAvatar = !String(userProfile?.image || '').startsWith('data:image/')
        ? (userProfile?.image || '')
        : '';

      const targetProfileFolderId = getFolderIdByType('profiles');
      if (!targetProfileFolderId || !GOOGLE_SCRIPT_URL) {
          showToast("กรุณาระบุโฟลเดอร์รูปโปรไฟล์พนักงาน หรือ Assets Folder ID ในตั้งค่าก่อนอัปโหลด", "error");
          return null;
      }

      setIsUploadingProfile(true);
      try {
          if (!file.type.startsWith('image/')) {
              throw new Error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น');
          }

          const base64Data = await compressImage(file, { maxWidth: 800, quality: 0.82 });
          setUserProfile(prev => (prev ? { ...prev, image: base64Data } : prev));

          const mimeType = base64Data.split(',')[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const extension = mimeType.includes('png') ? 'png' : 'jpg';
          const fileName = `profile_${userProfile?.username || 'user'}_${Date.now()}.${extension}`;

          const response = await fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({
                  action: 'uploadAsset', 
                  data: {
                      fileData: base64Data, 
                      mimeType: mimeType,
                      fileName: fileName,
                      folderId: targetProfileFolderId
                  }
              })
          });

          const result = await response.json();
          if (result.status === 'success' && (result.url || result.fileId)) {
              let newImageUrl = result.url;
              if (result.fileId) {
                  newImageUrl = `https://drive.google.com/uc?export=view&id=${result.fileId}`;
              }
              
              const finalProfile = { ...userProfile, image: newImageUrl };
              setUserProfile(finalProfile);
              localStorage.setItem('nexus_profile', JSON.stringify(finalProfile));

              const updatedUsers = authorizedUsers.map(u => 
                  u.username.toLowerCase() === (userProfile?.username || '').toLowerCase() 
                  ? { ...u, image: newImageUrl } 
                  : u
              );
              setAuthorizedUsers(updatedUsers);

              await saveSystemSettings('app_credentials', updatedUsers);
              
              showToast("อัปเดตรูปโปรไฟล์สำเร็จ", "success");
              return newImageUrl;
          }
          throw new Error(result.message || "อัปโหลดรูปไม่สำเร็จ");
      } catch (error) {
          console.error(error);
          setUserProfile(prev => (prev ? { ...prev, image: previousAvatar } : prev));
          showToast("อัปโหลดรูปโปรไฟล์ไม่สำเร็จ: " + error.message, "error");
          return null;
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
      
      const targetLogoFolderId = getFolderIdByType('assets');
      if (!targetLogoFolderId) {
          if (GOOGLE_SCRIPT_URL) {
             showToast("กรุณาระบุโฟลเดอร์โลโก้ร้าน / Assets Folder ID ในตั้งค่าก่อนอัปโหลดโลโก้", "error");
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
                          folderId: targetLogoFolderId 
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

  const deleteDriveFileSilently = useCallback((fileId, useKeepalive = false) => {
    if (!fileId || !GOOGLE_SCRIPT_URL) return;
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: 'deleteFile', id: fileId }),
      ...(useKeepalive ? { keepalive: true } : {})
    }).catch(() => {});
  }, [GOOGLE_SCRIPT_URL]);

  const cleanupPendingPreUploads = useCallback((useKeepalive = false) => {
    const ids = Array.from(pendingPreUploadedFileIdsRef.current);
    pendingPreUploadedFileIdsRef.current.clear();
    ids.forEach((fileId) => deleteDriveFileSilently(fileId, useKeepalive));
  }, [deleteDriveFileSilently]);

  useEffect(() => {
    if (!isAddModalOpen) return;
    const handleBeforeUnload = () => {
      if (pendingPreUploadedFileIdsRef.current.size > 0) {
        cleanupPendingPreUploads(true);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAddModalOpen, cleanupPendingPreUploads]);

  const uploadReferenceDataUrlToDrive = async (dataUrl, projectPrefix, index) => {
    const refFolderId = getFolderIdByType('reference');
    if (!GOOGLE_SCRIPT_URL || !refFolderId) return null;
    const mimeType = dataUrl.split(',')[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const rawBase64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
    const safePrefix = String(projectPrefix || 'project').replace(/[^a-zA-Z0-9_-]/g, '') || 'project';
    const fileName = `${safePrefix}_${Date.now()}_${index + 1}.${ext}`;
    const uploadRes = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: 'uploadAsset',
        data: {
          folderId: refFolderId,
          fileData: rawBase64,
          fileName: fileName,
          mimeType: mimeType
        }
      })
    });
    const resJson = await uploadRes.json();
    if (resJson.status === 'success' && (resJson.url || resJson.fileId)) {
      const fileId = resJson.fileId || null;
      const url = fileId
        ? `https://drive.google.com/uc?export=view&id=${fileId}`
        : resJson.url;
      return { url, fileId };
    }
    return null;
  };

  const handleReferenceImageUpload = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const fileList = Array.from(files);
      const refFolderId = getFolderIdByType('reference');
      const canPreUpload = Boolean(GOOGLE_SCRIPT_URL && refFolderId);
      const sessionAtStart = modalSessionIdRef.current;
      const projectPrefix = editingId || currentId || 'project';
      const existingCount = uploadedImagesRef.current.length;
      const newImages = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file.type || !file.type.startsWith('image/')) continue;
        const base64Data = await compressImage(file, { maxWidth: 1024, quality: 0.78 });
        newImages.push({
          id: `ref_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          url: base64Data,
          localPreview: base64Data,
          name: file.name,
          createdAt: new Date().toISOString(),
          isUploading: canPreUpload,
          uploadFailed: false
        });
      }

      if (newImages.length === 0) return;

      setUploadedImages(prev => [...prev, ...newImages]);
      if (!canPreUpload) {
        showToast(`เพิ่มรูปภาพอ้างอิง ${newImages.length} รูปเรียบร้อย`, 'success');
        return;
      }

      // Pre-upload concurrently in the background while the user fills out the rest of the form
      newImages.forEach((imgItem, idx) => {
        const uploadPromise = (async () => {
          try {
            const uploaded = await uploadReferenceDataUrlToDrive(imgItem.url, projectPrefix, existingCount + idx);
            if (!uploaded?.url || uploaded.url.startsWith('data:image')) {
              throw new Error('Drive upload failed');
            }
            // If modal closed without saving or user deleted this image mid-upload, clean up Drive file immediately
            if (sessionAtStart !== modalSessionIdRef.current || removedRefIdsRef.current.has(imgItem.id)) {
              if (uploaded.fileId) deleteDriveFileSilently(uploaded.fileId);
              return;
            }
            if (uploaded.fileId) {
              pendingPreUploadedFileIdsRef.current.add(uploaded.fileId);
            }
            setUploadedImages((prev) =>
              prev.map((entry) =>
                typeof entry === 'object' && entry.id === imgItem.id
                  ? {
                      ...entry,
                      url: uploaded.url,
                      ...(uploaded.fileId ? { fileId: uploaded.fileId } : {}),
                      isUploading: false,
                      uploadFailed: false
                    }
                  : entry
              )
            );
          } catch (imgErr) {
            console.warn("Background pre-upload ref image error:", imgErr);
            if (sessionAtStart !== modalSessionIdRef.current) return;
            setUploadedImages((prev) =>
              prev.map((entry) =>
                typeof entry === 'object' && entry.id === imgItem.id
                  ? { ...entry, isUploading: false, uploadFailed: true }
                  : entry
              )
            );
          } finally {
            inFlightRefUploadsRef.current.delete(imgItem.id);
          }
        })();
        inFlightRefUploadsRef.current.set(imgItem.id, uploadPromise);
      });
    } catch (err) {
      console.error("Reference image upload error:", err);
      showToast('เกิดข้อผิดพลาดในการเพิ่มรูปภาพ', 'error');
    }
  };

  const handleRemoveReferenceImage = (imgKey) => {
    removedRefIdsRef.current.add(imgKey);
    const target = uploadedImagesRef.current.find((img) => {
      const id = typeof img === 'object' ? img.id : img;
      const url = typeof img === 'object' ? img.url : img;
      return id === imgKey || url === imgKey;
    });
    const pendingFileId = typeof target === 'object' ? target?.fileId : null;
    if (pendingFileId && pendingPreUploadedFileIdsRef.current.has(pendingFileId)) {
      pendingPreUploadedFileIdsRef.current.delete(pendingFileId);
      deleteDriveFileSilently(pendingFileId);
    }
    setUploadedImages(prev => prev.filter(img => {
      const id = typeof img === 'object' ? img.id : img;
      const url = typeof img === 'object' ? img.url : img;
      return id !== imgKey && url !== imgKey;
    }));
  };

  const handleImageUpload = (filesOrFile) => {
    if (!filesOrFile) return;
    if (filesOrFile instanceof FileList || Array.isArray(filesOrFile)) {
      return handleReferenceImageUpload(filesOrFile);
    }
    return handleReferenceImageUpload([filesOrFile]);
  };

  // Window-level safety: prevent browser from navigating away if a file is dropped outside dropzones
  useEffect(() => {
    if (!isAddModalOpen) return;
    const preventWindowDrop = (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
        e.preventDefault();
      }
    };
    const handleGlobalDrop = (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
        e.preventDefault();
        refDragCounterRef.current = 0;
        slipDragCounterRef.current = 0;
        setIsDraggingRef(false);
        setIsDraggingSlip(false);
      }
    };
    window.addEventListener('dragover', preventWindowDrop);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', preventWindowDrop);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, [isAddModalOpen]);

  // Modal Drag Handlers (Keep safe boundaries without resetting child dropzone state)
  const handleModalDragOver = (e) => {
    if (viewOnlyMode) return;
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleModalDrop = (e) => {
    e.preventDefault();
  };

  // Reference Images Drag Handlers
  const handleRefDragEnter = (e) => {
    if (viewOnlyMode) return;
    e.preventDefault();
    e.stopPropagation();
    refDragCounterRef.current += 1;
    setIsDraggingRef(true);
  };

  const handleRefDragLeave = (e) => {
    if (viewOnlyMode) return;
    e.preventDefault();
    e.stopPropagation();
    refDragCounterRef.current = Math.max(0, refDragCounterRef.current - 1);
    if (refDragCounterRef.current === 0) {
      setIsDraggingRef(false);
    }
  };

  const handleRefDragOver = (e) => {
    if (viewOnlyMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleRefDrop = (e) => {
    if (viewOnlyMode) return;
    e.preventDefault();
    e.stopPropagation();
    refDragCounterRef.current = 0;
    setIsDraggingRef(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleReferenceImageUpload(e.dataTransfer.files);
    }
  };

  // Slip Drag Handlers
  const handleSlipDragEnter = (e) => {
    if (viewOnlyMode) return;
    e.preventDefault();
    e.stopPropagation();
    slipDragCounterRef.current += 1;
    setIsDraggingSlip(true);
  };

  const handleSlipDragLeave = (e) => {
    if (viewOnlyMode) return;
    e.preventDefault();
    e.stopPropagation();
    slipDragCounterRef.current = Math.max(0, slipDragCounterRef.current - 1);
    if (slipDragCounterRef.current === 0) {
      setIsDraggingSlip(false);
    }
  };

  const handleSlipDragOver = (e) => {
    if (viewOnlyMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleSlipDrop = (e) => {
    if (viewOnlyMode) return;
    e.preventDefault();
    e.stopPropagation();
    slipDragCounterRef.current = 0;
    setIsDraggingSlip(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSlipUpload(e.dataTransfer.files);
    }
  };

  const onDrop = handleRefDrop;
  const onDragOverImg = handleRefDragOver;

  const handleSlipUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsSaving(true);
    try {
      const fileList = Array.from(files);
      const newSlips = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file.type || !file.type.startsWith('image/')) continue;
        const base64Data = await compressImage(file, { maxWidth: 1024, quality: 0.78 });
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

  // Pure filtering and sorting function that can run against any tab filter state
  const filterAndSortActivities = (activities, filter, { dateField = 'delivery' } = {}) => {
    if (!Array.isArray(activities)) return [];
    let items = activities.filter(item => {
      const searchLower = (filter.search || '').toLowerCase();
      const matchesSearch = !searchLower ||
        (item.name || '').toLowerCase().includes(searchLower) ||
        (item.id || '').toLowerCase().includes(searchLower) ||
        (item.artist || '').toLowerCase().includes(searchLower) ||
        (item.customer || '').toLowerCase().includes(searchLower) ||
        (item.note && item.note.toLowerCase().includes(searchLower));

      let matchesDate = true;
      if (filter.dateMode !== 'all') {
        const candidates = dateField === 'payment'
          ? [
              item.paymentDate,
              item.rawDateTime,
              item.date,
              item.rawDeliveryStart,
              item.deliveryDate
            ]
          : dateField === 'project'
            ? [
                item.rawDateTime,
                item.date,
                item.rawDeliveryStart,
                item.paymentDate,
                item.deliveryDate
              ]
            : [
                item.rawDeliveryStart,
                item.rawDateTime,
                item.date,
                item.paymentDate,
                item.deliveryDate
              ];

        let itemDateStr = '';
        for (const val of candidates) {
          if (!val) continue;
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
              itemDateStr = trimmed.substring(0, 10);
              break;
            }
            if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
              const parts = trimmed.split(' ')[0].split('/');
              let y = parseInt(parts[2], 10);
              if (y > 2500) y -= 543;
              const mm = String(parts[1]).padStart(2, '0');
              const dd = String(parts[0]).padStart(2, '0');
              itemDateStr = `${y}-${mm}-${dd}`;
              break;
            }
          }
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            itemDateStr = `${yyyy}-${mm}-${dd}`;
            break;
          }
        }

        if (!itemDateStr) {
          matchesDate = false;
        } else if (filter.dateMode === 'date' && filter.date) {
          matchesDate = itemDateStr === filter.date;
        } else if (filter.dateMode === 'month' && filter.date) {
          matchesDate = itemDateStr.startsWith(filter.date);
        } else if (filter.dateMode === 'year' && filter.date) {
          matchesDate = itemDateStr.startsWith(filter.date);
        } else if (filter.dateMode === 'range' && filter.dateRange?.start && filter.dateRange?.end) {
          matchesDate = itemDateStr >= filter.dateRange.start && itemDateStr <= filter.dateRange.end;
        } else if (filter.dateMode === 'week' && filter.date) {
          const itemDate = new Date(itemDateStr);
          const weekStart = new Date(filter.date);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekStart.setHours(0, 0, 0, 0);
          weekEnd.setHours(23, 59, 59, 999);
          itemDate.setHours(12, 0, 0, 0);
          matchesDate = itemDate >= weekStart && itemDate <= weekEnd;
        }
      }

      const getDealTypeLocal = (val) => dealStatuses.find(s => s.value === val)?.type || 'pending';
      const getTransportTypeLocal = (val) => transportStatuses.find(s => s.value === val)?.type || 'pending';

      const matchesCategory = filter.category === 'all' || item.category === filter.category;

      let matchesStatus = true;
      if (filter.status === '__kpi_completed__') {
        const dType = getDealTypeLocal(item.dealStatus);
        const tType = getTransportTypeLocal(item.transportStatus);
        matchesStatus = tType === 'completed' && (dType === 'active' || dType === 'completed');
      } else if (filter.status === '__kpi_active__') {
        const dType = getDealTypeLocal(item.dealStatus);
        const tType = getTransportTypeLocal(item.transportStatus);
        matchesStatus = dType === 'active' && tType !== 'completed' && tType !== 'cancelled';
      } else if (filter.status === '__kpi_issues__') {
        const dType = getDealTypeLocal(item.dealStatus);
        const tType = getTransportTypeLocal(item.transportStatus);
        matchesStatus = dType === 'cancelled' || tType === 'cancelled';
      } else {
        matchesStatus = filter.status === 'all' || item.dealStatus === filter.status;
      }
      
      let matchesTransport = true;
      if (filter.transport === 'active_only') {
          const tType = getTransportTypeLocal(item.transportStatus);
          matchesTransport =
            tType !== 'completed' &&
            tType !== 'cancelled' &&
            item.transportStatus !== 'delivered' &&
            item.transportStatus !== 'completed' &&
            item.transportStatus !== 'issue' &&
            item.transportStatus !== 'cancelled';
      } else {
          matchesTransport = filter.transport === 'all' || item.transportStatus === filter.transport;
      }

      return matchesSearch && matchesDate && matchesCategory && matchesStatus && matchesTransport;
    });

    const sortConfig = filter.sortConfig || { key: 'id', direction: 'desc' };
    if (sortConfig.key !== null) {
      items.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (sortConfig.key === 'wage' || sortConfig.key === 'totalExpenses' || sortConfig.key === 'totalRevenue') {
          const numA = Number(aValue) || 0;
          const numB = Number(bValue) || 0;
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

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
  };

  // Dedicated activity streams per tab
  const plansScopeActivities = useMemo(
    () => filterAndSortActivities(allActivities, { ...plansFilter, status: 'all', transport: 'all' }, { dateField: 'project' }),
    [allActivities, plansFilter, dealStatuses, transportStatuses]
  );
  const plansActivities = useMemo(
    () => filterAndSortActivities(allActivities, plansFilter, { dateField: 'project' }),
    [allActivities, plansFilter, dealStatuses, transportStatuses]
  );
  const financeActivities = useMemo(
    () => filterAndSortActivities(allActivities, financeFilter, { dateField: 'payment' }),
    [allActivities, financeFilter, dealStatuses, transportStatuses]
  );
  const filteredAndSortedActivities = plansActivities;

  const [serverAnalytics, setServerAnalytics] = useState(null);
  const [serverStats, setServerStats] = useState(null);

  const analyticsData = useMemo(() => {
    const totals = serverAnalytics?.totals || {};
    const statusCounts = serverAnalytics?.status_counts || {};

    const currentRevenue = Number(totals.revenue ?? totals.total_revenue ?? 0);
    const currentSupport = Number(totals.support ?? totals.total_customer_support ?? 0);
    const currentCost = Number(totals.cost ?? totals.total_expenses ?? 0);
    const currentProfit = Number(totals.profit ?? totals.total_net_profit ?? (currentRevenue - currentCost));

    const totalProjects = Number(statusCounts.total ?? totals.total_projects ?? totals.total_orders ?? 0);
    const completedProjects = Number(statusCounts.completed || 0);
    const activeProjects = Number(statusCounts.active || 0);
    const pendingProjects = Number(statusCounts.pending || 0);
    const issueProjects = Number(statusCounts.cancelled ?? statusCounts.issue ?? 0);
    const declinedProjects = Number(statusCounts.declined || 0);

    const avgOrderValue = Number(totals.avg_order_value ?? (totalProjects > 0 ? currentRevenue / totalProjects : 0));
    const avgSupportValue = totalProjects > 0 ? currentSupport / totalProjects : 0;
    const netMarginPercent = totals.net_margin_pct !== undefined
      ? Number(totals.net_margin_pct).toFixed(1)
      : totals.net_margin_percent !== undefined
        ? Number(totals.net_margin_percent).toFixed(1)
        : (currentRevenue > 0 ? ((currentProfit / currentRevenue) * 100).toFixed(1) : '0.0');

    const allExpensesList = Array.isArray(serverAnalytics?.expenses)
      ? serverAnalytics.expenses.map((e) => ({
          category: e.category || 'ไม่ระบุหมวดหมู่',
          amount: Number(e.amount || 0),
        }))
      : [];
    const maxExpense = allExpensesList.length > 0 ? Math.max(...allExpensesList.map((e) => e.amount), 1) : 1;

    const topPerformers = Array.isArray(serverAnalytics?.top_artists)
      ? serverAnalytics.top_artists.map((a) => ({
          name: a.name,
          amount: Number(a.amount || 0),
          count: Number(a.count || 0),
        }))
      : [];
    const maxPerformerRevenue = topPerformers.length > 0 ? Math.max(...topPerformers.map((a) => a.amount), 1) : 1;

    const topCustomers = Array.isArray(serverAnalytics?.top_customers)
      ? serverAnalytics.top_customers.map((c) => ({
          name: c.name,
          amount: Number(c.amount || 0),
          count: Number(c.count || 0),
        }))
      : [];
    const maxCustomerRevenue = topCustomers.length > 0 ? Math.max(...topCustomers.map((c) => c.amount), 1) : 1;

    const topCustomerByProjects = Array.isArray(serverAnalytics?.top_customers_by_projects)
      ? serverAnalytics.top_customers_by_projects.map((c) => ({
          name: c.name,
          count: Number(c.count || 0),
          amount: Number(c.amount || 0),
        }))
      : [...topCustomers].sort((a, b) => (b.count || 0) - (a.count || 0));
    const maxCustomerProjectCount = topCustomerByProjects.length > 0 ? Math.max(...topCustomerByProjects.map((c) => c.count), 1) : 1;

    const categoryData = Array.isArray(serverAnalytics?.categories)
      ? serverAnalytics.categories.map((c) => ({
          name: c.name || 'ไม่ระบุ',
          count: Number(c.count || 0),
        }))
      : [];

    const banknoteBreakdown = {
      1000: { count: 0, amount: 0 },
      500: { count: 0, amount: 0 },
      100: { count: 0, amount: 0 },
      50: { count: 0, amount: 0 },
      20: { count: 0, amount: 0 },
    };
    const rawBanknotes = serverAnalytics?.banknotes;
    if (Array.isArray(rawBanknotes)) {
      rawBanknotes.forEach((b) => {
        const denom = Number(b?.denomination ?? b?.denom);
        if (banknoteBreakdown[denom]) {
          const count = Number(b?.count || 0);
          banknoteBreakdown[denom] = {
            count,
            amount: Number(b?.amount ?? denom * count),
          };
        }
      });
    } else if (rawBanknotes && typeof rawBanknotes === 'object') {
      [1000, 500, 100, 50, 20].forEach((denom) => {
        const entry = rawBanknotes[denom] || rawBanknotes[String(denom)];
        if (entry) {
          const count = Number(entry.count || 0);
          banknoteBreakdown[denom] = {
            count,
            amount: Number(entry.amount ?? denom * count),
          };
        }
      });
    }

    const topVenues = Array.isArray(serverAnalytics?.top_venues)
      ? serverAnalytics.top_venues.map((v) => ({
          name: v.name,
          count: Number(v.count || 0),
          revenue: Number(v.revenue || 0),
        }))
      : [];
    const maxVenueCount = topVenues.length > 0 ? Math.max(...topVenues.map((v) => v.count), 1) : 1;

    const lowMarginProjects = Array.isArray(serverAnalytics?.low_margin)
      ? serverAnalytics.low_margin.map((p) => ({
          ...p,
          id: p.id,
          name: p.name || '-',
          artist: p.artist || p.artist_name || '-',
          revenue: Number(p.revenue || 0),
          cost: Number(p.cost || 0),
          profit: Number(p.profit ?? (Number(p.revenue || 0) - Number(p.cost || 0))),
          marginPct: Number(p.marginPct ?? p.margin_pct ?? 0),
        }))
      : [];

    return {
      currentRevenue,
      currentSupport,
      currentCost,
      currentProfit,
      avgOrderValue,
      avgSupportValue,
      netMarginPercent,
      totalProjects,
      completedProjects,
      activeProjects,
      pendingProjects,
      issueProjects,
      declinedProjects,
      allExpensesList,
      maxExpense,
      topPerformers,
      maxPerformerRevenue,
      topCustomers,
      maxCustomerRevenue,
      topCustomerByProjects,
      maxCustomerProjectCount,
      categoryData,
      banknoteBreakdown,
      topVenues,
      maxVenueCount,
      lowMarginProjects,
    };
  }, [serverAnalytics]);

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

      if (activeTab === 'Plans') {
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;
        if (scrollTop + clientHeight >= scrollHeight - 250) {
          if (visibleCount < plansActivities.length) {
            setVisibleCount(prev => Math.min(prev + 20, plansActivities.length));
          }
        }
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true, capture: true });
    window.addEventListener('resize', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll, { capture: true });
      window.removeEventListener('resize', handleWindowScroll);
    };
  }, [activeTab, visibleCount, plansActivities.length, isLoadingMore]);

  const getDealType = (val) => dealStatuses.find(s => s.value === val)?.type || 'pending';
  const getTransportType = (val) => transportStatuses.find(s => s.value === val)?.type || 'pending';

  const stats = useMemo(() => {
    // เมื่อมีการกรองตามวันที่/เดือน/สัปดาห์/ช่วงเวลา หรือค้นหา/หมวดหมู่ ให้ใช้จำนวนแถวของ Scope นั้นโดยตรง
    const isUnfilteredAllScope =
      plansFilter.dateMode === 'all' &&
      !plansFilter.search?.trim() &&
      plansFilter.category === 'all';
    const baseActivities = plansScopeActivities;
    const total =
      isUnfilteredAllScope && serverStats?.total !== undefined
        ? serverStats.total
        : baseActivities.length;
    
    const completed = baseActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return tType === 'completed' && (dType === 'active' || dType === 'completed');
    }).length;

    const active = baseActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return dType === 'active' && tType !== 'completed' && tType !== 'cancelled';
    }).length;

    const pending = baseActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        return dType === 'pending';
    }).length;

    const issues = baseActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return dType === 'cancelled' || tType === 'cancelled';
    }).length;

    const renderVal = (v) => {
      if (isScopeLoading && baseActivities.length === 0) {
        return <span className="inline-block w-8 h-6 bg-slate-200 animate-pulse rounded-md" />;
      }
      return v;
    };

    return [
      { title: 'งานทั้งหมด', value: renderVal(total), change: 'รวมทั้งหมด', isPositive: true, icon: Folder, color: 'text-indigo-600', bg: 'bg-indigo-50', onClick: () => updateTabFilter('Plans', { status: 'all', transport: 'all' }) },
      { title: 'งานเสร็จสิ้น', value: renderVal(completed), change: 'ปิดจ๊อบแล้ว', isPositive: true, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => updateTabFilter('Plans', { status: '__kpi_completed__', transport: 'all' }) },
      { title: 'กำลังดำเนินการ', value: renderVal(active), change: 'Active Now', isPositive: true, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => updateTabFilter('Plans', { status: '__kpi_active__', transport: 'all' }) },
      { title: 'ยกเลิก/มีปัญหา', value: renderVal(issues), change: 'ต้องตรวจสอบ', isPositive: false, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', onClick: () => updateTabFilter('Plans', { status: '__kpi_issues__', transport: 'all' }) },
    ];
  }, [plansScopeActivities, plansFilter.dateMode, plansFilter.search, plansFilter.category, serverStats, dealStatuses, transportStatuses, isScopeLoading]);

  const openModalReqIdRef = useRef(0);

  const closeModal = (didSave = false) => {
    openModalReqIdRef.current += 1;
    modalSessionIdRef.current += 1;
    if (didSave === true) {
      pendingPreUploadedFileIdsRef.current.clear();
    } else {
      cleanupPendingPreUploads(false);
    }
    removedRefIdsRef.current.clear();
    inFlightRefUploadsRef.current.clear();
    refDragCounterRef.current = 0;
    slipDragCounterRef.current = 0;
    setIsDraggingRef(false);
    setIsDraggingSlip(false);
    setIsModalClosing(true);
    setTimeout(() => {
      setIsAddModalOpen(false);
      setIsModalClosing(false);
    }, 300); 
  };

  const {
    requestClose: requestCloseAddModal,
    isConfirmOpen: isAddModalCloseConfirmOpen,
    hasUnsavedChanges: hasAddModalUnsavedChanges,
    markClean: markAddModalClean,
    closeConfirmDialog: addModalCloseConfirmDialog,
  } = useModalCloseGuard({
    isOpen: isAddModalOpen,
    onClose: closeModal,
    shouldConfirm: !viewOnlyMode,
    watch: isAddModalOpen ? [
      projectName,
      projectCategory,
      projectDateTime,
      paymentDate,
      deliveryStart,
      deliveryEnd,
      artistName,
      customerName,
      customerSocial,
      customerLine,
      customerPhone,
      customerEmail,
      customerTaxId,
      customerAddress,
      recipientName,
      recipientPhone,
      locationName,
      mapLink,
      uploadedImages,
      uploadedSlips,
      note,
      wage,
      deliveryFee,
      expenses,
      quotationItems,
      customerSupportItems,
      paymentStatus,
      depositAmount,
      dealStatus,
      transportStatus,
    ] : null,
    disabled: isModalClosing,
    listenEscape: false,
  });

  const closeDeleteModal = () => {
    setIsDeleteClosing(true);
    setTimeout(() => {
      setDeleteConfirm({ ...deleteConfirm, show: false });
      setIsDeleteClosing(false);
    }, 300);
  };

  // Keyboard shortcut: close active modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        if (isAddModalCloseConfirmOpen) return;
        if (selectedVenueForModal) setSelectedVenueForModal(null);
        else if (isVenueDirectoryOpen) setIsVenueDirectoryOpen(false);
        else if (shareData) setShareData(null);
        else if (deleteConfirm.show) closeDeleteModal();
        else if (deleteLogoConfirm) closeDeleteLogoModal();
        else if (deleteProfileConfirm) closeDeleteProfileModal();
        else if (isAddModalOpen && !isModalClosing) requestCloseAddModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAddModalCloseConfirmOpen,
    selectedVenueForModal,
    isVenueDirectoryOpen,
    shareData,
    deleteConfirm.show,
    deleteLogoConfirm,
    deleteProfileConfirm,
    isAddModalOpen,
    isModalClosing,
    requestCloseAddModal
  ]);

  const applyMatchedCustomerDetails = (cust) => {
    if (!cust) return;
    setCustomerSocial(cust.social ?? cust.social_account ?? '');
    setCustomerLine(cust.line ?? cust.line_id ?? '');
    setCustomerPhone(formatPhoneNumber(cust.phone || ''));
    setCustomerEmail(cust.email || '');
    setCustomerTaxId(cust.taxId ?? cust.tax_id ?? '');
    setCustomerAddress(cust.address ?? cust.billing_address ?? '');
  };

  const handleCustomerNameUpdate = (value) => {
    setCustomerName(value);
    const trimmed = String(value || '').trim().toLowerCase();
    if (!trimmed) return;
    const existingCustomer = savedCustomers.find((c) => c.name?.toLowerCase() === trimmed);
    if (existingCustomer) {
      applyMatchedCustomerDetails(existingCustomer);
    }
  };

  const handleRecipientNameUpdate = (value) => {
    setRecipientName(value);
    const trimmed = String(value || '').trim().toLowerCase();
    if (!trimmed) return;
    const existingRecipient = savedRecipients.find((r) => r.name?.toLowerCase() === trimmed);
    if (existingRecipient) {
      setRecipientPhone(formatPhoneNumber(existingRecipient.phone || ''));
    }
  };

  const addModalGuardStateRef = useRef({ viewOnlyMode: false, hasUnsavedChanges: false });
  addModalGuardStateRef.current = { viewOnlyMode, hasUnsavedChanges: hasAddModalUnsavedChanges };

  const openModal = (activityOrId = null, viewOnly) => {
    const reqId = ++openModalReqIdRef.current;
    modalSessionIdRef.current += 1;
    cleanupPendingPreUploads(false);
    removedRefIdsRef.current.clear();
    inFlightRefUploadsRef.current.clear();
    markAddModalClean();
    const activity =
      typeof activityOrId === 'string'
        ? allActivities.find((a) => String(a.id) === String(activityOrId)) || null
        : (activityOrId?.id && !activityOrId.category
            ? allActivities.find((a) => String(a.id) === String(activityOrId.id)) || activityOrId
            : activityOrId);
    const effectiveViewOnly = activity ? (viewOnly !== undefined ? Boolean(viewOnly) : true) : false;
    setViewOnlyMode(effectiveViewOnly);

    if (activity) {
      setEditingId(activity.id);
      setCurrentId(activity.id);
      setProjectName(activity.name || '');
      setProjectCategory(activity.category || '');
      setProjectDateTime(activity.rawDateTime || '');
      setPaymentDate(activity.paymentDate || ''); // [ADDED]
      setArtistName(activity.artist || '');
      setCustomerName(activity.customer || '');
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
      const rawImages = Array.isArray(activity.images) && activity.images.length > 0
        ? activity.images
        : (activity.image ? [activity.image] : []);
      setUploadedImages(rawImages); 
      setUploadedSlips(Array.isArray(activity.slips) ? activity.slips : (activity.slip ? [activity.slip] : [])); 
      
      // JIT on-demand fetch of full single-project details, images & slips if opened
      if (activity.id) {
        fetchProjectDetailOnDemand(activity.id).then((detail) => {
          if (reqId !== openModalReqIdRef.current || !detail) return;
          if (addModalGuardStateRef.current.hasUnsavedChanges) return;
          if (detail.name) setProjectName(detail.name);
          if (detail.category) setProjectCategory(detail.category);
          if (detail.rawDateTime) setProjectDateTime(detail.rawDateTime);
          if (detail.paymentDate) setPaymentDate(detail.paymentDate);
          if (detail.artist) setArtistName(detail.artist);
          if (detail.customer) setCustomerName(detail.customer);
          if (detail.customerInfo) {
            if (detail.customerInfo.social !== undefined) setCustomerSocial(detail.customerInfo.social || '');
            if (detail.customerInfo.line !== undefined) setCustomerLine(detail.customerInfo.line || '');
            if (detail.customerInfo.phone !== undefined) setCustomerPhone(formatPhoneNumber(detail.customerInfo.phone || ''));
            if (detail.customerInfo.email !== undefined) setCustomerEmail(detail.customerInfo.email || '');
            if (detail.customerInfo.taxId !== undefined) setCustomerTaxId(detail.customerInfo.taxId || '');
            if (detail.customerInfo.address !== undefined) setCustomerAddress(detail.customerInfo.address || '');
          }
          if (detail.rawDeliveryStart) setDeliveryStart(detail.rawDeliveryStart);
          if (detail.rawDeliveryEnd || detail.rawDeliveryDateTime) {
            setDeliveryEnd(detail.rawDeliveryEnd || detail.rawDeliveryDateTime);
          }
          if (detail.recipient) setRecipientName(detail.recipient);
          if (detail.recipientPhone) setRecipientPhone(formatPhoneNumber(detail.recipientPhone));
          if (detail.location) setLocationName(detail.location);
          if (detail.mapLink) setMapLink(detail.mapLink);
          if (detail.note !== undefined && detail.note !== null) setNote(detail.note);
          if (detail.dealStatus) setDealStatus(detail.dealStatus);
          if (detail.transportStatus) setTransportStatus(detail.transportStatus);
          if (detail.paymentStatus) setPaymentStatus(detail.paymentStatus);
          if (detail.depositAmount !== undefined && detail.depositAmount !== null) {
            setDepositAmount(detail.depositAmount);
          }
          if (detail.images && detail.images.length > 0) setUploadedImages(detail.images);
          if (detail.slips && detail.slips.length > 0) setUploadedSlips(detail.slips);
          const detailFallbackDate = detail.paymentDate || detail.rawDateTime || activity.paymentDate || activity.rawDateTime || getNowDateString();
          if (detail.quotationItems && detail.quotationItems.length > 0) {
            const loadedItems = detail.quotationItems.map((item) => ({
              ...item,
              quantity: item.quantity !== undefined ? item.quantity : 1,
              unitPrice: item.unitPrice !== undefined ? item.unitPrice : (item.price || 0),
              date: item.date || detailFallbackDate,
            }));
            setQuotationItems(loadedItems);
            setWage(detail.quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0));
          } else if (detail.wage > 0) {
            setWage(detail.wage);
          }
          if (detail.customerSupport && detail.customerSupport.length > 0) {
            const mappedSupport = detail.customerSupport.map((item) =>
              item.denomination !== undefined
                ? { ...item, date: item.date || detailFallbackDate }
                : { denomination: 1, quantity: item.price, price: item.price, date: item.date || detailFallbackDate }
            );
            setCustomerSupportItems(mappedSupport);
          }
          if (detail.expenses && detail.expenses.length > 0) {
            const loadedExpenses = detail.expenses.map((item) => ({
              ...item,
              quantity: item.quantity !== undefined ? item.quantity : 1,
              unitPrice: item.unitPrice !== undefined ? item.unitPrice : (item.price || 0),
              date: item.date || detailFallbackDate,
            }));
            setExpenses(loadedExpenses);
          }
          markAddModalClean();
        }).catch(() => {});
      } 
      
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
          const initialWage = activity.wage ?? activity.revenue ?? 0;
          if (initialWage > 0) initialItems.push({ category: 'ค่าบริการ/อุปกรณ์', detail: 'ค่าจ้างเดิม', quantity: 1, unitPrice: initialWage, price: initialWage, date: fallbackDate });
          if (activity.deliveryFee > 0) initialItems.push({ category: 'ค่าจัดส่ง', detail: 'ค่าส่งเดิม', quantity: 1, unitPrice: activity.deliveryFee, price: activity.deliveryFee, date: fallbackDate });
          
          if (initialItems.length === 0) initialItems.push({ category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: fallbackDate });
          setQuotationItems(initialItems);
          setWage(initialWage);
      }

      if (activity.customerSupport && activity.customerSupport.length > 0) {
          const fallbackDate = activity.paymentDate || activity.rawDateTime || getNowDateString();
          const mappedSupport = activity.customerSupport.map(item => {
              if (item.denomination !== undefined) return { ...item, date: item.date || fallbackDate };
              return { denomination: 1, quantity: item.price, price: item.price, date: item.date || fallbackDate }; 
          });
          setCustomerSupportItems(mappedSupport);
      } else if ((parseFloat(activity.customerSupportTotal || activity.customer_support_total) || 0) > 0) {
          const fallbackDate = activity.paymentDate || activity.rawDateTime || getNowDateString();
          const supTotal = parseFloat(activity.customerSupportTotal || activity.customer_support_total) || 0;
          setCustomerSupportItems([{ denomination: 1000, quantity: Math.floor(supTotal / 1000) || 1, price: supTotal, date: fallbackDate }]);
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
      } else if ((parseFloat(activity.totalExpenses || activity.total_expenses || activity.cost) || 0) > 0) {
          const fallbackDate = activity.paymentDate || activity.rawDateTime || getNowDateString();
          const expTotal = parseFloat(activity.totalExpenses || activity.total_expenses || activity.cost) || 0;
          setExpenses([{ category: 'ต้นทุน/ค่าใช้จ่ายเดิม', detail: 'ค่าใช้จ่ายจริงรวม', quantity: 1, unitPrice: expTotal, price: expTotal, date: fallbackDate }]);
      } else {
          setExpenses([{ category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: getNowDateString() }]);
      }

      setNote(activity.note || '');
      setDealStatus(activity.dealStatus || (dealStatuses[0]?.value || ''));
      setTransportStatus(activity.transportStatus || (transportStatuses[0]?.value || ''));
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
      setUploadedImages([]);
      setUploadedSlips([]);
      setNote('');
      setWage(0);
      setDeliveryFee(0); 
      setExpenses([{ category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: todayDateStr }]); // [MODIFIED] Init
      setQuotationItems([{ category: '', detail: '', quantity: 1, unitPrice: 0, price: 0, date: todayDateStr }]); // [MODIFIED] Init
      setCustomerSupportItems([{ denomination: 1000, quantity: 0, price: 0, date: todayDateStr }]); 
      setPaymentStatus(paymentStatuses.length > 0 ? paymentStatuses[0].value : 'unpaid');
      setDepositAmount(0); 
      setDealStatus(dealStatuses.length > 0 ? dealStatuses[0].value : ''); 
      setTransportStatus(transportStatuses.length > 0 ? transportStatuses[0].value : '');
    }
    setSyncSupportToCashVault(true);
    setSyncExpensesToWarehouse(true);
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

    // [ADDED] Logic ป้องกัน ID ชนกัน และป้องกันเซฟทับของที่ถูกลบไปแล้ว (อ้างอิง Atomic Sequence ฝั่งเซิร์ฟเวอร์)
    const previewIdBeforeSave = currentId;
    let finalId = currentId;

    if (!editingId) {
      if (typeof allocateNextProjectCodeSync === 'function') {
        try {
          finalId = await allocateNextProjectCodeSync(allActivities);
          setCurrentId(finalId);
        } catch (allocErr) {
          console.warn('allocateNextProjectCodeSync fallback:', allocErr);
          const ids = allActivities.map(item => {
            if (!item.id) return 0;
            const match = String(item.id).match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          });
          const maxId = ids.length > 0 ? Math.max(...ids) : 0;
          finalId = `P-${String(maxId + 1).padStart(4, '0')}`;
          setCurrentId(finalId);
        }
      } else {
        const ids = allActivities.map(item => {
          if (!item.id) return 0;
          const match = String(item.id).match(/\d+/); 
          return match ? parseInt(match[0], 10) : 0;
        });
        const maxId = ids.length > 0 ? Math.max(...ids) : 0;
        finalId = `P-${String(maxId + 1).padStart(4, '0')}`;
        setCurrentId(finalId);
      }
    } else {
      // กรณีแก้ไข: เช็คว่างานนี้ยังอยู่ในระบบไหม
      const stillExists = allActivities.some(item => item.id === editingId);
      if (!stillExists) {
        showToast("ไม่สามารถบันทึกได้: รายการนี้ถูกลบไปแล้วโดยผู้ใช้อื่น", "error");
        setIsSaving(false);
        return;
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
      locationId: (() => {
        const found = deliveryLocations.find(l => 
          l.name && locationName && (
            l.name.toLowerCase() === locationName.trim().toLowerCase() ||
            (Array.isArray(l.aliases) && l.aliases.some(a => a.toLowerCase() === locationName.trim().toLowerCase()))
          )
        );
        return found ? found.id : null;
      })(),
      mapLink: mapLink,
      image: uploadedImages.length > 0 ? (typeof uploadedImages[0] === 'object' ? uploadedImages[0].url : uploadedImages[0]) : null,
      images: uploadedImages,
      slips: uploadedSlips
    };

    const hasBase64Item = (list) =>
      Array.isArray(list) &&
      list.some((entry) => {
        const u = typeof entry === 'object' ? entry?.url : entry;
        return typeof u === 'string' && u.startsWith('data:image');
      });

    // Wait for any background pre-uploads that are still in flight before finalizing
    if (typeof inFlightRefUploadsRef !== 'undefined' && inFlightRefUploadsRef.current?.size > 0) {
      await Promise.allSettled(Array.from(inFlightRefUploadsRef.current.values()));
    }

    const sanitizePersistedImageEntry = (entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const { localPreview: _lp, isUploading: _iu, uploadFailed: _uf, ...clean } = entry;
      return clean;
    };

    const rawLatestImages =
      typeof uploadedImagesRef !== 'undefined' && Array.isArray(uploadedImagesRef.current)
        ? uploadedImagesRef.current
        : (Array.isArray(uploadedImages) ? uploadedImages : []);
    const latestImages = rawLatestImages.map(sanitizePersistedImageEntry);
    activityData.images = latestImages;
    activityData.image = latestImages.length > 0 ? (typeof latestImages[0] === 'object' ? latestImages[0].url : latestImages[0]) : null;

    if (GOOGLE_SCRIPT_URL) {
      try {
        // Upload any remaining base64 reference images to Google Drive reference folder (fallback if pre-upload wasn't done or failed)
        let finalImages = [...latestImages];
        if (hasBase64Item(finalImages)) {
          const refFolderId = getFolderIdByType('reference');
          if (!refFolderId) {
            showToast('กรุณาตั้งค่าโฟลเดอร์ Google Drive สำหรับรูปภาพอ้างอิงก่อนบันทึก', 'error');
            setIsSaving(false);
            return;
          }
          for (let i = 0; i < finalImages.length; i++) {
            const itemImg = finalImages[i];
            const imgUrl = typeof itemImg === 'object' ? itemImg.url : itemImg;
            if (typeof imgUrl === 'string' && imgUrl.startsWith('data:image')) {
              let uploadedLink = null;
              let uploadedFileId = null;
              try {
                const uploaded = await uploadReferenceDataUrlToDrive(imgUrl, activityData.id, i);
                if (uploaded) {
                  uploadedLink = uploaded.url;
                  uploadedFileId = uploaded.fileId;
                }
              } catch (imgErr) {
                console.warn("Upload ref image to Drive error:", imgErr);
              }
              if (!uploadedLink || uploadedLink.startsWith('data:image')) {
                showToast('อัปโหลดรูปภาพอ้างอิงขึ้น Google Drive ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
                setIsSaving(false);
                return;
              }
              finalImages[i] = typeof itemImg === 'object' 
                ? { ...itemImg, url: uploadedLink, ...(uploadedFileId ? { fileId: uploadedFileId } : {}) }
                : uploadedLink;
            }
          }
          setUploadedImages(finalImages);
          activityData.images = finalImages;
          activityData.image = finalImages.length > 0 ? (typeof finalImages[0] === 'object' ? finalImages[0].url : finalImages[0]) : null;
        }

        // Upload any base64 slips to Google Drive slips folder (strictly forbid Base64 leak into DB)
        let finalSlips = Array.isArray(uploadedSlips) ? [...uploadedSlips] : [];
        if (hasBase64Item(finalSlips)) {
          const slipFolderId = getFolderIdByType('slips');
          if (!slipFolderId) {
            showToast('กรุณาตั้งค่าโฟลเดอร์ Google Drive สำหรับสลิปโอนเงินก่อนบันทึก', 'error');
            setIsSaving(false);
            return;
          }
          for (let i = 0; i < finalSlips.length; i++) {
            const itemSlip = finalSlips[i];
            const slipUrl = typeof itemSlip === 'object' ? itemSlip.url : itemSlip;
            if (typeof slipUrl === 'string' && slipUrl.startsWith('data:image')) {
              const mimeType = slipUrl.split(',')[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
              const rawBase64 = slipUrl.substring(slipUrl.indexOf(',') + 1);
              const fileName = `slip_${activityData.id}_${Date.now()}_${i + 1}.jpg`;
              let uploadedSlipLink = null;
              let uploadedSlipFileId = null;
              try {
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
                if (resJson.status === 'success' && (resJson.url || resJson.fileId)) {
                  uploadedSlipFileId = resJson.fileId || null;
                  uploadedSlipLink = resJson.fileId 
                    ? `https://drive.google.com/uc?export=view&id=${resJson.fileId}`
                    : resJson.url;
                }
              } catch (slipErr) {
                console.warn("Upload slip to Drive error:", slipErr);
              }
              if (!uploadedSlipLink || uploadedSlipLink.startsWith('data:image')) {
                showToast('อัปโหลดสลิปโอนเงินขึ้น Google Drive ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
                setIsSaving(false);
                return;
              }
              finalSlips[i] = typeof itemSlip === 'object' 
                ? { ...itemSlip, url: uploadedSlipLink, ...(uploadedSlipFileId ? { fileId: uploadedSlipFileId } : {}) }
                : uploadedSlipLink;
            }
          }
          setUploadedSlips(finalSlips);
          activityData.slips = finalSlips;
        }

        // 1. บันทึกลง Supabase และ IndexedDB แบบ Realtime
        await saveProjectSync(activityData);

        // 2. Seamless Bridge: ซิงก์ธนบัตรสนับสนุนศิลปิน / รายการซื้อของเข้ากระเป๋าคลังอัตโนมัติ (Idempotent)
        let syncedNotesMsg = '';
        if (syncSupportToCashVault && Array.isArray(activityData.customerSupport) && activityData.customerSupport.length > 0) {
          const supRes = await syncSupportCashToWarehouse({
            projectId: activityData.id,
            supportLines: activityData.customerSupport.map((l) => ({ ...l, syncToCashVault: true })),
            autoReserveForProject: true
          });
          if (supRes.syncedCount > 0) {
            syncedNotesMsg += ` + เติม/จองธนบัตรคลัง ${supRes.syncedCount} รายการ`;
          }
        }
        if (syncExpensesToWarehouse && Array.isArray(activityData.expenses) && activityData.expenses.length > 0) {
          const expRes = await syncExpenseLinesToWarehouse({
            projectId: activityData.id,
            expenseLines: activityData.expenses.map((l) => ({
              ...l,
              syncToWarehouse: shouldAutoSyncExpenseLine(l.detail, l.category, inventoryItems)
            })),
            catalogItems: inventoryItems
          });
          if (expRes.syncedCount > 0) {
            syncedNotesMsg += ` + เติมของเข้ากระเป๋าคลัง ${expRes.syncedCount} รายการ`;
          }
        }

        setAllActivities(prev => {
           const exists = prev.some(item => item.id === activityData.id);
           if (exists) {
               return prev.map(item => item.id === activityData.id ? activityData : item);
           } else {
               return [activityData, ...prev];
           }
        });

        setIsSaving(false);
        closeModal(true);
        const reassignedNote = !editingId && previewIdBeforeSave && finalId !== previewIdBeforeSave
          ? ` (ออกรหัส ${finalId})`
          : (!editingId ? ` (${finalId})` : '');
        showToast(`บันทึกข้อมูลเรียบร้อยแล้ว${reassignedNote}${syncedNotesMsg}`, 'success');
        return;
      } catch (error) {
        showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + error.message, 'error');
      }
    } else {
      if (hasBase64Item(latestImages) || hasBase64Item(uploadedSlips)) {
        showToast('กรุณาตั้งค่าระบบอัปโหลดรูปภาพ Google Drive ก่อนบันทึกรูปภาพหรือสลิป', 'error');
        setIsSaving(false);
        return;
      }
      if (editingId) {
        setAllActivities(allActivities.map(item => item.id === editingId ? activityData : item));
      } else {
        setAllActivities([activityData, ...allActivities]);
      }
      closeModal(true);
      showToast("บันทึกข้อมูลสำเร็จ", 'success');
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
    if (!deleteConfirm.id) return;
    setIsSaving(true);
    try {
      await deleteProjectSync(deleteConfirm.id);
      setAllActivities(prev => prev.filter(item => item.id !== deleteConfirm.id));
      showToast("ลบข้อมูลเรียบร้อยแล้ว", 'success');
      closeDeleteModal();
      if (deleteConfirm.fromModal) {
        closeModal();
      }
    } catch (supaErr) {
      console.error("Delete project error:", supaErr);
      showToast("ไม่สามารถลบรายการได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง", 'error');
    } finally {
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
          {items.length === 0 && isScopeLoading ? (
            <div className="flex flex-col gap-3 animate-pulse">
              {[1, 2, 3].map(idx => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-20 bg-slate-100 rounded-lg" />
                    <div className="h-5 w-24 bg-slate-100 rounded-md" />
                  </div>
                  <div className="h-5 w-3/4 bg-slate-100 rounded-md" />
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="h-4 w-28 bg-slate-100 rounded" />
                    <div className="h-4 w-28 bg-slate-100 rounded" />
                  </div>
                  <div className="h-16 bg-slate-50 rounded-xl" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-3 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-slate-400">
                <Folder className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-bold text-slate-700">ไม่พบรายการแผนงานในช่วงเวลานี้</h4>
                <p className="text-xs text-slate-400">ยังไม่มีข้อมูลสำหรับช่วงเวลานี้</p>
              </div>
              <button
                type="button"
                onClick={() => openModal()}
                className="mt-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> เพิ่มแผนงานใหม่
              </button>
            </div>
          ) : (
            items.map((item, i) => {
            const expRevenue = item.quotationItems && item.quotationItems.length > 0
              ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || ((parseFloat(q.unitPrice) || 0) * (parseFloat(q.quantity) || 1)) || 0), 0)
              : 0;
            const itemRevenue = expRevenue > 0 ? expRevenue : (parseFloat(item.wage || item.totalRevenue || item.total_revenue) || 0);

            const expSupport = item.customerSupport && item.customerSupport.length > 0
              ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || ((parseFloat(s.denomination || s.unitPrice) || 0) * (parseFloat(s.quantity) || 1)) || 0), 0)
              : 0;
            const itemSupport = expSupport > 0 ? expSupport : (parseFloat(item.customerSupportTotal || item.customer_support_total) || 0);

            const expExpenses = item.expenses && item.expenses.length > 0
              ? item.expenses.reduce((sum, ex) => sum + (parseFloat(ex.price) || ((parseFloat(ex.unitPrice) || 0) * (parseFloat(ex.quantity) || 1)) || 0), 0)
              : 0;
            const itemExpenses = expExpenses > 0 ? expExpenses : (parseFloat(item.totalExpenses || item.total_expenses) || 0);

            const itemProfit = itemRevenue - itemExpenses;
            const itemReceivable = itemRevenue + itemSupport;

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
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold whitespace-nowrap mt-0.5 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          <Wallet className="w-3.5 h-3.5" /> จ่าย: {formatDate(item.paymentDate).split(' ')[0]}
                        </div>
                      )}
                   </div>
                   <div className="flex flex-col gap-1.5 items-end">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${dealStatusInfo.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(dealStatusInfo)}`}></span>
                          {dealStatusInfo.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${transportStatusInfo.color}`}>
                          <Truck className="w-3.5 h-3.5" />
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
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> {itemRevenue.toLocaleString()}</span>
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
                {/* [MODIFIED] Mobile Action Buttons - Includes Game Inventory Shortcut */}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                    <button 
                        onClick={(e) => handleDeleteFromTable(e, item.id)} 
                        className="flex items-center justify-center gap-1 py-2.5 bg-rose-50 border border-rose-100 text-rose-600 font-bold hover:bg-rose-100 rounded-xl transition shadow-sm cursor-pointer"
                        title="ลบรายการ"
                    >
                        <Trash2 className="w-4 h-4" /> 
                    </button>
                    <button 
                        onClick={(e) => handleOpenProjectInventoryBag(e, item)} 
                        className="flex items-center justify-center gap-1 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 rounded-xl transition-colors shadow-sm text-xs cursor-pointer"
                        title="จัดของ / เบิกเงินพับคลังสินค้า"
                    >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" /> จัดของ
                    </button>
                    <button 
                        onClick={(e) => handleEditFromTable(e, item)} 
                        className="flex items-center justify-center gap-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-xs cursor-pointer"
                    >
                        <Edit className="w-3.5 h-3.5 shrink-0" /> แก้ไข
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShareData(item); }} 
                        className="flex items-center justify-center gap-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl transition-colors shadow-sm text-xs cursor-pointer"
                        title="แชร์ให้ลูกค้า"
                    >
                        <Share2 className="w-3.5 h-3.5 shrink-0" /> แชร์
                    </button>
                </div>
              </div>
            );
          }))}
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
                {/* [MODIFIED] Changed table-fixed to table-auto for better content adaptation with border-collapse */}
                <table className="w-full min-w-[1280px] table-auto border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-sm font-semibold border-b border-slate-100">
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
                  <tbody>
                    {items.length === 0 && isScopeLoading ? (
                      [1, 2, 3, 4, 5, 6].map(idx => (
                        <tr key={idx} className="border-b border-slate-100/60 animate-pulse">
                          <td className="px-4 py-4 align-top">
                            <div className="h-5 w-20 bg-slate-100 rounded-lg mb-2" />
                            <div className="h-3.5 w-16 bg-slate-100 rounded" />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="h-4 w-36 bg-slate-100 rounded mb-2" />
                            <div className="h-3 w-20 bg-slate-100 rounded" />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="h-4 w-28 bg-slate-100 rounded mb-1.5" />
                            <div className="h-3 w-20 bg-slate-100 rounded" />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="h-4 w-24 bg-slate-100 rounded mb-1.5" />
                            <div className="h-3 w-16 bg-slate-100 rounded" />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="h-4 w-28 bg-slate-100 rounded mb-1.5" />
                            <div className="h-3 w-32 bg-slate-100 rounded" />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="h-5 w-24 bg-slate-100 rounded-md mb-1.5" />
                            <div className="h-5 w-24 bg-slate-100 rounded-md" />
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                            <div className="h-4 w-20 bg-slate-100 rounded ml-auto mb-1.5" />
                            <div className="h-3 w-16 bg-slate-100 rounded ml-auto" />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="h-4 w-20 bg-slate-100 rounded" />
                          </td>
                          <td className="px-2 py-4 align-top text-right">
                            <div className="h-7 w-20 bg-slate-100 rounded-lg ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                              <Folder className="w-7 h-7" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <h4 className="text-base font-bold text-slate-700">ไม่พบรายการแผนงานในช่วงเวลานี้</h4>
                              <p className="text-xs text-slate-400">ยังไม่มีข้อมูลสำหรับช่วงเวลานี้ หรือคุณสามารถเพิ่มแผนงานใหม่ได้</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openModal()}
                              className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" /> เพิ่มแผนงานใหม่
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((item, i) => {
                      const expRevenue = item.quotationItems && item.quotationItems.length > 0
                        ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || ((parseFloat(q.unitPrice) || 0) * (parseFloat(q.quantity) || 1)) || 0), 0)
                        : 0;
                      const itemRevenue = expRevenue > 0 ? expRevenue : (parseFloat(item.wage || item.totalRevenue || item.total_revenue) || 0);

                      const expSupport = item.customerSupport && item.customerSupport.length > 0
                        ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || ((parseFloat(s.denomination || s.unitPrice) || 0) * (parseFloat(s.quantity) || 1)) || 0), 0)
                        : 0;
                      const itemSupport = expSupport > 0 ? expSupport : (parseFloat(item.customerSupportTotal || item.customer_support_total) || 0);

                      const expExpenses = item.expenses && item.expenses.length > 0
                        ? item.expenses.reduce((sum, ex) => sum + (parseFloat(ex.price) || ((parseFloat(ex.unitPrice) || 0) * (parseFloat(ex.quantity) || 1)) || 0), 0)
                        : 0;
                      const itemExpenses = expExpenses > 0 ? expExpenses : (parseFloat(item.totalExpenses || item.total_expenses) || 0);

                      const itemProfit = itemRevenue - itemExpenses;
                      const itemReceivable = itemRevenue + itemSupport;

                      const dealStatusInfo = getDealStatusInfo(item.dealStatus);
                      const transportStatusInfo = getTransportStatusInfo(item.transportStatus);

                      return (
                        <tr
                          key={item.id}
                          onClick={() => openModal(item, true)}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer border-b border-slate-100/70"
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs w-fit whitespace-nowrap">{item.id}</span>
                              {/* [MODIFIED] Date: whitespace-nowrap to prevent truncation */}
                              <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 whitespace-nowrap">
                                <Clock className="w-3 h-3 shrink-0" />
                                {item.rawDateTime
                                  ? formatDate(item.rawDateTime)
                                  : (item.date && item.date !== '-' ? item.date : '-')}
                              </div>
                              {item.paymentDate && (
                                <div className="flex items-center gap-1.5 text-emerald-700 text-xs mt-1 whitespace-nowrap font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 w-fit">
                                  <Wallet className="w-3.5 h-3.5 shrink-0" />
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
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border w-full max-w-[140px] truncate ${dealStatusInfo.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(dealStatusInfo)}`}></span>
                                <span className="truncate">{dealStatusInfo.label}</span>
                              </span>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border w-full max-w-[140px] truncate ${transportStatusInfo.color}`}>
                                <Truck className="w-3.5 h-3.5 shrink-0" />
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
                                    {itemSupport > 0 && <span className="text-blue-500 font-bold" title="เงินศิลปิน (สนับสนุน)">+{itemSupport.toLocaleString()}</span>}
                                    <span className="text-emerald-600 font-bold" title="รายได้ (ค่าจ้าง)">{itemRevenue.toLocaleString()}</span>
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
                                onClick={(e) => handleOpenProjectInventoryBag(e, item)}
                                className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg transition shadow-sm cursor-pointer"
                                title="จัดของ / เบิกเงินพับคลังสินค้า"
                              >
                                <ShoppingBag className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShareData(item); }}
                                className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 rounded-lg transition shadow-sm cursor-pointer"
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
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {limit === 0 && isLoadingMore && (
               <div className="w-full py-6 text-center border-0 bg-transparent animate-in fade-in">
                   <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-2 bg-white rounded-full shadow-sm border border-slate-200">
                          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      </div>
                      <span className="text-xs text-slate-500 font-bold animate-pulse">กำลังโหลดข้อมูลเพิ่มเติม...</span>
                   </div>
               </div>
            )}

            {limit === 0 && visibleCount < sourceData.length && (
              <div className="w-full py-4 text-center border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => Math.min(prev + 25, sourceData.length))}
                  className="px-6 py-2.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-2 active:scale-95"
                >
                  <span>แสดงข้อมูลเพิ่มเติม (เหลืออีก {sourceData.length - visibleCount} รายการ)</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            )}
        </div>
      </div>
    );
  };
  
  const renderFilterCard = (tabKey = activeTab) => {
    const curFilter = getTabFilter(tabKey);
    const curSearch = curFilter.search;
    const curDateMode = curFilter.dateMode;
    const curDate = curFilter.date;
    const curDateRange = curFilter.dateRange;
    const curCategory = curFilter.category;
    const curStatus = curFilter.status;
    const curTransport = curFilter.transport;

    const setCurSearch = (val) => updateTabFilter(tabKey, { search: val });
    const setCurDateMode = (val) => updateTabFilter(tabKey, { dateMode: val });
    const setCurDate = (val) => updateTabFilter(tabKey, { date: val });
    const setCurDateRange = (val) => updateTabFilter(tabKey, { dateRange: val });
    const setCurCategory = (val) => updateTabFilter(tabKey, { category: val });
    const setCurStatus = (val) => updateTabFilter(tabKey, { status: val });
    const setCurTransport = (val) => updateTabFilter(tabKey, { transport: val });
    const resetCurFilters = () => resetTabFilter(tabKey);

    const activeFilterCount = [
      curDateMode !== 'month',
      curCategory !== 'all',
      curStatus !== 'all',
      curTransport !== 'all'
    ].filter(Boolean).length;

    return (
      <HeaderFilterPortal
        active={activeTab === tabKey}
        searchValue={curSearch}
        onSearchChange={setCurSearch}
        placeholder="ค้นหาชื่องาน, ศิลปิน, รหัส..."
        activeFilterCount={activeFilterCount}
        onReset={resetCurFilters}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="sm:col-span-2 lg:col-span-1 h-10">
            <DateFilterControl
              mode={curDateMode}
              setMode={setCurDateMode}
              date={curDate}
              setDate={setCurDate}
              range={curDateRange}
              setRange={setCurDateRange}
            />
          </div>

          <StatusDropdown
            value={curCategory}
            onChange={(val) => setCurCategory(val)}
            options={[
              { value: 'all', label: 'ทุกหมวดหมู่' },
              ...projectCategories.map((cat) => ({ value: cat, label: cat })),
            ]}
            placeholder="ทุกหมวดหมู่"
            size="sm"
            showDot={false}
            leftIcon={Tag}
            className="bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-700"
          />

          <StatusDropdown
            value={curStatus}
            onChange={(val) => setCurStatus(val)}
            options={[
              { value: 'all', label: 'ทุกสถานะ (ดีล)' },
              ...(curStatus === '__kpi_completed__' ? [{ value: '__kpi_completed__', label: 'งานเสร็จสิ้น (ปิดจ๊อบแล้ว)' }] : []),
              ...(curStatus === '__kpi_active__' ? [{ value: '__kpi_active__', label: 'กำลังดำเนินการ (Active)' }] : []),
              ...(curStatus === '__kpi_issues__' ? [{ value: '__kpi_issues__', label: 'ยกเลิก / มีปัญหา' }] : []),
              ...dealStatuses.map((status) => ({
                value: status.value,
                label: status.label,
                color: status.color,
              })),
            ]}
            placeholder="ทุกสถานะ (ดีล)"
            size="sm"
            showDot={true}
            leftIcon={Briefcase}
            className="bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-700"
          />

          <StatusDropdown
            value={curTransport}
            onChange={(val) => setCurTransport(val)}
            options={[
              { value: 'all', label: 'ขนส่ง: ทั้งหมด' },
              { value: 'active_only', label: 'กำลังดำเนินการ (Active)' },
              ...transportStatuses.map((status) => ({
                value: status.value,
                label: status.label,
                color: status.color,
              })),
            ]}
            placeholder="ขนส่ง: ทั้งหมด"
            size="sm"
            showDot={true}
            leftIcon={Truck}
            className="bg-slate-50 border-slate-200/80 hover:border-slate-300 text-slate-700"
          />
        </div>
      </HeaderFilterPortal>
    );
  };

  const renderContent = () => {
    if (resetToken) {
      return (
        <ResetPasswordView
          token={resetToken}
          shopInfo={shopInfo}
          onBackToLogin={handleExitResetPassword}
        />
      );
    }

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
        
        // [FIX] Match against generated token or verified public single-project lookup
        const trackData = allActivities.find(item => 
            item.trackingToken === trackingId ||
            generateTrackingToken(item.id, item.rawDateTime) === trackingId ||
            (!isLoggedIn && allActivities.length === 1 && item.id)
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
            item.trackingToken === quotationId ||
            generateTrackingToken(item.id, item.rawDateTime) === quotationId ||
            (!isLoggedIn && allActivities.length === 1 && item.id)
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
    
    // Supabase Database Connection Check
    const isSupabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (!isSupabaseConfigured && !GOOGLE_SCRIPT_URL) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] w-full px-4 text-center">
            <div className="p-4 bg-amber-50 rounded-full text-amber-500 mb-4">
               <WifiOff className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">ยังไม่ได้เชื่อมต่อฐานข้อมูล Supabase</h2>
            <p className="text-slate-500 max-w-md mb-6">
               กรุณากำหนดค่าตัวแปร <code>VITE_SUPABASE_URL</code> และ <code>VITE_SUPABASE_ANON_KEY</code> ในไฟล์ .env.local
            </p>
        </div>
      );
    }

    // [PERFORMANCE FIX] ใช้เทคนิค Lazy Mount + Persistent Warm Layout พร้อม startTransition เพื่อความลื่นไหลระดับ 60fps
    return (
      <>
        {/* --- Tab: Calendar --- */}
        {visitedTabs.has('Calendar') && (
          <PersistentPage active={activeTab === 'Calendar'} className="block h-full">
            <Calendar 
              activities={allActivities} 
              onEventClick={(item) => openModal(item, true)} 
              dealStatuses={dealStatuses}
              transportStatuses={transportStatuses}
              onMonthChange={handleCalendarMonthChange}
            />
          </PersistentPage>
        )}

        {/* --- Tab 3: Analytics --- */}
        {visitedTabs.has('Analytics') && (
          <PersistentPage active={activeTab === 'Analytics'} className="block">
            <Analytics
              renderFilterCard={() => renderFilterCard('Analytics')}
              analyticsData={analyticsData}
              isLoading={isAnalyticsLoading}
              dateFilterMode={analyticsFilter.dateMode}
              resetFilters={() => resetTabFilter('Analytics')}
              setFilterStatus={(s) => updateTabFilter('Analytics', { status: s })}
              setFilterTransport={(t) => updateTabFilter('Analytics', { transport: t })}
              isActive={activeTab === 'Analytics'}
              onOpenVenueModal={(venueOrName) => {
                const match = typeof venueOrName === 'string'
                  ? deliveryLocations.find(l => l.name.toLowerCase() === venueOrName.trim().toLowerCase()) || { name: venueOrName }
                  : venueOrName;
                setSelectedVenueForModal(match);
              }}
              onSelectProject={(project) => openModal(project, true)}
            />
          </PersistentPage>
        )}

        {/* --- Tab 4: Plans --- */}
        {visitedTabs.has('Plans') && (
          <PersistentPage active={activeTab === 'Plans'} className="block">
            <Plans
              stats={stats}
              renderFilterCard={() => renderFilterCard('Plans')}
              renderTable={renderTable}
              filteredAndSortedActivities={plansActivities}
              onOpenModal={() => openModal()}
              renderBatchBanner={() => (
                <BatchDeliveryBanner
                  activities={plansActivities}
                  dealStatuses={dealStatuses}
                  transportStatuses={transportStatuses}
                  onSelectProject={(p) => openModal(p, true)}
                  onOpenVenueModal={(venueOrName) => {
                    const match = typeof venueOrName === 'string'
                      ? deliveryLocations.find(l => l.name.toLowerCase() === venueOrName.trim().toLowerCase()) || { name: venueOrName }
                      : venueOrName;
                    setSelectedVenueForModal(match);
                  }}
                />
              )}
            />
          </PersistentPage>
        )}

        {/* --- Tab 5: Finance --- */}
        {visitedTabs.has('Finance') && (
          <PersistentPage active={activeTab === 'Finance'} className="block min-h-full pb-24 md:pb-6">
              <Finance
                  activities={allActivities}
                  inventoryItems={inventoryItems}
                  dealStatuses={dealStatuses}
                  transportStatuses={transportStatuses}
                  paymentStatuses={paymentStatuses}
                  shopInfo={shopInfo}
                  onOpenProjectModal={openModal}
                  themeColor={shopInfo?.themeColor || 'indigo'}
                  dateFilterMode={financeFilter.dateMode}
                  setDateFilterMode={(m) => updateTabFilter('Finance', { dateMode: m })}
                  filterDate={financeFilter.date}
                  setFilterDate={(d) => updateTabFilter('Finance', { date: d })}
                  filterDateRange={financeFilter.dateRange}
                  setFilterDateRange={(r) => updateTabFilter('Finance', { dateRange: r })}
                  isActive={activeTab === 'Finance'}
                  onSaveActivity={(updatedActivity) => {
                    setAllActivities(prev => {
                      const exists = prev.some(item => item.id === updatedActivity.id);
                      if (exists) {
                        return prev.map(item => item.id === updatedActivity.id ? updatedActivity : item);
                      } else {
                        return [updatedActivity, ...prev];
                      }
                    });
                  }}
              />
          </PersistentPage>
        )}

        {/* --- Tab: Quotations --- */}
        {visitedTabs.has('Quotations') && (
          <PersistentPage active={activeTab === 'Quotations'} className="block">
            <Quotations
              activities={allActivities}
              allProjects={allActivities}
              customers={savedCustomers}
              shopInfo={shopInfo}
              dealStatuses={dealStatuses}
              inventoryItems={inventoryItems}
              inventoryImageFolderId={resolveInventoryImageFolder(driveFolders, assetsDriveFolderId)}
              driveUploadUrl={GOOGLE_SCRIPT_URL}
              isCreateOpen={isCreateQuotationOpen}
              onCloseCreate={() => setIsCreateQuotationOpen(false)}
              onOpenProjectModal={openModal}
              onRefresh={fetchProjects}
            />
          </PersistentPage>
        )}

        {/* --- Tab: Inventory --- */}
        {visitedTabs.has('Inventory') && (
          <PersistentPage active={activeTab === 'Inventory'} className="block">
            <Inventory
              defaultExperience="game"
              inventoryItems={inventoryItems}
              assetLoans={assetLoans}
              activities={allActivities}
              isCreateOpen={isCreateInventoryOpen}
              onCloseCreate={() => setIsCreateInventoryOpen(false)}
              onHistoryModeChange={setIsInventoryHistoryOpen}
              onOpenProjectModal={openModal}
              onSaveActivity={async (updatedActivity) => {
                await saveProjectSync(updatedActivity);
                setAllActivities((prev) => {
                  const exists = prev.some((item) => item.id === updatedActivity.id);
                  if (exists) {
                    return prev.map((item) => (item.id === updatedActivity.id ? updatedActivity : item));
                  }
                  return [updatedActivity, ...prev];
                });
              }}
              externalGameActionRequest={pendingGameInventoryAction}
              onClearExternalGameAction={() => setPendingGameInventoryAction(null)}
              onRefresh={fetchProjects}
              inventoryImageFolderId={resolveInventoryImageFolder(driveFolders, assetsDriveFolderId)}
              driveUploadUrl={GOOGLE_SCRIPT_URL}
              isActive={activeTab === 'Inventory'}
              userProfile={userProfile}
            />
          </PersistentPage>
        )}

        {/* --- Tab: Venues --- */}
        {visitedTabs.has('Locations') && (
          <PersistentPage active={activeTab === 'Locations'} className="block">
            <Locations
              venues={deliveryLocations}
              isCreateOpen={isCreateVenueOpen}
              onCloseCreate={() => setIsCreateVenueOpen(false)}
              onSelectVenue={(venue) => {
                setSelectedVenueForModal(venue);
              }}
              onRefresh={() => {
                loadLocationsLocalFirst(setDeliveryLocations);
              }}
              shopInfo={shopInfo}
            />
          </PersistentPage>
        )}

        {/* --- Tab: Artists --- */}
        {visitedTabs.has('Artists') && (
          <PersistentPage active={activeTab === 'Artists'} className="block">
            <Artists
              artists={artistList}
              artistStats={artistSummaryStats}
              assetsDriveFolderId={getFolderIdByType('artists')}
              activities={allActivities}
              isCreateOpen={isCreateArtistOpen}
              onCloseCreate={() => setIsCreateArtistOpen(false)}
              onOpenProjectModal={openModal}
              onFilterByArtist={(artistName) => {
                updateTabFilter('Plans', { search: artistName });
                handleSelectTab('Plans');
              }}
              onRefresh={() => {
                loadArtistsLocalFirst(setArtistList);
                loadArtistsAndCustomersSummaryStats(({ artistStats, customerStats }) => {
                  if (artistStats) setArtistSummaryStats(artistStats);
                  if (customerStats) setCustomerSummaryStats(customerStats);
                });
              }}
            />
          </PersistentPage>
        )}

        {/* --- Tab: Customers --- */}
        {visitedTabs.has('Customers') && (
          <PersistentPage active={activeTab === 'Customers'} className="block">
            <Customers
              customers={customerList}
              customerStats={customerSummaryStats}
              activities={allActivities}
              isCreateOpen={isCreateCustomerOpen}
              onCloseCreate={() => setIsCreateCustomerOpen(false)}
              onOpenProjectModal={openModal}
              onFilterByCustomer={(custName) => {
                updateTabFilter('Plans', { search: custName });
                handleSelectTab('Plans');
              }}
              onRefresh={() => {
                loadCustomersLocalFirst(setCustomerList);
                loadArtistsAndCustomersSummaryStats(({ artistStats, customerStats }) => {
                  if (artistStats) setArtistSummaryStats(artistStats);
                  if (customerStats) setCustomerSummaryStats(customerStats);
                });
              }}
            />
          </PersistentPage>
        )}

        {/* --- Tab: Staff --- */}
        {visitedTabs.has('Staff') && (
          <PersistentPage active={activeTab === 'Staff'} className="block">
            <Staff
              activities={allActivities}
              currentUser={userProfile}
              isCreateOpen={isCreateStaffOpen}
              onCloseCreate={() => setIsCreateStaffOpen(false)}
              onRefresh={fetchSettings}
              profilesDriveFolderId={getFolderIdByType('profiles')}
            />
          </PersistentPage>
        )}

        {/* --- Tab 6: Settings --- */}
        {visitedTabs.has('Settings') && (
          <PersistentPage active={activeTab === 'Settings'} className="block">
            <Settings
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
              paymentStatuses={paymentStatuses}
              setPaymentStatuses={setPaymentStatuses}
              handleLogout={handleLogout}
              processImageUrl={processImageUrl}
              defaultCategory={settingsDefaultCategory}
              onUpdateUserProfile={(newProf) => setUserProfile(newProf)}
            />
          </PersistentPage>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#F8FAFC] font-sans text-slate-800 selection:bg-indigo-100 selection:text-indigo-900 md:h-screen md:overflow-hidden md:relative">
      
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
      {previewImage && (
        <ImageViewer 
          src={previewImage} 
          onClose={() => setPreviewImage(null)} 
        />
      )}
      
      {/* Render SharePreviewModal when shareData exists */}
      {shareData && (
        <SharePreviewModal 
          data={shareData} 
          shopInfo={shopInfo} // [MODIFIED] Pass shopInfo prop to modal
          // [REMOVED] userProfile prop
          onClose={() => setShareData(null)} 
        />
      )}

      {/* --- Desktop / Tablet Sidebar (Zero-Reflow GPU 60-120 FPS, Deterministic Single-Token Gesture Engine) --- */}
      {/* Only show sidebar if logged in AND NOT in tracking mode */}
      {isLoggedIn && !trackingId && !quotationId && !resetToken && (
        <aside
          ref={attachSidebarRef}
          data-desktop-sidebar="true"
          onPointerDown={handleSidebarDragStart}
          onClickCapture={handleSidebarClickCapture}
          style={{
            touchAction: 'pan-y'
          }}
          className={`hidden md:flex flex-col shrink-0 bg-white border-r border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] ${isProfileMenuOpen ? 'z-[60]' : 'z-30'} md:absolute md:inset-y-0 md:left-0 select-none`}
        >
          {/* Invisible Right-Edge Drag Strip (Bubbles cleanly to single aside onPointerDown) */}
          <div
            className="sidebar-drag-handle hidden md:block absolute top-0 -right-1.5 w-3 h-full z-[70] touch-none select-none"
            aria-hidden="true"
          />

          {/* Clipped Inner Rail: Icons stay locked on x = 40px axis; single-line labels clip & fade smoothly */}
          <div className="sidebar-inner-rail flex flex-col flex-1 min-h-0 w-full overflow-hidden">
            {/* Header & Logo (Seamless without divider border; click or swipe to expand/collapse) */}
            <div
              data-sidebar-logo-toggle="true"
              onClick={() => {
                if (isDraggingSidebarRef.current) return;
                toggleDesktopSidebar();
              }}
              title={isSidebarCollapsed ? 'คลิกเพื่อขยายเมนู' : 'คลิกเพื่อย่อเมนู'}
              className="pl-5 pr-4 pt-[calc(18px+env(safe-area-inset-top,0px))] pb-2 min-h-[calc(72px+env(safe-area-inset-top,0px))] flex items-center gap-3.5 shrink-0 w-[256px] cursor-pointer group select-none"
            >
              {/* Sidebar Brand Logo */}
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden relative group-hover:scale-105 transition-transform duration-200 ${shopInfo.logo ? '' : 'theme-logo-bg'}`}>
                {shopInfo.logo ? (
                  <img
                    src={processImageUrl(shopInfo.logo)}
                    alt="App Logo"
                    draggable={false}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      e.target.parentElement.classList.add('theme-logo-bg');
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${shopInfo.logo ? 'hidden' : 'flex'}`}>
                  <Clipboard className="w-6 h-6 text-white" />
                </div>
              </div>
              <span
                className="sidebar-text-label shrink-0 w-[166px] text-xl font-extrabold text-slate-900 tracking-[-0.02em] whitespace-nowrap truncate pointer-events-none will-change-transform"
              >
                {shopInfo.shopName || 'Flower2you'}
              </span>
            </div>

            <nav className="flex-1 min-h-0 px-3 pt-2 pb-4 space-y-1.5 overflow-y-auto overflow-x-hidden no-scrollbar">
              {allowedNavItems.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    if (isDraggingSidebarRef.current) return;
                    handleSelectTab(item.name);
                  }}
                  className={`w-full h-12 pl-[18px] pr-0 flex items-center gap-3.5 text-sm font-bold rounded-[1.2rem] overflow-hidden shrink-0 transition-[background-color,color,box-shadow,transform] duration-150 group cursor-pointer ${
                    activeTab === item.name
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-200/60 scale-100'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 pointer-events-none ${activeTab === item.name ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span
                    className="sidebar-text-label shrink-0 whitespace-nowrap pr-4 pointer-events-none will-change-transform"
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>

            <div className="p-3 border-t border-slate-100/80 shrink-0">
              <div
                onClick={() => {
                  if (isDraggingSidebarRef.current) return;
                  setIsProfileMenuOpen((prev) => !prev);
                }}
                className="w-full h-14 pl-2 pr-0 flex items-center gap-3 cursor-pointer rounded-2xl bg-slate-50 hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-[background-color,box-shadow,border-color] duration-200 border border-transparent hover:border-slate-100 group select-none overflow-hidden"
                title="โปรไฟล์และบัญชีผู้ใช้"
              >
                {/* Profile Image in Sidebar */}
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold ring-4 ring-white shadow-md shrink-0 overflow-hidden">
                  {userProfile?.image ? (
                    <img
                      src={processImageUrl(userProfile.image)}
                      alt="Profile"
                      draggable={false}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : (
                    userProfile?.name?.charAt(0) || 'U'
                  )}
                  {userProfile?.image && <div className="hidden w-full h-full items-center justify-center bg-slate-900 text-white">{userProfile?.name?.charAt(0) || 'U'}</div>}
                </div>
                <div
                  className="sidebar-text-label shrink-0 w-[160px] pr-3 min-w-0 pointer-events-none will-change-transform"
                >
                  <p className="text-sm font-bold text-slate-900 whitespace-nowrap truncate">{userProfile?.name || 'Guest User'}</p>
                  <p className="text-xs text-slate-500 whitespace-nowrap truncate font-medium">{userProfile?.role || 'Viewer'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Popup Menu at Bottom-Left (kept outside overflow-hidden so popup is never clipped) */}
          {isProfileMenuOpen && (
            <>
              <div
                data-sidebar-no-drag="true"
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileMenuOpen(false)}
              />
              <div
                data-sidebar-no-drag="true"
                className={`absolute ${isSidebarCollapsed ? 'left-20 bottom-3' : 'left-3 bottom-[84px]'} bg-white rounded-3xl shadow-2xl border border-slate-100 p-2.5 w-72 sm:w-80 z-50 animate-in fade-in zoom-in-95 origin-bottom-left flex flex-col gap-1.5`}
              >
                {/* Top User Card */}
                <div
                  onClick={() => {
                    setIsUserProfileModalOpen(true);
                    setIsProfileMenuOpen(false);
                  }}
                  className="p-3 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-purple-50/50 rounded-2xl border border-indigo-100/70 hover:bg-indigo-50 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-lg overflow-hidden shrink-0 ring-2 ring-white shadow-md">
                      {userProfile?.image ? (
                        <img
                          src={processImageUrl(userProfile.image)}
                          alt="Profile"
                          draggable={false}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        userProfile?.name?.charAt(0) || 'U'
                      )}
                      {userProfile?.image && (
                        <div className="hidden w-full h-full items-center justify-center bg-slate-900 text-white">
                          {userProfile?.name?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition">
                        {userProfile?.name || 'Guest User'}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100">
                          {userProfile?.id || userProfile?.staff_code || '2611001'}
                        </span>
                        <span className="text-xs text-slate-500 font-medium truncate">
                          @{userProfile?.username || 'user'}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white inline-block">
                          {userProfile?.role_label || (userProfile?.role === 'admin' ? 'ผู้ดูแลระบบ' : userProfile?.role || 'พนักงาน')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setIsUserProfileModalOpen(true);
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-bold transition text-left cursor-pointer"
                  >
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 font-bold">โปรไฟล์ของฉัน (My Profile)</div>
                      <div className="text-xs text-slate-500 font-normal">แก้ไขชื่อ, เลขบัตร ปชช., เบอร์โทร, รหัสผ่าน</div>
                    </div>
                  </button>
                </div>

                <div className="h-px bg-slate-100 my-1" />

                {/* Logout Button */}
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 text-xs font-bold transition text-left cursor-pointer"
                >
                  <div className="p-2 bg-rose-100 text-rose-500 rounded-xl">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">ออกจากระบบ</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      <div
        ref={attachMainShellRef}
        data-main-shell="true"
        data-has-desktop-sidebar={isLoggedIn && !trackingId && !quotationId && !resetToken ? 'true' : undefined}
        className="flex-1 min-w-0 flex flex-col min-h-screen md:min-h-0 md:h-full md:overflow-hidden relative"
      >
        {/* Only show header if logged in AND NOT in tracking mode */}
        {isLoggedIn && !trackingId && !quotationId && !resetToken && (() => {
          const isInventorySubView = activeTab === 'Inventory' && isInventoryHistoryOpen;
          const currentHeaderTitle = isInventorySubView ? 'ประวัติคลังสินค้า' : getPageTitle(activeTab);
          const primaryActionBtnClass =
            'min-w-9 min-h-9 w-9 h-9 sm:w-10 sm:h-10 lg:w-auto lg:h-10 lg:px-4 rounded-xl theme-logo-bg text-white hover:brightness-95 text-sm font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600';

          const singlePageCreateMap = {
            Plans: { label: 'เพิ่มแผนงาน', onClick: () => openModal() },
            Calendar: { label: 'เพิ่มงาน', onClick: () => openModal() },
            Locations: {
              label: 'เพิ่มสถานที่',
              onClick: () => {
                setIsCreateVenueOpen(true);
                window.dispatchEvent(new CustomEvent('trigger-create-venue'));
              }
            },
            Artists: {
              label: 'เพิ่มศิลปินใหม่',
              onClick: () => {
                setIsCreateArtistOpen(true);
                window.dispatchEvent(new CustomEvent('trigger-create-artist'));
              }
            },
            Customers: {
              label: 'เพิ่มลูกค้าใหม่',
              onClick: () => {
                setIsCreateCustomerOpen(true);
                window.dispatchEvent(new CustomEvent('trigger-create-customer'));
              }
            },
            Staff: {
              label: 'เพิ่มพนักงานใหม่',
              onClick: () => {
                setIsCreateStaffOpen(true);
                window.dispatchEvent(new CustomEvent('trigger-create-staff'));
              }
            },
            Finance: {
              label: 'เพิ่มรายรับ/จ่าย',
              onClick: () => window.dispatchEvent(new CustomEvent('trigger-create-finance-tx'))
            }
          };
          const singleCreateAction = singlePageCreateMap[activeTab] || null;

          return (
            <div className="sticky top-0 left-0 right-0 z-50 shrink-0">
              <header
                ref={headerRef}
                className="relative z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200/75 px-4 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-4 min-h-[calc(72px+env(safe-area-inset-top,0px))] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(320px,496px)_minmax(0,1fr)] items-center gap-x-1.5 sm:gap-x-2 lg:gap-x-4"
              >
                {/* ================= ZONE 1: LEFT NAVIGATION / MOBILE SEARCH (+ TITLE ON WIDE PC) ================= */}
                <div className="justify-self-start flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 min-w-0 relative">
                  {isInventorySubView && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('trigger-inventory-history'))}
                      className="w-10 h-10 -ml-1.5 rounded-full text-slate-900 hover:bg-slate-100 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                      title="กลับคลังสินค้า"
                      aria-label="กลับคลังสินค้า"
                    >
                      <ArrowLeft aria-hidden="true" className="w-[21px] h-[21px] stroke-[2.2]" />
                    </button>
                  )}

                  {/* Mobile & Portrait Tablet (< lg): Search Trigger Slot [🔍] + Standalone Filter Slot [🎚️] */}
                  <div className="lg:hidden flex items-center gap-1">
                    <div id="app-header-mobile-search-trigger-slot" className="flex items-center empty:hidden" />
                    <div
                      id="app-header-filter-slot"
                      className={`${
                        activeTab === 'Inventory' || activeTab === 'Quotations'
                          ? 'hidden'
                          : 'flex'
                      } items-center empty:hidden`}
                    />
                  </div>

                  {/* Wide PC (lg+): Page Title next to Nav Action */}
                  <h1 className="hidden lg:block text-xl font-extrabold text-slate-900 tracking-[-0.02em] truncate">
                    {currentHeaderTitle}
                  </h1>
                </div>

                {/* ================= ZONE 2: CENTER TITLE (< lg) / SPOTLIGHT SEARCH (lg+) ================= */}
                <div className="min-w-0 flex items-center justify-center w-full">
                  <h1 className="lg:hidden text-base sm:text-lg font-extrabold text-slate-900 tracking-[-0.02em] truncate text-center">
                    {currentHeaderTitle}
                  </h1>
                  <div
                    id="app-header-center-search-slot"
                    className="hidden lg:flex w-full items-center justify-center"
                  />
                </div>

                {/* ================= ZONE 3: RIGHT PRIMARY ACTIONS (STRICT <= 3 + [⋯] OVERFLOW) ================= */}
                <div className="justify-self-end flex items-center justify-end gap-0.5 sm:gap-1.5 lg:gap-2 shrink-0 min-w-0 relative">
                  {/* Standard Single-CTA Pages (<= 3 right actions across all viewports) */}
                  {singleCreateAction && (
                    <button
                      type="button"
                      onClick={singleCreateAction.onClick}
                      className={primaryActionBtnClass}
                      title={singleCreateAction.label}
                      aria-label={singleCreateAction.label}
                    >
                      <Plus aria-hidden="true" className="w-5 h-5 lg:w-4 lg:h-4 stroke-[2.5] shrink-0" />
                      <span className="hidden lg:inline">{singleCreateAction.label}</span>
                    </button>
                  )}

                  {/* Quotations: PC shows [⚙️ ราคากลางวัสดุ] + [+ คำนวณราคา]; Mobile right shows [⚙️] + [+] (Left has [🔍]) */}
                  {activeTab === 'Quotations' && (
                    <>
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('trigger-rates-quotation'))}
                        className="min-w-9 min-h-9 w-9 h-9 sm:w-10 sm:h-10 lg:w-auto lg:h-10 lg:px-3.5 rounded-full text-slate-900 hover:bg-slate-100 lg:bg-slate-100/90 lg:hover:bg-slate-200/75 lg:text-slate-800 text-sm font-bold transition inline-flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                        title="ตั้งค่าราคากลางวัสดุ"
                        aria-label="ตั้งค่าราคากลางวัสดุ"
                      >
                        <SettingsIcon aria-hidden="true" className="w-[20px] h-[20px] lg:w-4 lg:h-4 text-slate-700 lg:text-slate-600 stroke-[2]" />
                        <span className="hidden lg:inline">ราคากลางวัสดุ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsCreateQuotationOpen(true);
                          window.dispatchEvent(new CustomEvent('trigger-create-quotation'));
                        }}
                        className={primaryActionBtnClass}
                        title="คำนวณราคา"
                        aria-label="คำนวณราคา"
                      >
                        <Plus aria-hidden="true" className="w-5 h-5 lg:w-4 lg:h-4 stroke-[2.5] shrink-0" />
                        <span className="hidden lg:inline">คำนวณราคา</span>
                      </button>
                    </>
                  )}

                  {/* Inventory: Mobile right shows [📷] + [⋯] (Left has [🔍]); PC shows [📷 สแกนหยิบ/คืน] + [+ เพิ่มพัสดุใหม่] + [⋯] */}
                  {activeTab === 'Inventory' && (
                    <>
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('trigger-inventory-scan'))}
                        className="min-w-9 min-h-9 w-9 h-9 sm:w-10 sm:h-10 lg:w-auto lg:h-10 lg:px-3.5 rounded-full text-slate-900 hover:bg-slate-100 lg:bg-slate-100/90 lg:hover:bg-slate-200/75 text-sm font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                        title="เปิดกล้องสแกนหยิบหรือคืนของ"
                        aria-label="สแกนหยิบ / คืน"
                      >
                        <QrCode aria-hidden="true" className="w-[20px] h-[20px] lg:w-4 lg:h-4 stroke-[2] shrink-0" />
                        <span className="hidden lg:inline">สแกนหยิบ / คืน</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsCreateInventoryOpen(true);
                          window.dispatchEvent(new CustomEvent('trigger-create-inventory'));
                        }}
                        className="hidden lg:inline-flex h-10 px-4 theme-logo-bg hover:brightness-95 text-white rounded-xl text-sm font-bold transition items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                        title="เพิ่มพัสดุใหม่"
                        aria-label="เพิ่มพัสดุใหม่"
                      >
                        <Plus aria-hidden="true" className="w-4 h-4 stroke-[2.5] shrink-0" />
                        <span>เพิ่มพัสดุใหม่</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderOverflowOpen((v) => !v);
                        }}
                        className={`relative min-w-9 min-h-9 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
                          isHeaderOverflowOpen
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-900 hover:bg-slate-100 lg:bg-slate-100/90 lg:hover:bg-slate-200/75'
                        }`}
                        title="คำสั่งเพิ่มเติม"
                        aria-label="คำสั่งเพิ่มเติม"
                        aria-expanded={isHeaderOverflowOpen}
                      >
                        <MoreHorizontal aria-hidden="true" className="w-[21px] h-[21px] lg:w-5 lg:h-5 stroke-[2]" />
                        {headerFilterMeta.activeFilterCount > 0 && !isInventorySubView && (
                          <span className="lg:hidden absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-600 ring-2 ring-white" />
                        )}
                      </button>
                    </>
                  )}

                  {/* Overflow Menu Popover [⋯] (Apple / IG Frosted Action Panel) */}
                  {isHeaderOverflowOpen && (activeTab === 'Inventory' || activeTab === 'Quotations') && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsHeaderOverflowOpen(false)}
                      />
                      <div className="absolute right-0 top-[calc(100%+8px)] w-64 bg-white/98 backdrop-blur-2xl rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/10 p-1.5 z-50 animate-in fade-in zoom-in-95 origin-top-right duration-150">
                        {activeTab === 'Quotations' && (
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsHeaderOverflowOpen(false);
                                window.dispatchEvent(new CustomEvent('trigger-toggle-header-filter'));
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100/85 transition text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                            >
                              <SlidersHorizontal aria-hidden="true" className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="flex-1">ตัวกรองรายการ</span>
                              {headerFilterMeta.activeFilterCount > 0 && (
                                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-violet-600 text-white text-[11px] font-extrabold flex items-center justify-center tabular-nums">
                                  {headerFilterMeta.activeFilterCount}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsHeaderOverflowOpen(false);
                                window.dispatchEvent(new CustomEvent('trigger-rates-quotation'));
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100/85 transition text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                            >
                              <SettingsIcon aria-hidden="true" className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="flex-1">ตั้งค่าราคากลางวัสดุ</span>
                            </button>
                            {headerFilterMeta.isDirty && (
                              <>
                                <hr className="my-1 border-slate-100" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsHeaderOverflowOpen(false);
                                    window.dispatchEvent(new CustomEvent('trigger-reset-header-filter'));
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition text-left cursor-pointer"
                                >
                                  <RotateCcw aria-hidden="true" className="w-4 h-4 shrink-0" />
                                  <span className="flex-1">ล้างตัวกรองทั้งหมด</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {activeTab === 'Inventory' && (
                          <div className="space-y-0.5">
                            {/* Mobile (< lg): + เพิ่มพัสดุใหม่ inside top of overflow menu */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsHeaderOverflowOpen(false);
                                setIsCreateInventoryOpen(true);
                                window.dispatchEvent(new CustomEvent('trigger-create-inventory'));
                              }}
                              className="lg:hidden w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-violet-700 hover:bg-violet-50 transition text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                              aria-label="เพิ่มพัสดุใหม่"
                            >
                              <Plus aria-hidden="true" className="w-4 h-4 text-violet-600 shrink-0" />
                              <span className="flex-1">เพิ่มพัสดุใหม่</span>
                            </button>

                            {!isInventorySubView && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsHeaderOverflowOpen(false);
                                  window.dispatchEvent(new CustomEvent('trigger-toggle-header-filter'));
                                }}
                                className="lg:hidden w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100/85 transition text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                              >
                                <SlidersHorizontal aria-hidden="true" className="w-4 h-4 text-slate-500 shrink-0" />
                                <span className="flex-1">ตัวกรองหมวดหมู่</span>
                                {headerFilterMeta.activeFilterCount > 0 && (
                                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-violet-600 text-white text-[11px] font-extrabold flex items-center justify-center tabular-nums">
                                    {headerFilterMeta.activeFilterCount}
                                  </span>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setIsHeaderOverflowOpen(false);
                                window.dispatchEvent(new CustomEvent('trigger-inventory-print'));
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100/85 transition text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                              aria-label="พิมพ์ฉลาก"
                            >
                              <Printer aria-hidden="true" className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="flex-1">พิมพ์สติกเกอร์ QR / Barcode</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsHeaderOverflowOpen(false);
                                window.dispatchEvent(new CustomEvent('trigger-inventory-history'));
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-100/85 transition text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                              aria-label={isInventorySubView ? 'กลับคลังสินค้า' : 'ประวัติคลังสินค้า'}
                            >
                              {isInventorySubView ? (
                                <ShoppingBag aria-hidden="true" className="w-4 h-4 text-violet-600 shrink-0" />
                              ) : (
                                <Clock aria-hidden="true" className="w-4 h-4 text-slate-500 shrink-0" />
                              )}
                              <span className="flex-1">
                                {isInventorySubView ? 'กลับกระเป๋าคลังสินค้า' : 'ประวัติคลังสินค้า'}
                              </span>
                            </button>

                            <hr className="my-1 border-slate-100" />

                            <button
                              type="button"
                              onClick={() => {
                                setIsHeaderOverflowOpen(false);
                                window.dispatchEvent(new CustomEvent('trigger-inventory-refresh'));
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100/85 transition text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                              aria-label="รีเฟรชข้อมูลคลัง"
                            >
                              <RefreshCw aria-hidden="true" className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="flex-1">รีเฟรชข้อมูลคลัง</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Full-width Mobile Search Overlay Portal Target */}
                <div id="app-header-mobile-search" className="contents" />
              </header>
              {/* Collapsible Page Filter Drawer Portal Target */}
              <div id="app-header-filter-drawer" className="relative z-20" />
            </div>
          );
        })()}

        <main
          id="main-scroll-container"
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
      {isLoggedIn && !trackingId && !quotationId && !resetToken && (
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
                  setIsMobileProfileMenuOpen(false);
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

            {/* Row 1: Primary Quick Navigation (5 Slots — strictly filtered by role permissions) */}
            {(() => {
              const preferredPrimary = ['Calendar', 'Plans', 'Finance'];
              const primarySlots = [];
              preferredPrimary.forEach((name) => {
                const found = allowedNavItems.find((i) => i.name === name);
                if (found && primarySlots.length < 3) primarySlots.push(found);
              });
              allowedNavItems.forEach((item) => {
                if (primarySlots.length < 3 && !primarySlots.some((p) => p.name === item.name)) {
                  primarySlots.push(item);
                }
              });
              const slotLeft1 = primarySlots[0] || null;
              const slotLeft2 = primarySlots[1] || null;
              const slotRight1 = primarySlots[2] || null;
              const primaryNames = new Set(primarySlots.map((p) => p.name));
              const drawerItems = allowedNavItems.filter((item) => !primaryNames.has(item.name));
              const shortLabelMap = {
                Calendar: 'ปฏิทิน',
                Plans: 'แผนงาน',
                Finance: 'การเงิน',
                Quotations: 'คำนวณราคา',
                Inventory: 'คลังพัสดุ',
                Locations: 'สถานที่',
                Artists: 'ศิลปิน',
                Customers: 'ลูกค้า',
                Staff: 'พนักงาน',
                Analytics: 'วิเคราะห์',
                Settings: 'ตั้งค่า'
              };
              const renderPrimarySlot = (item) => {
                if (!item) return <div />;
                const IconComp = item.icon;
                const isActive = activeTab === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      handleSelectTab(item.name);
                      if (isMobileNavExpanded) setIsMobileNavExpanded(false);
                    }}
                    className="relative flex flex-col items-center justify-center h-full w-full group cursor-pointer outline-none z-10 active:scale-95 transition-transform"
                    title={item.label}
                  >
                    <div className={`transition-all duration-200 flex flex-col items-center justify-center ${
                      isActive ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                      <IconComp
                        className={`transition-all duration-200 ${isMobileNavExpanded ? 'w-5.5 h-5.5' : 'w-7 h-7'}`}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      <span className={`text-xs leading-none transition-all duration-200 ${
                        isMobileNavExpanded ? 'opacity-100 max-h-4 mt-0.5' : 'opacity-0 max-h-0 pointer-events-none'
                      } ${isActive ? 'font-bold text-violet-600' : 'font-semibold text-slate-600'}`}>
                        {shortLabelMap[item.name] || item.label}
                      </span>
                      {isActive && (
                        <span className={`w-1.5 h-1.5 bg-violet-600 rounded-full transition-all duration-200 ${isMobileNavExpanded ? 'mt-0.5' : 'mt-1'}`} />
                      )}
                    </div>
                  </button>
                );
              };

              return (
                <>
                  <div className="relative grid grid-cols-5 h-13 items-center px-1">
                    {renderPrimarySlot(slotLeft1)}
                    {renderPrimarySlot(slotLeft2)}

                    {/* 3. Center Elevated Plus Button */}
                    <div className="relative flex justify-center items-center z-20 pointer-events-none">
                      {allowedTabSet.has('Plans') || allowedTabSet.has('Calendar') ? (
                        <button
                          onClick={() => openModal()}
                          className="w-11 h-11 theme-logo-bg rounded-full text-white shadow-lg flex items-center justify-center transform active:scale-95 transition-all border-2 border-white pointer-events-auto"
                          title="เพิ่มรายการใหม่"
                        >
                          <Plus className="w-6 h-6" strokeWidth={2.5} />
                        </button>
                      ) : (
                        <div className="w-11 h-11" />
                      )}
                    </div>

                    {renderPrimarySlot(slotRight1)}

                    {/* 5. Profile Popover Button (เหมือน PC Sidebar มุมซ้ายล่าง) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileProfileMenuOpen((prev) => !prev);
                        if (isMobileNavExpanded) setIsMobileNavExpanded(false);
                      }}
                      className="relative flex flex-col items-center justify-center h-full w-full group cursor-pointer outline-none z-10 active:scale-95 transition-transform"
                      title="โปรไฟล์และบัญชีผู้ใช้"
                      aria-label="เมนูโปรไฟล์ผู้ใช้"
                      aria-expanded={isMobileProfileMenuOpen}
                    >
                      <div className="transition-all duration-200 flex flex-col items-center justify-center">
                        <div
                          className={`rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold overflow-hidden transition-all duration-200 ${
                            isMobileNavExpanded ? 'w-6 h-6' : 'w-7 h-7'
                          } ${
                            isMobileProfileMenuOpen
                              ? 'ring-2 ring-violet-600 ring-offset-2'
                              : 'ring-2 ring-slate-200'
                          }`}
                        >
                          {userProfile?.image ? (
                            <img
                              src={processImageUrl(userProfile.image)}
                              alt="Profile"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : (
                            userProfile?.name?.charAt(0) || 'U'
                          )}
                          {userProfile?.image && (
                            <div className="hidden w-full h-full items-center justify-center bg-slate-900 text-white">
                              {userProfile?.name?.charAt(0) || 'U'}
                            </div>
                          )}
                        </div>
                        <span className={`text-xs leading-none transition-all duration-200 ${
                          isMobileNavExpanded ? 'opacity-100 max-h-4 mt-0.5' : 'opacity-0 max-h-0 pointer-events-none'
                        } ${isMobileProfileMenuOpen ? 'font-bold text-violet-600' : 'font-semibold text-slate-600'}`}>
                          โปรไฟล์
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Row 2: Secondary Navigation Section (strictly filtered by role permissions) */}
                  <div
                    ref={expandSectionRef}
                    className="overflow-hidden"
                    style={{
                      height: isMobileNavExpanded ? `${EXPAND_TARGET_H}px` : '0px',
                      opacity: isMobileNavExpanded ? 1 : 0,
                      pointerEvents: isMobileNavExpanded ? 'auto' : 'none'
                    }}
                  >
                    <div className="pt-2 pb-3 grid grid-cols-4 px-2 items-center gap-y-3.5 gap-x-2">
                      {drawerItems.map((item) => {
                        const IconComp = item.icon;
                        const isActive = activeTab === item.name;
                        return (
                          <button
                            key={item.name}
                            onClick={() => {
                              handleSelectTab(item.name);
                              setIsMobileNavExpanded(false);
                            }}
                            className="flex flex-col items-center justify-center py-1 group cursor-pointer outline-none active:scale-95 transition-transform"
                            title={item.label}
                          >
                            <IconComp className={`w-6 h-6 transition-colors ${isActive ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={isActive ? 2.5 : 2} />
                            <span className={`text-xs mt-1 leading-none ${isActive ? 'text-violet-600 font-bold' : 'text-slate-600 font-semibold'}`}>
                              {shortLabelMap[item.name] || item.label}
                            </span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 bg-violet-600 rounded-full mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </nav>

          {/* Mobile Profile Popover (เหมือน PC Sidebar Popover) */}
          {isMobileProfileMenuOpen && (
            <div className="md:hidden">
              <div
                className="fixed inset-0 z-[92] bg-slate-900/20 backdrop-blur-[1px]"
                onClick={() => setIsMobileProfileMenuOpen(false)}
              />
              <div className="fixed right-3 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] w-72 max-w-[calc(100vw-24px)] bg-white rounded-3xl shadow-2xl border border-slate-100 p-2.5 z-[95] animate-in fade-in zoom-in-95 origin-bottom-right flex flex-col gap-1.5">
                <div
                  onClick={() => {
                    setIsUserProfileModalOpen(true);
                    setIsMobileProfileMenuOpen(false);
                  }}
                  className="p-3 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-purple-50/50 rounded-2xl border border-indigo-100/70 hover:bg-indigo-50 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-lg overflow-hidden shrink-0 ring-2 ring-white shadow-md">
                      {userProfile?.image ? (
                        <img
                          src={processImageUrl(userProfile.image)}
                          alt="Profile"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        userProfile?.name?.charAt(0) || 'U'
                      )}
                      {userProfile?.image && (
                        <div className="hidden w-full h-full items-center justify-center bg-slate-900 text-white">
                          {userProfile?.name?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition">
                        {userProfile?.name || 'Guest User'}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100">
                          {userProfile?.id || userProfile?.staff_code || '2611001'}
                        </span>
                        <span className="text-xs text-slate-500 font-medium truncate">
                          @{userProfile?.username || 'user'}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white inline-block">
                          {userProfile?.role_label || (userProfile?.role === 'admin' ? 'ผู้ดูแลระบบ' : userProfile?.role || 'พนักงาน')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserProfileModalOpen(true);
                    setIsMobileProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-bold transition text-left cursor-pointer"
                >
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 font-bold">โปรไฟล์ของฉัน (My Profile)</div>
                    <div className="text-xs text-slate-500 font-normal truncate">แก้ไขข้อมูลส่วนตัวและรหัสผ่าน</div>
                  </div>
                </button>

                <div className="h-px bg-slate-100 my-0.5" />

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileProfileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 text-xs font-bold transition text-left cursor-pointer"
                >
                  <div className="p-2 bg-rose-100 text-rose-500 rounded-xl">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">ออกจากระบบ</div>
                  </div>
                </button>
              </div>
            </div>
          )}
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

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isUserProfileModalOpen}
        onClose={() => setIsUserProfileModalOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={(updated) => {
          setUserProfile(updated);
        }}
        showToast={showToast}
        handleProfileImageUpload={handleProfileImageUpload}
        isUploadingProfile={isUploadingProfile}
      />

      {/* Modern Add Item Modal - Expanded Version */}
      {addModalCloseConfirmDialog}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           {/* Backdrop */}
           <div
             className={`fixed inset-0 bg-slate-900/60 backdrop-blur-md ${isModalClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
           />
           
           {/* Modal Content - Responsive Layout with File Drag & Drop */}
           <div 
             onDragOver={handleModalDragOver}
             onDrop={handleModalDrop}
             className={`bg-white w-full max-w-5xl sm:rounded-[2.5rem] rounded-xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] ${isModalClosing ? 'modal-animate-out' : 'modal-animate-in'}`}
           >
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
                        {currentId && <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-lg font-bold border border-indigo-100 w-fit">{currentId}</span>}
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
                                images: uploadedImages,
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
                     onClick={requestCloseAddModal}
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
                               <span className="text-xs font-bold text-emerald-600">ใช้คำนวณรายได้ใน Dashboard</span>
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
                             <DbCombobox
                               options={artistList?.length ? artistList : savedArtists}
                               dbTable="artists"
                               placeholder="ค้นหาหรือพิมพ์ชื่อศิลปิน..."
                               value={artistName}
                               disabled={viewOnlyMode}
                               onChange={(val) => setArtistName(val)}
                               inputClassName="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors font-medium text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                             />
                           </div>
                           
                           {/* ส่วนลูกค้า */}
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">ลูกค้า</label>
                             <DbCombobox
                               options={savedCustomers}
                               dbTable="customers"
                               placeholder="ชื่อลูกค้า (พิมพ์ค้นหาจากฐานข้อมูล)"
                               value={customerName}
                               disabled={viewOnlyMode}
                               onChange={handleCustomerNameUpdate}
                               onSelectOption={(opt) => {
                                 if (opt?.raw) applyMatchedCustomerDetails(opt.raw);
                               }}
                               containerClassName="mb-3"
                               inputClassName="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors font-medium text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                                <StatusDropdown
                                  value={projectCategory}
                                  disabled={viewOnlyMode}
                                  options={projectCategories}
                                  showDot={false}
                                  placeholder="เลือกหมวดหมู่งาน..."
                                  ariaLabel="หมวดหมู่"
                                  onChange={(val) => setProjectCategory(val)}
                                  className="font-medium"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">สถานะ (ดีล)</label>
                                <StatusDropdown
                                  value={dealStatus}
                                  disabled={viewOnlyMode}
                                  options={dealStatuses}
                                  showDot={true}
                                  placeholder="เลือกสถานะดีล..."
                                  ariaLabel="สถานะ (ดีล)"
                                  onChange={(val) => setDealStatus(val)}
                                />
                              </div>
                           </div>

                           {/* [ADDED] สถานะการชำระเงิน (Payment Status) */}
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                             <div className="space-y-2">
                               <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-1.5">
                                 <Wallet className="w-4 h-4 text-indigo-600" />
                                 <span>สถานะการชำระเงิน</span>
                               </label>
                               <StatusDropdown
                                 value={paymentStatus}
                                 disabled={viewOnlyMode}
                                 options={paymentStatuses}
                                 showDot={true}
                                 placeholder="เลือกสถานะการชำระเงิน..."
                                 ariaLabel="สถานะการชำระเงิน"
                                 onChange={(val) => setPaymentStatus(val)}
                               />
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
                                    paymentStatus === 'unpaid' ? 'บันทึกเป็นยอดรอรับชำระเงิน (ค้างรับ)' :
                                    `สถานะปัจจุบัน: ${getPaymentStatusInfo(paymentStatus).label}`}
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
                           {(() => {
                             const matchedVenue = deliveryLocations.find(l => 
                               l.name && locationName && (
                                 l.name.toLowerCase() === locationName.trim().toLowerCase() ||
                                 (Array.isArray(l.aliases) && l.aliases.some(a => a.toLowerCase() === locationName.trim().toLowerCase()))
                               )
                             );
                             return (
                               <>
                                 <div className="space-y-2">
                                   <div className="flex items-center justify-between">
                                     <label className="text-sm font-bold text-slate-700 ml-1">สถานที่จัดส่ง (Venue)</label>
                                     {matchedVenue && (
                                       <button
                                         type="button"
                                         onClick={() => setSelectedVenueForModal(matchedVenue)}
                                         className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline cursor-pointer"
                                       >
                                         <Truck className="w-3.5 h-3.5 text-indigo-500" />
                                         <span>ดูลายแทง Loading Dock</span>
                                         <ExternalLink className="w-3 h-3" />
                                       </button>
                                     )}
                                   </div>
                                   <DbCombobox
                                     leftIcon={MapPin}
                                     options={deliveryLocations}
                                     dbTable="delivery_locations"
                                     placeholder="ค้นหาสถานที่จัดส่งจากฐานข้อมูล (เช่น CentralWorld, Impact Arena)"
                                     value={locationName}
                                     disabled={viewOnlyMode}
                                     onChange={(val) => {
                                       setLocationName(val);
                                       const found = deliveryLocations.find(
                                         (l) =>
                                           l.name?.toLowerCase() === String(val || '').trim().toLowerCase() ||
                                           (Array.isArray(l.aliases) &&
                                             l.aliases.some((a) => a.toLowerCase() === String(val || '').trim().toLowerCase()))
                                       );
                                       if (found && !mapLink && (found.loading_dock_map_link || found.default_map_link)) {
                                         setMapLink(found.loading_dock_map_link || found.default_map_link);
                                       }
                                     }}
                                     onSelectOption={(opt) => {
                                       const loc = opt?.raw;
                                       if (loc && (loc.loading_dock_map_link || loc.default_map_link)) {
                                         setMapLink(loc.loading_dock_map_link || loc.default_map_link);
                                       }
                                     }}
                                     inputClassName="w-full py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors font-medium text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                   />

                                   {/* Venue Intel Micro-Card */}
                                   {matchedVenue && (
                                     <div className="p-3 bg-gradient-to-r from-sky-50 via-indigo-50 to-slate-50 border border-indigo-100/80 rounded-2xl text-xs space-y-1.5 shadow-sm">
                                       <div className="flex items-center justify-between font-bold text-indigo-950">
                                         <span className="flex items-center gap-1.5">
                                           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                           {matchedVenue.zone ? `[โซน ${matchedVenue.zone}] ` : ''}{matchedVenue.name}
                                         </span>
                                         {matchedVenue.parking_height_limit && (
                                           <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold text-xs">
                                             จำกัดสูง {matchedVenue.parking_height_limit}
                                           </span>
                                         )}
                                       </div>
                                       {matchedVenue.gate_info && (
                                         <p className="text-slate-600 font-medium">
                                           <span className="font-bold text-slate-700">จุดส่ง:</span> {matchedVenue.gate_info}
                                         </p>
                                       )}
                                       {matchedVenue.delivery_tips && (
                                         <p className="text-slate-500 line-clamp-1 italic text-xs">
                                           💡 {matchedVenue.delivery_tips}
                                         </p>
                                       )}
                                     </div>
                                   )}
                                 </div>

                                 <div className="space-y-2">
                                   <div className="flex items-center justify-between">
                                     <label className="text-sm font-bold text-slate-700 ml-1">Google Maps Link</label>
                                     {matchedVenue?.loading_dock_map_link && !viewOnlyMode && (
                                       <button
                                         type="button"
                                         onClick={() => setMapLink(matchedVenue.loading_dock_map_link)}
                                         className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
                                       >
                                         <span>ใช้พิกัด Loading Dock</span>
                                       </button>
                                     )}
                                   </div>
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
                               </>
                             );
                           })()}
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">ผู้รับ</label>
                                <DbCombobox
                                  options={savedRecipients.map((r) => ({
                                    id: r.name,
                                    value: r.name,
                                    label: r.name,
                                    sublabel: r.phone || '',
                                    raw: r
                                  }))}
                                  dbTable="staff"
                                  placeholder="ชื่อผู้รับ (พิมพ์ค้นหา)"
                                  value={recipientName}
                                  disabled={viewOnlyMode}
                                  onChange={handleRecipientNameUpdate}
                                  onSelectOption={(opt) => {
                                    if (opt?.raw?.phone) {
                                      setRecipientPhone(formatPhoneNumber(opt.raw.phone));
                                    }
                                  }}
                                  inputClassName="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                              <StatusDropdown
                                value={transportStatus}
                                disabled={viewOnlyMode}
                                options={transportStatuses}
                                showDot={true}
                                placeholder="เลือกสถานะขนส่ง..."
                                ariaLabel="สถานะงาน (ขนส่ง)"
                                onChange={(val) => setTransportStatus(val)}
                              />
                           </div>

                          {/* Reference Images Upload Area */}
                          <div className="space-y-2.5 pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                                  <ImageIcon className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-bold text-slate-800">รูปภาพอ้างอิง</span>
                                {uploadedImages.length > 0 && (
                                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                    {uploadedImages.length} รูป
                                  </span>
                                )}
                              </div>
                              {!viewOnlyMode && (
                                <button
                                  type="button"
                                  onClick={() => document.getElementById('image-multi-upload').click()}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  เพิ่มรูปภาพ
                                </button>
                              )}
                            </div>

                            <input
                              type="file"
                              id="image-multi-upload"
                              className="hidden"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleReferenceImageUpload(e.target.files);
                                  e.target.value = '';
                                }
                              }}
                            />

                            {/* Reference Images Preview Grid or Upload Prompt */}
                            {uploadedImages.length > 0 ? (
                              <div 
                                className={`rounded-2xl transition-all duration-200 p-2.5 border-2 ${
                                  isDraggingRef
                                    ? 'border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/15'
                                    : 'border-slate-200/80 bg-slate-50/40'
                                }`}
                                onDragEnter={handleRefDragEnter}
                                onDragLeave={handleRefDragLeave}
                                onDragOver={handleRefDragOver}
                                onDrop={handleRefDrop}
                              >
                                {isDraggingRef && (
                                  <div className="mb-2.5 flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all animate-in fade-in duration-150">
                                    <UploadCloud className="w-4 h-4 animate-bounce" />
                                    <span>ปล่อยเมาส์เพื่อเพิ่มรูปภาพต่อท้าย ({uploadedImages.length} รูปเดิมจะคงอยู่)</span>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                  {uploadedImages.map((img, idx) => {
                                    const imgSrc = typeof img === 'object' ? (img.localPreview || img.url) : img;
                                    const imgKey = typeof img === 'object' ? (img.id || idx) : idx;
                                    const isImgUploading = typeof img === 'object' && Boolean(img.isUploading);
                                    return (
                                      <div
                                        key={imgKey}
                                        className="relative group rounded-xl overflow-hidden border border-slate-200/90 bg-slate-100 aspect-[3/4] cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
                                        onClick={() => setPreviewImage({
                                          images: uploadedImages,
                                          initialIndex: idx,
                                          title: 'รูปภาพอ้างอิง'
                                        })}
                                      >
                                        <img
                                          src={processImageUrl(imgSrc)}
                                          alt={`รูปอ้างอิง ${idx + 1}`}
                                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = "https://placehold.co/300x400?text=Image+Error";
                                          }}
                                        />
                                        {isImgUploading && (
                                          <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-indigo-600/90 backdrop-blur-sm rounded-md text-[11px] text-white font-semibold flex items-center gap-1 shadow-sm z-10 pointer-events-none">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>กำลังอัปโหลด</span>
                                          </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                                          <div className="p-2 bg-white/25 backdrop-blur-md rounded-full text-white shadow-sm">
                                            <Maximize2 className="w-4 h-4" />
                                          </div>
                                        </div>
                                        {!viewOnlyMode && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveReferenceImage(imgKey);
                                            }}
                                            className="absolute top-1.5 right-1.5 p-1.5 bg-white/95 backdrop-blur-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shadow-sm z-10 cursor-pointer"
                                            title="ลบรูปภาพ"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-xs text-white font-medium flex items-center gap-1 shadow-sm">
                                          <span>รูปที่ {idx + 1}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {!viewOnlyMode && (
                                    isDraggingRef ? (
                                      <div className="border-2 border-dashed border-indigo-500 bg-indigo-100/70 text-indigo-700 ring-2 ring-indigo-400/20 rounded-xl flex flex-col items-center justify-center aspect-[3/4] transition-all animate-pulse shadow-sm p-2 text-center pointer-events-none">
                                        <UploadCloud className="w-6 h-6 mb-1 text-indigo-600 animate-bounce" />
                                        <span className="text-xs font-bold text-indigo-800">วางไฟล์ที่นี่</span>
                                        <span className="text-xs text-indigo-600 mt-0.5">เพิ่มต่อท้าย</span>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => document.getElementById('image-multi-upload').click()}
                                        className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl flex flex-col items-center justify-center aspect-[3/4] text-slate-400 hover:text-indigo-600 transition-all duration-150 group shadow-2xs cursor-pointer"
                                      >
                                        <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors mb-1.5">
                                          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        </div>
                                        <span className="text-xs font-bold">เพิ่มอีก</span>
                                        <span className="text-xs text-slate-400 group-hover:text-indigo-500">หรือลากไฟล์มา</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            ) : (
                              !viewOnlyMode ? (
                                <div
                                  className={`w-full border-2 border-dashed rounded-2xl p-6 sm:p-7 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer group ${
                                    isDraggingRef
                                      ? 'border-indigo-500 bg-indigo-50/70 ring-4 ring-indigo-500/15 shadow-sm scale-[0.995]'
                                      : 'border-slate-300/80 bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-400 shadow-2xs'
                                  }`}
                                  onClick={() => document.getElementById('image-multi-upload').click()}
                                  onDragEnter={handleRefDragEnter}
                                  onDragLeave={handleRefDragLeave}
                                  onDragOver={handleRefDragOver}
                                  onDrop={handleRefDrop}
                                >
                                  <div className="flex flex-col items-center pointer-events-none select-none">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 transition-all duration-200 ${
                                      isDraggingRef
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-110'
                                        : 'bg-white border border-slate-200/90 text-indigo-600 group-hover:scale-105 group-hover:border-indigo-300 group-hover:bg-indigo-50/50 shadow-2xs'
                                    }`}>
                                      {isDraggingRef ? (
                                        <UploadCloud className="w-6 h-6 animate-bounce" />
                                      ) : (
                                        <ImageIcon className="w-6 h-6" />
                                      )}
                                    </div>
                                    <p className={`text-sm font-bold transition-colors duration-150 ${
                                      isDraggingRef ? 'text-indigo-800 font-extrabold' : 'text-slate-700 group-hover:text-indigo-600'
                                    }`}>
                                      {isDraggingRef ? 'ปล่อยเมาส์เพื่อวางรูปภาพอ้างอิงทันที' : 'คลิกเพื่อเลือกรูปภาพ หรือลากไฟล์มาวางที่นี่'}
                                    </p>
                                    <p className={`text-xs mt-1 transition-colors duration-150 ${
                                      isDraggingRef ? 'text-indigo-600 font-semibold' : 'text-slate-400'
                                    }`}>
                                      {isDraggingRef ? 'พร้อมอัพโหลดเข้าสู่รายการ' : 'รองรับ JPG, PNG, WEBP (เลือกได้หลายรูป)'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full px-4 py-6 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic text-sm flex flex-col items-center gap-1.5">
                                  <ImageIcon className="w-6 h-6 opacity-40" />
                                  <span>ไม่มีรูปภาพอ้างอิง</span>
                                </div>
                              )
                            )}
                          </div>

                          {/* Payment Slips Upload Area */}
                          <div className="space-y-2.5 pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs">
                                  <Receipt className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-bold text-slate-800">สลิปโอนเงิน (หลักฐานชำระเงิน)</span>
                                {uploadedSlips.length > 0 && (
                                  <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                    {uploadedSlips.length} รูป
                                  </span>
                                )}
                              </div>
                              {!viewOnlyMode && (
                                <button
                                  type="button"
                                  onClick={() => document.getElementById('slip-multi-upload').click()}
                                  className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
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
                              <div 
                                className={`rounded-2xl transition-all duration-200 p-2.5 border-2 ${
                                  isDraggingSlip
                                    ? 'border-amber-500 bg-amber-50/40 ring-4 ring-amber-500/15'
                                    : 'border-slate-200/80 bg-slate-50/40'
                                }`}
                                onDragEnter={handleSlipDragEnter}
                                onDragLeave={handleSlipDragLeave}
                                onDragOver={handleSlipDragOver}
                                onDrop={handleSlipDrop}
                              >
                                {isDraggingSlip && (
                                  <div className="mb-2.5 flex items-center justify-center gap-2 py-2 px-3 bg-amber-600 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all animate-in fade-in duration-150">
                                    <UploadCloud className="w-4 h-4 animate-bounce" />
                                    <span>ปล่อยเมาส์เพื่อเพิ่มสลิปโอนเงิน ({uploadedSlips.length} รูปเดิมจะคงอยู่)</span>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                  {uploadedSlips.map((slip, idx) => {
                                    const slipSrc = typeof slip === 'object' ? slip.url : slip;
                                    const slipKey = typeof slip === 'object' ? (slip.id || idx) : idx;
                                    return (
                                      <div
                                        key={slipKey}
                                        className="relative group rounded-xl overflow-hidden border border-slate-200/90 bg-slate-100 aspect-[3/4] cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
                                        onClick={() => setPreviewImage({
                                          images: uploadedSlips,
                                          initialIndex: idx,
                                          title: 'สลิปโอนเงิน (หลักฐานชำระเงิน)'
                                        })}
                                      >
                                        <img
                                          src={processImageUrl(slipSrc)}
                                          alt={`สลิป ${idx + 1}`}
                                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = "https://placehold.co/300x400?text=Slip+Error";
                                          }}
                                        />
                                        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                                          <div className="p-2 bg-white/25 backdrop-blur-md rounded-full text-white shadow-sm">
                                            <Maximize2 className="w-4 h-4" />
                                          </div>
                                        </div>
                                        {!viewOnlyMode && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveSlip(slipKey);
                                            }}
                                            className="absolute top-1.5 right-1.5 p-1.5 bg-white/95 backdrop-blur-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shadow-sm z-10 cursor-pointer"
                                            title="ลบสลิป"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-xs text-white font-medium flex items-center gap-1 shadow-sm">
                                          <span>ใบที่ {idx + 1}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {!viewOnlyMode && (
                                    isDraggingSlip ? (
                                      <div className="border-2 border-dashed border-amber-500 bg-amber-100/70 text-amber-700 ring-2 ring-amber-400/20 rounded-xl flex flex-col items-center justify-center aspect-[3/4] transition-all animate-pulse shadow-sm p-2 text-center pointer-events-none">
                                        <UploadCloud className="w-6 h-6 mb-1 text-amber-600 animate-bounce" />
                                        <span className="text-xs font-bold text-amber-800">วางไฟล์ที่นี่</span>
                                        <span className="text-xs text-amber-600 mt-0.5">เพิ่มต่อท้าย</span>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => document.getElementById('slip-multi-upload').click()}
                                        className="border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/30 rounded-xl flex flex-col items-center justify-center aspect-[3/4] text-slate-400 hover:text-amber-600 transition-all duration-150 group shadow-2xs cursor-pointer"
                                      >
                                        <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center text-slate-500 group-hover:text-amber-600 transition-colors mb-1.5">
                                          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        </div>
                                        <span className="text-xs font-bold">เพิ่มอีก</span>
                                        <span className="text-xs text-slate-400 group-hover:text-amber-500">หรือลากไฟล์มา</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            ) : (
                              !viewOnlyMode ? (
                                <div
                                  className={`w-full border-2 border-dashed rounded-2xl p-6 sm:p-7 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer group ${
                                    isDraggingSlip
                                      ? 'border-amber-500 bg-amber-50/70 ring-4 ring-amber-500/15 shadow-sm scale-[0.995]'
                                      : 'border-slate-300/80 bg-slate-50/50 hover:bg-amber-50/30 hover:border-amber-400 shadow-2xs'
                                  }`}
                                  onClick={() => document.getElementById('slip-multi-upload').click()}
                                  onDragEnter={handleSlipDragEnter}
                                  onDragLeave={handleSlipDragLeave}
                                  onDragOver={handleSlipDragOver}
                                  onDrop={handleSlipDrop}
                                >
                                  <div className="flex flex-col items-center pointer-events-none select-none">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 transition-all duration-200 ${
                                      isDraggingSlip
                                        ? 'bg-amber-600 text-white shadow-md shadow-amber-200 scale-110'
                                        : 'bg-white border border-slate-200/90 text-amber-600 group-hover:scale-105 group-hover:border-amber-300 group-hover:bg-amber-50/50 shadow-2xs'
                                    }`}>
                                      {isDraggingSlip ? (
                                        <UploadCloud className="w-6 h-6 animate-bounce" />
                                      ) : (
                                        <Receipt className="w-6 h-6" />
                                      )}
                                    </div>
                                    <p className={`text-sm font-bold transition-colors duration-150 ${
                                      isDraggingSlip ? 'text-amber-800 font-extrabold' : 'text-slate-700 group-hover:text-amber-600'
                                    }`}>
                                      {isDraggingSlip ? 'ปล่อยเมาส์เพื่อวางสลิปโอนเงินทันที' : 'คลิกเพื่อเลือกสลิป หรือลากไฟล์มาวางที่นี่'}
                                    </p>
                                    <p className={`text-xs mt-1 transition-colors duration-150 ${
                                      isDraggingSlip ? 'text-amber-600 font-semibold' : 'text-slate-400'
                                    }`}>
                                      {isDraggingSlip ? 'พร้อมอัพโหลดหลักฐานชำระเงิน' : 'รองรับ JPG, PNG, WEBP (เลือกได้หลายรูป)'}
                                    </p>
                                  </div>
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
                         <h5 className="font-bold text-slate-800 text-base flex items-center gap-2">
                            <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shadow-xs">1</span>
                            เงินสนับสนุนศิลปิน (Money Order)
                         </h5>
                         <p className="text-sm text-slate-500 -mt-1 ml-7 font-medium">ยอดเงินสนับสนุนส่งต่อศิลปินโดยตรง (ไม่นำมาคิดเป็นกำไรของร้าน)</p>
                         <div className="bg-slate-50/80 rounded-2xl border border-indigo-200/80 p-4 shadow-2xs">
                              <div className="space-y-3">
                                  {/* Header Row on Desktop */}
                                  <div className="hidden sm:grid sm:grid-cols-[142px_172px_88px_124px_minmax(0,1fr)_36px] gap-2.5 px-1 text-sm font-bold text-slate-700 tracking-wide">
                                      <div className="text-left">วันที่รับเงิน</div>
                                      <div>ประเภทแบงค์</div>
                                      <div className="text-center">จำนวน</div>
                                      <div className="text-right">รวมเป็นเงิน</div>
                                      <div className="pl-1">รายละเอียด</div>
                                      <div></div>
                                  </div>

                                  {/* Dynamic Rows */}
                                  {customerSupportItems.map((item, idx) => (
                                      <div 
                                          key={idx} 
                                          className="rounded-2xl sm:rounded-none border border-indigo-200 sm:border-none overflow-visible bg-white sm:bg-transparent shadow-xs sm:shadow-none animate-in fade-in slide-in-from-left-2 duration-300"
                                      >
                                          {/* Mobile Card Header */}
                                          <div className="sm:hidden rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-3.5 py-2.5 flex items-center justify-between text-white shadow-2xs">
                                              <span className="font-black text-sm flex items-center gap-1.5 tracking-wide text-white">
                                                  <Wallet className="w-4 h-4 text-white/90" />
                                                  รายการที่ {idx + 1}
                                              </span>
                                              {!viewOnlyMode && (
                                                  <button
                                                      type="button"
                                                      onClick={() => handleRemoveSupportItem(idx)}
                                                      className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-90"
                                                      title={`ลบรายการที่ ${idx + 1}`}
                                                  >
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              )}
                                          </div>

                                          {/* Card Content / Desktop Row */}
                                          <div className="p-3.5 sm:p-0 grid grid-cols-1 sm:grid-cols-[142px_172px_88px_124px_minmax(0,1fr)_36px] gap-2.5 items-center bg-white sm:bg-transparent">
                                          {/* 1. วันที่รับเงิน */}
                                          <div>
                                              <span className="sm:hidden text-sm font-bold text-slate-700 mb-1.5 block text-left">วันที่รับเงิน</span>
                                              <ModernDateTimePicker
                                                  value={item.date ? item.date.slice(0, 10) : ''}
                                                  disabled={viewOnlyMode}
                                                  hasTime={false}
                                                  compact={false}
                                                  placeholder="เลือกวันที่..."
                                                  onChange={(e) => handleSupportItemChange(idx, 'date', e.target.value)}
                                                  className={`!px-3 !py-3 h-[46px] border-indigo-200 bg-white text-slate-800 font-medium ${viewOnlyMode ? 'opacity-80 cursor-not-allowed' : ''}`}
                                              />
                                          </div>

                                          {/* 2. ประเภทแบงค์ */}
                                          <div className="relative">
                                              <span className="sm:hidden text-sm font-bold text-slate-700 mb-1.5 block text-left">ประเภทแบงค์</span>
                                              <StatusDropdown
                                                  value={item.denomination}
                                                  disabled={viewOnlyMode}
                                                  options={BANKNOTE_DENOMINATION_OPTIONS}
                                                  showDot={true}
                                                  placeholder="เลือกแบงค์..."
                                                  ariaLabel="ประเภทแบงค์"
                                                  onChange={(val) => handleSupportItemChange(idx, 'denomination', val)}
                                                  className="!px-3 !py-3 !rounded-xl !text-base h-[46px]"
                                              />
                                          </div>
                                          
                                          {/* 3. จำนวน */}
                                          <div>
                                              <span className="sm:hidden text-sm font-bold text-slate-700 mb-1.5 block text-left">จำนวน</span>
                                              <input
                                                  type="number"
                                                  placeholder="จำนวน"
                                                  value={item.quantity === 0 ? '' : item.quantity} 
                                                  disabled={viewOnlyMode}
                                                  onChange={(e) => handleSupportItemChange(idx, 'quantity', e.target.value)}
                                                  className={`w-full h-[46px] px-2 py-3 bg-white border border-indigo-200 rounded-xl text-base text-center font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${viewOnlyMode ? 'bg-slate-50 opacity-80 cursor-not-allowed' : ''}`}
                                              />
                                          </div>

                                          {/* 4. รวมเป็นเงิน */}
                                          <div>
                                              <span className="sm:hidden text-sm font-bold text-slate-700 mb-1.5 block text-left">รวมเป็นเงิน (บาท)</span>
                                              <input
                                                  type="number"
                                                  placeholder="0.00"
                                                  value={item.price === 0 ? '' : item.price} 
                                                  disabled={viewOnlyMode}
                                                  onChange={(e) => handleSupportItemChange(idx, 'price', e.target.value)}
                                                  className={`w-full h-[46px] px-3 py-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-base font-black text-indigo-900 text-center sm:text-right focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${viewOnlyMode ? 'opacity-80 cursor-not-allowed' : ''}`}
                                              />
                                          </div>

                                          {/* 5. รายละเอียด */}
                                          <div>
                                              <span className="sm:hidden text-sm font-bold text-slate-700 mb-1.5 block text-left">รายละเอียด</span>
                                              <input
                                                  type="text"
                                                  placeholder="รายละเอียด (ถ้ามี)"
                                                  value={item.detail || ''}
                                                  disabled={viewOnlyMode}
                                                  onChange={(e) => handleSupportItemChange(idx, 'detail', e.target.value)}
                                                  className={`w-full h-[46px] px-3 py-3 bg-white border border-indigo-200 rounded-xl text-base text-left text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${viewOnlyMode ? 'bg-slate-50 opacity-80 cursor-not-allowed' : ''}`}
                                              />
                                          </div>

                                          {/* 6. ปุ่มลบ (Desktop Only) */}
                                          <div className="hidden sm:flex justify-center">
                                              {!viewOnlyMode && (
                                                  <button
                                                      type="button"
                                                      onClick={() => handleRemoveSupportItem(idx)}
                                                      className="p-1.5 text-indigo-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                      title={`ลบรายการที่ ${idx + 1}`}
                                                  >
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                                  ))}
                              </div>

                              {/* Footer Action Bar */}
                              <div className="flex flex-wrap justify-between items-center gap-2 mt-4 pt-3 border-t border-indigo-100/80">
                                  <div className="flex flex-wrap items-center gap-3">
                                    {!viewOnlyMode && (
                                      <button
                                          type="button"
                                          onClick={handleAddSupportItem}
                                          className="flex items-center gap-2 text-sm font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 px-3.5 py-2 rounded-xl border border-indigo-200 transition shadow-2xs cursor-pointer w-fit"
                                      >
                                          <Plus className="w-4 h-4 text-indigo-600" />
                                          เพิ่มรายการเงิน
                                      </button>
                                    )}
                                    {!viewOnlyMode && (
                                      <label className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-800 bg-white/80 px-3 py-2 rounded-xl border border-indigo-200 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={syncSupportToCashVault}
                                          onChange={(e) => setSyncSupportToCashVault(e.target.checked)}
                                          className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <Banknote className="w-4 h-4 text-indigo-600" />
                                        <span>เติม+จองธนบัตรเข้าคลังอัตโนมัติตอนบันทึก</span>
                                      </label>
                                    )}
                                  </div>
                                  <div className="text-base font-black text-indigo-900 bg-white px-4 py-2 rounded-xl border border-indigo-200 shadow-2xs font-mono">
                                      รวม: ฿{customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString()}
                                  </div>
                              </div>
                         </div>
                     </div>

                     {/* 3.2: Quotation Items (Replaces Service + Delivery) */}
                     <div className="space-y-3 pt-4 border-t border-slate-100">
                         <h5 className="font-bold text-emerald-700 text-base flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            รายการเสนอราคา (Quotation)
                         </h5>
                         <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-4">
                             <div className="space-y-3">
                                {/* Header Row */}
                                <div className="hidden sm:grid sm:grid-cols-[142px_minmax(175px,1.25fr)_minmax(0,1.4fr)_72px_118px_36px] gap-2 px-1 text-sm font-bold text-emerald-800/80 tracking-wide">
                                   <div className="text-left">วันที่ทำบิล/รับเงิน</div>
                                   <div>หมวดหมู่</div>
                                   <div>รายละเอียดรายการ</div>
                                   <div className="text-center">จำนวน</div>
                                   <div className="text-right">ราคา/หน่วย</div>
                                   <div></div>
                                </div>

                                {/* Dynamic Rows */}
                                {quotationItems.map((item, idx) => (
                                   <div 
                                       key={idx} 
                                       className="rounded-2xl sm:rounded-none border border-emerald-200 sm:border-none overflow-visible bg-white sm:bg-transparent shadow-xs sm:shadow-none animate-in fade-in slide-in-from-left-2 duration-300"
                                   >
                                       {/* Mobile Card Header */}
                                       <div className="sm:hidden rounded-t-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-3.5 py-2.5 flex items-center justify-between text-white shadow-2xs">
                                           <span className="font-black text-sm flex items-center gap-1.5 tracking-wide">
                                               <FileText className="w-4 h-4 text-white/90" />
                                               รายการที่ {idx + 1}
                                           </span>
                                           {!viewOnlyMode && (
                                               <button
                                                   type="button"
                                                   onClick={() => handleRemoveQuotationItem(idx)}
                                                   className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-90"
                                                   title={`ลบรายการที่ ${idx + 1}`}
                                               >
                                                   <Trash2 className="w-4 h-4" />
                                               </button>
                                           )}
                                       </div>

                                       {/* Card Content / Desktop Row */}
                                       <div className="p-3 sm:p-0 grid grid-cols-1 sm:grid-cols-[142px_minmax(175px,1.25fr)_minmax(0,1.4fr)_72px_118px_36px] gap-2 items-center">
                                       <div>
                                          <span className="sm:hidden text-sm font-bold text-emerald-600 mb-1.5 block">วันที่ทำบิล/รับเงิน</span>
                                          <ModernDateTimePicker
                                            value={item.date ? item.date.slice(0, 10) : ''}
                                            hasTime={false}
                                            compact={false}
                                            placeholder="เลือกวันที่..."
                                            onChange={(e) => handleQuotationItemChange(idx, 'date', e.target.value)}
                                            className="!px-3 !py-3 h-[46px] border-emerald-200"
                                          />
                                       </div>
                                       <div>
                                          <span className="sm:hidden text-sm font-bold text-emerald-600 mb-1.5 block">หมวดหมู่</span>
                                          <DbCombobox
                                            options={projectCategories}
                                            placeholder="ระบุหมวดหมู่..."
                                            value={item.category}
                                            onChange={(val) => handleQuotationItemChange(idx, 'category', val)}
                                            inputClassName="w-full h-[46px] px-3 py-3 bg-white border border-emerald-200 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                                          />
                                       </div>
                                       <div>
                                          <span className="sm:hidden text-sm font-bold text-emerald-600 mb-1.5 block">รายละเอียด</span>
                                          <input
                                            type="text"
                                            placeholder="รายละเอียดเพิ่มเติม..."
                                            value={item.detail}
                                            onChange={(e) => handleQuotationItemChange(idx, 'detail', e.target.value)}
                                            className="w-full h-[46px] px-3 py-3 bg-white border border-emerald-200 rounded-xl text-base focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
                                          />
                                       </div>
                                       <div>
                                          <span className="sm:hidden text-sm font-bold text-emerald-600 mb-1.5 block">จำนวน</span>
                                          <input
                                            type="number"
                                            placeholder="1"
                                            value={item.quantity}
                                            onChange={(e) => handleQuotationItemChange(idx, 'quantity', e.target.value)}
                                            className="w-full h-[46px] px-2 py-3 bg-white border border-emerald-200 rounded-xl text-base font-bold text-center text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                          />
                                       </div>
                                       <div>
                                          <span className="sm:hidden text-sm font-bold text-emerald-600 mb-1.5 block">ราคา/หน่วย</span>
                                          <input
                                            type="number"
                                            placeholder="0.00"
                                            value={item.unitPrice !== undefined ? item.unitPrice : item.price}
                                            onChange={(e) => handleQuotationItemChange(idx, 'unitPrice', e.target.value)}
                                            className="w-full h-[46px] px-3 py-3 bg-white border border-emerald-200 rounded-xl text-base font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-right"
                                          />
                                       </div>
                                       {/* 6. ปุ่มลบ (Desktop Only) */}
                                       <div className="hidden sm:flex justify-center">
                                          {!viewOnlyMode && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveQuotationItem(idx)}
                                                className="p-1.5 text-emerald-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                title={`ลบรายการที่ ${idx + 1}`}
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                          )}
                                       </div>
                                   </div>
                               </div>
                            ))}
                              </div>

                              <div className="flex justify-between items-center mt-4">
                                  <button
                                    onClick={handleAddQuotationItem}
                                    className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-xl transition w-fit cursor-pointer"
                                  >
                                    <Plus className="w-4 h-4" />
                                    เพิ่มรายการเสนอราคา
                                  </button>
                                  <div className="text-base font-black text-emerald-800 bg-white px-4 py-2 rounded-xl border border-emerald-200 shadow-2xs font-mono">
                                      รวม: ฿{quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString()}
                                  </div>
                              </div>
                         </div>
                     </div>

                     {/* 3.3: Expenses (Moved to Row 3) */}
                     <div className="space-y-3 pt-4 border-t border-slate-100">
                         <h5 className="font-bold text-rose-700 text-base flex items-center gap-2">
                            <TrendingDown className="w-5 h-5" />
                            รายจ่ายจริง / ต้นทุนเพิ่ม (Expenses)
                         </h5>
                         <p className="text-sm text-slate-400 -mt-1 ml-7">รายการนี้ไม่แสดงให้ลูกค้าเห็น (ใช้สำหรับคำนวณกำไรภายใน)</p>
                         <div className="bg-rose-50/50 rounded-2xl border border-rose-100 p-4">
                             <div className="space-y-3">
                                {/* Header Row */}
                                <div className="hidden sm:grid sm:grid-cols-[142px_minmax(175px,1.25fr)_minmax(0,1.4fr)_72px_118px_36px] gap-2 px-1 text-sm font-bold text-rose-800/80 tracking-wide">
                                   <div className="text-left">วันที่จ่ายเงิน</div>
                                   <div>หมวดหมู่</div>
                                   <div>รายละเอียด</div>
                                   <div className="text-center">จำนวน</div>
                                   <div className="text-right">ราคา/หน่วย</div>
                                   <div></div>
                                </div>

                                {expenses.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        className="rounded-2xl sm:rounded-none border border-rose-200 sm:border-none overflow-visible bg-white sm:bg-transparent shadow-xs sm:shadow-none animate-in fade-in slide-in-from-left-2 duration-300"
                                    >
                                        {/* Mobile Card Header */}
                                        <div className="sm:hidden rounded-t-2xl bg-gradient-to-r from-rose-500 to-rose-600 px-3.5 py-2.5 flex items-center justify-between text-white shadow-2xs">
                                            <span className="font-black text-sm flex items-center gap-1.5 tracking-wide">
                                                <TrendingDown className="w-4 h-4 text-white/90" />
                                                รายการที่ {idx + 1}
                                            </span>
                                            {!viewOnlyMode && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveExpense(idx)}
                                                    className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-90"
                                                    title={`ลบรายการที่ ${idx + 1}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Card Content / Desktop Row */}
                                        <div className="p-3 sm:p-0 grid grid-cols-1 sm:grid-cols-[142px_minmax(175px,1.25fr)_minmax(0,1.4fr)_72px_118px_36px] gap-2 items-center">
                                            <div>
                                               <span className="sm:hidden text-sm font-bold text-rose-500 mb-1.5 block">วันที่จ่ายเงิน</span>
                                               <ModernDateTimePicker
                                                 value={item.date ? item.date.slice(0, 10) : ''}
                                                 hasTime={false}
                                                 compact={false}
                                                 placeholder="เลือกวันที่..."
                                                 onChange={(e) => handleExpenseChange(idx, 'date', e.target.value)}
                                                 className="!px-3 !py-3 h-[46px] border-rose-200"
                                               />
                                            </div>
                                            <div>
                                               <span className="sm:hidden text-sm font-bold text-rose-500 mb-1.5 block">หมวดหมู่</span>
                                               <DbCombobox
                                                 options={expenseCategories}
                                                 placeholder="หมวดหมู่..."
                                                 value={item.category}
                                                 onChange={(val) => handleExpenseChange(idx, 'category', val)}
                                                 inputClassName="w-full h-[46px] px-3 py-3 bg-white border border-rose-200 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
                                               />
                                            </div>
                                            <div>
                                               <span className="sm:hidden text-sm font-bold text-rose-500 mb-1.5 block">รายละเอียด</span>
                                               <DbCombobox
                                                 options={inventoryItems}
                                                 dbTable="inventory_items"
                                                 placeholder="รายละเอียด (เช่น โฟม, ดอกไม้)..."
                                                 value={item.detail}
                                                 onChange={(val) => handleExpenseChange(idx, 'detail', val)}
                                                 inputClassName="w-full h-[46px] px-3 py-3 bg-white border border-rose-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
                                               />
                                            </div>
                                            <div>
                                               <span className="sm:hidden text-sm font-bold text-rose-500 mb-1.5 block">จำนวน</span>
                                               <input
                                                 type="number"
                                                 placeholder="1"
                                                 value={item.quantity}
                                                 onChange={(e) => handleExpenseChange(idx, 'quantity', e.target.value)}
                                                 className="w-full h-[46px] px-2 py-3 bg-white border border-rose-200 rounded-xl text-base font-bold text-center text-slate-700 focus:ring-2 focus:ring-rose-500/20"
                                               />
                                            </div>
                                            <div>
                                               <span className="sm:hidden text-sm font-bold text-rose-500 mb-1.5 block">ราคา/หน่วย</span>
                                               <input
                                                 type="number"
                                                 placeholder="0.00"
                                                 value={item.unitPrice !== undefined ? item.unitPrice : item.price}
                                                 onChange={(e) => handleExpenseChange(idx, 'unitPrice', e.target.value)}
                                                 className="w-full h-[46px] px-3 py-3 bg-white border border-rose-200 rounded-xl text-base font-semibold text-rose-800 focus:ring-2 focus:ring-rose-500/20 text-right"
                                               />
                                            </div>
                                            <div className="hidden sm:flex justify-center">
                                               {!viewOnlyMode && (
                                                   <button
                                                     type="button"
                                                     onClick={() => handleRemoveExpense(idx)}
                                                     className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                     title={`ลบรายการที่ ${idx + 1}`}
                                                   >
                                                     <Trash2 className="w-4 h-4" />
                                                   </button>
                                               )}
                                            </div>
                                        </div>
                                    </div>
                                 ))}
                              </div>

                              <div className="flex flex-wrap justify-between items-center gap-2 mt-4">
                                  <div className="flex flex-wrap items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={handleAddExpense}
                                        className="flex items-center gap-2 text-sm font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3.5 py-2 rounded-xl transition w-fit cursor-pointer"
                                      >
                                        <Plus className="w-4 h-4" />
                                        เพิ่มรายการจ่าย
                                      </button>
                                    {!viewOnlyMode && (
                                      <label className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-800 bg-white px-3 py-2 rounded-xl border border-rose-200 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={syncExpensesToWarehouse}
                                          onChange={(e) => setSyncExpensesToWarehouse(e.target.checked)}
                                          className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                        />
                                        <Package className="w-4 h-4 text-rose-600" />
                                        <span>เติมของที่ซื้อเข้ากระเป๋าคลังอัตโนมัติตอนบันทึก</span>
                                      </label>
                                    )}
                                  </div>
                                  <div className="text-base font-black text-rose-800 bg-white px-4 py-2 rounded-xl border border-rose-200 shadow-2xs font-mono">
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
                                    <p className="text-xs text-slate-500 mb-2">(ยอดสนับสนุน ไม่หักกำไร)</p>
                                </div>
                                <p className={`font-black text-slate-800 tracking-tight break-all leading-tight ${(customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                    ฿{(customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toLocaleString()}
                                </p>
                             </div>

                             {/* 2. รายได้ */}
                             <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-bold text-emerald-700 mb-1">2. รายได้</p>
                                    <p className="text-xs text-emerald-600 mb-2">(รายการเสนอราคา)</p>
                                </div>
                                <p className={`font-black text-emerald-700 tracking-tight break-all leading-tight ${(quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                    ฿{(quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toLocaleString()}
                                </p>
                             </div>

                             {/* 3. ค่าใช้จ่าย */}
                             <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-bold text-rose-700 mb-1">3. ค่าใช้จ่าย</p>
                                    <p className="text-xs text-rose-500 mb-2">(รวมรายจ่ายจริง)</p>
                                </div>
                                <p className={`font-black text-rose-600 tracking-tight break-all leading-tight ${totalExpenses.toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                    ฿{totalExpenses.toLocaleString()}
                                </p>
                             </div>
                             
                             {/* 4. กำไรสุทธิ */}
                             <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-bold text-indigo-100 mb-1">4. กำไรสุทธิ</p>
                                    <p className="text-xs text-indigo-200 mb-2">(รายได้ - ค่าใช้จ่าย)</p>
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

      {/* Venue Detail / Loading Dock Intelligence Modal */}
      {selectedVenueForModal && (
        <VenueDetailModal
          isOpen={Boolean(selectedVenueForModal)}
          venue={selectedVenueForModal}
          onClose={() => setSelectedVenueForModal(null)}
          onUpdateVenue={(updated) => {
            setDeliveryLocations(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v));
            setSelectedVenueForModal(prev => ({ ...prev, ...updated }));
          }}
        />
      )}

      {/* Venue Intelligence Directory Modal */}
      <VenueDirectoryModal
        isOpen={isVenueDirectoryOpen}
        venues={deliveryLocations}
        onClose={() => setIsVenueDirectoryOpen(false)}
        onSelectVenue={(venue) => {
          setSelectedVenueForModal(venue);
          setIsVenueDirectoryOpen(false);
        }}
      />

    </div>
  );
};

export default App;
