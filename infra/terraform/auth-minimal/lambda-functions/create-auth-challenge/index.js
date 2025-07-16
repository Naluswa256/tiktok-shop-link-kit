// Lambda function for creating auth challenge (SMS OTP)
exports.handler = async (event) => {
    console.log('Create Auth Challenge Event:', JSON.stringify(event, null, 2));
    
    if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in private challenge parameters
        event.response.privateChallengeParameters = {
            answer: otp
        };
        
        // Set public challenge parameters (sent to client)
        event.response.publicChallengeParameters = {
            phone: event.request.userAttributes.phone_number
        };
        
        // Set challenge metadata
        event.response.challengeMetadata = 'CUSTOM_CHALLENGE';
        
        console.log('Generated OTP for phone:', event.request.userAttributes.phone_number);
    }
    
    return event;
};
