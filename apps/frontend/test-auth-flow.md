# Frontend Authentication Flow Testing Guide

## 🧪 Testing the Complete Auth Flow

### Prerequisites
1. **Backend API running** on `http://localhost:3001`
2. **Frontend dev server** running on `http://localhost:5173`
3. **Valid TikTok handle** for testing (e.g., `charlidamelio`)

### Test Scenarios

#### ✅ **Scenario 1: Successful Signup Flow**
1. **Navigate to** `http://localhost:5173`
2. **Click** "Get My Shop Link" button
3. **Step 1 - Handle Validation:**
   - Enter: `@charlidamelio`
   - Click "Validate Handle"
   - Should show: ✅ "Found @charlidamelio"
   - Button changes to "Continue"

4. **Step 2 - Phone Number:**
   - Select country code: `+256` (Uganda)
   - Enter phone: `742670421`
   - Click "Send Code"
   - Should show: "OTP sent to +256 742670421"

5. **Step 3 - OTP Verification:**
   - Enter the 6-digit code from SMS
   - Click "Verify & Continue"
   - Should redirect to subscription prompt

6. **Subscription Prompt:**
   - Modal appears: "Welcome to BuyLink UG! 🎉"
   - Shows shop preview: `@charlidamelio's Shop`
   - Click "Start Free Trial"
   - Should redirect to `/shop/charlidamelio`

#### ❌ **Scenario 2: Invalid Handle**
1. **Step 1:** Enter `@invalidhandle123456789`
2. **Click** "Validate Handle"
3. **Should show:** ❌ "Handle not found on TikTok"
4. **Button remains disabled**

#### ❌ **Scenario 3: Invalid Phone**
1. **Step 1:** Valid handle
2. **Step 2:** Enter invalid phone like `123`
3. **Button should be disabled** until valid phone entered

#### ❌ **Scenario 4: Invalid OTP**
1. **Complete Steps 1-2** successfully
2. **Step 3:** Enter wrong OTP like `000000`
3. **Should show error:** "Invalid verification code"

### Expected UI States

#### **Loading States**
- ⏳ Handle validation: "Validating..." with spinner
- ⏳ Sending OTP: "Sending..." with spinner  
- ⏳ Verifying OTP: "Verifying..." with spinner
- ⏳ Starting trial: "Starting Trial..." with spinner

#### **Success States**
- ✅ Valid handle: Green checkmark + "Found @handle"
- ✅ OTP sent: Toast notification
- ✅ Account created: Toast + redirect
- ✅ Trial started: Toast + shop access

#### **Error States**
- ❌ Invalid handle: Red X + error message
- ❌ Network error: Toast notification
- ❌ Invalid OTP: Inline error message

### API Integration Points

#### **Handle Validation**
```
POST /api/v1/auth/validate-handle
Body: { "handle": "charlidamelio" }
Response: { "success": true, "data": { "exists": true, ... } }
```

#### **Signup (Send OTP)**
```
POST /api/v1/auth/signup  
Body: { "handle": "charlidamelio", "phoneNumber": "+256742670421" }
Response: { "success": true, "data": { "session": "...", ... } }
```

#### **Verify OTP**
```
POST /api/v1/auth/verify-signup
Body: { "handle": "charlidamelio", "phoneNumber": "+256742670421", "code": "123456" }
Response: { "success": true, "data": { "accessToken": "...", ... } }
```

### Browser Storage

#### **After Successful Signup:**
- `localStorage.buylink_access_token`: JWT access token
- `localStorage.buylink_refresh_token`: JWT refresh token  
- `localStorage.buylink_user`: User object JSON
- `localStorage.buylink_trial_started`: "true"
- `localStorage.buylink_trial_start_date`: ISO date string

### Mobile Testing
- **Test on mobile viewport** (375px width)
- **Touch targets** should be at least 48px
- **OTP input** should trigger numeric keyboard
- **Form validation** should work on mobile

### Performance Checks
- **Handle validation** should cache results (5 minutes)
- **Session reuse** should avoid duplicate Cognito calls
- **Loading states** should be responsive
- **Error recovery** should allow retry

### Accessibility
- **Screen reader** announcements for state changes
- **Keyboard navigation** through all steps
- **Focus management** between steps
- **Error announcements** with `role="alert"`
