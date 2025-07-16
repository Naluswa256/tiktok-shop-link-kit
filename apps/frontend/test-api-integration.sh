#!/bin/bash

# Frontend API Integration Test Script
# Tests the frontend API client against the backend endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:3001/api/v1"
FRONTEND_URL="http://localhost:5173"

echo -e "${BLUE}🧪 Testing Frontend API Integration${NC}"
echo -e "${BLUE}Backend API: $API_BASE_URL${NC}"
echo -e "${BLUE}Frontend URL: $FRONTEND_URL${NC}"
echo ""

# Function to print test results
print_test() {
    echo -e "${BLUE}🔍 Test: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Test 1: Backend API Health Check
print_test "Backend API Health Check"
if curl -s "$API_BASE_URL/auth/validate-handle" -X POST -H "Content-Type: application/json" -d '{"handle":"test"}' > /dev/null 2>&1; then
    print_success "Backend API is responding"
else
    print_error "Backend API is not responding. Make sure it's running on port 3001"
    exit 1
fi

# Test 2: Frontend Dev Server Check
print_test "Frontend Dev Server Check"
if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    print_success "Frontend dev server is running"
else
    print_error "Frontend dev server is not responding. Make sure it's running on port 5173"
    exit 1
fi

# Test 3: API Response Structure
print_test "API Response Structure - Valid Handle"
response=$(curl -s "$API_BASE_URL/auth/validate-handle" -X POST -H "Content-Type: application/json" -d '{"handle":"charlidamelio"}')
echo "Response: $response"

if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    print_success "API returns structured response with 'success' field"
else
    print_error "API response structure is incorrect"
fi

if echo "$response" | jq -e '.data' > /dev/null 2>&1; then
    print_success "API returns 'data' field"
else
    print_error "API response missing 'data' field"
fi

if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
    print_success "API returns 'message' field"
else
    print_error "API response missing 'message' field"
fi

# Test 4: Handle Validation Response
print_test "Handle Validation Data Structure"
if echo "$response" | jq -e '.data.exists' > /dev/null 2>&1; then
    print_success "Handle validation returns 'exists' field"
else
    print_error "Handle validation missing 'exists' field"
fi

# Test 5: Error Response Structure
print_test "API Error Response Structure"
error_response=$(curl -s "$API_BASE_URL/auth/validate-handle" -X POST -H "Content-Type: application/json" -d '{"handle":"thishandledoesnotexist123456789"}')
echo "Error Response: $error_response"

if echo "$error_response" | jq -e '.success == false' > /dev/null 2>&1; then
    print_success "API returns 'success: false' for errors"
else
    print_warning "API error response structure may need verification"
fi

# Test 6: CORS Headers
print_test "CORS Headers Check"
cors_response=$(curl -s -I "$API_BASE_URL/auth/validate-handle" -X OPTIONS)
if echo "$cors_response" | grep -i "access-control-allow-origin" > /dev/null; then
    print_success "CORS headers are present"
else
    print_warning "CORS headers may not be configured - check if frontend can make requests"
fi

echo ""
echo -e "${GREEN}🎉 API Integration Tests Complete!${NC}"
echo ""
echo -e "${BLUE}📋 Manual Testing Checklist:${NC}"
echo "1. Open browser to $FRONTEND_URL"
echo "2. Click 'Get My Shop Link' button"
echo "3. Test handle validation with 'charlidamelio'"
echo "4. Test phone number input with '+256742670421'"
echo "5. Check browser console for any API errors"
echo "6. Verify toast notifications appear"
echo "7. Check network tab for correct API calls"
echo ""
echo -e "${BLUE}🔧 Environment Variables:${NC}"
echo "Frontend .env file should contain:"
echo "VITE_API_URL=$API_BASE_URL"
echo ""
echo -e "${BLUE}🚨 Common Issues:${NC}"
echo "- CORS errors: Check backend CORS configuration"
echo "- 404 errors: Verify API endpoints match backend routes"
echo "- Network errors: Ensure both servers are running"
echo "- Type errors: Check response structure matches interfaces"
