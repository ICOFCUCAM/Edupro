import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface TeacherProfile {
  id: string;
  auth_id: string;
  email: string;
  full_name: string;
  school_name: string;
  country: string;
  region: string;
  preferred_language: string;
  subscription_plan: string;
  subscription_status: string;
  lesson_count: number;
  last_login: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: any | null;
  profile: TeacherProfile | null;
  session: any | null;
  loading: boolean;
  initialized: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    initialized: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch teacher profile by auth_id
  const fetchProfile = useCallback(async (authId: string): Promise<TeacherProfile | null> => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('teachers')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();

      if (fetchErr) {
        console.error('Profile fetch error:', fetchErr);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  }, []);

  // Create teacher profile after signup
  const createProfile = useCallback(async (authId: string, email: string, fullName: string, schoolName: string, country: string, region: string): Promise<TeacherProfile | null> => {
    try {
      const { data, error: insertErr } = await supabase
        .from('teachers')
        .insert({
          auth_id: authId,
          email,
          full_name: fullName,
          school_name: schoolName || '',
          country: country || 'Nigeria',
          region: region || 'West Africa',
          subscription_plan: 'free',
          subscription_status: 'active',
          lesson_count: 0,
          last_login: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) {
        console.error('Profile create error:', insertErr);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Profile create exception:', err);
      return null;
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          const profile = await fetchProfile(session.user.id);
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false,
            initialized: true,
          });
        } else if (mounted) {
          setAuthState(prev => ({ ...prev, loading: false, initialized: true }));
        }
      } catch (err) {
        console.error('Auth init error:', err);
        if (mounted) {
          setAuthState(prev => ({ ...prev, loading: false, initialized: true }));
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setAuthState({
          user: session.user,
          profile,
          session,
          loading: false,
          initialized: true,
        });
      } else if (event === 'SIGNED_OUT') {
        setAuthState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          initialized: true,
        });
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setAuthState(prev => ({ ...prev, session, user: session.user }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign up with email/password
  const signUp = async (email: string, password: string, fullName: string, schoolName: string, country: string, region: string) => {
    setError(null);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, school_name: schoolName, country, region },
        },
      });

      if (signUpErr) {
        setError(signUpErr.message);
        return { success: false, error: signUpErr.message };
      }

      if (data.user) {
        // Create teacher profile
        const profile = await createProfile(data.user.id, email, fullName, schoolName, country, region);

        if (data.session) {
          setAuthState({
            user: data.user,
            profile,
            session: data.session,
            loading: false,
            initialized: true,
          });
          return { success: true, needsConfirmation: false };
        } else {
          // Email confirmation required
          return { success: true, needsConfirmation: true };
        }
      }

      return { success: false, error: 'Unknown error during signup' };
    } catch (err: any) {
      const msg = err.message || 'Signup failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        setError(signInErr.message);
        return { success: false, error: signInErr.message };
      }

      if (data.user) {
        const profile = await fetchProfile(data.user.id);

        // Update last_login
        if (profile) {
          await supabase
            .from('teachers')
            .update({ last_login: new Date().toISOString() })
            .eq('id', profile.id);
        }

        setAuthState({
          user: data.user,
          profile,
          session: data.session,
          loading: false,
          initialized: true,
        });

        return { success: true };
      }

      return { success: false, error: 'Unknown error during sign in' };
    } catch (err: any) {
      const msg = err.message || 'Sign in failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false,
        initialized: true,
      });
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    setError(null);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (resetErr) {
        setError(resetErr.message);
        return { success: false, error: resetErr.message };
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Password reset failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<TeacherProfile>) => {
    if (!authState.profile) return { success: false, error: 'No profile found' };

    try {
      const { data, error: updateErr } = await supabase
        .from('teachers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', authState.profile.id)
        .select()
        .single();

      if (updateErr) return { success: false, error: updateErr.message };

      setAuthState(prev => ({ ...prev, profile: data }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Increment lesson count
  const incrementLessonCount = async () => {
    if (!authState.profile) return;
    const newCount = (authState.profile.lesson_count || 0) + 1;
    await supabase
      .from('teachers')
      .update({ lesson_count: newCount })
      .eq('id', authState.profile.id);

    setAuthState(prev => ({
      ...prev,
      profile: prev.profile ? { ...prev.profile, lesson_count: newCount } : null,
    }));
  };

  return {
    ...authState,
    error,
    isLoggedIn: !!authState.user && !!authState.session,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    fetchProfile,
    incrementLessonCount,
    clearError: () => setError(null),
  };
}
