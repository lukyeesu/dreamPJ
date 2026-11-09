import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MapPin,
  Truck,
  Building2,
  Phone,
  ShieldAlert,
  Search,
  Plus,
  ExternalLink,
  Edit,
  Filter,
  Check,
  Info,
  Navigation,
  Compass,
  Maximize2,
  Minimize2,
  Crosshair,
  Layers,
  ChevronRight,
  X,
  Route,
  Clock,
  Sparkles,
  Warehouse,
  Edit3,
  FileText,
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { saveLocationSync } from './services/syncService';
import Toast from './components/common/Toast';
import { useStickyFilter } from './hooks/useStickyFilter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { locationFormSchema } from './schemas/locationSchema';

// Flower2U Central Workshop & Logistics Hub Default Settings
export const DEFAULT_FLOWER2U_HUB = {
  name: 'Flower2U Workshop & Hub (จุดกระจายสินค้า)',
  description: 'ศูนย์รวมดอกไม้และเตรียมทีมขนส่งออกหน้างาน',
  coords: [13.736717, 100.523186],
  mapLink: 'https://maps.google.com/?q=13.736717,100.523186'
};

// Helper ถอดรหัสพิกัดละติจูด,ลองจิจูด จากข้อความหรือลิงก์ Google Maps ทุกรูปแบบ
export const parseCoordinatesFromInput = (input) => {
  if (!input) return null;
  const str = String(input).trim();
  // 1. ตรวจสอบพิกัดตัวเลขตรงๆ: "13.736717, 100.523186" หรือ "13.736717 100.523186"
  const plainMatch = str.match(/(-?\d+\.\d+)\s*[, ]\s*(-?\d+\.\d+)/);
  if (plainMatch) {
    const lat = parseFloat(plainMatch[1]);
    const lng = parseFloat(plainMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }
  // 2. ตรวจสอบลิงก์ Google Maps ที่มี @lat,lng หรือ q=lat,lng หรือ ll=lat,lng
  const urlMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || str.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlMatch) {
    const lat = parseFloat(urlMatch[1]);
    const lng = parseFloat(urlMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }
  return null;
};

// Fallback coordinate dictionary for known venues
const VENUE_COORDINATES = {
  'อิมแพ็ค อารีน่า': [13.9114, 100.5489],
  'impact arena': [13.9114, 100.5489],
  'อิมแพ็ค ชาเลนเจอร์': [13.9130, 100.5510],
  'impact challenger': [13.9130, 100.5510],
  'ธันเดอร์โดม': [13.9100, 100.5430],
  'thunder dome': [13.9100, 100.5430],
  'เซ็นทรัลเวิลด์': [13.7466, 100.5393],
  'centralworld': [13.7466, 100.5393],
  'ctw': [13.7466, 100.5393],
  'สยามพารากอน': [13.7462, 100.5348],
  'siam paragon': [13.7462, 100.5348],
  'ไอคอนสยาม': [13.7267, 100.5108],
  'iconsiam': [13.7267, 100.5108],
  'ทรู ไอคอน ฮอลล์': [13.7267, 100.5108],
  'true icon hall': [13.7267, 100.5108],
  'ศูนย์การประชุมแห่งชาติสิริกิติ์': [13.7237, 100.5593],
  'qsncc': [13.7237, 100.5593],
  'ไบเทค บางนา': [13.6700, 100.6069],
  'bitec': [13.6700, 100.6069],
  'ยูเนี่ยน มอลล์': [13.8136, 100.5614],
  'union mall': [13.8136, 100.5614],
  'เซ็นทรัล ลาดพร้าว': [13.8164, 100.5606],
  'central ladprao': [13.8164, 100.5606],
  'เซ็นทรัล พระราม 9': [13.7578, 100.5664],
  'central rama 9': [13.7578, 100.5664],
  'สามย่าน มิตรทาวน์': [13.7337, 100.5284],
  'samyan mitrtown': [13.7337, 100.5284],
  'เอ็มควอเทียร์': [13.7314, 100.5698],
  'emquartier': [13.7314, 100.5698],
  'เอ็มสเฟียร์': [13.7320, 100.5670],
  'emsphere': [13.7320, 100.5670],
  'uob live': [13.7320, 100.5670],
  'บราโว บีเคเค': [13.7533, 100.5746],
  'show dc': [13.7533, 100.5746],
  'เดอะมอลล์ไลฟ์สโตร์ บางกะปิ': [13.7656, 100.6433],
  'the mall bangkapi': [13.7656, 100.6433],
  'เอ็มบีเค เซ็นเตอร์': [13.7444, 100.5300],
  'mbk': [13.7444, 100.5300],
  'จีเอ็มเอ็ม ไลฟ์ เฮาส์': [13.7466, 100.5393],
  'gmm live house': [13.7466, 100.5393],
  'สยามสแควร์วัน': [13.7450, 100.5338],
  'siam square one': [13.7450, 100.5338],
  'ศูนย์วัฒนธรรมแห่งประเทศไทย': [13.7712, 100.5741],
  'หอศิลปกรุงเทพฯ': [13.7469, 100.5304],
  'bacc': [13.7469, 100.5304],
  'เซ็นทรัล เวสต์เกต': [13.8761, 100.4116],
  'central westgate': [13.8761, 100.4116],
  'ธรรมศาสตร์ รังสิต': [14.0736, 100.6015],
  'tu rungsit': [14.0736, 100.6015]
};

// Calculate approximate straight/road distance in KM (Haversine * 1.35 road factor)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  return Math.round(straightKm * 1.32 * 10) / 10; // 1.32 road meandering factor
}

// Helper: Extract coordinate from URL or dictionary or hash
function getVenueCoordinate(venue, index = 0) {
  const url = venue.loading_dock_map_link || venue.default_map_link || '';

  // 1. Check coordinates inside URL (@lat,lng or q=lat,lng)
  const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)|q=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = url.match(regex);
  if (match) {
    const lat = parseFloat(match[1] || match[3]);
    const lng = parseFloat(match[2] || match[4]);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }

  // 2. Check dictionary by name or alias
  const nameKey = (venue.name || '').toLowerCase();
  for (const [key, coords] of Object.entries(VENUE_COORDINATES)) {
    if (nameKey.includes(key)) {
      return coords;
    }
  }

  if (Array.isArray(venue.aliases)) {
    for (const alias of venue.aliases) {
      const aKey = alias.toLowerCase();
      for (const [key, coords] of Object.entries(VENUE_COORDINATES)) {
        if (aKey.includes(key)) {
          return coords;
        }
      }
    }
  }

  // 3. Deterministic scatter around Bangkok center [13.7563, 100.5018]
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = 0.02 + ((index % 7) * 0.015);
  return [13.7563 + radius * Math.sin(angle), 100.5018 + radius * Math.cos(angle)];
}

function Locations({
  locations = [],
  venues: venuesProp = [],
  isCreateOpen = false,
  onCloseCreate,
  onSelectVenue,
  onRefresh,
  shopInfo
}) {
  const { isFilterStuck, filterSentinelRef } = useStickyFilter();
  const venues = locations.length > 0 ? locations : venuesProp;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [isMapExpanded, setIsMapExpanded] = useState(true);
  const [activeVenue, setActiveVenue] = useState(null);
  const [activeRouteInfo, setActiveRouteInfo] = useState(null);
  const [mapLayerType, setMapLayerType] = useState('google'); // 'google' | 'hybrid' | 'osm'

  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef(new Map());
  const routePolylineRef = useRef(null);
  const hubMarkerRef = useRef(null);
  const clickMarkerRef = useRef(null);

  // จุดเริ่มต้นขนส่ง / โกดัง (Hub Settings) บันทึกถาวรลง localStorage & ซิงค์กับ shopInfo
  const [hubSettings, setHubSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('flower2u_hub_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    if (shopInfo?.gpsLocation) {
      const parsed = parseCoordinatesFromInput(shopInfo.gpsLocation);
      if (parsed) {
        return {
          name: shopInfo.shopName || DEFAULT_FLOWER2U_HUB.name,
          description: shopInfo.address || DEFAULT_FLOWER2U_HUB.description,
          coords: parsed,
          mapLink: shopInfo.mapLink || `https://maps.google.com/?q=${parsed[0]},${parsed[1]}`
        };
      }
    }
    return DEFAULT_FLOWER2U_HUB;
  });

  const hubSettingsRef = useRef(hubSettings);
  useEffect(() => {
    hubSettingsRef.current = hubSettings;
  }, [hubSettings]);

  // ซิงค์พิกัดเริ่มต้นเมื่อ shopInfo หรือการตั้งค่ามีการเปลี่ยนแปลง
  useEffect(() => {
    if (shopInfo?.gpsLocation) {
      const parsed = parseCoordinatesFromInput(shopInfo.gpsLocation);
      if (parsed) {
        const updated = {
          name: shopInfo.shopName || DEFAULT_FLOWER2U_HUB.name,
          description: shopInfo.address || DEFAULT_FLOWER2U_HUB.description,
          coords: parsed,
          mapLink: shopInfo.mapLink || `https://maps.google.com/?q=${parsed[0]},${parsed[1]}`
        };
        setHubSettings(updated);
        try {
          localStorage.setItem('flower2u_hub_settings', JSON.stringify(updated));
        } catch (e) {}

        if (hubMarkerRef.current) {
          hubMarkerRef.current.setLatLng(parsed);
          hubMarkerRef.current.bindPopup(`
            <div class="p-1 font-sans text-slate-800">
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">จุดเริ่มต้นขนส่ง (ร้าน)</span>
              <h4 class="font-bold text-sm text-slate-900 mt-1">${updated.name}</h4>
              <p class="text-xs text-slate-500 mt-0.5">${updated.description}</p>
            </div>
          `);
        }
      }
    }

    const handleHubUpdate = (e) => {
      if (e.detail) {
        setHubSettings(e.detail);
        if (hubMarkerRef.current && e.detail.coords) {
          hubMarkerRef.current.setLatLng(e.detail.coords);
          hubMarkerRef.current.bindPopup(`
            <div class="p-1 font-sans text-slate-800">
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">จุดเริ่มต้นขนส่ง</span>
              <h4 class="font-bold text-sm text-slate-900 mt-1">${e.detail.name}</h4>
              <p class="text-xs text-slate-500 mt-0.5">${e.detail.description}</p>
            </div>
          `);
        }
      }
    };
    window.addEventListener('flower2u_hub_updated', handleHubUpdate);
    return () => window.removeEventListener('flower2u_hub_updated', handleHubUpdate);
  }, [shopInfo?.gpsLocation, shopInfo?.shopName, shopInfo?.address, shopInfo?.mapLink]);

  const [isEditHubModalOpen, setIsEditHubModalOpen] = useState(false);
  const [hubForm, setHubForm] = useState({
    name: DEFAULT_FLOWER2U_HUB.name,
    description: DEFAULT_FLOWER2U_HUB.description,
    locationInput: DEFAULT_FLOWER2U_HUB.coords.join(', '),
    mapLink: DEFAULT_FLOWER2U_HUB.mapLink || ''
  });

  const handleOpenEditHub = () => {
    setHubForm({
      name: hubSettings.name,
      description: hubSettings.description,
      locationInput: hubSettings.coords.join(', '),
      mapLink: hubSettings.mapLink || ''
    });
    setIsEditHubModalOpen(true);
  };

  const handleSaveHub = (e) => {
    e.preventDefault();
    const parsedCoords = parseCoordinatesFromInput(hubForm.locationInput);
    if (!parsedCoords) {
      showToast('กรุณาระบุพิกัดละติจูด,ลองจิจูด หรือลิงก์ Google Maps ที่ถูกต้อง', 'error');
      return;
    }

    const updated = {
      name: hubForm.name.trim() || DEFAULT_FLOWER2U_HUB.name,
      description: hubForm.description.trim() || DEFAULT_FLOWER2U_HUB.description,
      coords: parsedCoords,
      mapLink: hubForm.mapLink.trim() || `https://maps.google.com/?q=${parsedCoords[0]},${parsedCoords[1]}`
    };

    setHubSettings(updated);
    try {
      localStorage.setItem('flower2u_hub_settings', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('flower2u_hub_updated', { detail: updated }));
    } catch (err) {}

    // อัปเดตหมุดจุดเริ่มต้นบนแผนที่ Leaflet
    if (hubMarkerRef.current) {
      hubMarkerRef.current.setLatLng(updated.coords);
      hubMarkerRef.current.bindPopup(`
        <div class="p-1 font-sans text-slate-800">
          <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">จุดเริ่มต้นขนส่ง</span>
          <h4 class="font-bold text-sm text-slate-900 mt-1">${updated.name}</h4>
          <p class="text-xs text-slate-500 mt-0.5">${updated.description}</p>
        </div>
      `);
    }

    if (leafletMapRef.current) {
      leafletMapRef.current.panTo(updated.coords);
    }

    setIsEditHubModalOpen(false);
    showToast('บันทึกจุดเริ่มต้นขนส่งสำเร็จ!', 'success');
  };

  // ดึงตำแหน่งของฉัน (GPS Locate Me)
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast('เบราว์เซอร์ไม่รองรับ GPS', 'error');
      return;
    }
    showToast('กำลังค้นหาพิกัดตำแหน่งของคุณ...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const map = leafletMapRef.current;
        if (!map) return;
        map.setView([latitude, longitude], 14, { animate: true });

        if (clickMarkerRef.current) clickMarkerRef.current.remove();

        const myIcon = L.divIcon({
          className: 'my-loc-pin',
          html: `
            <div class="relative group cursor-pointer animate-pulse">
              <div class="w-9 h-9 rounded-full bg-sky-600 border-2 border-white text-white flex items-center justify-center shadow-xl font-bold text-sm">
                🎯
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-sky-600 rotate-45"></div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36]
        });

        const dist = calculateDistanceKm(hubSettings.coords[0], hubSettings.coords[1], latitude, longitude);
        const estMins = Math.round(dist * 2.2);

        const marker = L.marker([latitude, longitude], { icon: myIcon }).addTo(map);
        clickMarkerRef.current = marker;

        marker.bindPopup(`
          <div class="p-1 font-sans text-slate-800">
            <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">📍 ตำแหน่งของคุณปัจจุบัน</span>
            <p class="font-mono text-xs font-bold text-slate-900 mt-1">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
            <p class="text-xs text-slate-500 mt-0.5">ห่างจากจุดเริ่มต้นขนส่ง ~${dist} กม. (~${estMins} นาที)</p>
          </div>
        `).openPopup();

        showToast('ระบุพิกัดของคุณเรียบร้อยแล้ว', 'success');
      },
      (err) => {
        showToast('ไม่สามารถระบุพิกัดได้: ' + err.message, 'error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // เปิดมุมมองแผนที่ปัจจุบันใน Google Maps เต็มหน้า
  const handleOpenInGoogleMaps = () => {
    const map = leafletMapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    window.open(`https://www.google.com/maps/@${center.lat},${center.lng},${zoom}z`, '_blank');
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: '',
      zone: 'ทั่วไป',
      default_map_link: '',
      loading_dock_map_link: '',
      gate_info: '',
      parking_height_limit: '',
      dock_contact_phone: '',
      delivery_tips: ''
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Hook up single header button
  useEffect(() => {
    if (isCreateOpen) {
      handleOpenCreateModal();
      if (onCloseCreate) onCloseCreate();
    }
  }, [isCreateOpen]);

  // Keyboard shortcut: close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isCreateModalOpen) {
        setIsCreateModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen]);

  // Extract unique zones
  const zones = useMemo(() => {
    const set = new Set();
    venues.forEach(v => {
      if (v.zone && v.zone.trim()) set.add(v.zone.trim());
    });
    return Array.from(set).sort();
  }, [venues]);

  // Filtered venues
  const filteredVenues = useMemo(() => {
    return venues.filter(v => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (Array.isArray(v.aliases) && v.aliases.some(a => a.toLowerCase().includes(q))) ||
        (v.zone && v.zone.toLowerCase().includes(q)) ||
        (v.gate_info && v.gate_info.toLowerCase().includes(q));

      const matchZone = selectedZone === 'all' || v.zone === selectedZone;
      return matchSearch && matchZone;
    });
  }, [venues, searchQuery, selectedZone]);

  // Statistics
  const stats = useMemo(() => {
    const total = venues.length;
    const withDockPin = venues.filter(v => Boolean(v.loading_dock_map_link)).length;
    const withGateInfo = venues.filter(v => Boolean(v.gate_info)).length;
    const withPhone = venues.filter(v => Boolean(v.dock_contact_phone)).length;
    return { total, withDockPin, withGateInfo, withPhone };
  }, [venues]);

  // Map Tile Switcher URLs
  const getTileUrl = (type) => {
    switch (type) {
      case 'hybrid':
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'osm':
        return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      case 'google':
      default:
        // Google Maps Street Roadmap - 100% free, fast, real Thai roads and routes!
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (leafletMapRef.current) return;

    // Default center Bangkok [13.7563, 100.5018]
    const map = L.map(mapContainerRef.current, {
      center: [13.7563, 100.5018],
      zoom: 11,
      zoomControl: true,
      scrollWheelZoom: true
    });

    const tile = L.tileLayer(getTileUrl('google'), {
      attribution: '&copy; Google Maps / OpenStreetMap',
      maxZoom: 20
    }).addTo(map);

    tileLayerRef.current = tile;
    leafletMapRef.current = map;

    // Add Flower2U Hub Pin
    const hubIcon = L.divIcon({
      className: 'hub-pin',
      html: `
        <div class="relative group cursor-pointer animate-bounce">
          <div class="w-10 h-10 rounded-2xl bg-indigo-600 border-2 border-white text-white flex items-center justify-center shadow-xl font-black text-sm">
            🌸
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-600 rotate-45"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });

    const marker = L.marker(hubSettings.coords, { icon: hubIcon })
      .addTo(map)
      .bindPopup(`
        <div class="p-1 font-sans text-slate-800">
          <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">จุดเริ่มต้นขนส่ง</span>
          <h4 class="font-bold text-sm text-slate-900 mt-1">${hubSettings.name}</h4>
          <p class="text-xs text-slate-500 mt-0.5">${hubSettings.description}</p>
        </div>
      `);
    hubMarkerRef.current = marker;

    // Google Maps-style Interactive Click: drop pin anywhere to inspect coords, distance & travel time
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const currentHub = hubSettingsRef.current || DEFAULT_FLOWER2U_HUB;
      const dist = calculateDistanceKm(currentHub.coords[0], currentHub.coords[1], lat, lng);
      const estMins = Math.round(dist * 2.2);
      const latFormatted = lat.toFixed(6);
      const lngFormatted = lng.toFixed(6);
      const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${currentHub.coords[0]},${currentHub.coords[1]}&destination=${latFormatted},${lngFormatted}`;
      const gmapUrl = `https://maps.google.com/?q=${latFormatted},${lngFormatted}`;

      if (clickMarkerRef.current) {
        clickMarkerRef.current.remove();
      }

      const clickIcon = L.divIcon({
        className: 'user-click-pin',
        html: `
          <div class="relative group cursor-pointer animate-bounce">
            <div class="w-9 h-9 rounded-2xl bg-rose-600 border-2 border-white text-white flex items-center justify-center shadow-xl font-black text-sm">
              📍
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-rose-600 rotate-45"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
      });

      const clickMarker = L.marker([lat, lng], { icon: clickIcon }).addTo(map);
      clickMarkerRef.current = clickMarker;

      const popupHtml = `
        <div class="p-1 font-sans text-slate-800 max-w-xs">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              📌 พิกัดที่คุณเลือกบนแผนที่
            </span>
          </div>
          <div class="text-xs font-mono font-bold text-slate-900 bg-slate-100 p-2 rounded-xl select-all border border-slate-200">
            ${latFormatted}, ${lngFormatted}
          </div>
          <div class="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span class="text-slate-500 block text-xs font-medium">ระยะทางจากจุดเริ่มต้น</span>
              <span class="font-black text-slate-800">~${dist} กม.</span>
            </div>
            <div class="text-right">
              <span class="text-slate-500 block text-xs font-medium">เวลาขับรถเฉลี่ย</span>
              <span class="font-black text-indigo-600">~${estMins} นาที</span>
            </div>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
            <a href="${navUrl}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-2 rounded-xl bg-indigo-600 text-white text-xs font-bold text-center hover:bg-indigo-700 shadow-xs flex items-center justify-center gap-1">
              🧭 เปิด Google Maps นำทาง
            </a>
            <a href="${gmapUrl}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold text-center hover:bg-slate-200 flex items-center justify-center gap-1">
              🗺️ ดูตำแหน่งบน Google Maps
            </a>
          </div>
        </div>
      `;

      clickMarker.bindPopup(popupHtml, { maxWidth: 300 }).openPopup();
    });

    // Invalidate size after layout stabilization
    const timer = setTimeout(() => {
      if (leafletMapRef.current && typeof leafletMapRef.current.invalidateSize === 'function') {
        leafletMapRef.current.invalidateSize();
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Update Tile Layer when layer type changes
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const tile = L.tileLayer(getTileUrl(mapLayerType), {
      attribution: '&copy; Google Maps / OpenStreetMap',
      maxZoom: 20
    }).addTo(map);

    tileLayerRef.current = tile;
  }, [mapLayerType]);

  // Invalidate map size on expand/collapse
  useEffect(() => {
    const timer = setTimeout(() => {
      if (leafletMapRef.current && typeof leafletMapRef.current.invalidateSize === 'function') {
        leafletMapRef.current.invalidateSize();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [isMapExpanded]);

  // Sync Markers with filteredVenues
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([hubSettings.coords]);

    filteredVenues.forEach((venue, idx) => {
      const coords = getVenueCoordinate(venue, idx);
      const isDockPin = Boolean(venue.loading_dock_map_link);

      // Custom HTML Pin Marker
      const pinColor = isDockPin ? 'bg-amber-500 border-amber-300' : 'bg-sky-500 border-sky-300';
      const iconHtml = `
        <div class="relative group cursor-pointer transition-transform hover:scale-125">
          <div class="w-8 h-8 rounded-full ${pinColor} border-2 text-white flex items-center justify-center shadow-lg font-bold text-xs">
            ${isDockPin ? '🚚' : '📍'}
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-venue-pin',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const dist = calculateDistanceKm(hubSettings.coords[0], hubSettings.coords[1], coords[0], coords[1]);
      const estMins = Math.round(dist * 2.2);

      const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${hubSettings.coords[0]},${hubSettings.coords[1]}&destination=${coords[0]},${coords[1]}`;

      const popupContent = `
        <div class="p-1 font-sans text-slate-800 max-w-xs">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
              ${venue.zone || 'ทั่วไป'}
            </span>
            ${isDockPin ? '<span class="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">มีพิกัดจุดโหลด</span>' : ''}
          </div>
          <h4 class="font-bold text-sm text-slate-900 leading-snug">${venue.name}</h4>
          ${venue.gate_info ? `<p class="text-xs text-slate-600 mt-1">🚪 <b>จุดเทียบรถ:</b> ${venue.gate_info}</p>` : ''}
          ${venue.parking_height_limit ? `<p class="text-xs text-amber-700 mt-0.5">⚠️ <b>จำกัดความสูง:</b> ${venue.parking_height_limit}</p>` : ''}
          ${venue.dock_contact_phone ? `<p class="text-xs text-emerald-700 mt-0.5">📞 <b>โทร รปภ.:</b> <a href="tel:${venue.dock_contact_phone}" class="underline font-bold">${venue.dock_contact_phone}</a></p>` : ''}
          
          <div class="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span class="text-slate-500 block text-xs font-medium">ระยะทางจากร้าน</span>
              <span class="font-black text-slate-800">~${dist} กม.</span>
            </div>
            <div class="text-right">
              <span class="text-slate-500 block text-xs font-medium">เวลาเดินทางเฉลี่ย</span>
              <span class="font-black text-indigo-600">~${estMins} นาที</span>
            </div>
          </div>

          <div class="mt-2.5 pt-2 border-t border-slate-100 flex gap-1.5">
            <a href="${navUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 py-1.5 px-2 rounded-xl bg-indigo-600 text-white text-xs font-bold text-center hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-1">
              🧭 เปิด Google Maps นำทาง
            </a>
          </div>
        </div>
      `;

      const marker = L.marker(coords, { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);

      marker.on('click', () => {
        handleFlyToVenue(venue, idx);
      });

      markersRef.current.set(venue.id || venue.name, marker);
      bounds.extend(coords);
    });

    if (filteredVenues.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [filteredVenues]);

  // Fly to venue & Draw active delivery route
  const handleFlyToVenue = (venue, idx) => {
    const map = leafletMapRef.current;
    if (!map) return;
    const destCoords = getVenueCoordinate(venue, idx);
    setActiveVenue(venue);

    // Calculate Route Metrics
    const dist = calculateDistanceKm(hubSettings.coords[0], hubSettings.coords[1], destCoords[0], destCoords[1]);
    const estMins = Math.round(dist * 2.2);
    setActiveRouteInfo({
      venue,
      distanceKm: dist,
      durationMins: estMins,
      navUrl: `https://www.google.com/maps/dir/?api=1&origin=${hubSettings.coords[0]},${hubSettings.coords[1]}&destination=${destCoords[0]},${destCoords[1]}`
    });

    // Draw Route Polyline from Flower2U Hub to Venue
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
    }

    // Midpoint curve for natural route depiction
    const midLat = (hubSettings.coords[0] + destCoords[0]) / 2 + 0.005;
    const midLng = (hubSettings.coords[1] + destCoords[1]) / 2 - 0.005;

    const routePolyline = L.polyline([
      hubSettings.coords,
      [midLat, midLng],
      destCoords
    ], {
      color: '#4f46e5',
      weight: 5,
      opacity: 0.85,
      dashArray: '8, 8',
      lineCap: 'round'
    }).addTo(map);

    routePolylineRef.current = routePolyline;

    // Fly to venue and open popup
    map.flyTo(destCoords, 15, { duration: 1.2 });
    const marker = markersRef.current.get(venue.id || venue.name);
    if (marker) {
      setTimeout(() => marker.openPopup(), 600);
    }
  };

  const handleOpenCreateModal = (venue = null) => {
    if (venue) {
      setEditingVenue(venue);
      reset({
        name: venue.name || '',
        zone: venue.zone || 'ทั่วไป',
        default_map_link: venue.default_map_link || '',
        loading_dock_map_link: venue.loading_dock_map_link || '',
        gate_info: venue.gate_info || '',
        parking_height_limit: venue.parking_height_limit || '',
        dock_contact_phone: venue.dock_contact_phone || '',
        delivery_tips: venue.delivery_tips || ''
      });
    } else {
      setEditingVenue(null);
      reset({
        name: '',
        zone: 'ทั่วไป',
        default_map_link: '',
        loading_dock_map_link: '',
        gate_info: '',
        parking_height_limit: '',
        dock_contact_phone: '',
        delivery_tips: ''
      });
    }
    setIsCreateModalOpen(true);
  };

  const onSubmitVenue = async (formData) => {
    setIsSaving(true);
    try {
      await saveLocationSync({
        ...formData,
        id: editingVenue?.id || undefined
      });
      setIsCreateModalOpen(false);
      showToast('บันทึกสถานที่สำเร็จ', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('บันทึกสถานที่ล้มเหลว: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 min-h-full pb-24 md:pb-6 px-4 sm:px-8 lg:px-10 pt-4">
      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">สถานที่ทั้งหมด</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total} แห่ง</p>
          <div className="mt-1 pt-1 border-t border-slate-100 text-xs font-semibold text-slate-400">ครอบคลุมทุกโซนจัดงาน</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700">มีพิกัดจุดโหลดของจริง</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-700">{stats.withDockPin} แห่ง</p>
          <div className="mt-1 pt-1 border-t border-slate-100 text-xs font-semibold text-amber-600">ปักหมุด Loading Dock ตรงจุด</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-sky-700">ระบุประตูเทียบรถ</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-sky-700">{stats.withGateInfo} แห่ง</p>
          <div className="mt-1 pt-1 border-t border-slate-100 text-xs font-semibold text-sky-600">มีแนวทางเข้าตึกชัดเจน</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700">มีเบอร์ติดต่อ รปภ./จุดโหลด</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700">{stats.withPhone} แห่ง</p>
          <div className="mt-1 pt-1 border-t border-slate-100 text-xs font-semibold text-emerald-600">กดโทรออกหน้างานได้ทันที</div>
        </div>
      </div>

      {/* Starting Point Banner (จุดเริ่มต้นขนส่ง / โกดัง / Hub) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-sm border border-indigo-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300 shrink-0 mt-0.5">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 text-xs font-bold uppercase tracking-wider border border-indigo-400/20">
                จุดเริ่มต้นขนส่ง (Logistics Origin)
              </span>
              <span className="text-xs text-indigo-300 font-mono">
                📍 {hubSettings.coords[0].toFixed(5)}, {hubSettings.coords[1].toFixed(5)}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1">{hubSettings.name}</h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">{hubSettings.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
          {hubSettings.mapLink && (
            <a
              href={hubSettings.mapLink}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/10 transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>ดูใน Google Maps</span>
            </a>
          )}
          <button
            type="button"
            onClick={handleOpenEditHub}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>แก้ไขจุดเริ่มต้นขนส่ง</span>
          </button>
        </div>
      </div>

      {/* Interactive Google Maps / OpenStreetMap View */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden space-y-2">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>แผนที่พิกัดสถานที่จัดส่ง & เส้นทางขนส่ง (Thailand Logistics Map)</span>
              </h3>
              <p className="text-xs text-slate-400">
                แผนที่ถนนจริง Google Maps แสดงเส้นทางขนส่งจากร้าน ระยะทาง และจุดโหลดของ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Actions: Locate Me & Open Google Maps */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLocateMe}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="ระบุตำแหน่งปัจจุบันของฉัน"
              >
                <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">ตำแหน่งฉัน</span>
              </button>
              <button
                type="button"
                onClick={handleOpenInGoogleMaps}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="เปิดมุมมองนี้ใน Google Maps"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Google Maps</span>
              </button>
            </div>

            {/* Layer Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setMapLayerType('google')}
                className={`px-2.5 py-1 rounded-lg transition ${mapLayerType === 'google' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'}`}
              >
                🗺️ ถนน (Google)
              </button>
              <button
                type="button"
                onClick={() => setMapLayerType('hybrid')}
                className={`px-2.5 py-1 rounded-lg transition ${mapLayerType === 'hybrid' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'}`}
              >
                🛰️ ดาวเทียม
              </button>
              <button
                type="button"
                onClick={() => setMapLayerType('osm')}
                className={`px-2.5 py-1 rounded-lg transition ${mapLayerType === 'osm' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'}`}
              >
                🌍 OSM
              </button>
            </div>

            {/* Expand / Minimize Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className={`px-3 py-1.5 rounded-xl transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isMapExpanded
                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
              title={isMapExpanded ? 'ย่อแผนที่' : 'ขยายแผนที่'}
            >
              {isMapExpanded ? (
                <>
                  <Minimize2 className="w-4 h-4 text-indigo-600" />
                  <span>ย่อ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-slate-600" />
                  <span>ขยาย</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Route Active Banner (When a venue is clicked) */}
        {activeRouteInfo && isMapExpanded && (
          <div className="mx-4 sm:mx-5 p-3.5 bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm">
                <Route className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <span>เส้นทางขนส่งไปยัง:</span>
                  <span className="font-black text-indigo-700">{activeRouteInfo.venue.name}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-600">
                  <span>📍 เริ่มจาก: <b>{hubSettings.name}</b></span>
                  <span>🛣️ ระยะทาง: <b className="text-slate-900">~{activeRouteInfo.distanceKm} กม.</b></span>
                  <span>⏱️ ขับรถเฉลี่ย: <b className="text-indigo-600">~{activeRouteInfo.durationMins} นาที</b></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activeRouteInfo.navUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 transition flex items-center gap-1.5"
              >
                <Navigation className="w-4 h-4" />
                <span>เปิดนำทางใน Google Maps</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setActiveRouteInfo(null);
                  if (routePolylineRef.current) routePolylineRef.current.remove();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600"
                title="ลบเส้นทาง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div
          ref={mapContainerRef}
          className={`w-full transition-all duration-300 z-10 ${
            isMapExpanded ? 'h-[520px] sm:h-[640px] lg:h-[740px]' : 'h-0 hidden'
          }`}
        />

        {/* Map Interactive Tip Footer */}
        {isMapExpanded && (
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <span className="flex items-center gap-1.5 font-medium">
              💡 <span>คลิกจุดใดก็ได้บนแผนที่เพื่อดูพิกัด ละติจูด/ลองจิจูด และนำทางแบบ Google Maps</span>
            </span>
            <span className="font-semibold text-slate-400">
              รองรับการลาก ซูม และกดเลือกสถานที่
            </span>
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div 
        ref={filterSentinelRef} 
        className="w-full h-0 -my-3 pointer-events-none opacity-0"
      />
      <div className={`bg-white/95 backdrop-blur-md transition-all duration-200 ease-in-out z-20 sticky top-[calc(56px+env(safe-area-inset-top,0px))] md:top-0 ${
        isFilterStuck
          ? '-mx-4 sm:-mx-8 lg:-mx-10 py-2 sm:py-2.5 px-4 sm:px-8 lg:px-10 border-b border-slate-100 shadow-sm rounded-b-[2rem] sm:rounded-b-3xl rounded-t-none'
          : 'p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)]'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาชื่อสถานที่ ประตู หรือคำค้น (เช่น อิมแพ็ค, CTW, สยาม, ไบเทค)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                title="ล้างข้อความค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Zone Dropdown */}
            <div className="relative w-44 sm:w-56 shrink-0">
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer shadow-2xs transition-colors"
              >
                <option value="all">ทุกโซนพื้นที่ ({venues.length})</option>
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedZone('all');
              }}
              className="h-10 w-10 bg-slate-50 border border-slate-200/70 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 active:scale-95 cursor-pointer shadow-2xs"
              title="ล้างค่าตัวกรองทั้งหมด"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1060px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/70 text-xs font-bold text-slate-600 uppercase tracking-wider select-none">
                <th className="py-4 px-5 min-w-[240px]">สถานที่จัดส่ง</th>
                <th className="py-4 px-4 min-w-[100px] whitespace-nowrap">โซน</th>
                <th className="py-4 px-4 min-w-[240px] max-w-[340px]">ประตู / จุดเทียบรถ (Loading Dock)</th>
                <th className="py-4 px-3 text-center min-w-[110px] whitespace-nowrap">จำกัดความสูง</th>
                <th className="py-4 px-4 min-w-[150px] whitespace-nowrap">เบอร์ติดต่อ รปภ./จุดโหลด</th>
                <th className="py-4 px-4 min-w-[180px] max-w-[280px]">หมายเหตุ</th>
                <th className="py-4 px-5 text-right min-w-[170px] whitespace-nowrap">เส้นทาง & จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredVenues.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    ไม่พบสถานที่ที่ตรงกับการค้นหา
                  </td>
                </tr>
              ) : (
                filteredVenues.map((venue, idx) => (
                  <tr
                    key={venue.id || venue.name}
                    className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                      activeVenue?.name === venue.name ? 'bg-indigo-50/50 ring-1 ring-inset ring-indigo-200' : ''
                    }`}
                    onClick={() => handleFlyToVenue(venue, idx)}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/70 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/80 shadow-xs">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm leading-snug break-words">
                            {venue.name}
                          </div>
                          {Array.isArray(venue.aliases) && venue.aliases.length > 0 && (
                            <div className="text-xs text-slate-600 font-medium tracking-tight mt-0.5 truncate" title={venue.aliases.join(', ')}>
                              ชื่อเรียก: {venue.aliases.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/70 shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                        {venue.zone || 'ทั่วไป'}
                      </span>
                    </td>

                    <td className="py-4 px-4 min-w-[240px] max-w-[340px]">
                      {venue.gate_info ? (
                        <div className="bg-amber-50/60 hover:bg-amber-50/90 p-2.5 rounded-xl border border-amber-200/50 transition-colors">
                          <div className="flex items-start gap-2 text-xs font-semibold text-slate-800 break-words leading-relaxed">
                            <Truck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span className="break-words leading-relaxed">{venue.gate_info}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-semibold pl-2">-</span>
                      )}
                    </td>

                    <td className="py-4 px-3 text-center whitespace-nowrap">
                      {venue.parking_height_limit ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-mono font-bold text-xs border border-amber-200/80 shadow-xs">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{venue.parking_height_limit}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 font-semibold">-</span>
                      )}
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      {venue.dock_contact_phone ? (
                        <a
                          href={`tel:${venue.dock_contact_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200/60 inline-flex items-center gap-2 transition-all active:scale-95 shadow-xs text-xs group"
                          title="กดเพื่อโทรออกหา รปภ./จุดโหลด"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                          <span className="tracking-wide">{venue.dock_contact_phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-300 font-semibold pl-2">-</span>
                      )}
                    </td>

                    <td className="py-4 px-4 min-w-[180px] max-w-[280px]">
                      {venue.delivery_tips ? (
                        <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed break-words">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="break-words leading-relaxed">{venue.delivery_tips}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-semibold pl-2">-</span>
                      )}
                    </td>

                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleFlyToVenue(venue, idx)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-200 transition-all active:scale-95 cursor-pointer"
                          title="ซูมและแสดงเส้นทางบนแผนที่"
                        >
                          <Route className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">ดูเส้นทาง</span>
                        </button>
                        {(venue.loading_dock_map_link || venue.default_map_link) && (
                          <a
                            href={venue.loading_dock_map_link || venue.default_map_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/60 transition-colors shrink-0"
                            title="เปิด Google Maps นำทาง"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenCreateModal(venue)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-slate-200/60 transition-colors shrink-0 cursor-pointer"
                          title="แก้ไขข้อมูลสถานที่"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {filteredVenues.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400">
            ไม่พบสถานที่ที่ตรงกับการค้นหา
          </div>
        ) : (
          filteredVenues.map((venue, idx) => (
            <div
              key={venue.id || venue.name}
              className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3.5 transition-all ${
                activeVenue?.name === venue.name ? 'ring-2 ring-indigo-500/30 bg-indigo-50/20' : ''
              }`}
            >
              {/* Header: Zone Badge + Location Name & Aliases */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {venue.zone || 'ทั่วไป'}
                    </span>
                    {Array.isArray(venue.aliases) && venue.aliases.length > 0 && (
                      <span className="text-xs text-slate-500 font-medium truncate">
                        ({venue.aliases.join(', ')})
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug">
                    {venue.name}
                  </h3>
                </div>
              </div>

              {/* Detail Rows (แสดงข้อมูลครบถ้วน หากว่างขึ้น -) */}
              <div className="bg-slate-50/80 p-3 rounded-xl text-xs space-y-2 border border-slate-100">
                {/* Gate & Dock Info */}
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 text-slate-500 font-semibold shrink-0 min-w-[85px] pt-0.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>จุดเทียบรถ:</span>
                  </div>
                  <div className="flex-1 font-medium text-slate-800 break-words leading-relaxed">
                    {venue.gate_info ? venue.gate_info : <span className="text-slate-300">-</span>}
                  </div>
                </div>

                {/* Height Limit */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-slate-500 font-semibold shrink-0 min-w-[85px]">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>ความสูงจำกัด:</span>
                  </div>
                  <div className="flex-1">
                    {venue.parking_height_limit ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold text-xs border border-amber-200 inline-block">
                        {venue.parking_height_limit}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>
                </div>

                {/* Dock Contact Phone */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-slate-500 font-semibold shrink-0 min-w-[85px]">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>เบอร์ รปภ./จุดโหลด:</span>
                  </div>
                  <div className="flex-1">
                    {venue.dock_contact_phone ? (
                      <a
                        href={`tel:${venue.dock_contact_phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 inline-flex items-center gap-1 hover:bg-emerald-100 transition"
                      >
                        <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{venue.dock_contact_phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>
                </div>

                {/* Notes / Delivery Tips */}
                <div className="flex items-start gap-2 pt-0.5 border-t border-slate-200/60">
                  <div className="flex items-center gap-1 text-slate-500 font-semibold shrink-0 min-w-[85px] pt-0.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>หมายเหตุ:</span>
                  </div>
                  <div className="flex-1 text-slate-600 break-words leading-relaxed">
                    {venue.delivery_tips ? venue.delivery_tips : <span className="text-slate-300">-</span>}
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar (ย้ายมาไว้ข้างล่าง คล้ายการ์ดโปรเจก) */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleFlyToVenue(venue, idx)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors text-xs active:scale-95 cursor-pointer shadow-sm border border-indigo-100/60"
                  title="ดูเส้นทางบนแผนที่"
                >
                  <Route className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">ดูเส้นทาง</span>
                </button>

                {venue.loading_dock_map_link || venue.default_map_link ? (
                  <a
                    href={venue.loading_dock_map_link || venue.default_map_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors text-xs active:scale-95 shadow-sm shadow-indigo-200"
                    title="เปิด Google Maps นำทาง"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">Google Maps</span>
                  </a>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">ไม่มีพิกัด</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(venue)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl transition-colors text-xs active:scale-95 cursor-pointer shadow-sm"
                  title="แก้ไขสถานที่"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="whitespace-nowrap">แก้ไข</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Venue Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsCreateModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-2xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {editingVenue ? 'แก้ไขข้อมูลสถานที่' : 'เพิ่มสถานที่จัดส่งใหม่'}
                    </h3>
                    {editingVenue?.name && (
                      <span className="bg-indigo-50 text-indigo-600 text-xs sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-100 w-fit">
                        {editingVenue.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    บันทึกพิกัด ประตูเทียบรถ และกฎระเบียบการขนของ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors active:scale-95 cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitVenue)} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-5 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อสถานที่จัดงาน *</label>
                    <input
                      type="text"
                      placeholder="เช่น เซ็นทรัลเวิลด์ (CentralWorld)"
                      {...register('name')}
                      className={`w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border rounded-xl sm:rounded-2xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                        errors.name ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                      }`}
                    />
                    {errors.name && (
                      <p className="text-xs text-rose-500 font-bold mt-1">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">โซนพื้นที่</label>
                    <input
                      type="text"
                      placeholder="เช่น พระราม 1, เมืองทอง"
                      {...register('zone')}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ประตูเทียบรถ / จุดขนของ (Loading Dock Gate)</label>
                  <input
                    type="text"
                    placeholder="เช่น ประตู 2 ด้านหลังฝั่ง Groove ชั้น B1"
                    {...register('gate_info')}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">จำกัดความสูงรถ (Height Limit)</label>
                    <input
                      type="text"
                      placeholder="เช่น ไม่เกิน 2.10 เมตร"
                      {...register('parking_height_limit')}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">เบอร์โทร รปภ./จุดโหลด</label>
                    <input
                      type="tel"
                      placeholder="02-xxx-xxxx หรือ 081-xxx-xxxx"
                      {...register('dock_contact_phone')}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">พิกัดจุดเทียบของจริง (Google Maps Loading Dock)</label>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/..."
                    {...register('loading_dock_map_link')}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">พิกัดทางเข้าห้างปกติ (Google Maps Front)</label>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/..."
                    {...register('default_map_link')}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ข้อพึงระวัง & เคล็ดลับการส่งของ</label>
                  <textarea
                    rows="3"
                    placeholder="เช่น ต้องแลกบัตร ปชช. ที่ป้อม 3, ห้ามนำรถเข้าช่วง 11.00-13.00 น."
                    {...register('delivery_tips')}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-3 px-5 sm:px-6 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-3 px-7 sm:px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isSaving ? 'กำลังบันทึก...' : (editingVenue ? 'บันทึกการแก้ไข' : 'บันทึกสถานที่')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Hub Location Modal (จุดเริ่มต้นขนส่ง / โกดัง) */}
      {isEditHubModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsEditHubModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Warehouse className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    กำหนดจุดเริ่มต้นขนส่ง (โกดัง / Hub)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    ใส่พิกัดหรือลิงก์ Google Maps เพื่อให้ระบบคำนวณเส้นทางและปักหมุดได้ถูกต้อง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditHubModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveHub} className="overflow-y-auto custom-scrollbar flex-1 flex flex-col">
              <div className="p-5 sm:p-8 space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ชื่อจุดเริ่มต้น / โกดัง / ออฟฟิศ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={hubForm.name}
                    onChange={(e) => setHubForm({ ...hubForm, name: e.target.value })}
                    placeholder="เช่น Flower2U Workshop & Hub (จุดกระจายสินค้า)"
                    className="w-full px-4 py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    คำอธิบายเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    value={hubForm.description}
                    onChange={(e) => setHubForm({ ...hubForm, description: e.target.value })}
                    placeholder="เช่น ศูนย์รวมดอกไม้และเตรียมทีมขนส่งออกหน้างาน"
                    className="w-full px-4 py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      พิกัด (ละติจูด, ลองจิจูด) หรือ ลิงก์ Google Maps <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              const lat = pos.coords.latitude.toFixed(6);
                              const lng = pos.coords.longitude.toFixed(6);
                              setHubForm(prev => ({
                                ...prev,
                                locationInput: `${lat}, ${lng}`,
                                mapLink: `https://maps.google.com/?q=${lat},${lng}`
                              }));
                              showToast('ดึงพิกัดจาก GPS ปัจจุบันสำเร็จ', 'success');
                            },
                            () => showToast('ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณากรอกพิกัดเอง', 'error')
                          );
                        }
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer hover:underline"
                    >
                      📍 ใช้ GPS ปัจจุบัน
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={hubForm.locationInput}
                    onChange={(e) => setHubForm({ ...hubForm, locationInput: e.target.value })}
                    placeholder="เช่น 13.736717, 100.523186 หรือวางลิงก์ Google Maps"
                    className="w-full px-4 py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-2xl text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    รองรับทั้งรูปแบบตัวเลข <code>13.736717, 100.523186</code> หรือก๊อปปี้ URL จาก Google Maps มาวางได้ทันที
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ลิงก์แผนที่ Google Maps (ถ้ามี)
                  </label>
                  <input
                    type="url"
                    value={hubForm.mapLink}
                    onChange={(e) => setHubForm({ ...hubForm, mapLink: e.target.value })}
                    placeholder="https://maps.google.com/?q=..."
                    className="w-full px-4 py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
                  💡 <b>ระบบนำทาง:</b> เมื่อบันทึกแล้ว หมุดจุดเริ่มต้น 🌸 บนแผนที่ และการคำนวณระยะทาง/เวลาขับรถไปยังสถานที่จัดส่งทุกแห่งจะอิงจากพิกัดนี้ทันที
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white sticky bottom-0 z-20 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setHubForm({
                      name: DEFAULT_FLOWER2U_HUB.name,
                      description: DEFAULT_FLOWER2U_HUB.description,
                      locationInput: DEFAULT_FLOWER2U_HUB.coords.join(', '),
                      mapLink: DEFAULT_FLOWER2U_HUB.mapLink
                    });
                  }}
                  className="py-2.5 px-4 rounded-xl text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 font-bold text-xs transition cursor-pointer"
                >
                  คืนค่าเริ่มต้น
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditHubModalOpen(false)}
                    className="py-2.5 px-5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>บันทึกจุดเริ่มต้น</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
}

export default React.memo(Locations);
