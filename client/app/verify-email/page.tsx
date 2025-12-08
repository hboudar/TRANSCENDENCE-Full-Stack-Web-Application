'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Loading from '../components/loading';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(5);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const verifyEmail = async () => {
            if (!token) {
                setStatus('invalid');
                setLoading(false);
                return;
            }

            try {
                
                const response = await fetch(`/api/verify-email?token=${token}`);
                
                if (response.ok) {
                    setStatus('success');
                } else {
                    setStatus('failed');
                }
            } catch (error) {
                console.error('Verification error:', error);
                setStatus('error');
            } finally {
                setLoading(false);
            }
        };

        verifyEmail();
    }, [token]);

    useEffect(() => {
        if (status === 'success') {
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        router.push('/login');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [status, router]);

    const handleLoginClick = () => {
        router.push('/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                {loading && (
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 mb-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">
                            Verifying Your Email...
                        </h1>
                        <p className="text-gray-600">
                            Please wait while we verify your email address.
                        </p>
                    </div>
                )}

                {!loading && status === 'success' && (
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                            <svg
                                className="h-10 w-10 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">
                            Email Verified Successfully!
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Your email has been verified. You can now login to your account.
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            Redirecting to login in {countdown} seconds...
                        </p>
                        <button
                            onClick={handleLoginClick}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                        >
                            Login Now
                        </button>
                    </div>
                )}

                {!loading && status === 'failed' && (
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                            <svg
                                className="h-10 w-10 text-red-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">
                            Verification Failed
                        </h1>
                        <p className="text-gray-600 mb-6">
                            This verification link is invalid or has already been used.
                        </p>
                        <button
                            onClick={handleLoginClick}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                        >
                            Go to Login
                        </button>
                    </div>
                )}

                {!loading && status === 'invalid' && (
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
                            <svg
                                className="h-10 w-10 text-yellow-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">
                            Invalid Link
                        </h1>
                        <p className="text-gray-600 mb-6">
                            The verification link appears to be invalid or incomplete.
                        </p>
                        <button
                            onClick={handleLoginClick}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                        >
                            Go to Login
                        </button>
                    </div>
                )}

                {!loading && status === 'error' && (
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                            <svg
                                className="h-10 w-10 text-red-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">
                            Something Went Wrong
                        </h1>
                        <p className="text-gray-600 mb-6">
                            We encountered an error while verifying your email. Please try again later.
                        </p>
                        <button
                            onClick={handleLoginClick}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                        >
                            Go to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailResult() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <Loading />
                </div>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
