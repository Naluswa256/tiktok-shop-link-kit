#!/bin/bash

# TikTok Commerce Authentication - Signup Flow Test Script
# This script tests the signup flow with handle validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:3001/api/v1"

echo -e "${BLUE}🧪 Testing TikTok Commerce Signup Flow${NC}"
echo -e "${BLUE}API Base URL: $API_BASE_URL${NC}"
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

# Function to make API calls and check response
test_signup() {
    local handle=$1
    local phone=$2
    local expected_status=$3
    local description=$4
    
    print_test "$description"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"handle\":\"$handle\",\"phoneNumber\":\"$phone\"}")
    
    # Split response and status code
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    echo "Request: POST $API_BASE_URL/auth/signup"
    echo "Body: {\"handle\":\"$handle\",\"phoneNumber\":\"$phone\"}"
    echo "Status: $status_code (Expected: $expected_status)"
    
    if [ "$status_code" -eq "$expected_status" ]; then
        print_success "Status code matches expected"
    else
        print_error "Status code mismatch"
    fi
    
    # Pretty print JSON response
    echo "Response:"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
    echo ""
    
    return $([ "$status_code" -eq "$expected_status" ])
}

# Test 1: Valid TikTok handle with valid phone number
echo -e "${GREEN}=== Test 1: Valid Handle + Valid Phone ===${NC}"

# Test 2: Invalid TikTok handle
echo -e "${GREEN}=== Test 2: Invalid Handle ===${NC}"
test_signup "thishandledoesnotexist123456789" "+1234567891" 404 "Signup with non-existent TikTok handle"

# Test 3: Valid handle but invalid phone format
echo -e "${GREEN}=== Test 3: Valid Handle + Invalid Phone Format ===${NC}"
test_signup "charlidamelio" "invalid-phone" 400 "Signup with invalid phone number format"

# Test 4: Empty handle
echo -e "${GREEN}=== Test 4: Empty Handle ===${NC}"
test_signup "" "+1234567892" 400 "Signup with empty handle"

# Test 5: Handle with special characters
echo -e "${GREEN}=== Test 5: Handle with Special Characters ===${NC}"
test_signup "invalid@handle!" "+1234567893" 400 "Signup with invalid handle format"

# Test 6: Another valid handle (if you want to test multiple)
echo -e "${GREEN}=== Test 6: Another Valid Handle ===${NC}"
test_signup "khaby.lame" "+1234567894" 200 "Signup with another valid TikTok handle (khaby.lame)"

# Test 7: Duplicate phone number (if first signup was successful)
echo -e "${GREEN}=== Test 7: Duplicate Phone Number ===${NC}"
print_warning "This test will only work if Test 1 was successful and the user was created"
test_signup "zendaya" "+1234567890" 409 "Signup with already registered phone number"

echo -e "${GREEN}🎉 Signup Flow Tests Complete!${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo "- Valid handles should return 200 and initiate SMS OTP"
echo "- Invalid handles should return 404 with HANDLE_NOT_FOUND error"
echo "- Invalid phone formats should return 400 with validation error"
echo "- Duplicate phone numbers should return 409 with PHONE_ALREADY_EXISTS error"
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo "1. If Test 1 was successful, check your phone for SMS OTP"
echo "2. Use the verify-signup endpoint to complete the signup process"
echo "3. Test the signin flow with the registered phone number"
echo ""
echo -e "${YELLOW}📱 Verify Signup (if you received OTP):${NC}"
echo "curl -X POST $API_BASE_URL/auth/verify-signup \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"handle\":\"charlidamelio\",\"phoneNumber\":\"+1234567890\",\"code\":\"YOUR_OTP_CODE\"}'"
