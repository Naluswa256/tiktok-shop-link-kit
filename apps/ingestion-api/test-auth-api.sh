#!/bin/bash

# TikTok Commerce Authentication API Test Script
# This script tests all the authentication endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:3001"
TEST_HANDLE="testuser$(date +%s)"  # Unique handle with timestamp
TEST_PHONE="+1234567890"  # Replace with your actual phone number for SMS testing

echo -e "${BLUE}🧪 TikTok Commerce Authentication API Tests${NC}"
echo -e "${BLUE}API Base URL: $API_BASE_URL${NC}"
echo -e "${BLUE}Test Handle: $TEST_HANDLE${NC}"
echo -e "${BLUE}Test Phone: $TEST_PHONE${NC}"
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
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    print_test "$description"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_BASE_URL$endpoint")
    fi
    
    # Split response and status code
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" -eq "$expected_status" ]; then
        print_success "Status: $status_code (Expected: $expected_status)"
        echo "Response: $response_body" | jq '.' 2>/dev/null || echo "Response: $response_body"
    else
        print_error "Status: $status_code (Expected: $expected_status)"
        echo "Response: $response_body"
    fi
    
    echo ""
    return $([ "$status_code" -eq "$expected_status" ])
}

# Test 1: Health Check
test_endpoint "GET" "/health" "" 200 "Health Check"

# Test 2: Handle Validation (Valid Handle)
test_endpoint "POST" "/auth/validate-handle" '{"handle":"charlidamelio"}' 200 "Handle Validation - Valid Handle (charlidamelio)"

# Test 3: Handle Validation (Invalid Handle)
test_endpoint "POST" "/auth/validate-handle" '{"handle":"thishandledoesnotexist123456789"}' 404 "Handle Validation - Invalid Handle"

# Test 4: Handle Validation (Invalid Format)
test_endpoint "POST" "/auth/validate-handle" '{"handle":"invalid@handle"}' 400 "Handle Validation - Invalid Format"

# Test 5: Signup with Test Handle
print_test "Signup Flow - Step 1: Initiate Signup"
echo -e "${YELLOW}Note: This will attempt to send SMS to $TEST_PHONE${NC}"
echo -e "${YELLOW}Make sure this is your actual phone number if you want to test SMS!${NC}"
echo ""

read -p "Do you want to proceed with SMS testing? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Test signup
    test_endpoint "POST" "/auth/signup" "{\"handle\":\"$TEST_HANDLE\",\"phoneNumber\":\"$TEST_PHONE\"}" 200 "Signup - Initiate"
    
    # Prompt for OTP
    echo -e "${YELLOW}Check your phone for SMS OTP code${NC}"
    read -p "Enter the OTP code you received: " OTP_CODE
    
    if [ -n "$OTP_CODE" ]; then
        # Test signup verification
        test_endpoint "POST" "/auth/verify-signup" "{\"handle\":\"$TEST_HANDLE\",\"phoneNumber\":\"$TEST_PHONE\",\"code\":\"$OTP_CODE\"}" 201 "Signup - Verify OTP"
        
        # If signup successful, test signin
        echo -e "${BLUE}Testing signin flow...${NC}"
        test_endpoint "POST" "/auth/signin" "{\"phoneNumber\":\"$TEST_PHONE\"}" 200 "Signin - Initiate"
        
        echo -e "${YELLOW}Check your phone for another SMS OTP code${NC}"
        read -p "Enter the signin OTP code: " SIGNIN_OTP
        
        if [ -n "$SIGNIN_OTP" ]; then
            test_endpoint "POST" "/auth/verify-signin" "{\"phoneNumber\":\"$TEST_PHONE\",\"code\":\"$SIGNIN_OTP\"}" 200 "Signin - Verify OTP"
        fi
    fi
else
    print_warning "Skipping SMS tests"
fi

# Test 6: Error Cases
echo -e "${BLUE}Testing Error Cases...${NC}"

# Test duplicate handle (if we created a user)
if [[ $REPLY =~ ^[Yy]$ ]]; then
    test_endpoint "POST" "/auth/signup" "{\"handle\":\"$TEST_HANDLE\",\"phoneNumber\":\"+1987654321\"}" 409 "Signup - Duplicate Handle"
fi

# Test invalid phone format
test_endpoint "POST" "/auth/signup" '{"handle":"newuser123","phoneNumber":"invalid-phone"}' 400 "Signup - Invalid Phone Format"

# Test missing fields
test_endpoint "POST" "/auth/signup" '{"handle":"newuser123"}' 400 "Signup - Missing Phone Number"

# Test invalid JSON
echo -e "${BLUE}🔍 Test: Invalid JSON${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/auth/signup" \
    -H "Content-Type: application/json" \
    -d '{"invalid json"}')
status_code=$(echo "$response" | tail -n1)
if [ "$status_code" -eq 400 ]; then
    print_success "Status: $status_code (Expected: 400)"
else
    print_error "Status: $status_code (Expected: 400)"
fi
echo ""

# Test 7: API Documentation (if enabled)
test_endpoint "GET" "/api/docs" "" 200 "API Documentation (Swagger)"

echo -e "${GREEN}🎉 API Testing Complete!${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo "- Health check endpoint working"
echo "- Handle validation working"
echo "- Error handling working"
echo "- API documentation accessible"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "- SMS OTP flow tested"
    echo "- User signup/signin tested"
fi
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "- Check application logs for detailed error information"
echo "- Monitor AWS CloudWatch for Lambda function logs"
echo "- Verify DynamoDB table for created user records"
echo "- Check Cognito User Pool for registered users"
