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
            setIsOpen(!mobile); 
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
                            {!isOpen && (
                                <button
                                    className="fixed bottom-6 left-4 z-50 p-3 bg-gradient-to-br from-purple-600/90 to-blue-600/90 rounded-full text-white md:hidden shadow-2xl hover:shadow-purple-500/50 hover:scale-110 transition-all duration-200 backdrop-blur-md border border-purple-400/40"
                                    onClick={() => setIsOpen(!isOpen)}
                                >
                                    <GiHamburgerMenu size={22} className="drop-shadow-lg" />
                                </button>
                            )}
                            {isOpen && (
                                <>
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30" onClick={() => setIsOpen(false)} />
                                    <div className="absolute top-0 left-0 z-40 w-fit h-full bg-[#0a0a0a]/95 shadow-2xl transition-transform duration-300 px-3">
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
