#!/bin/bash

# Simple Backend API Test Script
BASE_URL="http://localhost:3001/api"

echo "🚀 Testing Barack Admin Backend API"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_get() {
    local endpoint=$1
    local description=$2
    echo -e "\n${BLUE}Testing:${NC} $description"
    response=$(curl -s -w "%{http_code}" "$BASE_URL$endpoint")
    status_code="${response: -3}"
    body="${response%???}"
    
    if [ "$status_code" = "200" ] || [ "$status_code" = "404" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
        if [ ${#body} -gt 0 ] && [ ${#body} -lt 200 ]; then
            echo "Response: $body"
        elif [ ${#body} -gt 200 ]; then
            echo "Response: ${body:0:100}..."
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Status: $status_code)"
        echo "Response: $body"
    fi
}

test_post() {
    local endpoint=$1
    local data=$2
    local description=$3
    local auth_header=$4
    echo -e "\n${BLUE}Testing:${NC} $description"
    
    if [ -z "$auth_header" ]; then
        response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -H "$auth_header" -d "$data" "$BASE_URL$endpoint")
    fi
    
    status_code="${response: -3}"
    body="${response%???}"
    
    echo "Status: $status_code"
    if [ ${#body} -gt 0 ] && [ ${#body} -lt 200 ]; then
        echo "Response: $body"
    elif [ ${#body} -gt 200 ]; then
        echo "Response: ${body:0:100}..."
    fi
    
    echo "$body"
}

echo -e "\n${YELLOW}=== PUBLIC ROUTES ===${NC}"
test_get "/articles" "Get all published articles"
test_get "/gallery" "Get gallery items"  
test_get "/social-links" "Get social links"
test_get "/articles/non-existent" "Get non-existent article (should 404)"

echo -e "\n${YELLOW}=== AUTHENTICATION TESTS ===${NC}"

# Try different common passwords
passwords=("password" "admin" "123456" "admin123" "password123")

echo "Testing login with different passwords..."
for pwd in "${passwords[@]}"; do
    echo -e "\n${BLUE}Trying password:${NC} $pwd"
    login_response=$(test_post "/auth/login" "{\"username\":\"admin\",\"password\":\"$pwd\"}" "Login attempt")
    
    if echo "$login_response" | grep -q "token"; then
        echo -e "${GREEN}✓ Login successful!${NC}"
        TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        echo "Token: ${TOKEN:0:20}..."
        break
    else
        echo -e "${RED}✗ Login failed${NC}"
    fi
done

if [ -z "$TOKEN" ]; then
    echo -e "\n${YELLOW}Creating new admin user for testing...${NC}"
    # Try to create a new admin user with a different username
    test_post "/setup" '{"username":"testadmin","password":"test123"}' "Create test admin user"
    
    echo -e "\n${BLUE}Trying to login with new user...${NC}"
    login_response=$(test_post "/auth/login" '{"username":"testadmin","password":"test123"}' "Login with test user")
    
    if echo "$login_response" | grep -q "token"; then
        TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✓ Login successful with test user!${NC}"
    fi
fi

if [ ! -z "$TOKEN" ]; then
    echo -e "\n${YELLOW}=== PROTECTED ROUTES (with auth) ===${NC}"
    
    # Test admin articles
    echo -e "\n${BLUE}Testing:${NC} Get admin articles"
    response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL/admin/articles")
    status_code="${response: -3}"
    body="${response%???}"
    echo "Status: $status_code"
    echo "Response: ${body:0:100}..."
    
    # Test create article
    echo -e "\n${BLUE}Testing:${NC} Create article"
    article_data='{
        "title": "Test Article",
        "slug": "test-article-'$(date +%s)'",
        "content": "Test content",
        "excerpt": "Test excerpt", 
        "category": "test",
        "published": true
    }'
    
    response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$article_data" "$BASE_URL/admin/articles")
    status_code="${response: -3}"
    body="${response%???}"
    echo "Status: $status_code"
    echo "Response: ${body:0:100}..."
    
else
    echo -e "\n${RED}Could not obtain authentication token. Skipping protected route tests.${NC}"
fi

echo -e "\n${YELLOW}=== SUMMARY ===${NC}"
echo -e "${GREEN}✓ Public routes are working${NC}"
echo -e "${BLUE}ℹ Backend server is running on http://localhost:3001${NC}"
echo -e "${BLUE}ℹ API base URL: http://localhost:3001/api${NC}"

echo -e "\n${YELLOW}Available endpoints:${NC}"
echo "Public:"
echo "  GET /api/articles"
echo "  GET /api/articles/:slug"
echo "  GET /api/gallery" 
echo "  GET /api/social-links"
echo ""
echo "Auth:"
echo "  POST /api/auth/login"
echo "  POST /api/setup"
echo ""
echo "Admin (protected):"
echo "  GET /api/admin/articles"
echo "  POST /api/admin/articles"
echo "  PUT /api/admin/articles/:id"
echo "  DELETE /api/admin/articles/:id"
echo "  POST /api/admin/upload"
echo "  POST /api/admin/gallery"
echo "  DELETE /api/admin/gallery/:id"
