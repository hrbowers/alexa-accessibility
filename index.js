// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        /**
         * sessionAttributes - Directs user path by tracking which intent they came from.
         * sessionAttributes.previousIntent - Must be manually set in order to track it.
         *  Value of previousIntent can be checked to determine what the 'yes' was in 
         *  response to.
         * 
         * This allows us to use the 'yes' response to more than one question.
         * */
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'LaunchRequest';
        
        const speakOutput = 'Welcome to the appeal process. If successful, you will reactivate your account. A plan' +
        ' of action includes, the root cause of the issue, the actions you have taken to resolve the issue, and the steps' +
        ' you have taken to prevent the issue going forward. Would you like to begin with the first question?';
        
        //TODO
        /**
         * repromptText is meant to be called if the user responsed with an undefined answer.
         * However, It is not fully implemented yet.
         * It can come to this, but, only after a second bad response.
         * */
         
        const repromptText = 'I didn\'t quite get that. Would you like to begin with the first question? Answer with yes, or no.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptText)
            .getResponse();
    }
};

// Invoked by responding with 'the root cause of the issue'
const RootCauseHandler = {
    canHandle(handlerInput) {
        
        /**
         * Ensures we come from 'yes' through 'LaunchRequest'
         * 
         * Otherwise 'yes' could take us here after any other question if the user invoked
         * 'the root cause of the issue' 
         * */
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RootCause'
        && sessionAttributes.previousIntent === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'RootCause';
        
        const answer = handlerInput.requestEnvelope.request.intent.slots.Query.value;

        const speechOutput = "You have entered that the root cause of the issue " + answer+
        ". Is this the response that you would like to submit?";
        
        
        return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt()
        .getResponse();
    }
}

/**
 * Many parts of this Alexa skill wants confirmation that what they entered is sufficient.
 * A yes or no is the answer to that question. This intent directs those yes or no's to
 * the proper path.
 * */
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    handle(handlerInput) {
        var speechOutput = "";
        const reprompt = "I'm sorry, I didn't get that. What is the root cause of the issue?";
        
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        //const 
        
        // Question 1
        if(sessionAttributes.previousIntent === 'LaunchRequest') {
            speechOutput = "Great, let's get started. What is the root cause of the issue?";
        }
        
        // Question 1 complete, continue?
        else if (sessionAttributes.previousIntent === 'RootCause') {
            speechOutput = "Awesome, would you like to continue on to the next question?";
            sessionAttributes.previousIntent = 'RootCauseCont';
        } 
        
        // Question 2
        else if (sessionAttributes.previousIntent === 'RootCauseCont') {
            speechOutput = "Okay! What actions have you taken to resolve the issue?";
        }

        return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(reprompt)
        .getResponse();
        
    }
}
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        RootCauseHandler,
        YesIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler
    )
    .lambda();
