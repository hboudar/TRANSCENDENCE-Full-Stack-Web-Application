"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Gamepad2 } from "lucide-react";
import { useUser } from "./Context/UserContext";
import Loading from "./components/loading";

export default function NotFound() {
    const router = useRouter();
    const { user, loading } = useUser();


    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring" as const,
                stiffness: 100,
            },
        },
    };

    const floatingVariants = {
        animate: {
            y: [-10, 10, -10],
            rotate: [-5, 5, -5],
            transition: {
                duration: 4,
                repeat: Infinity as number,
            },
        },
    };

    const glowVariants = {
        animate: {
            boxShadow: [
                "0 0 20px rgba(123, 93, 223, 0.3)",
                "0 0 60px rgba(123, 93, 223, 0.6)",
                "0 0 20px rgba(123, 93, 223, 0.3)",
            ],
            transition: {
                duration: 2,
                repeat: Infinity as number,
            },
        },
    };

    if (loading) {
        return (<Loading />);
    }
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-blue-900/20 flex items-center justify-center p-4 overflow-hidden relative">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity as number,
                    }}
                />
                <motion.div
                    className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity as number,
                        delay: 1,
                    }}
                />
                <motion.div
                    className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-2xl"
                    animate={{
                        x: [-100, 100, -100],
                        y: [-50, 50, -50],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity as number,
                    }}
                />
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="relative z-10 max-w-2xl w-full text-center"
            >
                {/* 404 Text */}
                <motion.div
                    variants={floatingVariants}
                    animate="animate"
                    className="relative mb-8"
                >
                    <motion.h1
                        variants={glowVariants}
                        animate="animate"
                        className="text-[150px] md:text-[200px] font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent leading-none font-chakra"
                        style={{
                            WebkitTextStroke: "2px rgba(123, 93, 223, 0.3)",
                        }}
                    >
                        404
                    </motion.h1>

                    {/* Floating game icons */}
                    <motion.div
                        className="absolute -top-10 -left-10"
                        animate={{
                            y: [-20, 0, -20],
                            rotate: [0, 360],
                        }}
                        transition={{
                            duration: 5,
                            repeat: Infinity as number,
                        }}
                    >
                        <Gamepad2 className="w-16 h-16 text-purple-400/40" />
                    </motion.div>

                    <motion.div
                        className="absolute -bottom-10 -right-10"
                        animate={{
                            y: [0, -20, 0],
                            rotate: [360, 0],
                        }}
                        transition={{
                            duration: 6,
                            repeat: Infinity as number,
                        }}
                    >
                        <Search className="w-12 h-12 text-blue-400/40" />
                    </motion.div>
                </motion.div>

                {/* Error Message */}
                <motion.div variants={itemVariants} className="space-y-4 mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-white font-chakra">
                        Page Not Found
                    </h2>
                    <p className="text-gray-400 text-lg md:text-xl max-w-md mx-auto">
                        Looks like this page took a wrong turn in the game. Let&apos;s get you back on track!
                    </p>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    variants={itemVariants}
                    className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                >
                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(123, 93, 223, 0.5)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push("/")}
                        className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 border border-purple-500/30"
                    >
                        Go Landing Page
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-8 py-4 bg-white/5 text-white rounded-xl font-semibold border border-purple-500/30 hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
                    >
                        <ArrowLeft size={20} />
                        Go Back
                    </motion.button>
                </motion.div>

                {/* Decorative elements */}
                <motion.div
                    variants={itemVariants}
                    className="mt-16 flex justify-center gap-8"
                >
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full bg-purple-500"
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.3, 1, 0.3],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                delay: i * 0.3,
                            }}
                        />
                    ))}
                </motion.div>

                {/* Quick Links */}
                <motion.div
                    variants={itemVariants}
                    className="mt-12 grid grid-cols-1 sm:grid-cols-5  gap-4 text-sm"
                >
                    {[
                        { label: "Home", path: "/home" },
                        { label: "Games", path: "/games" },
                        { label: "Shop", path: "/shop" },
                        { label: "Profile", path: `/profile/${user?.id}`},
                        {label: "Chat", path: "/chat" },
                    ].map((link, index) => (
                        <motion.button
                            key={link.path}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push(link.path)}
                            className="px-4 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 hover:text-white transition-all duration-300 border border-purple-500/20 backdrop-blur-sm"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 + index * 0.1 }}
                        >
                            {link.label}
                        </motion.button>
                    ))}
                </motion.div>

                <motion.p
                    variants={itemVariants}
                    className="mt-12 text-gray-500 text-sm"
                >
                    Error Code: 404 | Page Not Found
                </motion.p>
            </motion.div>

            <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => {
                    const left = ((i * 47) % 100);
                    const top = ((i * 73) % 100);
                    const duration = 3 + ((i % 5) * 0.5);
                    const delay = (i % 10) * 0.2;

                    return (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
                            style={{
                                left: `${left}%`,
                                top: `${top}%`,
                            }}
                            animate={{
                                y: [0, -100, 0],
                                opacity: [0, 1, 0],
                            }}
                            transition={{
                                duration,
                                repeat: Infinity,
                                delay,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
