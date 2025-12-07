#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Testing Pong Game CLI API${NC}"
echo -e "${BLUE}================================${NC}\n"

# Base URL
BASE_URL="https://localhost/api"

# Test 1: Get active games
echo -e "${YELLOW}[1] Getting active games...${NC}"
curl -k -s "${BASE_URL}/games/cli/active" | jq '.'
echo -e "\n"

# Test 2: Get game statistics
echo -e "${YELLOW}[2] Getting game statistics...${NC}"
curl -k -s "${BASE_URL}/games/cli/stats" | jq '.'
echo -e "\n"

# Test 3: Monitor a specific session (if exists)
echo -e "${YELLOW}[3] Enter a session ID to monitor (or press Enter to skip):${NC}"
read SESSION_ID

if [ ! -z "$SESSION_ID" ]; then
    echo -e "${GREEN}Monitoring session: $SESSION_ID${NC}"
    while true; do
        clear
        echo -e "${BLUE}=== Game State ===${NC}"
        curl -k -s "${BASE_URL}/games/cli/session/${SESSION_ID}" | jq '.session.score, .session.positions'
        echo -e "\n${YELLOW}Press Ctrl+C to stop monitoring${NC}"
        sleep 1
    done
else
    echo -e "${YELLOW}Skipped session monitoring${NC}"
fi

echo -e "\n${GREEN}✓ CLI API tests completed!${NC}"
