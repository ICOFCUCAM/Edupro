import React, { useEffect, useState } from 'react';
import { CreditCard, Check, Smartphone, Star } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface SubscriptionsPageProps { userId?: string; country?: string; }

const PLANS = [
  {
    id: 'teacher_basic',
    name: 'Teacher Basic',
    price: 'Free',
    currency: '',
    features: ['5 AI lesson notes/month', 'Content library access', 'Exam bank (view only)', 'Community support'],
    color: 'border-gray-200',
    badge: '',
  },
  {
    id: 'teacher_pro',
    name: 'Teacher Pro',
    price: '2,500',
    currency: 'XAF / month',
    features: ['Unlimited lesson notes', 'Full content library', 'Download exams', 'AI teaching assistant', 'Priority support'],
    color: 'border-blue-500',
    badge: 'Most Popular',
  },
  {
    id: 'school_plan',
    name: 'School Plan',
    price: '15,000',
    currency: 'XAF / month',
    features: ['All Pro features', 'Up to 50 teachers', 'School website builder', 'Admin dashboard', 'Bulk lesson export', 'Dedicated support'],
    color: 'border-emerald-500',
    badge: 'Best Value',
  },
];

const PAYMENT_METHODS = [
  { id: 'mtn_momo', name: 'MTN Mobile Money', icon: '📱', countries: ['Cameroon', 'Ghana', 'Uganda', 'Rwanda'] },
  { id: 'orange_money', name: 'Orange Money', icon: '🟠', countries: ['Cameroon', 'Senegal', 'DRC'] },
  { id: 'mpesa', name: 'M-Pesa', icon: '💚', countries: ['Kenya', 'Tanzania'] },
  { id: 'airtel_money', name: 'Airtel Money', icon: '🔴', countries: ['Uganda', 'Tanzania', 'Rwanda'] },
  { id: 'stripe_backup', name: 'Card (Stripe)', icon: '💳', countries: ['All countries'] },
];

const SubscriptionsPage: React.FC<SubscriptionsPageProps> = ({ userId, country }) => {
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('teacher_pro');
  const [selectedPayment, setSelectedPayment] = useState('mtn_momo');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('subscriptions').select('plan, status').eq('user_id', userId).eq('status', 'active').single()
      .then(({ data }) => { if (data) setCurrentPlan(data.plan); });
  }, [userId]);

  const handleSubscribe = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const ref = `EDU-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await supabase.from('payment_logs').insert({
        provider: selectedPayment, reference: ref, status: 'pending',
        payload: { plan: selectedPlan, phone, country, userId },
      });
      await supabase.from('subscriptions').insert({
        user_id: userId, country, plan: selectedPlan, status: 'pending', payment_reference: ref,
      });
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-emerald-600 to-blue-700 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <Star className="w-10 h-10 mx-auto mb-3" />
          <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
          <p className="text-emerald-200">Upgrade to unlock the full power of EDU Pro</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {PLANS.map((plan) => (
            <div key={plan.id} onClick={() => setSelectedPlan(plan.id)}
              className={`relative bg-white rounded-2xl border-2 p-6 cursor-pointer transition-all hover:shadow-lg ${
                selectedPlan === plan.id ? plan.color + ' shadow-lg' : 'border-gray-100'
              }`}>
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{plan.badge}</span>
              )}
              {currentPlan === plan.id && (
                <span className="absolute top-3 right-3 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">Current</span>
              )}
              <h3 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                {plan.currency && <span className="text-gray-400 text-sm ml-1">{plan.currency}</span>}
              </div>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Payment */}
        {selectedPlan !== 'teacher_basic' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-xl mx-auto">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-600" /> Payment Method</h2>
            <div className="space-y-2 mb-4">
              {PAYMENT_METHODS.map((method) => (
                <label key={method.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedPayment === method.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <input type="radio" name="payment" value={method.id} checked={selectedPayment === method.id}
                    onChange={() => setSelectedPayment(method.id)} className="accent-blue-600" />
                  <span>{method.icon}</span>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{method.name}</p>
                    <p className="text-xs text-gray-400">{method.countries.join(', ')}</p>
                  </div>
                </label>
              ))}
            </div>
            {selectedPayment !== 'stripe_backup' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5">
                  <Smartphone className="w-4 h-4 text-gray-400" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+237 6XX XXX XXX" className="flex-1 outline-none text-sm" />
                </div>
              </div>
            )}
            {success ? (
              <div className="bg-emerald-50 text-emerald-700 rounded-xl p-4 text-center text-sm font-medium">
                Payment initiated! You will receive a prompt on your phone. Your plan will activate once confirmed.
              </div>
            ) : (
              <button onClick={handleSubscribe} disabled={loading || !userId}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all">
                {loading ? 'Processing...' : `Subscribe to ${PLANS.find((p) => p.id === selectedPlan)?.name}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionsPage;
