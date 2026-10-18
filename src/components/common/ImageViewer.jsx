import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, ZoomIn, ZoomOut, X } from 'lucide-react';

const ImageViewer = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();
      const newScale = Math.max(1, Math.min(scale + (e.deltaY * -0.01), 5));
      setScale(newScale);
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) container.removeEventListener('wheel', handleWheel);
    };
  }, [scale]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      containerRef.current._initialDistance = dist;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setStartPos({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
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
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - startPos.x,
        y: e.touches[0].clientY - startPos.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (containerRef.current) containerRef.current._initialDistance = 0;
  };

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (scale === 1) setPosition({ x: 0, y: 0 });
  }, [scale]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col animate-in fade-in duration-300">
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/50 to-transparent">
        <div className="text-white/80 text-sm font-bold flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          Preview
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-white/10 rounded-full p-1 backdrop-blur-md">
            <button 
              onClick={() => setScale(Math.max(1, scale - 0.5))}
              className="p-2 text-white hover:bg-white/20 rounded-full transition"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setScale(Math.min(5, scale + 0.5))}
              className="p-2 text-white hover:bg-white/20 rounded-full transition"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden cursor-move touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          src={src} 
          alt="Full Preview"
          referrerPolicy="no-referrer"
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
          draggable={false}
        />
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs font-medium pointer-events-none bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
        {scale === 1 ? 'Pinch or Scroll to Zoom' : `${Math.round(scale * 100)}%`}
      </div>
    </div>,
    document.body
  );
};

export default ImageViewer;
