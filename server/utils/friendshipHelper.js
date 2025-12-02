// Helper function to check if two users are friends
export function checkFriendship(db, userId1, userId2) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM friends WHERE 
             (user_id = ? AND friend_id = ? AND is_request = 0) OR 
             (user_id = ? AND friend_id = ? AND is_request = 0)`,
            [userId1, userId2, userId2, userId1],
            (err, friendship) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(!!friendship); // Returns true if friends, false otherwise
                }
            }
        );
    });
}

// Helper function to check if one user has blocked another
export function checkBlock(db, userId1, userId2) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM blocks WHERE 
             (blocker_id = ? AND blocked_id = ?) OR 
             (blocker_id = ? AND blocked_id = ?)`,
            [userId1, userId2, userId2, userId1],
            (err, block) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(block || null); // Returns block object or null
                }
            }
        );
    });
}
