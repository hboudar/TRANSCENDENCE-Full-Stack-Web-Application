"use client";
import React, { useState, useEffect } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const [token, setToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const tokenParam = searchParams.get("token");
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setError("Invalid or missing reset token");
        }
    }, [searchParams]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters long");
            setLoading(false);
            return;
        }

        if (newPassword.length > 16) {
            setError("Password must be at most 16 characters long");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/reset-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || "Password has been reset successfully!");
                setNewPassword("");
                setConfirmPassword("");
                
                setTimeout(() => {
                    window.location.href = "/login";
                }, 2000);
            } else {
                setError(data.error || "Failed to reset password. Please try again.");
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
                <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
                    Reset Password
                </h1>
                <p className="text-gray-300 text-center text-sm mb-6 sm:mb-8">
                    Enter your new password below (6-16 characters).
                </p>

                {message && (
                    <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm">
                        {message}
                        <p className="mt-2 text-xs">Redirecting to login...</p>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div className="relative">
                        <Lock
                            className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400"
                            size={18}
                        />
                        <input
                            type={showPassword ? "text" : "password"}
                            name="newPassword"
                            placeholder="New Password (6-16 chars)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            minLength={6}
                            maxLength={16}
                            className="w-full bg-transparent border-b border-gray-500 text-white placeholder-gray-400 py-2.5 sm:py-3 pl-7 sm:pl-8 pr-10 focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                            required
                            disabled={loading || !token}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <div className="relative">
                        <Lock
                            className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400"
                            size={18}
                        />
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            minLength={6}
                            maxLength={16}
                            className="w-full bg-transparent border-b border-gray-500 text-white placeholder-gray-400 py-2.5 sm:py-3 pl-7 sm:pl-8 pr-10 focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                            required
                            disabled={loading || !token}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !token}
                        className="w-full bg-[#4c7cf3] hover:bg-[#3d6ae0] text-white font-medium py-3 sm:py-3.5 rounded-xl transition-all duration-300 mt-6 sm:mt-8 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Resetting..." : "Reset Password"}
                    </button>

                    <p className="text-center text-gray-300 text-xs sm:text-sm mt-4 sm:mt-6">
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

export default function ResetPassword() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
