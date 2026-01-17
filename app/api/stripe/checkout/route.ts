import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/app/lib/stripe';

// Initialize Supabase Admin for backend (Service Role)
// We need this to look up profiles securely, or we can use the user's session token.
// Using session token is better for "acting as the user".
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { isTrial } = body; // true = 30 days free, false = immediate charge

        // 1. Verify User Session
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        // 2. Get or Create Stripe Customer
        // We need to fetch the user's profile to see if they already have a stripe_customer_id
        // NOTE: Standard Supabase client might not have access to 'profiles' if RLS is strict. 
        // Assuming current user can read their own profile.
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        let customerId = profile?.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user.id,
                },
            });
            customerId = customer.id;

            // We need to save this to the DB. 
            // If RLS prevents update, we might need Service Role here.
            // For now, attempting with user's client.
            await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
        }

        // 3. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: process.env.STRIPE_PRICE_ID,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            allow_promotion_codes: true,
            subscription_data: {
                // If isTrial is true, set 30 days. 
                // If false, set 0 to force immediate charge (overriding Price default).
                trial_period_days: isTrial ? 30 : 0,
                metadata: {
                    userId: user.id,
                }
            },
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/chat?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/chat?canceled=true`,
            metadata: {
                userId: user.id,
            },
        });

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
