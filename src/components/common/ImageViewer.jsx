import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { processImageUrl } from '../../utils/formatters';

const ImageViewer = ({ src, images, initialIndex = 0, title, onClose }) => {
  // Support both array of images and single src, plus object src if passed
  const resolvedImages = useMemo(() => {
    let list = [];
    if (Array.isArray(images) && images.length > 0) {
      list = images;
    } else if (typeof src === 'object' && src !== null) {
      if (Array.isArray(src.images) && src.images.length > 0) {
        list = src.images;
      } else if (src.url || src.src) {
        list = [src.url || src.src];
      }
    } else if (typeof src === 'string' && src) {
      list = [src];
    }
    return list
      .map(item => {
        const raw = typeof item === 'object' && item !== null ? (item.url || item.src) : item;
        return processImageUrl(raw);
      })
      .filter(Boolean);
  }, [images, src]);

  const resolvedInitialIndex = useMemo(() => {
    if (typeof initialIndex === 'number' && initialIndex >= 0) return initialIndex;
    if (typeof src === 'object' && typeof src?.initialIndex === 'number') return src.initialIndex;
    return 0;
  }, [initialIndex, src]);

  const resolvedTitle = useMemo(() => {
    if (title) return title;
    if (typeof src === 'object' && src?.title) return src.title;
    return 'Preview';
  }, [title, src]);

  const total = resolvedImages.length;
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (resolvedInitialIndex >= 0 && resolvedInitialIndex < (total || 1)) {
      return resolvedInitialIndex;
    }
    return 0;
  });

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // Swipe state for scale === 1 (Mobile touch & Desktop mouse drag)
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const mouseStartRef = useRef({ x: 0, y: 0, time: 0 });
  const isMouseDownRef = useRef(false);
  const lastTapRef = useRef(0);
  const containerRef = useRef(null);

  // Sync initialIndex if prop changes
  useEffect(() => {
    if (resolvedInitialIndex >= 0 && resolvedInitialIndex < total) {
      setCurrentIndex(resolvedInitialIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setSwipeOffset(0);
    }
  }, [resolvedInitialIndex, total]);

  // Navigate functions
  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : total - 1));
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setSwipeOffset(0);
  }, [total]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex(prev => (prev < total - 1 ? prev + 1 : 0));
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setSwipeOffset(0);
  }, [total]);

  // Preload neighboring images for smooth instant transitions
  useEffect(() => {
    if (total <= 1) return;
    const nextIdx = (currentIndex + 1) % total;
    const prevIdx = (currentIndex - 1 + total) % total;
    if (resolvedImages[nextIdx]) {
      const imgA = new Image();
      imgA.src = resolvedImages[nextIdx];
    }
    if (resolvedImages[prevIdx]) {
      const imgB = new Image();
      imgB.src = resolvedImages[prevIdx];
    }
  }, [currentIndex, total, resolvedImages]);

  // Wheel zoom
  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();
      setScale(prev => Math.max(1, Math.min(prev + (e.deltaY * -0.01), 5)));
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Keyboard navigation (Arrow keys + Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  // Reset position when scale returns to 1
  useEffect(() => {
    if (scale === 1) setPosition({ x: 0, y: 0 });
  }, [scale]);

  // Double tap to zoom / reset (only on stationary taps)
  const handleDoubleTap = (dx = 0, dy = 0) => {
    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
      lastTapRef.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (scale > 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setScale(2.5);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  // Touch Handlers (Swipe when scale === 1, Pan/Pinch when zoomed)
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setIsSwiping(false);
      setSwipeOffset(0);
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      containerRef.current._initialDistance = dist;
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        setIsDragging(true);
        setStartPos({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y
        });
      } else {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: Date.now()
        };
        setIsSwiping(true);
        setSwipeOffset(0);
      }
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && containerRef.current?._initialDistance) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const factor = dist / containerRef.current._initialDistance;
      setScale(Math.max(1, Math.min(scale * factor, 5)));
      containerRef.current._initialDistance = dist;
    } else if (e.touches.length === 1) {
      if (scale > 1 && isDragging) {
        setPosition({
          x: e.touches[0].clientX - startPos.x,
          y: e.touches[0].clientY - startPos.y
        });
      } else if (scale === 1 && isSwiping && total > 1) {
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          setSwipeOffset(dx);
        }
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (scale > 1) {
      setIsDragging(false);
      if (containerRef.current) containerRef.current._initialDistance = 0;
      handleDoubleTap(0, 0);
    } else if (scale === 1 && isSwiping) {
      const endX = (e?.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : (touchStartRef.current.x + swipeOffset);
      const endY = (e?.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartRef.current.y;
      const dx = endX - touchStartRef.current.x;
      const dy = endY - touchStartRef.current.y;
      const timeDiff = Date.now() - touchStartRef.current.time;
      const isQuickSwipe = Math.abs(dx) > 30 && timeDiff < 450;
      const isFarSwipe = Math.abs(dx) > 50;
      if ((isQuickSwipe || isFarSwipe) && total > 1) {
        if (dx < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      } else if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        handleDoubleTap(dx, dy);
      }
      setIsSwiping(false);
      setSwipeOffset(0);
    }
  };

  // Mouse Handlers (Desktop drag-swipe when scale === 1, pan when scale > 1)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (scale > 1) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    } else {
      isMouseDownRef.current = true;
      mouseStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now()
      };
      setIsSwiping(true);
      setSwipeOffset(0);
    }
  };

  const handleMouseMove = (e) => {
    if (scale > 1 && isDragging) {
      setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
    } else if (scale === 1 && isMouseDownRef.current && isSwiping && total > 1) {
      const dx = e.clientX - mouseStartRef.current.x;
      setSwipeOffset(dx);
    }
  };

  const handleMouseUp = (e) => {
    if (scale > 1) {
      setIsDragging(false);
    } else if (scale === 1 && isMouseDownRef.current) {
      const endX = e?.clientX !== undefined ? e.clientX : (mouseStartRef.current.x + swipeOffset);
      const dx = endX - mouseStartRef.current.x;
      const timeDiff = Date.now() - mouseStartRef.current.time;
      const isQuickSwipe = Math.abs(dx) > 30 && timeDiff < 450;
      const isFarSwipe = Math.abs(dx) > 50;
      if ((isQuickSwipe || isFarSwipe) && total > 1) {
        if (dx < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
      isMouseDownRef.current = false;
      setIsSwiping(false);
      setSwipeOffset(0);
    }
  };

  const currentImageSrc = resolvedImages[currentIndex] || '';
  const isSlip = resolvedTitle.toLowerCase().includes('สลิป') || resolvedTitle.toLowerCase().includes('หลักฐาน');

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 select-none flex flex-col animate-in fade-in duration-200">
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="text-white text-sm font-bold flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isSlip ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
            {isSlip ? <Receipt className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
          </div>
          <span className="truncate max-w-[140px] sm:max-w-xs md:max-w-md">{resolvedTitle}</span>
          {total > 1 && (
            <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-mono font-bold tracking-wider border border-white/20 backdrop-blur-xs">
              {currentIndex + 1}/{total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex gap-1 bg-white/10 rounded-full p-1 backdrop-blur-md border border-white/10">
            <button 
              type="button"
              onClick={() => setScale(Math.max(1, scale - 0.5))}
              className="p-1.5 sm:p-2 text-white hover:bg-white/20 rounded-full transition cursor-pointer"
              title="ย่อขนาด"
            >
              <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button 
              type="button"
              onClick={() => setScale(Math.min(5, scale + 0.5))}
              className="p-1.5 sm:p-2 text-white hover:bg-white/20 rounded-full transition cursor-pointer"
              title="ขยายขนาด"
            >
              <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition border border-white/10 cursor-pointer"
            title="ปิดหน้าต่าง (Esc)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Area with Swipe / Drag & Zoom */}
      <div 
        ref={containerRef}
        className={`flex-1 flex items-center justify-center overflow-hidden touch-none relative ${
          scale > 1 ? 'cursor-move' : total > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {currentImageSrc ? (
          <img 
            key={currentIndex}
            src={currentImageSrc} 
            alt={`Preview ${currentIndex + 1}`}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://placehold.co/600x800?text=Image+Load+Error";
            }}
            style={{ 
              transform: scale > 1 
                ? `translate(${position.x}px, ${position.y}px) scale(${scale})`
                : `translate(${swipeOffset}px, 0px) scale(1)`,
              opacity: isSwiping && Math.abs(swipeOffset) > 20 
                ? Math.max(0.65, 1 - Math.abs(swipeOffset) / 800) 
                : 1,
              transition: isDragging || isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease',
              maxWidth: '92%',
              maxHeight: '85vh',
              objectFit: 'contain'
            }}
            draggable={false}
          />
        ) : (
          <div className="text-white/60 text-sm italic">ไม่มีรูปภาพ</div>
        )}

        {/* Left & Right Navigation Chevron Buttons */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2.5 sm:left-6 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3.5 rounded-full bg-black/40 hover:bg-black/75 active:scale-90 text-white backdrop-blur-md border border-white/15 shadow-2xl transition-all group cursor-pointer"
              title="รูปก่อนหน้า (ลูกศรซ้าย)"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2.5 sm:right-6 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3.5 rounded-full bg-black/40 hover:bg-black/75 active:scale-90 text-white backdrop-blur-md border border-white/15 shadow-2xl transition-all group cursor-pointer"
              title="รูปถัดไป (ลูกศรขวา)"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ImageViewer;
