import React, { useState } from 'react';
import { PRICING_PLANS } from '@/lib/constants';
import { Check, X, CreditCard, Smartphone, Star, Zap, Building } from 'lucide-react';

interface PricingSectionProps {
  onSelectPlan: (planId: string) => void;
}

const PricingSection: React.FC<PricingSectionProps> = ({ onSelectPlan }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const planIcons = [
    <Zap className="w-6 h-6" />,
    <Star className="w-6 h-6" />,
    <Building className="w-6 h-6" />,
  ];

  const planColors = [
    'from-gray-500 to-gray-600',
    'from-blue-600 to-emerald-500',
    'from-indigo-600 to-violet-600',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-blue-200 text-lg max-w-2xl mx-auto mb-8">
            Choose the plan that fits your needs. Start free and upgrade as you grow.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-white/10 rounded-xl p-1.5 backdrop-blur-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${billingCycle === 'yearly' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}`}
            >
              Yearly <span className="text-emerald-400 text-xs ml-1">Save 20%</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-16">
        <div className="grid md:grid-cols-3 gap-6">
          {PRICING_PLANS.map((plan, i) => {
            const price = billingCycle === 'yearly' ? (plan.price * 0.8 * 12).toFixed(0) : plan.price.toFixed(2);
            const isPopular = plan.popular;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl shadow-xl border-2 transition-all hover:shadow-2xl ${
                  isPopular ? 'border-blue-500 relative scale-105 z-10' : 'border-gray-100'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-emerald-500 text-white text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <div className="p-6">
                  {/* Plan header */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${planColors[i]} flex items-center justify-center text-white mb-4`}>
                    {planIcons[i]}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-3 mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.price === 0 ? 'Free' : `$${price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-gray-500 text-sm">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, fi) => (
                      <div key={fi} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </div>
                    ))}
                    {plan.limitations.map((limit, li) => (
                      <div key={li} className="flex items-start gap-2">
                        <X className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-400">{limit}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => onSelectPlan(plan.id)}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                      isPopular
                        ? 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white hover:shadow-lg hover:shadow-blue-200'
                        : plan.price === 0
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    {plan.price === 0 ? 'Get Started Free' : 'Subscribe Now'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Organization License Tiers ── */}
        <div className="mt-20">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-3">For Schools, Districts & Ministries</span>
            <h2 className="text-3xl font-bold text-gray-900">Organization Licenses</h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">Deploy EduPro across your entire institution — one license, every teacher covered.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                id: 'school_basic',
                name: 'School Basic',
                seats: '20 teachers',
                price: '$49',
                period: '/month',
                color: 'from-blue-500 to-blue-600',
                badge: null,
                features: ['20 teacher seats', 'School knowledge space', 'Lesson library sharing', 'Scheme of work upload', 'School analytics', 'Mobile money payment'],
              },
              {
                id: 'school_pro',
                name: 'School Pro',
                seats: '100 teachers',
                price: '$149',
                period: '/month',
                color: 'from-indigo-600 to-purple-600',
                badge: 'POPULAR',
                features: ['100 teacher seats', 'Everything in Basic', 'Teacher performance analytics', 'Priority AI generation', 'School AI memory loop', 'NGO voucher support'],
              },
              {
                id: 'district',
                name: 'District License',
                seats: 'Unlimited schools',
                price: 'Contact',
                period: '',
                color: 'from-purple-600 to-pink-600',
                badge: null,
                features: ['All schools in district', 'District analytics dashboard', 'Curriculum coverage heatmaps', 'School engagement metrics', 'Dedicated account manager', 'Custom onboarding'],
              },
              {
                id: 'ministry',
                name: 'Ministry License',
                seats: 'National rollout',
                price: 'Contact',
                period: '',
                color: 'from-gray-800 to-gray-900',
                badge: null,
                features: ['Entire country coverage', 'Ministry analytics dashboard', 'Curriculum monitoring', 'Policy alert system', 'Bulk school onboarding', 'Government billing terms'],
              },
            ].map((tier) => (
              <div key={tier.id} className={`bg-white rounded-2xl shadow-xl border-2 transition-all hover:shadow-2xl relative ${
                tier.badge ? 'border-indigo-500' : 'border-gray-100'
              }`}>
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-full">
                    {tier.badge}
                  </div>
                )}
                <div className="p-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center mb-3`}>
                    <Building className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900">{tier.name}</h3>
                  <p className="text-xs text-gray-400 mb-3">{tier.seats}</p>
                  <div className="mb-5">
                    <span className="text-2xl font-bold text-gray-900">{tier.price}</span>
                    {tier.period && <span className="text-gray-500 text-sm">{tier.period}</span>}
                  </div>
                  <div className="space-y-2 mb-5">
                    {tier.features.map((f, fi) => (
                      <div key={fi} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-gray-600">{f}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => onSelectPlan(tier.id)}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      tier.badge
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                        : tier.price === 'Contact'
                        ? 'bg-gray-900 text-white hover:bg-gray-800'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}>
                    {tier.price === 'Contact' ? 'Contact Sales' : 'Get Started'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Activation methods */}
          <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
            <h4 className="font-bold text-indigo-900 mb-3">Organization Activation Methods</h4>
            <div className="grid sm:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Mobile Money', desc: 'MTN MoMo, M-Pesa, Airtel, Orange Money' },
                { label: 'Bank Transfer', desc: 'Direct institutional bank payment' },
                { label: 'NGO Voucher Code', desc: 'Grant-funded access for schools' },
                { label: 'Ministry PO', desc: 'Purchase order for government procurement' },
              ].map((m, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-indigo-100">
                  <p className="font-semibold text-indigo-800 text-xs">{m.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mt-16 text-center pb-12">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Accepted Payment Methods</h3>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-xl border border-gray-100 shadow-sm">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">Credit/Debit Cards</div>
                <div className="text-xs text-gray-500">Visa, Mastercard, Verve</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-xl border border-gray-100 shadow-sm">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">Mobile Money</div>
                <div className="text-xs text-gray-500">M-Pesa, MTN MoMo, Airtel Money, Orange Money</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-xl border border-gray-100 shadow-sm">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">Bank Transfer</div>
                <div className="text-xs text-gray-500">Direct bank payment</div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-emerald-50 rounded-2xl p-6 max-w-2xl mx-auto">
            <h4 className="font-bold text-emerald-800 mb-2">Special Offer for Schools</h4>
            <p className="text-sm text-emerald-700">
              Get 30% off when you subscribe 5 or more teachers. Contact us for custom school packages with dedicated support and training.
            </p>
            <button className="mt-3 px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all">
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingSection;
