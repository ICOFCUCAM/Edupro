import React, { useState } from 'react';
import { X, Mail, Lock, User, Building, Globe2, CreditCard, Smartphone, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle, Key } from 'lucide-react';

import { REGIONS, COUNTRIES_WITH_LEVELS } from '@/lib/constants';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'signup' | 'reset';
  setMode: (mode: 'login' | 'signup' | 'reset') => void;
  onSignIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onSignUp: (email: string, password: string, fullName: string, schoolName: string, country: string, region: string) => Promise<{ success: boolean; needsConfirmation?: boolean; error?: string }>;
  onResetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, mode, setMode, onSignIn, onSignUp, onResetPassword }) => {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '', fullName: '', schoolName: '',
    country: 'Nigeria', region: 'West Africa', paymentMethod: 'card'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const allCountries = REGIONS.flatMap(r => r.countries.map(c => ({ country: c, region: r.name })));

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'country') {
        const found = allCountries.find(c => c.country === value);
        if (found) updated.region = found.region;
      }
      return updated;
    });
    setError('');
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(formData.email)) { setError('Please enter a valid email address'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    setError('');
    const result = await onSignIn(formData.email, formData.password);
    setLoading(false);

    if (result.success) {
      onClose();
      setFormData({ email: '', password: '', confirmPassword: '', fullName: '', schoolName: '', country: 'Nigeria', region: 'West Africa', paymentMethod: 'card' });
    } else {
      setError(result.error || 'Sign in failed. Please check your credentials.');
    }
  };

  const handleSignupStep1 = () => {
    if (!formData.fullName.trim()) { setError('Please enter your full name'); return; }
    if (!validateEmail(formData.email)) { setError('Please enter a valid email address'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setStep(2);
  };

  const handleSignupSubmit = async () => {
    setLoading(true);
    setError('');
    const result = await onSignUp(
      formData.email, formData.password, formData.fullName,
      formData.schoolName, formData.country, formData.region
    );
    setLoading(false);

    if (result.success) {
      if (result.needsConfirmation) {
        setSuccessMessage('Account created! Please check your email to confirm your account, then sign in.');
        setStep(4); // confirmation step
      } else {
        onClose();
        setFormData({ email: '', password: '', confirmPassword: '', fullName: '', schoolName: '', country: 'Nigeria', region: 'West Africa', paymentMethod: 'card' });
      }
    } else {
      setError(result.error || 'Signup failed. Please try again.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(formData.email)) { setError('Please enter a valid email address'); return; }

    setLoading(true);
    setError('');
    const result = await onResetPassword(formData.email);
    setLoading(false);

    if (result.success) {
      setSuccessMessage('Password reset link sent! Check your email inbox.');
    } else {
      setError(result.error || 'Failed to send reset link.');
    }
  };

  const resetState = () => {
    setStep(1);
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 z-10">
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {mode === 'reset' ? (
                <Key className="w-7 h-7 text-white" />
              ) : (

                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'reset' ? 'Reset Password' :
               mode === 'login' ? 'Welcome Back' :
               step === 1 ? 'Create Account' :
               step === 2 ? 'School Details' :
               step === 3 ? 'Payment Setup' :
               'Check Your Email'}
            </h2>
            <p className="text-gray-500 mt-1 text-sm">
              {mode === 'reset' ? 'Enter your email to receive a reset link' :
               mode === 'login' ? 'Sign in to your EduPro account' :
               step === 4 ? '' : `Step ${step} of 3`}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ==================== PASSWORD RESET ==================== */}
          {mode === 'reset' && !successMessage && (
            <form onSubmit={handleResetPassword}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" required value={formData.email} onChange={e => handleChange('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="teacher@school.edu" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}

          {mode === 'reset' && successMessage && (
            <button onClick={() => { setMode('login'); resetState(); }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">
              Back to Sign In
            </button>
          )}

          {/* ==================== LOGIN ==================== */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" required value={formData.email} onChange={e => handleChange('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="teacher@school.edu" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button type="button" onClick={() => { setMode('reset'); resetState(); }}
                      className="text-xs text-blue-600 hover:underline font-medium">Forgot password?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={e => handleChange('password', e.target.value)}
                      className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      placeholder="Enter your password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          )}

          {/* ==================== SIGNUP ==================== */}
          {mode === 'signup' && (
            <>
              {/* Step 1: Account details */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={formData.fullName} onChange={e => handleChange('fullName', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        placeholder="Your full name" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        placeholder="teacher@school.edu" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => handleChange('password', e.target.value)}
                        className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        placeholder="Min. 6 characters" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="password" value={formData.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        placeholder="Re-enter password" />
                    </div>
                  </div>
                  <button type="button" onClick={handleSignupStep1}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">
                    Continue
                  </button>
                </div>
              )}

              {/* Step 2: School details */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={formData.schoolName} onChange={e => handleChange('schoolName', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        placeholder="Your school name (optional)" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <div className="relative">
                      <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select value={formData.country} onChange={e => handleChange('country', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm appearance-none bg-white">
                        {REGIONS.map(region => (
                          <optgroup key={region.id} label={region.name}>
                            {region.countries.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                    <strong>Region:</strong> {formData.region} | <strong>Curriculum:</strong> {COUNTRIES_WITH_LEVELS[formData.country]?.curriculum || 'National Curriculum'}
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setStep(1); setError(''); }}
                      className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-1">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={() => { setError(''); setStep(3); }}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Payment preference */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Choose your preferred payment method. Start with a free trial!</p>
                  <div className="space-y-3">
                    <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.paymentMethod === 'card' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="payment" value="card" checked={formData.paymentMethod === 'card'} onChange={() => handleChange('paymentMethod', 'card')} className="sr-only" />
                      <CreditCard className={`w-5 h-5 ${formData.paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="font-medium text-sm">Credit/Debit Card</div>
                        <div className="text-xs text-gray-500">Visa, Mastercard, Verve</div>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.paymentMethod === 'mobile' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="payment" value="mobile" checked={formData.paymentMethod === 'mobile'} onChange={() => handleChange('paymentMethod', 'mobile')} className="sr-only" />
                      <Smartphone className={`w-5 h-5 ${formData.paymentMethod === 'mobile' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="font-medium text-sm">Mobile Money</div>
                        <div className="text-xs text-gray-500">M-Pesa, MTN MoMo, Airtel Money, Orange Money</div>
                      </div>
                    </label>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-sm text-emerald-700">
                    <strong>Free Trial:</strong> Start with 3 free lesson notes. Upgrade anytime!
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setStep(2); setError(''); }}
                      className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-1">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleSignupSubmit} disabled={loading}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50">
                      {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Email confirmation */}
              {step === 4 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="text-sm text-gray-600">We've sent a confirmation link to <strong>{formData.email}</strong>. Please check your inbox and confirm your email to activate your account.</p>
                  <button onClick={() => { setMode('login'); resetState(); }}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-medium hover:shadow-lg transition-all">
                    Go to Sign In
                  </button>
                </div>
              )}
            </>
          )}

          {/* Toggle between modes */}
          {mode !== 'reset' && step !== 4 && (
            <div className="mt-6 text-center text-sm text-gray-500">
              {mode === 'login' ? (
                <>Don't have an account? <button onClick={() => { setMode('signup'); resetState(); }} className="text-blue-600 font-medium hover:underline">Sign Up</button></>
              ) : (
                <>Already have an account? <button onClick={() => { setMode('login'); resetState(); }} className="text-blue-600 font-medium hover:underline">Sign In</button></>
              )}
            </div>
          )}

          {mode === 'reset' && !successMessage && (
            <div className="mt-6 text-center text-sm text-gray-500">
              <button onClick={() => { setMode('login'); resetState(); }} className="text-blue-600 font-medium hover:underline flex items-center gap-1 mx-auto">
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
