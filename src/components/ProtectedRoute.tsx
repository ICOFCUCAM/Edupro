import React from 'react';
import { Lock, LogIn, UserPlus, ArrowRight } from 'lucide-react';

interface ProtectedRouteProps {
  isLoggedIn: boolean;
  children: React.ReactNode;
  featureName: string;
  onSignIn: () => void;
  onSignUp: () => void;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ isLoggedIn, children, featureName, onSignIn, onSignUp }) => {
  if (isLoggedIn) return <>{children}</>;

  return (
    <div className="min-h-[80vh] bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          {/* Lock icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-blue-600" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            You need to be signed in to access the <strong className="text-gray-700">{featureName}</strong>. 
            Create a free account to get started with 3 free lesson notes.
          </p>

          <div className="space-y-3">
            <button
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-200 transition-all"
            >
              <LogIn className="w-5 h-5" />
              Sign In to Continue
            </button>
            <button
              onClick={onSignUp}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:border-blue-300 hover:bg-blue-50 transition-all"
            >
              <UserPlus className="w-5 h-5" />
              Create Free Account
            </button>
          </div>

          {/* Benefits */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Free account includes</p>
            <div className="grid grid-cols-2 gap-2 text-left">
              {[
                '3 Lesson Notes/month',
                'Basic content library',
                'PDF export',
                'Community support',
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <ArrowRight className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtectedRoute;
