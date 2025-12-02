"use client";

import { GoHomeFill } from "react-icons/go";
import { IoChatbubbleSharp, IoGameController } from "react-icons/io5";
import { FaShoppingCart } from "react-icons/fa";
import { IoLogOut } from "react-icons/io5";
// game icon
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Leftheader() {
    const pathname = usePathname();

    const navItems = [
        { href: "/home", icon: <GoHomeFill size={26} />, label: "Home" },
        { href: "/games", icon: <IoGameController size={26} />, label: "games" },
        { href: "/chat", icon: <IoChatbubbleSharp size={26} />, label: "Chat" },
        { href: "/shop", icon: <FaShoppingCart size={26} />, label: "Shop" },
    ];

    return (
        <div className="h-full w-full flex flex-col justify-between items-center text-white shadow-xl p-4">
            {/* Logo */}
            <div className="w-20 p-1">
                <img
                    src="/logo.png"
                    alt="Logo"
                    className="shadow-md hidden md:block"
                    width={200}
                    height={200}
                />
            </div>

            {/* Nav Items */}
            <nav className="flex flex-col gap-3 items-center w-full px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-label={item.label}
                            className={`group relative w-full p-3 rounded-xl flex items-center justify-center md:justify-center transition-all duration-300 backdrop-blur-sm
                                ${isActive 
                                    ? "bg-gradient-to-r from-purple-600/80 to-blue-600/80 text-white scale-105 shadow-lg shadow-purple-500/50 border border-purple-400/30" 
                                    : "text-gray-400 hover:bg-gradient-to-r hover:from-purple-600/40 hover:to-blue-600/40 hover:text-white hover:scale-105 hover:shadow-md border border-transparent hover:border-purple-500/20"}
                            `}
                        >
                            <div className="flex items-center gap-3 w-full md:flex-col md:gap-1">
                                <div className={`rounded-full p-2 transition-all ${isActive ? 'bg-white/20' : 'group-hover:bg-white/10'}`}>
                                    {item.icon}
                                </div>
                                <span className={`text-sm font-medium md:text-xs transition-all ${isActive ? "opacity-100" : "opacity-70 md:opacity-0"} md:group-hover:opacity-100`}>
                                    {item.label}
                                </span>
                            </div>
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-purple-400 to-blue-400 rounded-r-full md:hidden" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <button
                className="w-full p-3 rounded-xl flex items-center justify-center md:flex-col gap-3 md:gap-1 text-gray-400 hover:text-white hover:bg-gradient-to-r hover:from-red-600/40 hover:to-pink-600/40 hover:scale-105 transition-all duration-300 group border border-transparent hover:border-red-500/30 backdrop-blur-sm"
                onClick={async () => {
                    try {
                        await fetch("/api/logout", {
                            method: "POST",
                            credentials: "include",
                        });
                    } catch (error) {
                        console.error("Logout error:", error);
                    } finally {
                        window.location.href = "/login";
                    }
                }}
            >
                <div className="group-hover:bg-white/10 p-2 rounded-full transition-all">
                    <IoLogOut size={28} />
                </div>
                <span className="text-sm md:text-xs font-medium opacity-70 group-hover:opacity-100 transition-all">
                    Logout
                </span>
            </button>
        </div>
    );
}
