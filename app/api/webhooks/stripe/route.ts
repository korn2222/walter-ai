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
                let subscription: Stripe.Subscription | null = null;
                try {
                    subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                } catch (err) {
                    console.error('Error retrieving subscription:', err);
                }

                let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default to 30 days
                if (subscription && (subscription as any).current_period_end) {
                    currentPeriodEnd = new Date((subscription as any).current_period_end * 1000).toISOString();
                } else {
                    console.warn('Subscription or current_period_end missing, using default 30 days');
                }

                // Get userId from metadata OR client_reference_id (for Payment Links)
                let userId = session.metadata?.userId || session.client_reference_id;

                // Fallback: If no userId, try to find user by email
                if (!userId && session.customer_details?.email) {
                    const email = session.customer_details.email;
                    // We need to query the `auth.users` table technically, but we can't do that easily via public client.
                    // However, we have a public `profiles` table that triggers create on signup.
                    // So we can look up the profile ID by email if the email is stored in profiles (it usually isn't by default).

                    // Wait, we need to locate the user ID.
                    // We can use the Admin API (Service Role) to list users by email.
                    const { data: { users }, error } = await supabase.auth.admin.listUsers();
                    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

                    if (user) {
                        userId = user.id;
                        console.log(`Found user ${userId} by email ${email}`);
                    } else {
                        console.error(`Could not find user by email: ${email}`);
                    }
                }

                if (userId) {
                    await supabase.from('profiles').update({
                        stripe_customer_id: session.customer as string,
                        subscription_id: session.subscription as string,
                        subscription_status: 'active', // or 'trialing'
                        current_period_end: currentPeriodEnd,
                    }).eq('id', userId);
                    console.log(`Updated subscription for user ${userId}`);
                } else if (session.customer_details?.email) {
                    // User doesn't exist yet, store in prepaid_subscriptions
                    const email = session.customer_details.email;
                    console.log(`User not found for email ${email}, storing as prepaid subscription`);

                    const { error: prepaidError } = await supabase
                        .from('prepaid_subscriptions')
                        .upsert({
                            email: email,
                            stripe_customer_id: session.customer as string,
                            subscription_id: session.subscription as string,
                            subscription_status: 'active',
                            current_period_end: currentPeriodEnd,
                        }, { onConflict: 'email' });

                    if (prepaidError) {
                        console.error('Error storing prepaid subscription:', prepaidError);
                    } else {
                        console.log(`Stored prepaid subscription for ${email}`);
                    }
                } else {
                    console.error('Webhook Error: Could not identify user or email for session', session.id);
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
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;
                const subscriptionId = invoice.subscription as string;
                const email = invoice.customer_email || invoice.customer_name; // Fallnames or other fields might be needed if email not directly on invoice object sometimes

                // Retrieve subscription to get end date if not in invoice
                let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                if (subscriptionId) {
                    try {
                        const sub = await stripe.subscriptions.retrieve(subscriptionId);
                        currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
                    } catch (e) { console.error('Error fetching sub in invoice hook', e) }
                }

                // Try to find user by customer_id first (existing link)
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('stripe_customer_id', customerId);

                if (profiles && profiles.length > 0) {
                    await supabase.from('profiles').update({
                        subscription_status: 'active',
                        current_period_end: currentPeriodEnd,
                        subscription_id: subscriptionId
                    }).eq('stripe_customer_id', customerId);
                    console.log(`Updated subscription via invoice for customer ${customerId}`);
                } else if (invoice.customer_email) {
                    // Try to find user by email
                    const { data: { users }, error } = await supabase.auth.admin.listUsers();
                    const user = users?.find(u => u.email?.toLowerCase() === invoice.customer_email?.toLowerCase());

                    if (user) {
                        await supabase.from('profiles').update({
                            stripe_customer_id: customerId,
                            subscription_id: subscriptionId,
                            subscription_status: 'active',
                            current_period_end: currentPeriodEnd,
                        }).eq('id', user.id);
                        console.log(`Linked customer ${customerId} to user ${user.id} via invoice email`);
                    } else {
                        // PREPAID SUBSCRIPTION LOGIC (For Manual Dashboard Creation)
                        console.log(`User not found for invoice email ${invoice.customer_email}, storing as prepaid`);
                        await supabase.from('prepaid_subscriptions').upsert({
                            email: invoice.customer_email,
                            stripe_customer_id: customerId,
                            subscription_id: subscriptionId,
                            subscription_status: 'active',
                            current_period_end: currentPeriodEnd,
                        }, { onConflict: 'email' });
                    }
                }
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
