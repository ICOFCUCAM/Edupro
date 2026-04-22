import React from 'react';
import { AFRICA_MAP_IMAGE, STUDENT_IMAGES, TEACHER_IMAGES } from '@/lib/constants';
import { Sparkles, Globe2, FileText, Brain, Gamepad2, Award, Globe, Building, Printer, BookOpen, Languages, Shield } from 'lucide-react';

interface FeaturesSectionProps {
  onNavigate: (page: string) => void;
}

const FeaturesSection: React.FC<FeaturesSectionProps> = ({ onNavigate }) => {
  const features = [
    { icon: Sparkles, title: 'AI Lesson Generator', desc: 'Generate curriculum-aligned lesson notes for any African country in seconds. Custom table formats matching your national standards.', color: 'from-blue-500 to-blue-600', page: 'lesson-generator' },
    { icon: Brain, title: 'AI Knowledge Base', desc: 'Country-specific pedagogical bots that track curriculum changes and automatically update your lesson notes.', color: 'from-emerald-500 to-teal-600', page: 'knowledge-base' },
    { icon: Gamepad2, title: 'Content Library', desc: 'Educational videos, audio lessons, interactive games for preschool, nursery and primary. Includes Christian education content.', color: 'from-purple-500 to-violet-600', page: 'content-library' },
    { icon: Award, title: 'Exam Bank', desc: 'Past First School and Common Entrance exams. Practice tests with answers. Upload and manage your own exam papers.', color: 'from-amber-500 to-orange-600', page: 'exam-bank' },
    { icon: Globe, title: 'Website Builder', desc: 'Create a professional school website by filling a simple form. AI generates everything. Get a custom domain.', color: 'from-indigo-500 to-violet-600', page: 'website-builder' },
    { icon: Languages, title: '18+ Languages', desc: 'Full support for English, French, Spanish, Swahili, Hausa, Yoruba, Amharic, Arabic, Zulu, and many more African languages.', color: 'from-pink-500 to-rose-600', page: 'home' },
    { icon: Printer, title: 'PDF Export', desc: 'Print-ready lesson notes with country-specific formatting. Add your school letterhead. Batch print weekly plans.', color: 'from-cyan-500 to-blue-600', page: 'lesson-generator' },
    { icon: Shield, title: 'Secure Payments', desc: 'Pay with credit cards, mobile money (M-Pesa, MTN MoMo, Airtel Money), or bank transfer. Flexible monthly plans.', color: 'from-green-500 to-emerald-600', page: 'pricing' },
  ];

  const countries = [
    { name: 'Nigeria', flag: 'NG', curriculum: 'NERDC', teachers: '1,200+' },
    { name: 'Ghana', flag: 'GH', curriculum: 'NaCCA', teachers: '800+' },
    { name: 'Kenya', flag: 'KE', curriculum: 'CBC', teachers: '650+' },
    { name: 'South Africa', flag: 'ZA', curriculum: 'CAPS', teachers: '500+' },
    { name: 'Cameroon', flag: 'CM', curriculum: 'National', teachers: '400+' },
    { name: 'Tanzania', flag: 'TZ', curriculum: 'TIE', teachers: '350+' },
    { name: 'Uganda', flag: 'UG', curriculum: 'NCDC', teachers: '300+' },
    { name: 'Rwanda', flag: 'RW', curriculum: 'CBC', teachers: '250+' },
    { name: 'Ethiopia', flag: 'ET', curriculum: 'NCF', teachers: '200+' },
    { name: 'Senegal', flag: 'SN', curriculum: 'National', teachers: '180+' },
    { name: 'DRC', flag: 'CD', curriculum: 'EPSP', teachers: '150+' },
    { name: 'Zimbabwe', flag: 'ZW', curriculum: 'ZIMSEC', teachers: '120+' },
  ];

  return (
    <div>
      {/* Features Grid */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-4">Powerful Features</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Everything You Need to Teach Better</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">From AI-powered lesson planning to multimedia content libraries, EduPro gives African teachers the tools they deserve.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature, i) => (
              <div
                key={i}
                onClick={() => onNavigate(feature.page)}
                className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Countries Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-sm font-medium mb-4">Pan-African Coverage</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Supporting 40+ African Education Systems</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Each country has its own curriculum format, assessment standards, and pedagogical requirements. EduPro's AI understands them all and generates perfectly formatted lesson notes.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {countries.map((country, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer">
                    <div className="font-semibold text-gray-900 text-sm">{country.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{country.curriculum} Curriculum</div>
                    <div className="text-xs text-emerald-600 font-medium mt-1">{country.teachers} teachers</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img src={AFRICA_MAP_IMAGE} alt="Africa Education Map" className="w-full rounded-2xl shadow-2xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-purple-50 text-purple-600 rounded-full text-sm font-medium mb-4">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Loved by Teachers Across Africa</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Mrs. Adebayo', role: 'Primary Teacher, Lagos', quote: 'EduPro has transformed how I prepare my lesson notes. What used to take me 3 hours now takes 5 minutes. The Nigerian curriculum format is perfect!', image: TEACHER_IMAGES[0] },
              { name: 'Mr. Osei', role: 'Head Teacher, Accra', quote: 'The NaCCA-aligned lesson notes are exactly what we need. Our entire school now uses EduPro. The content library is amazing for our nursery classes.', image: TEACHER_IMAGES[1] },
              { name: 'Ms. Wanjiku', role: 'CBC Teacher, Nairobi', quote: 'Finally, a platform that understands Kenya\'s CBC curriculum! The AI knowledge base keeps my lessons updated with the latest KICD guidelines.', image: TEACHER_IMAGES[2] },
            ].map((testimonial, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <img src={testimonial.image} alt={testimonial.name} className="w-12 h-12 rounded-full object-cover" />
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{testimonial.name}</div>
                    <div className="text-xs text-gray-500">{testimonial.role}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed italic">"{testimonial.quote}"</p>
                <div className="flex gap-0.5 mt-3">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-emerald-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Transform Your Teaching?</h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Join 5,000+ teachers across Africa who are already using EduPro to create better lesson notes, access rich content, and save hours every week.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => onNavigate('lesson-generator')} className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-xl transition-all text-lg">
              Start Free Trial
            </button>
            <button onClick={() => onNavigate('pricing')} className="px-8 py-4 bg-white/10 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/20 transition-all text-lg">
              View Pricing
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FeaturesSection;
