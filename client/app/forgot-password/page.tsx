"use client";
import React, { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");

        try {
            const response = await fetch("/api/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || "If an account exists with this email, a password reset link will be sent.");
                setEmail("");
            } else {
                setError(data.error || "Failed to process request. Please try again.");
            }
        } catch (error) {
            console.error("Error during password reset:", error);
            setError("An error occurred. Please try again later.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen relative flex items-center justify-center px-4 py-8 overflow-auto">
            <div className="relative z-10 bg-[#3d2977]/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 md:p-10 w-full max-w-md shadow-2xl my-auto">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6"
                >
                    <ArrowLeft size={18} />
                    <span className="text-sm">Back to Login</span>
                </Link>

                <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
                    Forgot Password?
                </h1>
                <p className="text-gray-300 text-center text-sm mb-6 sm:mb-8">
                    Enter your email address and we&apos;ll send you a link to reset your password.
                </p>

                {message && (
                    <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div className="relative">
                        <Mail
                            className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400"
                            size={18}
                        />
                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            maxLength={36}
                            className="w-full bg-transparent border-b border-gray-500 text-white placeholder-gray-400 py-2.5 sm:py-3 pl-7 sm:pl-8 pr-2 focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                            required
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#4c7cf3] hover:bg-[#3d6ae0] text-white font-medium py-3 sm:py-3.5 rounded-xl transition-all duration-300 mt-6 sm:mt-8 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>

                    <p className="text-center text-gray-300 text-xs sm:text-sm mt-4">
                        Remember your password?{" "}
                        <Link
                            href="/login"
                            className="text-[#4c7cf3] hover:text-[#3d6ae0] font-medium transition-colors"
                        >
                            Back to Login
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
