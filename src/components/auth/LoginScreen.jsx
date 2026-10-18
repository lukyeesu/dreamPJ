import React, { useState } from 'react';
import { Clipboard, User, Lock, Eye, EyeOff, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { processImageUrl } from '../../utils/formatters';

export const LoginScreen = ({ onLogin, isLoading, loginError, shopInfo }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password, rememberMe);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          {/* Logo Display Logic */}
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-4 rotate-3 hover:rotate-6 transition-transform overflow-hidden relative ${shopInfo?.logo ? 'bg-transparent' : 'bg-indigo-600'}`}>
            {shopInfo?.logo ? (
              <img 
                src={processImageUrl(shopInfo.logo)} 
                alt="App Logo" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer"
                onError={(e) => { 
                  e.target.style.display = 'none'; 
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  e.target.parentElement.classList.add('bg-indigo-600');
                }}
              />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center ${shopInfo?.logo ? 'hidden' : 'flex'}`}>
              <Clipboard className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight text-center leading-tight">
            {shopInfo?.shopName || 'ProjectPlan'}
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">เข้าสู่ระบบเพื่อจัดการแผนงาน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">ชื่อผู้ใช้งาน</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={username}
                disabled={isLoading}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                placeholder="Username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">รหัสผ่าน</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                disabled={isLoading}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-1">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="remember" className="text-sm font-bold text-slate-600 cursor-pointer select-none">
              จดจำการเข้าสู่ระบบ
            </label>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  เข้าสู่ระบบ
                </>
              )}
            </button>
            
            {loginError && (
              <div className="bg-rose-50 text-rose-600 text-xs font-bold p-3 rounded-xl border border-rose-100 flex items-center gap-2 animate-in slide-in-from-top-1 fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {loginError}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
