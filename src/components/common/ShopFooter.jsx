import React from 'react';
import { Phone, Mail, Facebook, Instagram, Music2 } from 'lucide-react';
import { StoreIcon, LineIcon, XIcon, WeChatIcon, TelegramIcon } from '../icons/SocialIcons';
import { formatPhoneNumber, processImageUrl } from '../../utils/formatters';

const ShopFooter = ({ shopInfo, maxWidthClass = "max-w-7xl" }) => {
  if (!shopInfo) return null;

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto pb-safe w-full">
      <div className={`${maxWidthClass} mx-auto px-4 w-full h-auto md:h-[100px] flex flex-col md:flex-row items-center justify-between gap-4 py-4 md:py-0`}>
        {/* Left: Brand (Logo + Name) & Address */}
        <div className="flex items-start gap-3 w-full md:w-auto justify-center md:justify-start">
          <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center relative self-start mt-0.5">
            {shopInfo.logo ? (
              <img 
                src={processImageUrl(shopInfo.logo)} 
                alt="Shop Logo" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
              />
            ) : null}
            
            <div className={`w-full h-full bg-slate-100 text-slate-400 flex items-center justify-center ${shopInfo.logo ? 'hidden' : 'flex'}`}>
              <StoreIcon className="w-6 h-6" />
            </div>
          </div>

          <div className="flex flex-col text-left">
            <span className="text-sm font-bold text-slate-800 leading-tight">{shopInfo.shopName || 'ร้านค้า'}</span>
            {shopInfo.address && (
              <p className="text-xs font-medium text-slate-500 leading-snug mt-1 max-w-[280px] md:max-w-[400px] whitespace-pre-wrap">
                {shopInfo.address}
              </p>
            )}
          </div>
        </div>
        
        {/* Right: Contact Info & Socials */}
        <div className="flex flex-col items-center md:items-end gap-3 md:gap-2 w-full md:w-auto">
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-4 gap-y-1 text-xs font-medium text-slate-500 w-full md:w-auto">
            {shopInfo.phone && (
              <a href={`tel:${shopInfo.phone}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors whitespace-nowrap">
                <Phone className="w-3.5 h-3.5" /> 
                {formatPhoneNumber(shopInfo.phone)}
              </a>
            )}
            {shopInfo.email && (
              <a href={`mailto:${shopInfo.email}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors break-all">
                <Mail className="w-3.5 h-3.5 shrink-0" /> 
                {shopInfo.email}
              </a>
            )}
          </div>

          <div className="flex items-center gap-3">
            {shopInfo.line && (
              <a href={shopInfo.line} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#06C755] transition-all hover:scale-110">
                <LineIcon className="w-5 h-5" />
              </a>
            )}
            {shopInfo.facebook && (
              <a href={shopInfo.facebook} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#1877F2] transition-all hover:scale-110">
                <Facebook className="w-5 h-5 fill-current" />
              </a>
            )}
            {shopInfo.instagram && (
              <a href={shopInfo.instagram} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#C13584] transition-all hover:scale-110">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {shopInfo.tiktok && (
              <a href={shopInfo.tiktok} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-black transition-all hover:scale-110">
                <Music2 className="w-5 h-5" />
              </a>
            )}
            {shopInfo.twitter && (
              <a href={shopInfo.twitter} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-black transition-all hover:scale-110">
                <XIcon className="w-4 h-4" />
              </a>
            )}
            {shopInfo.wechat && (
              <a href={shopInfo.wechat} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#07C160] transition-all hover:scale-110">
                <WeChatIcon className="w-5 h-5" />
              </a>
            )}
            {shopInfo.telegram && (
              <a href={shopInfo.telegram} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#0088cc] transition-all hover:scale-110">
                <TelegramIcon className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default ShopFooter;
