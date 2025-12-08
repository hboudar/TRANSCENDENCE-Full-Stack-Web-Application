

const DRAW = 0
const WIN = 1
const LOSE = -1
const GAMES_PER_MATCH = 5
const GAME_TIMEOUT = 5000 

function rps_winner( c1, c2 ) {
    if ( c1 === c2 ) return DRAW

    if ( c1 === ROCK ) {
        if ( c2 == SCISSOR ) return WIN
        if ( c2 == PAPER ) return LOSE
    }

    if ( c1 === PAPER ) {
        if ( c2 == ROCK ) return WIN
        if ( c2 == SCISSOR ) return LOSE
    }

    if ( c1 === SCISSOR ) {
        if ( c2 == PAPER ) return WIN
        if ( c2 == ROCK ) return LOSE
    }
}

const ROCK = 0
const PAPER = 1
const SCISSOR = 2
const NO_CHOICE = -1

import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET;

let rooms = []


const getUserInfo = (db, userId, callback) => {
    db.get('SELECT name, picture FROM users WHERE id = ?', [userId], (err, row) => {
        if (err || !row) {
            console.error('Error fetching user info:', err)
            callback(null)
        } else {
            
            callback({
                username: row.name,
                avatarUrl: row.picture
            })
        }
    })
}


const rpsHandler = (io, db) => {
    
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token || 
                          socket.handshake.headers.cookie?.match(/token=([^;]+)/)?.[1];
            
            if (!token) {
                console.log('⚠️ RPS connection rejected: No token');
                return next(new Error('Authentication required'));
            }
            
            
            db.get('SELECT token FROM blacklist_tokens WHERE token = ?', [token], (err, blacklisted) => {
                if (err || blacklisted) {
                    console.log('⚠️ RPS connection rejected: Token blacklisted');
                    return next(new Error('Token has been revoked'));
                }
                
                
                let decoded;
                try {
                    decoded = jwt.verify(token, SECRET);
                } catch (jwtError) {
                    console.log('⚠️ RPS connection rejected: Invalid token');
                    return next(new Error('Invalid or expired token'));
                }
                
                const userId = decoded.userId;
                
                
                db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
                    if (err || !user) {
                        console.log(`⚠️ RPS connection rejected: User ${userId} not found`);
                        return next(new Error('User not found'));
                    }
                    
                    socket.userId = userId;
                    console.log(`✅ RPS authenticated for user ${userId}`);
                    next();
                });
            });
        } catch (error) {
            console.log('⚠️ RPS connection rejected:', error.message);
            next(new Error('Authentication failed'));
        }
    });
    
    io.on('connection', (socket) => {
        console.log("⚡ RPS player connected:", socket.id, "User:", socket.userId)
        let currentRoomId = null

        
        socket.on('create_room', (msg) => {
            console.log(`🎮 create_room received ${msg.roomId}`)
            
            
            const userId = socket.userId;
            if (!userId) {
                socket.emit('rps_error', 'Authentication required');
                return;
            }
            
            
            if (!msg.roomId || typeof msg.roomId !== 'string') {
                socket.emit('rps_error', 'Invalid room ID');
                return;
            }

            
            const existingRoom = rooms.find(r => r.room_id === msg.roomId)
            if (existingRoom) {
                socket.emit('rps_error', 'Room already exists! Choose a different room ID.')
                return
            }

            
            getUserInfo(db, userId, (userInfo) => {
                if (!userInfo) {
                    socket.emit('rps_error', 'Failed to get user info')
                    return
                }

                
                rooms.push({
                    room_id: msg.roomId,
                    player1: {
                        socketId: socket.id,
                        userId: userId,
                        username: userInfo.username,
                        avatar: userInfo.avatarUrl,
                        choice: NO_CHOICE,
                        matchWins: 0
                    },
                    player2: null,
                    gamesPlayed: 0,
                    gameTimer: null
                })

                socket.join(msg.roomId)
                currentRoomId = msg.roomId
                
                socket.emit('room_created', { roomId: msg.roomId })
                console.log(`✅ Room ${msg.roomId} created by user ${userId}`)
            })
        })

        
        socket.on('join_room', (msg) => {
            console.log(`🚪 join_room received ${msg.roomId}`)
            
            
            const userId = socket.userId;
            if (!userId) {
                socket.emit('rps_error', 'Authentication required');
                return;
            }
            
            
            if (!msg.roomId || typeof msg.roomId !== 'string') {
                socket.emit('rps_error', 'Invalid room ID');
                return;
            }

            
            const room = rooms.find(r => r.room_id === msg.roomId)
            
            if (!room) {
                socket.emit('rps_error', 'Room does not exist!')
                return
            }

            if (room.player1.userId === userId) {
                socket.emit('rps_error', 'Cannot play with yourself!')
                return
            }

            if (room.player2) {
                socket.emit('rps_error', 'Room is full!')
                return
            }

            
            getUserInfo(db, userId, (userInfo) => {
                if (!userInfo) {
                    socket.emit('rps_error', 'Failed to get user info')
                    return
                }

                
                room.player2 = {
                    socketId: socket.id,
                    userId: userId,
                    username: userInfo.username,
                    avatar: userInfo.avatarUrl,
                    choice: NO_CHOICE,
                    matchWins: 0
                }

                socket.join(msg.roomId)
                currentRoomId = msg.roomId
                
                
                io.to(room.player1.socketId).emit('opponent_joined', {
                    username: userInfo.username,
                    avatar: userInfo.avatarUrl,
                    matchStats: { wins: 0, losses: 0, draws: 0 }
                })
                
                socket.emit('room_joined', {
                    opponentUsername: room.player1.username,
                    opponentAvatar: room.player1.avatar,
                    matchStats: { wins: 0, losses: 0, draws: 0 }
                })

                console.log(`✅ User ${userId} joined room ${msg.roomId}`)
            })
        })

        
        socket.on('leave_room', () => {
            if (!currentRoomId) return

            const roomIndex = rooms.findIndex(r => r.room_id === currentRoomId)
            if (roomIndex === -1) return

            const room = rooms[roomIndex]
            
            
            if (room.gameTimer) {
                clearTimeout(room.gameTimer)
            }

            
            if (room.player1?.socketId === socket.id && room.player2) {
                io.to(room.player2.socketId).emit('opponent_left')
            } else if (room.player2?.socketId === socket.id && room.player1) {
                io.to(room.player1.socketId).emit('opponent_left')
            }

            
            rooms.splice(roomIndex, 1)
            socket.leave(currentRoomId)
            currentRoomId = null

            console.log(`👋 Room ${currentRoomId} closed`)
        })

        
        socket.on('rps', (msg) => {
            console.log(`✊✋✌️ rps message received ${msg.roomId}, choice: ${msg.choice}`)
            
            
            const userId = socket.userId;
            if (!userId) {
                socket.emit('rps_error', 'Authentication required');
                return;
            }
            
            
            if (!msg.roomId || typeof msg.roomId !== 'string') {
                socket.emit('rps_error', 'Invalid room ID');
                return;
            }
            
            if (msg.choice !== ROCK && msg.choice !== PAPER && msg.choice !== SCISSOR) {
                socket.emit('rps_error', 'Invalid choice');
                return;
            }

            const room = rooms.find(r => r.room_id === msg.roomId)
            
            if (!room) {
                socket.emit('rps_error', 'Room not found!')
                return
            }

            if (!room.player2) {
                socket.emit('rps_error', 'Waiting for opponent!')
                return
            }

            
            let currentPlayer, opponentPlayer
            if (room.player1.socketId === socket.id) {
                currentPlayer = room.player1
                opponentPlayer = room.player2
            } else if (room.player2.socketId === socket.id) {
                currentPlayer = room.player2
                opponentPlayer = room.player1
            } else {
                return
            }

            
            currentPlayer.choice = msg.choice

            
            if (room.player1.choice !== NO_CHOICE && room.player2.choice !== NO_CHOICE) {
                
                if (room.gameTimer) {
                    clearTimeout(room.gameTimer)
                    room.gameTimer = null
                }

                
                processGame(room, io, db)
            } else {
                
                if (!room.gameTimer) {
                    
                    io.to(room.player1.socketId).emit('timer_started')
                    io.to(room.player2.socketId).emit('timer_started')
                    
                    room.gameTimer = setTimeout(() => {
                        
                        handleGameTimeout(room, io, db)
                    }, GAME_TIMEOUT)
                }
            }
        })

        socket.on('disconnect', () => {
            console.log("❌ RPS player disconnected:", socket.id)
            
            
            const roomIndex = rooms.findIndex(r => 
                r.player1?.socketId === socket.id || r.player2?.socketId === socket.id
            )
            
            if (roomIndex !== -1) {
                const room = rooms[roomIndex]
                
                
                if (room.gameTimer) {
                    clearTimeout(room.gameTimer)
                }
                
                
                if (room.player1?.socketId === socket.id && room.player2) {
                    io.to(room.player2.socketId).emit('opponent_left')
                } else if (room.player2?.socketId === socket.id && room.player1) {
                    io.to(room.player1.socketId).emit('opponent_left')
                }
                
                
                rooms.splice(roomIndex, 1)
            }
        })
    })
}


function processGame(room, io, db) {
    const result = rps_winner(room.player1.choice, room.player2.choice)
    
    
    if (result === WIN) {
        room.player1.matchWins++
    } else if (result === LOSE) {
        room.player2.matchWins++
    }
    
    
    room.gamesPlayed++
    
    
    const player1Stats = {
        wins: room.player1.matchWins,
        losses: room.player2.matchWins,
        draws: room.gamesPlayed - room.player1.matchWins - room.player2.matchWins
    }
    
    const player2Stats = {
        wins: room.player2.matchWins,
        losses: room.player1.matchWins,
        draws: room.gamesPlayed - room.player1.matchWins - room.player2.matchWins
    }
    
    
    io.to(room.player1.socketId).emit('rps_result', {
        result: result === WIN ? 'WIN' : result === LOSE ? 'LOSE' : 'DRAW',
        matchStats: player1Stats,
        gamesPlayed: room.gamesPlayed
    })
    
    io.to(room.player2.socketId).emit('rps_result', {
        result: result === LOSE ? 'WIN' : result === WIN ? 'LOSE' : 'DRAW',
        matchStats: player2Stats,
        gamesPlayed: room.gamesPlayed
    })
    
    
    room.player1.choice = NO_CHOICE
    room.player2.choice = NO_CHOICE
    
    
    if (room.gamesPlayed >= GAMES_PER_MATCH) {
        finishMatch(room, io, db)
    }
}


function handleGameTimeout(room, io, db) {
    room.gameTimer = null
    
    
    const player1Chose = room.player1.choice !== NO_CHOICE
    const player2Chose = room.player2.choice !== NO_CHOICE
    
    if (!player1Chose && !player2Chose) {
        
        room.gamesPlayed++
        
        const matchStats = {
            wins: room.player1.matchWins,
            losses: room.player2.matchWins,
            draws: room.gamesPlayed - room.player1.matchWins - room.player2.matchWins
        }
        
        io.to(room.player1.socketId).emit('rps_result', {
            result: 'DRAW',
            matchStats: matchStats,
            gamesPlayed: room.gamesPlayed,
            timeout: true
        })
        
        io.to(room.player2.socketId).emit('rps_result', {
            result: 'DRAW',
            matchStats: {
                wins: room.player2.matchWins,
                losses: room.player1.matchWins,
                draws: matchStats.draws
            },
            gamesPlayed: room.gamesPlayed,
            timeout: true
        })
        
        
        room.player1.choice = NO_CHOICE
        room.player2.choice = NO_CHOICE
        
        
        if (room.gamesPlayed >= GAMES_PER_MATCH) {
            finishMatch(room, io, db)
        }
    } else if (!player1Chose) {
        
        room.player2.matchWins++
        room.gamesPlayed++
        
        const player1Stats = {
            wins: room.player1.matchWins,
            losses: room.player2.matchWins,
            draws: room.gamesPlayed - room.player1.matchWins - room.player2.matchWins
        }
        
        const player2Stats = {
            wins: room.player2.matchWins,
            losses: room.player1.matchWins,
            draws: room.gamesPlayed - room.player1.matchWins - room.player2.matchWins
        }
        
        io.to(room.player1.socketId).emit('rps_result', {
            result: 'LOSE',
            matchStats: player1Stats,
            gamesPlayed: room.gamesPlayed,
            timeout: true
        })
        
        io.to(room.player2.socketId).emit('rps_result', {
            result: 'WIN',
            matchStats: player2Stats,
            gamesPlayed: room.gamesPlayed
        })
        
        room.player1.choice = NO_CHOICE
        room.player2.choice = NO_CHOICE
        
        if (room.gamesPlayed >= GAMES_PER_MATCH) {
            finishMatch(room, io, db)
        }
    } else if (!player2Chose) {
        
        room.player1.matchWins++
        room.gamesPlayed++
        
        const player1Stats = {
            wins: room.player1.matchWins,
            losses: room.player2.matchWins,
            draws: room.gamesPlayed - room.player1.matchWins - room.player2.matchWins
        }
        
        const player2Stats = {
            wins: room.player2.matchWins,
            losses: room.player1.matchWins,
            draws: room.gamesPlayed - room.player1.matchWins - room.player2.matchWins
        }
        
        io.to(room.player1.socketId).emit('rps_result', {
            result: 'WIN',
            matchStats: player1Stats,
            gamesPlayed: room.gamesPlayed
        })
        
        io.to(room.player2.socketId).emit('rps_result', {
            result: 'LOSE',
            matchStats: player2Stats,
            gamesPlayed: room.gamesPlayed,
            timeout: true
        })
        
        room.player1.choice = NO_CHOICE
        room.player2.choice = NO_CHOICE
        
        if (room.gamesPlayed >= GAMES_PER_MATCH) {
            finishMatch(room, io, db)
        }
    }
}


function finishMatch(room, io, db) {
    const player1Wins = room.player1.matchWins
    const player2Wins = room.player2.matchWins
    
    let matchResult
    if (player1Wins > player2Wins) {
        
        matchResult = 'PLAYER1_WIN'
        updateRPSStats(db, room.player1.userId, WIN)
        updateRPSStats(db, room.player2.userId, LOSE)
    } else if (player2Wins > player1Wins) {
        
        matchResult = 'PLAYER2_WIN'
        updateRPSStats(db, room.player1.userId, LOSE)
        updateRPSStats(db, room.player2.userId, WIN)
    } else {
        
        matchResult = 'DRAW'
        updateRPSStats(db, room.player1.userId, DRAW)
        updateRPSStats(db, room.player2.userId, DRAW)
    }
    
    
    io.to(room.player1.socketId).emit('match_finished', {
        result: matchResult === 'PLAYER1_WIN' ? 'WIN' : matchResult === 'PLAYER2_WIN' ? 'LOSE' : 'DRAW',
        finalStats: {
            wins: player1Wins,
            losses: player2Wins,
            draws: room.gamesPlayed - player1Wins - player2Wins
        }
    })
    
    io.to(room.player2.socketId).emit('match_finished', {
        result: matchResult === 'PLAYER2_WIN' ? 'WIN' : matchResult === 'PLAYER1_WIN' ? 'LOSE' : 'DRAW',
        finalStats: {
            wins: player2Wins,
            losses: player1Wins,
            draws: room.gamesPlayed - player1Wins - player2Wins
        }
    })
    
    
    const roomIndex = rooms.findIndex(r => r.room_id === room.room_id)
    if (roomIndex !== -1) {
        rooms.splice(roomIndex, 1)
    }
}


function updateRPSStats(db, userId, result) {
    if (!userId) return
    
    let column = ''
    if (result === WIN) column = 'rps_wins'
    else if (result === LOSE) column = 'rps_losses'
    else if (result === DRAW) column = 'rps_draws'
    
    if (column) {
        db.run(`UPDATE users SET ${column} = ${column} + 1 WHERE id = ?`, [userId], (err) => {
            if (err) {
                console.error('Error updating RPS stats:', err)
            } else {
                console.log(`Updated ${column} for user ${userId}`)
            }
        })
    }
}

export { rpsHandler }