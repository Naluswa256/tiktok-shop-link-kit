// Lambda function for verifying auth challenge response
exports.handler = async (event) => {
    console.log('Verify Auth Challenge Event:', JSON.stringify(event, null, 2));
    
    const { request, response } = event;
    
    // Get the expected answer from private challenge parameters
    const expectedAnswer = request.privateChallengeParameters.answer;
    
    // Get the user's answer
    const userAnswer = request.challengeAnswer;
    
    // Compare answers
    if (userAnswer === expectedAnswer) {
        response.answerCorrect = true;
        console.log('OTP verification successful');
    } else {
        response.answerCorrect = false;
        console.log('OTP verification failed. Expected:', expectedAnswer, 'Got:', userAnswer);
    }
    
    return event;
};
