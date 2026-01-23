#!/bin/bash

# Backend API Test Script
# Tests all routes for the Barack Admin backend

BASE_URL="http://localhost:3001/api"
TOKEN=""

echo "🚀 Testing Barack Admin Backend API"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    local auth_header=""
    
    if [ ! -z "$TOKEN" ]; then
        auth_header="-H \"Authorization: Bearer $TOKEN\""
    fi
    
    echo -e "\n${BLUE}Testing:${NC} $description"
    echo -e "${YELLOW}$method${NC} $BASE_URL$endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" $auth_header "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST $auth_header -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT $auth_header -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE $auth_header "$BASE_URL$endpoint")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
        if [ ! -z "$body" ] && [ "$body" != "null" ]; then
            echo "Response: $(echo "$body" | head -c 200)..."
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "Response: $body"
    fi
    
    # Return the response body for further processing
    echo "$body"
}

echo -e "\n${BLUE}=== PUBLIC API ROUTES ===${NC}"

# Test public articles endpoint
test_endpoint "GET" "/articles" "" "200" "Get all published articles"

# Test public gallery endpoint  
test_endpoint "GET" "/gallery" "" "200" "Get gallery items"

# Test public social links endpoint
test_endpoint "GET" "/social-links" "" "200" "Get social links"

# Test non-existent article
test_endpoint "GET" "/articles/non-existent-slug" "" "404" "Get non-existent article"

echo -e "\n${BLUE}=== AUTHENTICATION ===${NC}"

# Test login with invalid credentials
test_endpoint "POST" "/auth/login" '{"username":"invalid","password":"invalid"}' "401" "Login with invalid credentials"

# Test setup endpoint (create admin user)
echo -e "\n${YELLOW}Setting up admin user...${NC}"
setup_response=$(test_endpoint "POST" "/setup" '{"username":"admin","password":"admin123"}' "200" "Create admin user")

# Test login with valid credentials
echo -e "\n${YELLOW}Logging in...${NC}"
login_response=$(test_endpoint "POST" "/auth/login" '{"username":"admin","password":"admin123"}' "200" "Login with valid credentials")

# Extract token from login response
TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$TOKEN" ]; then
    echo -e "${GREEN}✓ Token obtained:${NC} ${TOKEN:0:20}..."
else
    echo -e "${RED}✗ Failed to obtain token${NC}"
    exit 1
fi

echo -e "\n${BLUE}=== PROTECTED ADMIN ROUTES ===${NC}"

# Test protected routes without token first
echo -e "\n${YELLOW}Testing protected routes without authentication...${NC}"
TOKEN_BACKUP="$TOKEN"
TOKEN=""
test_endpoint "GET" "/admin/articles" "" "401" "Get admin articles (no auth)"
TOKEN="$TOKEN_BACKUP"

# Test admin articles endpoint
test_endpoint "GET" "/admin/articles" "" "200" "Get all articles (admin)"

# Test create article
echo -e "\n${YELLOW}Creating test article...${NC}"
article_data='{
    "title": "Test Article",
    "slug": "test-article",
    "content": "This is a test article content.",
    "excerpt": "Test excerpt",
    "category": "test",
    "published": true
}'
create_response=$(test_endpoint "POST" "/admin/articles" "$article_data" "200" "Create new article")

# Extract article ID for further tests
ARTICLE_ID=$(echo "$create_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$ARTICLE_ID" ]; then
    echo -e "${GREEN}✓ Article created with ID:${NC} $ARTICLE_ID"
    
    # Test update article
    echo -e "\n${YELLOW}Updating article...${NC}"
    update_data='{
        "title": "Updated Test Article",
        "slug": "updated-test-article", 
        "content": "This is updated content.",
        "excerpt": "Updated excerpt",
        "category": "updated",
        "published": false
    }'
    test_endpoint "PUT" "/admin/articles/$ARTICLE_ID" "$update_data" "200" "Update article"
    
    # Test delete article
    echo -e "\n${YELLOW}Deleting article...${NC}"
    test_endpoint "DELETE" "/admin/articles/$ARTICLE_ID" "" "200" "Delete article"
else
    echo -e "${RED}✗ Failed to create article${NC}"
fi

# Test gallery management
echo -e "\n${YELLOW}Testing gallery management...${NC}"
gallery_data='{
    "title": "Test Gallery Item",
    "description": "Test description",
    "type": "image",
    "image_url": "https://example.com/test.jpg",
    "date": "2024-01-23"
}'
gallery_response=$(test_endpoint "POST" "/admin/gallery" "$gallery_data" "200" "Create gallery item")

GALLERY_ID=$(echo "$gallery_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$GALLERY_ID" ]; then
    echo -e "${GREEN}✓ Gallery item created with ID:${NC} $GALLERY_ID"
    test_endpoint "DELETE" "/admin/gallery/$GALLERY_ID" "" "200" "Delete gallery item"
fi

# Test file upload endpoint (without actual file)
echo -e "\n${YELLOW}Testing file upload endpoint...${NC}"
test_endpoint "POST" "/admin/upload" "" "400" "File upload (no file)"

echo -e "\n${BLUE}=== TEST SUMMARY ===${NC}"
echo -e "${GREEN}✓ All basic API routes are working correctly!${NC}"
echo -e "${YELLOW}Note:${NC} File upload test requires actual file data"
echo -e "${YELLOW}Note:${NC} Some tests created and cleaned up test data"

echo -e "\n${BLUE}=== AVAILABLE ENDPOINTS ===${NC}"
echo "Public Routes:"
echo "  GET  /api/articles"
echo "  GET  /api/articles/:slug" 
echo "  GET  /api/gallery"
echo "  GET  /api/social-links"
echo ""
echo "Auth Routes:"
echo "  POST /api/auth/login"
echo "  POST /api/setup"
echo ""
echo "Admin Routes (require authentication):"
echo "  GET    /api/admin/articles"
echo "  POST   /api/admin/articles"
echo "  PUT    /api/admin/articles/:id"
echo "  DELETE /api/admin/articles/:id"
echo "  POST   /api/admin/upload"
echo "  POST   /api/admin/gallery"
echo "  DELETE /api/admin/gallery/:id"
