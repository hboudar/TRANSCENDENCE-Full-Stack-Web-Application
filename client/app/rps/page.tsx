"use client"
import { useState, useEffect } from 'react'
import { useUser } from '../Context/UserContext'
import Cookies from 'js-cookie'
import { io, Socket } from 'socket.io-client'

interface gameStatsType {
    wins: number;
    losses: number;
    draws: number;
}

export default function rps() {
    const { user, loading } = useUser()

    // opponent
    const [opponentInfo, setOpponentInfo] = useState<{
        username: string,
        avatar: string
    } | null>(null)
    
    // Match stats (per-match, not total from DB)
    const [matchStats, setMatchStats] = useState<gameStatsType>({
        wins: 0,
        losses: 0,
        draws: 0
    })

    const [gamesPlayed, setGamesPlayed] = useState<number>(0)
    const [roomId, setRoomId] = useState<string>('')
    const [result, setResult] = useState<string>('')
    const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
    const [waiting, setWaiting] = useState<boolean>(false)
    const [roomStatus, setRoomStatus] = useState<string>('')
    const [joined, setJoined] = useState<boolean>(false)
    const [roomCreated, setRoomCreated] = useState<boolean>(false)
    const [matchFinished, setMatchFinished] = useState<boolean>(false)
    const [timeLeft, setTimeLeft] = useState<number>(5)
    const [timerActive, setTimerActive] = useState<boolean>(false)

    // for keeping the same socket
    const [socket, setSocket] = useState<Socket | null>(null)

    useEffect(() => {
        if (!user?.id) return

        // connect to rps socket using Socket.IO
        const socket = io('http://localhost:4000')

        socket.on('connect', () => {
            console.log("connected to rps socket")
            setSocket(socket)
            
            // Send userId to server
            socket.emit('set_user', {
                userId: user.id
            })
        })

        socket.on('room_created', (data) => {
            setRoomCreated(true)
            setJoined(true)
            setRoomStatus('Room created! Waiting for opponent...')
            setTimeout(() => setRoomStatus(''), 3000)
        })

        socket.on('room_joined', (data) => {
            setJoined(true)
            setOpponentInfo({
                username: data.opponentUsername,
                avatar: data.opponentAvatar
            })
            setMatchStats(data.matchStats)
            setRoomStatus('You joined the room! 🎮')
            setTimeout(() => setRoomStatus(''), 3000)
        })

        socket.on('opponent_joined', (data) => {
            setOpponentInfo({
                username: data.username,
                avatar: data.avatar
            })
            setMatchStats(data.matchStats)
            setRoomStatus('Opponent joined! Game starting...')
            setTimeout(() => setRoomStatus(''), 3000)
        })

        socket.on('opponent_left', () => {
            setRoomStatus('Opponent left 😢')
            setOpponentInfo(null)
            setJoined(false)
            setRoomCreated(false)
            setWaiting(false)
            setSelectedChoice(null)
            setMatchStats({ wins: 0, losses: 0, draws: 0 })
            setGamesPlayed(0)
            setMatchFinished(false)
            setTimeout(() => setRoomStatus(''), 3000)
        })

        socket.on('timer_started', () => {
            setTimerActive(true)
            setTimeLeft(5)
        })

        socket.on('rps_result', (data: {
            result: string,
            matchStats: gameStatsType,
            gamesPlayed: number,
            timeout?: boolean
        }) => {
            console.log(`received result: ${data.result}`)

            setResult(data.result)
            setMatchStats(data.matchStats)
            setGamesPlayed(data.gamesPlayed)
            setWaiting(false)
            setSelectedChoice(null)
            setTimerActive(false)

            if (data.timeout) {
                setRoomStatus('⏰ Time out!')
                setTimeout(() => setRoomStatus(''), 2000)
            }

            // Clear result after 2 seconds for next game
            setTimeout(() => {
                setResult('')
            }, 2000)
        })

        socket.on('match_finished', (data) => {
            setResult(data.result === 'WIN' ? 'MATCH WON! 🎉' : data.result === 'LOSE' ? 'MATCH LOST 😢' : 'MATCH DRAW 🤝')
            setMatchFinished(true)
            setMatchStats(data.finalStats)
            
            // Reset everything after 5 seconds
            setTimeout(() => {
                setJoined(false)
                setRoomCreated(false)
                setOpponentInfo(null)
                setMatchStats({ wins: 0, losses: 0, draws: 0 })
                setGamesPlayed(0)
                setResult('')
                setMatchFinished(false)
                setRoomId('')
            }, 5000)
        })

        socket.on('rps_error', (error: string) => {
            alert(error)
            setWaiting(false)
        })

        // generate 12 character alpha-numeric code
        const chars: string = 'abcdefghijklmnopqrstuvwxyz0123456789'
        let result: string = ''

        for (let i: number = 0; i < 12; i++) {
            const randomIndex: number = Math.floor(Math.random() * chars.length)
            result += chars.charAt(randomIndex)
        }
        setRoomId(result)

        return () => {
            socket.disconnect()
        }
    }, [user])

    // Timer effect - show timer for both players once it starts
    useEffect(() => {
        if (timerActive) {
            const interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        setTimerActive(false)
                        return 5
                    }
                    return prev - 1
                })
            }, 1000)

            return () => clearInterval(interval)
        }
    }, [timerActive])

    const handleCreateRoom = () => {
        if (roomId.trim() && socket && socket.connected) {
            socket.emit('create_room', {
                roomId: roomId,
                userId: user?.id
            })
            console.log("create_room away!")
        }
    }

    const handleJoinRoom = () => {
        if (roomId.trim() && socket && socket.connected) {
            socket.emit('join_room', {
                roomId: roomId,
                userId: user?.id
            })
            console.log("join_room away!")
        }
    }

    const handleLeaveRoom = () => {
        if (socket && socket.connected) {
            socket.emit('leave_room')
            setJoined(false)
            setRoomCreated(false)
            setOpponentInfo(null)
            setMatchStats({ wins: 0, losses: 0, draws: 0 })
            setGamesPlayed(0)
            setResult('')
            setWaiting(false)
            setSelectedChoice(null)
            setMatchFinished(false)
        }
    }

    const handleChoice = (choice: number) => {
        if (socket && socket.connected && !matchFinished) {
            setSelectedChoice(choice)
            setWaiting(true)
            // Don't start timer here - server will notify both players via 'timer_started'
            socket.emit('rps', {
                roomId: roomId,
                choice: choice,
                userId: user?.id
            })

            console.log("rps away!")
        }
    }

    const canMakeChoice = joined && opponentInfo && !waiting && !matchFinished

    return (
        <div className="flex flex-col">
            {loading ? (
                <div className="flex justify-center items-center h-screen">
                    <div className="text-2xl">Loading...</div>
                </div>
            ) : (
                <>
                    {/* Opponent Widget */}
                    {joined && opponentInfo && (
                        <div className="mt-4 mx-4 flex items-center gap-4 bg-gradient-to-r from-purple-900/50 to-blue-900/50 px-6 py-4 rounded-xl shadow-lg border border-purple-500/30">
                            <img 
                                src={opponentInfo.avatar} 
                                className="w-16 h-16 rounded-full border-2 border-purple-400 object-cover shadow-md"
                                alt="Opponent avatar"
                            />
                            <div className="flex flex-col">
                                <span className="text-white font-bold text-xl">
                                    {opponentInfo.username}
                                </span>
                                <span className="text-purple-300 text-sm">Opponent</span>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center pt-4 sm:pt-6 md:pt-10 px-4">
                        <div className="w-full p-4 sm:p-6 md:p-8 rounded-lg">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 sm:mb-4 text-center w-full">
                                Rocky Papery Scissory :)
                            </h1>
                            <p className="text-base sm:text-lg md:text-xl text-gray-300 text-center w-full mb-4 sm:mb-6 md:mb-8">
                                Match: Best of 5 games
                            </p>
                            {gamesPlayed > 0 && (
                                <p className="text-lg sm:text-xl text-yellow-400 text-center font-semibold">
                                    Game {gamesPlayed} / 5
                                </p>
                            )}
                        </div>

                        {/* Room status indicator */}
                        {roomStatus && (
                            <div className="mb-4 sm:mb-6 px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg text-base sm:text-lg md:text-xl font-semibold animate-pulse">
                                {roomStatus}
                            </div>
                        )}

                        {/* Timer Display - show for both players when active */}
                        {timerActive && (
                            <div className="mb-4 px-6 py-3 bg-red-600 text-white rounded-lg text-2xl font-bold animate-pulse">
                                ⏰ {timeLeft}s
                            </div>
                        )}

                        {/* Choice buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center w-full max-w-2xl">
                            <button 
                                className={`px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-lg sm:text-xl md:text-2xl cursor-pointer border transition-all duration-200 ${
                                    selectedChoice === 0 
                                        ? 'bg-amber-800 border-amber-600 scale-105 shadow-lg' 
                                        : 'hover:bg-amber-800'
                                } ${!canMakeChoice ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => handleChoice(0)}
                                disabled={!canMakeChoice}
                            >
                                ROCK
                            </button>
                            <button 
                                className={`px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-lg sm:text-xl md:text-2xl cursor-pointer border transition-all duration-200 ${
                                    selectedChoice === 1 
                                        ? 'bg-amber-200 text-black border-amber-400 scale-105 shadow-lg' 
                                        : 'hover:bg-amber-200 hover:text-black'
                                } ${!canMakeChoice ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => handleChoice(1)}
                                disabled={!canMakeChoice}
                            >
                                PAPER
                            </button>
                            <button 
                                className={`px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-lg sm:text-xl md:text-2xl cursor-pointer border transition-all duration-200 ${
                                    selectedChoice === 2 
                                        ? 'bg-slate-600 text-black border-slate-400 scale-105 shadow-lg' 
                                        : 'hover:bg-slate-600 hover:text-black'
                                } ${!canMakeChoice ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => handleChoice(2)}
                                disabled={!canMakeChoice}
                            >
                                SCISSOR
                            </button>
                        </div>

                        {/* Match stats */}
                        <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 md:gap-20 mt-6 sm:mt-8 px-6 sm:px-8 py-6 sm:py-8 bg-black/40 rounded-lg w-full max-w-3xl">
                            <div className="text-center flex-1">
                                <div className="text-xl sm:text-2xl font-bold">WINS</div>
                                <div className="text-3xl sm:text-4xl font-bold text-green-400">{matchStats.wins}</div>
                            </div>

                            <div className="text-center flex-1">
                                <div className="text-xl sm:text-2xl font-bold">LOSSES</div>
                                <div className="text-3xl sm:text-4xl font-bold text-red-400">{matchStats.losses}</div>
                            </div>

                            <div className="text-center flex-1">
                                <div className="text-xl sm:text-2xl font-bold">DRAWS</div>
                                <div className="text-3xl sm:text-4xl font-bold text-blue-400">{matchStats.draws}</div>
                            </div>
                        </div>
                    </div>

                    {/* Room controls */}
                    <div className="flex flex-col items-center justify-center mt-6 sm:mt-8 gap-4 px-4">
                        <input 
                            type="text" 
                            value={roomId}
                            className="px-4 py-2 rounded border w-full max-w-xs text-center text-sm sm:text-base text-white bg-gray-800 border-gray-600"
                            onChange={(e) => setRoomId(e.target.value.toLowerCase())}
                            disabled={joined}
                            placeholder="Enter room ID"
                        />
                        
                        {!joined ? (
                            <div className="flex gap-3">
                                <button
                                    className="cursor-pointer px-6 sm:px-8 py-2 sm:py-3 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base"
                                    onClick={handleCreateRoom}
                                >
                                    Create Room
                                </button>
                                <button
                                    className="cursor-pointer px-6 sm:px-8 py-2 sm:py-3 bg-green-600 text-white rounded hover:bg-green-700 text-sm sm:text-base"
                                    onClick={handleJoinRoom}
                                >
                                    Join Room
                                </button>
                            </div>
                        ) : (
                            <button
                                className="cursor-pointer px-6 sm:px-8 py-2 sm:py-3 bg-red-600 text-white rounded hover:bg-red-700 text-sm sm:text-base"
                                onClick={handleLeaveRoom}
                            >
                                Leave Room
                            </button>
                        )}
                    </div>

                    {/* Result display */}
                    {result && (
                        <div className="mt-8 sm:mt-10 flex justify-center px-4">
                            <div className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-2xl sm:text-3xl font-bold shadow-xl transition-all duration-300
                                ${result.includes('WIN') ? 'bg-green-700 text-white' : ''}
                                ${result.includes('LOSE') ? 'bg-red-700 text-white' : ''}
                                ${result.includes('DRAW') ? 'bg-gray-700 text-white' : ''}
                                `}>
                                {result}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
