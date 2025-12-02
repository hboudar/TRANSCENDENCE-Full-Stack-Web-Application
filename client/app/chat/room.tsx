"use client";
import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import socket from '../socket'; // Make sure this is your initialized socket.io-client
import SendMessage from './sendmessages';
import FetchMessages from './fetchmessages';

type Message = {
    id?: number;
    content: string;
    sender_id: number;
    receiver_id: number;
    status: boolean;
    created_at?: string;
};

export default function Room({
    selected,
    me,
    messages,
    setMessages,
    isBlocked,
    blockMessage
}: {
    selected: number;
    me: number;
    messages: Message[];
    setMessages: Dispatch<SetStateAction<Message[]>>;
    isBlocked?: boolean;
    blockMessage?: string;
}) {
    const [errorMessage, setErrorMessage] = useState("");
    useEffect(() => {
        if (!socket) return;
        
        // Join personal room for this user
        socket.emit("join", me); // This ensures the user is in their own room

        const handleIncomingMessage = (msg: Message) => {
            // Only refresh messages if it's relevant
            if (
                (msg.sender_id === selected && msg.receiver_id === me) ||
                (msg.sender_id === me && msg.receiver_id === selected)
            ) {
                console.log("📥 Received live message:", msg);
                // insert the new message at the end of the messages array
                setMessages((prevMessages: Message[]) => [...prevMessages, msg]);
            }
        };

        const handleMessageBlocked = (data: { message: string }) => {
            console.log("🚫 Message blocked:", data);
            setErrorMessage(data.message);
            setTimeout(() => setErrorMessage(""), 3000);
        };

        socket.on("new message", handleIncomingMessage);
        socket.on("message_blocked", handleMessageBlocked);

        return () => {
            if (socket) {
                socket.off("new message", handleIncomingMessage);
                socket.off("message_blocked", handleMessageBlocked);
            }
        };
    }, [selected, me]);

    return (
        <div className="flex flex-col h-full justify-between relative">
            {(isBlocked || errorMessage) ? (
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <div className="mb-4 text-5xl">🚫</div>
                        <p className="text-gray-400 text-lg">
                            {errorMessage || blockMessage}
                        </p>
                    </div>
                </div>
            ) : (
                <FetchMessages selected={selected} me={me} messages={messages} setMessages={setMessages} />
            )}
            <SendMessage me={me} selected={selected} isBlocked={isBlocked} />
        </div>
    );
}
