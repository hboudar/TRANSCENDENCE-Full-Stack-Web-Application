'use client';
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Leftheader from "./leftheader";
import Topheader from "./topheader";
import { GiHamburgerMenu } from "react-icons/gi";

export const LayoutComp = ({ children }: { children: React.ReactNode }) => {
    const path = usePathname();
    const [isMobile, setIsMobile] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            setIsOpen(!mobile); // show sidebar by default on desktop
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const shouldShowLayout = path === "/games" || path.startsWith("/profile/") || path === "/rps" || path === "/home" || path === "/chat" || path === "/friends" || path === "/shop";

    return (
        <div className="min-h-screen bg-[#00000070] relative">
            {shouldShowLayout ? (
                <div className="flex h-screen overflow-hidden">
                    {isMobile ? (
                        <>
                            <button
                                className="absolute top-5 left-3 z-50 p-3 bg-gradient-to-br from-purple-600/80 to-blue-600/80 rounded-xl text-white md:hidden shadow-lg hover:shadow-purple-500/50 hover:scale-105 transition-all duration-200 backdrop-blur-sm border border-purple-500/30"
                                onClick={() => setIsOpen(!isOpen)}
                            >
                                <GiHamburgerMenu size={24} className="drop-shadow-lg" />
                            </button>
                            {isOpen && (
                                <>
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30" onClick={() => setIsOpen(false)} />
                                    <div className="absolute top-0 left-0 z-40 w-64 h-full bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] shadow-2xl shadow-purple-500/20 transition-transform duration-300 border-r border-purple-500/30">
                                        <div className="p-4 border-b border-purple-500/30 flex justify-end">
                                            <button
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <Leftheader />
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="w-20 bg-[#0000004d]">
                            <Leftheader />
                        </div>
                    )}
                    <div className="flex flex-1 flex-col z-10 bg-[#0000004d]">
                        <Topheader />
                        <main className="flex-1 lg:border-l-[0.5px] md:border-l-[0.5px] border-[#9c9c9c] border-t-[0.1px] rounded-tl-xl overflow-auto bg-[#0e052472]
                        [&::-webkit-scrollbar-thumb]:bg-blue-400
               [&::-webkit-scrollbar-thumb]:rounded-full
               [&::-webkit-scrollbar]:w-2
                        ">
                            {children}
                        </main>
                    </div>
                </div>
            ) : (
                <div className="min-h-screen bg-[#00000070]">{children}</div>
            )}
        </div>
    );
};
