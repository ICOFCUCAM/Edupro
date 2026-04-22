import React from 'react';
import { HERO_IMAGE, STUDENT_IMAGES, TEACHER_IMAGES } from '@/lib/constants';
import { ArrowRight, Play, BookOpen, Users, Globe2, Award } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onNavigate: (page: string) => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted, onNavigate }) => {
  const stats = [
    { icon: Globe2, value: '40+', label: 'African Countries' },
    { icon: BookOpen, value: '10K+', label: 'Lesson Notes' },
    { icon: Users, value: '5K+', label: 'Teachers' },
    { icon: Award, value: '18+', label: 'Languages' },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-800" />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${HERO_IMAGE})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 via-blue-900/50 to-transparent" />

      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-emerald-300 text-sm font-medium mb-6 border border-white/10">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              AI-Powered Education Platform for Africa
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Transform Teaching
              <span className="block bg-gradient-to-r from-emerald-300 to-blue-300 bg-clip-text text-transparent">
                Across Africa
              </span>
            </h1>
            <p className="text-lg text-blue-100/80 mb-8 max-w-lg leading-relaxed">
              Generate curriculum-aligned lesson notes for 40+ African countries. AI-powered, multi-language, and formatted to your country's education standards.
            </p>
            <div className="flex flex-wrap gap-4 mb-12">
              <button
                onClick={onGetStarted}
                className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-emerald-500/30 transition-all text-lg"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onNavigate('content-library')}
                className="group flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20 text-lg"
              >
                <Play className="w-5 h-5" />
                Watch Demo
              </button>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {TEACHER_IMAGES.map((img, i) => (
                  <img key={i} src={img} alt="" className="w-10 h-10 rounded-full border-2 border-blue-900 object-cover" />
                ))}
              </div>
              <div className="text-sm text-blue-200">
                <span className="font-semibold text-white">5,000+</span> teachers already using EduPro
              </div>
            </div>
          </div>

          {/* Right - Feature Preview */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Main card */}
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-white/50 text-xs ml-2">EduPro Lesson Generator</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-emerald-300 text-xs font-medium mb-1">COUNTRY</div>
                    <div className="text-white font-medium">Nigeria - NERDC Curriculum</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-emerald-300 text-xs font-medium mb-1">SUBJECT & TOPIC</div>
                    <div className="text-white font-medium">Mathematics - Addition & Subtraction</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-emerald-300 text-xs font-medium mb-1">CLASS</div>
                    <div className="text-white font-medium">Primary 3</div>
                  </div>
                  <div className="bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl p-4 text-center">
                    <div className="text-white font-semibold flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Generating Lesson Note...
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-xs font-medium text-gray-700">PDF Ready!</span>
              </div>

              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Globe2 className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-700">18+ Languages</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10 text-center hover:bg-white/15 transition-all">
              <stat.icon className="w-6 h-6 text-emerald-300 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-blue-200">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
