import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Globe, Loader2, Eye, Palette, School, Phone, Mail, MapPin, Users, Calendar, Sparkles, CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';

const WebsiteBuilder: React.FC = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [formData, setFormData] = useState({
    schoolName: '', motto: '', address: '', phone: '', email: '',
    principal: '', founded: '', description: '', programs: '',
    staffCount: '', studentCount: '', domainName: '',
    primaryColor: '#2563EB', secondaryColor: '#059669',
    paymentMethod: 'card'
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateWebsite = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-school-website', {
        body: { ...formData, colors: { primary: formData.primaryColor, secondary: formData.secondaryColor } }
      });
      if (error) throw error;
      if (data?.success) {
        setPreview(data.websiteContent);
        setStep(3);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate website. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-violet-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AI Website Builder</h1>
              <p className="text-indigo-200">Create a professional school website in minutes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6">
        {/* Progress Steps */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 mb-6">
          <div className="flex items-center justify-between">
            {['School Info', 'Design & Domain', 'Preview & Publish'].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > i + 1 ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${step === i + 1 ? 'text-indigo-600' : 'text-gray-400'}`}>{label}</span>
                {i < 2 && <div className={`w-12 sm:w-24 h-0.5 mx-2 ${step > i + 1 ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: School Info */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <School className="w-5 h-5 text-indigo-600" /> School Information
            </h2>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
                  <input value={formData.schoolName} onChange={e => handleChange('schoolName', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Bright Future Academy" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Motto</label>
                  <input value={formData.motto} onChange={e => handleChange('motto', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Excellence in Education" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formData.description} onChange={e => handleChange('description', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows={3} placeholder="Brief description of your school..." />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal's Name</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={formData.principal} onChange={e => handleChange('principal', e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Principal name" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year Founded</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={formData.founded} onChange={e => handleChange('founded', e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., 2010" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={formData.address} onChange={e => handleChange('address', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="School address" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={formData.phone} onChange={e => handleChange('phone', e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="+234..." />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={formData.email} onChange={e => handleChange('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="info@school.edu" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Programs Offered</label>
                <input value={formData.programs} onChange={e => handleChange('programs', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Nursery, Primary, After-school" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Staff</label>
                  <input type="number" value={formData.staffCount} onChange={e => handleChange('staffCount', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., 25" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Students</label>
                  <input type="number" value={formData.studentCount} onChange={e => handleChange('studentCount', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., 350" />
                </div>
              </div>
              <button onClick={() => setStep(2)} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
                Continue to Design
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Design & Domain */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Palette className="w-5 h-5 text-indigo-600" /> Design & Domain
            </h2>
            <div className="space-y-6">
              {/* Colors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Brand Colors</label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.primaryColor} onChange={e => handleChange('primaryColor', e.target.value)}
                      className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer" />
                    <div>
                      <div className="text-sm font-medium">Primary Color</div>
                      <div className="text-xs text-gray-400">{formData.primaryColor}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.secondaryColor} onChange={e => handleChange('secondaryColor', e.target.value)}
                      className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer" />
                    <div>
                      <div className="text-sm font-medium">Secondary Color</div>
                      <div className="text-xs text-gray-400">{formData.secondaryColor}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Domain */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Domain Name</label>
                <div className="flex items-center gap-2">
                  <input value={formData.domainName} onChange={e => handleChange('domainName', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="brightfuture" />
                  <span className="text-sm text-gray-500 font-medium">.edupro.africa</span>
                </div>
                {formData.domainName && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {formData.domainName}.edupro.africa is available!
                  </p>
                )}
              </div>

              {/* Payment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Website Hosting Payment ($9.99/month)</label>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.paymentMethod === 'card' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                    <input type="radio" name="wpay" value="card" checked={formData.paymentMethod === 'card'} onChange={() => handleChange('paymentMethod', 'card')} className="sr-only" />
                    <CreditCard className={`w-5 h-5 ${formData.paymentMethod === 'card' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <div>
                      <div className="font-medium text-sm">Credit/Debit Card</div>
                      <div className="text-xs text-gray-500">Visa, Mastercard, Verve</div>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.paymentMethod === 'mobile' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                    <input type="radio" name="wpay" value="mobile" checked={formData.paymentMethod === 'mobile'} onChange={() => handleChange('paymentMethod', 'mobile')} className="sr-only" />
                    <Smartphone className={`w-5 h-5 ${formData.paymentMethod === 'mobile' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <div>
                      <div className="font-medium text-sm">Mobile Money</div>
                      <div className="text-xs text-gray-500">M-Pesa, MTN MoMo, Airtel Money</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50">Back</button>
                <button onClick={generateWebsite} disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <><Sparkles className="w-5 h-5" /> Generate Website</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && preview && (
          <div className="space-y-6 pb-12">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" /> Website Preview
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Edit</button>
                  <button className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all">Publish Website</button>
                </div>
              </div>

              {/* Website Preview Frame */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                {/* Browser bar */}
                <div className="bg-gray-100 px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg px-3 py-1 text-xs text-gray-500">
                    https://{formData.domainName || 'yourschool'}.edupro.africa
                  </div>
                </div>

                {/* Hero */}
                <div className="p-8 text-center" style={{ background: `linear-gradient(135deg, ${formData.primaryColor}, ${formData.secondaryColor})` }}>
                  <h1 className="text-3xl font-bold text-white mb-2">{formData.schoolName || 'Your School Name'}</h1>
                  <p className="text-white/80 text-lg mb-1">{formData.motto || 'Excellence in Education'}</p>
                  {preview.hero && <p className="text-white/70 text-sm max-w-lg mx-auto mt-2">{preview.hero.subheadline}</p>}
                  <button className="mt-4 px-6 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium">
                    {preview.hero?.ctaText || 'Learn More'}
                  </button>
                </div>

                {/* About */}
                {preview.about && (
                  <div className="p-8 bg-white">
                    <h2 className="text-xl font-bold text-gray-900 mb-3">{preview.about.title || 'About Us'}</h2>
                    <p className="text-sm text-gray-600 leading-relaxed">{preview.about.description}</p>
                    {preview.about.mission && (
                      <div className="mt-4 bg-gray-50 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-gray-800 mb-1">Our Mission</h3>
                        <p className="text-xs text-gray-600">{preview.about.mission}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Programs */}
                {preview.programs && preview.programs.length > 0 && (
                  <div className="p-8 bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Our Programs</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {preview.programs.slice(0, 4).map((prog: any, i: number) => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
                          <h3 className="font-semibold text-sm text-gray-900">{prog.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">{prog.description}</p>
                          {prog.ageRange && <span className="text-xs text-indigo-600 mt-2 inline-block">{prog.ageRange}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact */}
                <div className="p-8 bg-white border-t border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-3">Contact Us</h2>
                  <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />{formData.address || 'School Address'}</div>
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" />{formData.phone || 'Phone'}</div>
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />{formData.email || 'Email'}</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 text-center text-xs text-white" style={{ backgroundColor: formData.primaryColor }}>
                  &copy; {new Date().getFullYear()} {formData.schoolName || 'School Name'}. Powered by EduPro
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebsiteBuilder;
