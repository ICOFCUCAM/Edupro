import React, { useState } from 'react';
import { BookOpen, Mail, MapPin, Phone, Send, ArrowRight } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <footer className="bg-gray-900 text-white">
      {/* Newsletter */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-gradient-to-r from-blue-600/20 to-emerald-600/20 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">Stay Updated with EduPro</h3>
              <p className="text-gray-400">Get the latest curriculum updates, teaching tips, and new features.</p>
            </div>
            <form onSubmit={handleSubscribe} className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter your email"
                />
              </div>
              <button type="submit" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-xl font-medium text-sm hover:shadow-lg transition-all flex items-center gap-1 whitespace-nowrap">
                {subscribed ? 'Subscribed!' : <><Send className="w-4 h-4" /> Subscribe</>}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">EduPro</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Africa's leading AI-powered education platform for teachers and schools.
            </p>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Lagos, Nigeria</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> +234 800 EDU PRO</div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> hello@edupro.africa</div>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold text-white mb-4">Platform</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Lesson Generator', page: 'lesson-generator' },
                { label: 'Content Library', page: 'content-library' },
                { label: 'Exam Bank', page: 'exam-bank' },
                { label: 'Knowledge Base', page: 'knowledge-base' },
                { label: 'Website Builder', page: 'website-builder' },
              ].map(item => (
                <li key={item.page}>
                  <button onClick={() => onNavigate(item.page)} className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1 group">
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2.5">
              {['Teaching Guides', 'Curriculum Updates', 'Video Tutorials', 'Blog', 'Help Center', 'API Documentation'].map(item => (
                <li key={item}>
                  <button className="text-gray-400 hover:text-white text-sm transition-colors">{item}</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Countries */}
          <div>
            <h4 className="font-semibold text-white mb-4">Countries</h4>
            <ul className="space-y-2.5">
              {['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Cameroon', 'Tanzania', 'Uganda', 'Rwanda'].map(item => (
                <li key={item}>
                  <button className="text-gray-400 hover:text-white text-sm transition-colors">{item}</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2.5">
              {['About Us', 'Careers', 'Press', 'Partners', 'Privacy Policy', 'Terms of Service'].map(item => (
                <li key={item}>
                  <button className="text-gray-400 hover:text-white text-sm transition-colors">{item}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} EduPro Africa. All rights reserved.</p>
          <div className="flex items-center gap-4">
            {/* Social icons */}
            {['twitter', 'facebook', 'linkedin', 'youtube'].map(social => (
              <button key={social} className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  {social === 'twitter' && <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />}
                  {social === 'facebook' && <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />}
                  {social === 'linkedin' && <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z" />}
                  {social === 'youtube' && <path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33zM9.75 15.02V8.48l5.75 3.27-5.75 3.27z" />}
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
