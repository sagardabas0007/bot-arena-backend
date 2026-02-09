#!/bin/bash

# Bot Arena Backend API Test Script
# This script tests all major backend endpoints

# Set your backend URL (default: production)
BACKEND_URL="${1:-https://elegant-energy-production-bea0.up.railway.app}"

echo "🧪 Testing Bot Arena Backend API"
echo "Backend URL: $BACKEND_URL"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo "Testing: $description"
    echo "  → $method $endpoint"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BACKEND_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BACKEND_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "  ${GREEN}✓ Status: $http_code${NC}"
        echo "  Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body | head -c 100)"
    elif [ "$http_code" -ge 400 ] && [ "$http_code" -lt 500 ]; then
        echo -e "  ${YELLOW}⚠ Status: $http_code (Client Error)${NC}"
        echo "  Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body)"
    else
        echo -e "  ${RED}✗ Status: $http_code (Error)${NC}"
        echo "  Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body)"
    fi
    echo ""
}

# 1. Health Check
test_endpoint "GET" "/health" "Health Check"

# 2. Seed Arenas (run this first if database is empty)
echo "=================================="
echo "⚠️  Database Seeding"
echo "=================================="
test_endpoint "POST" "/api/arena/seed" "Seed Arena Tiers"

# 3. Arena Endpoints
echo "=================================="
echo "🏟️  Arena Endpoints"
echo "=================================="
test_endpoint "GET" "/api/arenas" "List All Arenas"
test_endpoint "GET" "/api/arena/list" "List Arenas (alt route)"

# 4. Bot Endpoints
echo "=================================="
echo "🤖 Bot Endpoints"
echo "=================================="
test_endpoint "GET" "/api/leaderboard?sortBy=wins&limit=10" "Get Leaderboard"

# 5. Game Endpoints
echo "=================================="
echo "🎮 Game Endpoints"
echo "=================================="
test_endpoint "GET" "/api/games/active" "List Active Games"

# 6. Stats Endpoints
echo "=================================="
echo "📊 Stats Endpoints"
echo "=================================="
test_endpoint "GET" "/api/stats/overview" "Get Overview Stats"

echo "=================================="
echo "✅ Testing Complete"
echo "=================================="
echo ""
echo "Note: Some endpoints may fail if:"
echo "  - Database is not seeded (run POST /api/arena/seed)"
echo "  - No bots or games exist in the database"
echo "  - Authentication/wallet address is required"
echo ""
echo "To test with local backend:"
echo "  ./test-endpoints.sh http://localhost:5000"
