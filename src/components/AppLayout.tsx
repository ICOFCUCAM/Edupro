import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import Navbar from './Navbar';
import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import LessonGenerator from './LessonGenerator';
import ContentLibrary from './ContentLibrary';
import ExamBank from './ExamBank';
import KnowledgeBase from './KnowledgeBase';
import WebsiteBuilder from './WebsiteBuilder';
import PricingSection from './PricingSection';
import AuthModal from './AuthModal';
import Footer from './Footer';
import ProtectedRoute from './ProtectedRoute';
import UserDashboard from './UserDashboard';

// Pages that require authentication
const PROTECTED_PAGES: Record<string, string> = {
  'lesson-generator': 'Lesson Note Generator',
  'exam-bank': 'Exam Bank',
  'website-builder': 'Website Builder',
  'knowledge-base': 'Knowledge Base',
  'dashboard': 'Dashboard',
  'my-lessons': 'My Lessons',
  'settings': 'Settings',
};

const AppLayout: React.FC = () => {
  const {
    user, profile, session, loading: authLoading, initialized,
    isLoggedIn, error: authError,
    signUp, signIn, signOut, resetPassword, updateProfile, incrementLessonCount,
    clearError,
  } = useAuth();

  const [currentPage, setCurrentPage] = useState('home');
  const [language, setLanguage] = useState('en');
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [showInstallButton, setShowInstallButton] = useState(false);
  const installPromptRef = useRef<any>(null);

  const { isOnline, syncStatus, pendingCount, lastSyncTime, triggerSync } = useOfflineMode({
    country: profile?.country || 'Nigeria',
    autoStart: isLoggedIn,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e;
      setShowInstallButton(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptRef.current) return;
    installPromptRef.current.prompt();
    const { outcome } = await installPromptRef.current.userChoice;
    if (outcome === 'accepted') setShowInstallButton(false);
    installPromptRef.current = null;
  };

  // Close auth modal on successful login
  useEffect(() => {
    if (isLoggedIn && showAuth) {
      setShowAuth(false);
    }
  }, [isLoggedIn]);

  const handleLogout = async () => {
    await signOut();
    setCurrentPage('home');
  };

  const handleGetStarted = () => {
    if (isLoggedIn) {
      setCurrentPage('lesson-generator');
    } else {
      setShowAuth(true);
      setAuthMode('signup');
    }
  };

  const handleSelectPlan = (planId: string) => {
    if (!isLoggedIn) {
      setShowAuth(true);
      setAuthMode('signup');
    } else {
      // TODO: integrate payment
      alert(`You selected the ${planId} plan! Payment integration coming soon.`);
    }
  };

  const openSignIn = () => { setShowAuth(true); setAuthMode('login'); clearError(); };
  const openSignUp = () => { setShowAuth(true); setAuthMode('signup'); clearError(); };

  const handleSignIn = async (email: string, password: string) => {
    return await signIn(email, password);
  };

  const handleSignUp = async (email: string, password: string, fullName: string, schoolName: string, country: string, region: string) => {
    return await signUp(email, password, fullName, schoolName, country, region);
  };

  const handleResetPassword = async (email: string) => {
    return await resetPassword(email);
  };

  const handleLessonSaved = () => {
    incrementLessonCount();
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Show loading spinner while auth initializes
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Loading EduPro...</p>
        </div>
      </div>
    );
  }

  const isProtectedPage = currentPage in PROTECTED_PAGES;
  const needsAuth = isProtectedPage && !isLoggedIn;

  const renderPage = () => {
    // Protected pages - show login prompt if not authenticated
    if (needsAuth) {
      return (
        <ProtectedRoute
          isLoggedIn={isLoggedIn}
          featureName={PROTECTED_PAGES[currentPage]}
          onSignIn={openSignIn}
          onSignUp={openSignUp}
        >
          <div />
        </ProtectedRoute>
      );
    }

    switch (currentPage) {
      case 'home':
        return (
          <>
            <HeroSection onGetStarted={handleGetStarted} onNavigate={handleNavigate} />
            <FeaturesSection onNavigate={handleNavigate} />
          </>
        );

      case 'lesson-generator':
        return (
          <LessonGenerator
            teacherId={profile?.id}
            onLessonSaved={handleLessonSaved}
            isOnline={isOnline}
          />
        );

      case 'content-library':
        return <ContentLibrary />;

      case 'exam-bank':
        return <ExamBank />;

      case 'knowledge-base':
        return <KnowledgeBase />;

      case 'website-builder':
        return <WebsiteBuilder />;

      case 'pricing':
        return <PricingSection onSelectPlan={handleSelectPlan} />;

      case 'dashboard':
        return (
          <UserDashboard profile={profile} onNavigate={handleNavigate} onUpdateProfile={updateProfile} initialTab="overview"
            isOnline={isOnline} syncStatus={syncStatus} pendingCount={pendingCount} lastSyncTime={lastSyncTime} onSyncClick={triggerSync} />
        );
      case 'my-lessons':
        return (
          <UserDashboard profile={profile} onNavigate={handleNavigate} onUpdateProfile={updateProfile} initialTab="lessons"
            isOnline={isOnline} syncStatus={syncStatus} pendingCount={pendingCount} lastSyncTime={lastSyncTime} onSyncClick={triggerSync} />
        );
      case 'settings':
        return (
          <UserDashboard profile={profile} onNavigate={handleNavigate} onUpdateProfile={updateProfile} initialTab="settings"
            isOnline={isOnline} syncStatus={syncStatus} pendingCount={pendingCount} lastSyncTime={lastSyncTime} onSyncClick={triggerSync} />
        );


      default:
        return (
          <>
            <HeroSection onGetStarted={handleGetStarted} onNavigate={handleNavigate} />
            <FeaturesSection onNavigate={handleNavigate} />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        currentPage={currentPage}
        setCurrentPage={handleNavigate}
        language={language}
        setLanguage={setLanguage}
        isLoggedIn={isLoggedIn}
        setShowAuth={setShowAuth}
        setAuthMode={(mode: 'login' | 'signup') => { setAuthMode(mode); clearError(); }}
        onLogout={handleLogout}
        userName={profile?.full_name || user?.email?.split('@')[0] || ''}
        isOnline={isOnline}
        syncStatus={syncStatus}
        pendingCount={pendingCount}
        onSyncClick={triggerSync}
        showInstallButton={showInstallButton}
        onInstallClick={handleInstallClick}
      />

      <main>
        {renderPage()}
      </main>

      <Footer onNavigate={handleNavigate} />

      <AuthModal
        isOpen={showAuth}
        onClose={() => { setShowAuth(false); clearError(); }}
        mode={authMode}
        setMode={(m) => { setAuthMode(m); clearError(); }}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onResetPassword={handleResetPassword}
      />
    </div>
  );
};

export default AppLayout;
