# Pong Game CLI API Testing Guide

This document demonstrates how to interact with the Pong game server via CLI (Command-Line Interface) using the REST API.

## Public CLI Endpoints (No Authentication Required)

These endpoints are specifically designed for CLI access and don't require authentication:

### 1. Get All Active Games
```bash
curl -k https://localhost/api/games/cli/active
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "sessions": [
    {
      "sessionId": "abc-123",
      "players": {
        "player1": { "id": 1, "name": "Alice", "ready": true },
        "player2": { "id": 2, "name": "Bob", "ready": true }
      },
      "gameType": "online",
      "status": "active",
      "score": { "p1": 5, "p2": 3 }
    }
  ],
  "timestamp": "2025-12-07T10:30:00.000Z"
}
```

### 2. Get Specific Game Session State
```bash
curl -k https://localhost/api/games/cli/session/SESSION_ID
```

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": "abc-123",
    "players": {
      "p1_id": 1,
      "p1_name": "Alice",
      "p2_id": 2,
      "p2_name": "Bob"
    },
    "gameType": "online",
    "p1_ready": true,
    "p2_ready": true,
    "startgame": true,
    "score": { "p1": 5, "p2": 3 },
    "positions": {
      "p1": 45.5,
      "p2": 52.3,
      "ballx": 60.2,
      "bally": 48.7,
      "win": 0
    }
  },
  "timestamp": "2025-12-07T10:30:00.000Z"
}
```

### 3. Get Game Statistics
```bash
curl -k https://localhost/api/games/cli/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_games": 150,
    "total_players": 25,
    "avg_total_score": 22.5,
    "highest_score": 12,
    "active_sessions": 2
  },
  "timestamp": "2025-12-07T10:30:00.000Z"
}
```

## Automated Testing Script

Use the provided test script for automated testing:

```bash
# Make it executable
chmod +x test-cli-api.sh

# Run tests
./test-cli-api.sh
```

## Real-time Game Monitoring

Monitor a live game in real-time:

```bash
# Replace SESSION_ID with actual session ID from active games
watch -n 1 'curl -k -s https://localhost/api/games/cli/session/SESSION_ID | jq ".session.score, .session.positions"'
```

## Examples with Pretty Output (using jq)

### List all active games with formatted output:
```bash
curl -k -s https://localhost/api/games/cli/active | jq '.sessions[] | {sessionId, status, score}'
```

### Monitor game score only:
```bash
curl -k -s https://localhost/api/games/cli/session/SESSION_ID | jq '.session.score'
```

### Get just the count of active games:
```bash
curl -k -s https://localhost/api/games/cli/active | jq '.count'
```

## Integration Examples

### Bash script to track games:
```bash
#!/bin/bash

while true; do
    ACTIVE=$(curl -k -s https://localhost/api/games/cli/active | jq '.count')
    echo "$(date): $ACTIVE active games"
    sleep 5
done
```

### Python script example:
```python
import requests
import json

url = "https://localhost/api/games/cli/active"
response = requests.get(url, verify=False)
games = response.json()

print(f"Active games: {games['count']}")
for session in games['sessions']:
    print(f"  - {session['sessionId']}: {session['score']}")
```

## Notes

- The `-k` flag in curl bypasses SSL certificate verification (needed for self-signed certs)
- These endpoints are **read-only** and safe for public access
- Real-time positions update every 20ms during active gameplay
- Use `jq` for pretty JSON formatting (`sudo apt-get install jq`)
- For authenticated endpoints, you need to provide a valid JWT token

## Troubleshooting

If you get connection errors:
```bash
# Check if containers are running
docker ps

# Check nginx logs
docker logs nginx

# Check server logs
docker logs server
```
