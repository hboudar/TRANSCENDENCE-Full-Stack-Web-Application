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
        <div className="h-full flex flex-col items-center text-white shadow-xl py-6 px-2">
            {/* Logo - Stays at top */}
            <div className="w-12 mb-8 flex-shrink-0">
                <img
                    src="/logo.png"
                    alt="Logo"
                    className="shadow-md"
                    width={48}
                    height={48}
                />
            </div>

            {/* Spacer to push nav items to center */}
            <div className="flex-grow"></div>

            {/* Nav Items - Centered */}
            <nav className="flex flex-col gap-6 items-center flex-shrink-0">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-label={item.label}
                            className="group flex flex-col items-center gap-1 transition-all duration-200"
                        >
                            <div className={`transition-colors duration-200 ${isActive ? 'text-purple-500' : 'text-gray-400 group-hover:text-purple-500'}`}>
                                {item.icon}
                            </div>
                            <span className={`text-xs font-medium whitespace-nowrap transition-all duration-200 ${isActive ? 'opacity-100 text-purple-500' : 'opacity-0 group-hover:opacity-100 group-hover:text-purple-500'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Spacer to push logout to bottom */}
            <div className="flex-grow"></div>

            {/* Logout - At bottom */}
            <button
                className="group flex flex-col items-center gap-1 transition-all duration-200 flex-shrink-0"
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
                <div className="text-gray-400 group-hover:text-red-500 transition-colors duration-200">
                    <IoLogOut size={28} />
                </div>
                <span className="text-xs font-medium whitespace-nowrap text-gray-400 group-hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    Logout
                </span>
            </button>
        </div>
    );
}
