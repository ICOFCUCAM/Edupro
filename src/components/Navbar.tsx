import React, { useState } from 'react';
import { LANGUAGES } from '@/lib/constants';
import { Globe, Menu, X, BookOpen, ChevronDown, User, LogOut, Download, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { SyncStatus } from '../workers/offlineSyncWorker';

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
  isLoggedIn: boolean;
  setShowAuth: (show: boolean) => void;
  setAuthMode: (mode: 'login' | 'signup') => void;
  onLogout: () => void;
  userName?: string;
  // Offline mode
  isOnline?: boolean;
  syncStatus?: SyncStatus;
  pendingCount?: number;
  onSyncClick?: () => void;
  showInstallButton?: boolean;
  onInstallClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  currentPage, setCurrentPage, language, setLanguage,
  isLoggedIn, setShowAuth, setAuthMode, onLogout, userName,
  isOnline = true, syncStatus = 'idle', pendingCount = 0,
  onSyncClick, showInstallButton = false, onInstallClick,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'lesson-generator', label: 'Lesson Notes' },
    { id: 'content-library', label: 'Content Library' },
    { id: 'exam-bank', label: 'Exam Bank' },
    { id: 'knowledge-base', label: 'Knowledge Base' },
    { id: 'website-builder', label: 'Website Builder' },
    { id: 'pricing', label: 'Pricing' },
    ...(isLoggedIn ? [{ id: 'dashboard', label: 'Dashboard' }] : []),
  ];


  const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage('home')}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">EduPro</span>
              <span className="hidden sm:block text-[10px] text-gray-400 -mt-1 leading-none">Africa's Teaching Platform</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === item.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">

            {/* Connection status badge */}
            <button
              onClick={onSyncClick}
              title={!isOnline ? 'Offline Mode Active' : syncStatus === 'syncing' ? 'Syncing...' : 'Online'}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                !isOnline
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : syncStatus === 'syncing' || syncStatus === 'error'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                !isOnline ? 'bg-blue-500 animate-pulse'
                : syncStatus === 'syncing' ? 'bg-yellow-500 animate-pulse'
                : 'bg-emerald-500'
              }`} />
              {!isOnline
                ? <><WifiOff className="w-3 h-3" /> Offline</>
                : syncStatus === 'syncing'
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> Syncing</>
                  : <><Wifi className="w-3 h-3" /> Online</>
              }
              {pendingCount > 0 && (
                <span className="bg-orange-500 text-white rounded-full text-[10px] px-1 leading-4">{pendingCount}</span>
              )}
            </button>

            {/* PWA Install button */}
            {showInstallButton && (
              <button
                onClick={onInstallClick}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-all"
                title="Install EduPro on your device"
              >
                <Download className="w-3.5 h-3.5" /> Install App
              </button>
            )}

            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => { setLangOpen(!langOpen); setUserMenuOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
              >
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="hidden sm:inline">{selectedLang.name}</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 max-h-80 overflow-y-auto z-50">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 ${
                        language === lang.code ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auth */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => { setUserMenuOpen(!userMenuOpen); setLangOpen(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-medium"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{userName || 'Teacher'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                    <button onClick={() => { setCurrentPage('dashboard'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Dashboard</button>
                    <button onClick={() => { setCurrentPage('my-lessons'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">My Lessons</button>
                    <button onClick={() => { setCurrentPage('settings'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Settings</button>
                    <hr className="my-1" />
                    <button onClick={() => { onLogout(); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAuth(true); setAuthMode('login'); }}
                  className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setShowAuth(true); setAuthMode('signup'); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg hover:shadow-lg hover:shadow-blue-200 transition-all"
                >
                  Get Started
                </button>
              </div>
            )}

            {/* Mobile menu */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 py-3 px-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setCurrentPage(item.id); setMobileOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                currentPage === item.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
          {/* Mobile connection status + install */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between px-1">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${!isOnline ? 'text-blue-600' : 'text-emerald-600'}`}>
              <span className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
              {!isOnline ? 'Offline Mode' : syncStatus === 'syncing' ? 'Syncing...' : 'Online'}
              {pendingCount > 0 && <span className="bg-orange-500 text-white rounded-full text-[10px] px-1">{pendingCount}</span>}
            </span>
            {showInstallButton && (
              <button onClick={() => { onInstallClick?.(); setMobileOpen(false); }}
                className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                <Download className="w-3.5 h-3.5" /> Install App
              </button>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(langOpen || userMenuOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setLangOpen(false); setUserMenuOpen(false); }} />
      )}
    </nav>
  );
};

export default Navbar;
