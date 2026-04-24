import { supabase } from './supabaseClient';

export type PaymentProvider = 'mtn_momo' | 'orange_money' | 'mpesa' | 'airtel_money' | 'stripe_backup';

export interface WebhookPayload {
  provider: PaymentProvider;
  reference: string;
  status: 'success' | 'failed' | 'pending';
  amount?: number;
  currency?: string;
  userId?: string;
  plan?: string;
  [key: string]: unknown;
}

export async function logPayment(payload: WebhookPayload): Promise<void> {
  const { error } = await supabase.from('payment_logs').insert({
    provider: payload.provider,
    reference: payload.reference,
    status: payload.status,
    payload,
  });
  if (error) throw error;
}

export async function activateSubscription(
  userId: string,
  plan: string,
  reference: string,
  country: string,
  durationDays = 30
): Promise<void> {
  const now = new Date();
  const expiry = new Date(now.getTime() + durationDays * 86400000);

  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    country,
    plan,
    status: 'active',
    payment_reference: reference,
    start_date: now.toISOString(),
    expiry_date: expiry.toISOString(),
  });

  if (error) throw error;

  await supabase.from('profiles').update({ subscription_status: 'active' }).eq('id', userId);
}
