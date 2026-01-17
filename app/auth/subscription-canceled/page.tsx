'use client';

import { useRouter } from 'next/navigation';

export default function SubscriptionCanceledPage() {
    const router = useRouter();

    const handleReactivate = () => {
        router.push('/settings');
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-app-gradient text-white p-6">
            <div className="max-w-md w-full text-center space-y-8 animate-fade-in bg-slate-900/50 p-8 rounded-3xl border border-white/5 backdrop-blur-xl">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-red-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Subscription Expired</h1>
                    <p className="text-app-text-secondary text-lg">
                        Your access to Walter AI has been paused because your subscription was canceled or payment failed.
                    </p>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleReactivate}
                        className="w-full bg-accent-gradient hover:opacity-90 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-glow transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Reactivate Subscription
                    </button>
                    <button
                        onClick={() => router.push('/auth/login')}
                        className="mt-4 text-sm text-app-text-muted hover:text-white transition-colors"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        </div>
    );
}
