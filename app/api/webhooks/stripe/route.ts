import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/app/lib/stripe';

// Initialize Supabase Admin (Service Role)
// CRITICAL: We need SERVICE_ROLE_KEY to bypass RLS and update any user's profile
// You must add checks to ensure this key exists
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
    if (!supabaseServiceKey) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const body = await req.text();
    const signature = (await headers()).get('Stripe-Signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: any) {
        console.error('Webhook signature verification failed', error.message);
        return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                // Retrieve the subscription details
                // Cast to Stripe.Subscription to avoid "Response<Subscription>" TS issues
                const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as unknown as Stripe.Subscription;

                // Get userId from metadata (we added this in checkout route)
                const userId = session.metadata?.userId;

                if (userId) {
                    await supabase.from('profiles').update({
                        stripe_customer_id: session.customer as string,
                        subscription_id: session.subscription as string,
                        subscription_status: 'active', // or 'trialing'
                        current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                    }).eq('id', userId);
                    console.log(`Updated subscription for user ${userId}`);
                }
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                // Find user by customer_id
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('stripe_customer_id', subscription.customer as string);

                if (profiles && profiles.length > 0) {
                    await supabase.from('profiles').update({
                        subscription_status: subscription.status, // active, past_due, canceled, trialing
                        current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                    }).eq('stripe_customer_id', subscription.customer as string);
                    console.log(`Updated subscription status: ${subscription.status}`);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await supabase.from('profiles').update({
                    subscription_status: 'canceled',
                    // Keep the current_period_end as is, or update it?
                    // Usually deleted means access is revoked immediately or at end of period.
                    // Stripe sends this when it's fully gone.
                    current_period_end: new Date().toISOString(), // Revoke access now?
                }).eq('stripe_customer_id', subscription.customer as string);
                console.log(`Subscription deleted for customer ${subscription.customer}`);
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;
                // Mark as past_due or canceled
                await supabase.from('profiles').update({
                    subscription_status: 'past_due',
                }).eq('stripe_customer_id', customerId);
                console.log(`Payment failed for customer ${customerId}`);
                break;
            }
        }
    } catch (error: any) {
        console.error('Webhook handler failed:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
