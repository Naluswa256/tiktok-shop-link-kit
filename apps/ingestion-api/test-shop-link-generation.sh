#!/bin/bash

# TikTok Commerce Shop Link Generation Test Script
# This script tests the complete shop link generation flow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:3001/api/v1"
TEST_HANDLE="testshop$(date +%s)"  # Unique handle for testing
TEST_PHONE="+256701234567"

echo -e "${BLUE}🧪 Testing TikTok Commerce Shop Link Generation${NC}"
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

# Function to make API calls and extract data
make_api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth_header=$4
    
    if [ -n "$auth_header" ]; then
        curl -s -w "\n%{http_code}" -X "$method" "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $auth_header" \
            ${data:+-d "$data"}
    else
        curl -s -w "\n%{http_code}" -X "$method" "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"}
    fi
}

# Step 1: Validate Handle (using a known valid handle for testing)
echo -e "${GREEN}=== Step 1: Handle Validation ===${NC}"
print_test "Validating TikTok handle"

# Use a known valid handle for testing (you can change this)
VALID_HANDLE="charlidamelio"
response=$(make_api_call "POST" "/auth/validate-handle" "{\"handle\":\"$VALID_HANDLE\"}")
status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

echo "Request: POST $API_BASE_URL/auth/validate-handle"
echo "Body: {\"handle\":\"$VALID_HANDLE\"}"
echo "Status: $status_code"
echo "Response:"
echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
echo ""

if [ "$status_code" -eq 200 ]; then
    print_success "Handle validation successful"
else
    print_error "Handle validation failed"
    exit 1
fi

# Step 2: Initiate Signup
echo -e "${GREEN}=== Step 2: Signup Initiation ===${NC}"
print_test "Initiating signup with validated handle"

response=$(make_api_call "POST" "/auth/signup" "{\"handle\":\"$VALID_HANDLE\",\"phoneNumber\":\"$TEST_PHONE\"}")
status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

echo "Request: POST $API_BASE_URL/auth/signup"
echo "Body: {\"handle\":\"$VALID_HANDLE\",\"phoneNumber\":\"$TEST_PHONE\"}"
echo "Status: $status_code"
echo "Response:"
echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
echo ""

if [ "$status_code" -eq 200 ]; then
    print_success "Signup initiated successfully"
    print_warning "SMS OTP should be sent to $TEST_PHONE"
else
    print_error "Signup initiation failed"
    if [ "$status_code" -eq 409 ]; then
        print_warning "User might already exist - this is expected in repeated tests"
    else
        exit 1
    fi
fi

# Step 3: Manual OTP Input
echo -e "${GREEN}=== Step 3: OTP Verification ===${NC}"
print_warning "This step requires manual input of the OTP code"
echo -e "${YELLOW}Please check your phone for the OTP code and enter it below:${NC}"
read -p "Enter OTP code (or press Enter to skip): " OTP_CODE

if [ -n "$OTP_CODE" ]; then
    print_test "Verifying OTP and completing signup"
    
    response=$(make_api_call "POST" "/auth/verify-signup" "{\"handle\":\"$VALID_HANDLE\",\"phoneNumber\":\"$TEST_PHONE\",\"code\":\"$OTP_CODE\"}")
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    echo "Request: POST $API_BASE_URL/auth/verify-signup"
    echo "Body: {\"handle\":\"$VALID_HANDLE\",\"phoneNumber\":\"$TEST_PHONE\",\"code\":\"$OTP_CODE\"}"
    echo "Status: $status_code"
    echo "Response:"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
    echo ""
    
    if [ "$status_code" -eq 200 ]; then
        print_success "OTP verification successful"
        print_success "User account created"
        print_success "Shop link should be generated"
        
        # Extract access token for next steps
        ACCESS_TOKEN=$(echo "$response_body" | jq -r '.data.accessToken' 2>/dev/null)
        if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
            print_success "Access token obtained"
            
            # Step 4: Verify Shop Link Creation
            echo -e "${GREEN}=== Step 4: Shop Link Verification ===${NC}"
            print_test "Fetching shop data to verify link generation"
            
            response=$(make_api_call "GET" "/shop/$VALID_HANDLE" "" "$ACCESS_TOKEN")
            status_code=$(echo "$response" | tail -n1)
            response_body=$(echo "$response" | head -n -1)
            
            echo "Request: GET $API_BASE_URL/shop/$VALID_HANDLE"
            echo "Status: $status_code"
            echo "Response:"
            echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
            echo ""
            
            if [ "$status_code" -eq 200 ]; then
                print_success "Shop data retrieved successfully"
                
                # Extract shop link
                SHOP_LINK=$(echo "$response_body" | jq -r '.data.shopLink' 2>/dev/null)
                if [ "$SHOP_LINK" != "null" ] && [ -n "$SHOP_LINK" ]; then
                    print_success "Shop link generated: $SHOP_LINK"
                    print_success "Expected format: /shop/$VALID_HANDLE"
                    
                    if [ "$SHOP_LINK" = "/shop/$VALID_HANDLE" ]; then
                        print_success "Shop link format is correct"
                    else
                        print_error "Shop link format is incorrect"
                    fi
                else
                    print_error "Shop link not found in response"
                fi
                
                # Check subscription status
                SUBSCRIPTION_STATUS=$(echo "$response_body" | jq -r '.data.subscriptionStatus' 2>/dev/null)
                if [ "$SUBSCRIPTION_STATUS" = "trial" ]; then
                    print_success "Subscription status is 'trial' (correct for new users)"
                else
                    print_warning "Subscription status: $SUBSCRIPTION_STATUS"
                fi
                
            else
                print_error "Failed to retrieve shop data"
            fi
        else
            print_error "Failed to extract access token"
        fi
    else
        print_error "OTP verification failed"
    fi
else
    print_warning "OTP verification skipped"
fi

echo ""
echo -e "${GREEN}🎉 Shop Link Generation Test Complete!${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo "- Handle validation should return 200 with handle details"
echo "- Signup should return 200 and send SMS OTP"
echo "- OTP verification should return 200 with access token and user data"
echo "- Shop endpoint should return 200 with shop link in format /shop/{handle}"
echo "- New users should have subscription status 'trial'"
echo ""
echo -e "${YELLOW}💡 Expected Flow:${NC}"
echo "1. User signs up with valid TikTok handle"
echo "2. System validates handle exists on TikTok"
echo "3. System creates user account and shop entry"
echo "4. Shop link is generated: /shop/{handle}"
echo "5. ShopLinkGeneratedEvent is emitted to SNS"
echo "6. User can access their shop at the generated link"
echo ""
echo -e "${YELLOW}🔗 Test the shop link in browser:${NC}"
echo "http://localhost:8080/shop/$VALID_HANDLE"
