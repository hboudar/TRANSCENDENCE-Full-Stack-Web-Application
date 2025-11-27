// Canonical Game type definition
// Used across all game-related components
export type Game = {
    id: number;
    player1_id?: number;
    player2_id?: number;
    player1_score?: number;
    player2_score?: number;
    player1_gold_earned?: number;
    player2_gold_earned?: number;
    winner_id?: number;
    winnerId?: number; // Alias for backward compatibility
    winner?: number; // Alias for backward compatibility
    date?: string;
    created_at?: string;
    timestamp?: string;
    played_at?: string;
    createdAt?: string;
};

export type User = {
    id: number;
    name?: string;
    username?: string;
    email?: string;
    picture?: string;
    gold?: number;
};
