
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
            && sessionAttributes.previousIntent === 'Continue';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'RootCause';

        sessionAttributes.qst1 = handlerInput.requestEnvelope.request.intent.slots.Query.value;

        const speechOutput = "You have entered that the root cause of the issue " + sessionAttributes.qst1 +
            ". Is this the response that you would like to submit?";


        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt()
            .getResponse();
    }
}

const ActionTakenHandler = {
    canHandle(handlerInput){
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ActionTaken'
            && sessionAttributes.previousIntent === 'GoToActionTaken';
    },
    handle(handlerInput){
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'ActionTaken';

        sessionAttributes.qst2 = handlerInput.requestEnvelope.request.intent.slots.Query.value;

        const speechOutput = "The steps you have taken are " + sessionAttributes.qst2 +
            ". Is this correct?";

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt()
            .getResponse();
    }
}

const StepsTakenHandler = {
    canHandle(handlerInput){
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StepsTaken'
        && sessionAttributes.previousIntent === 'GoToStepsTaken';
    },
    handle(handlerInput){
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'StepsTaken';

        sessionAttributes.qst3 = handlerInput.requestEnvelope.request.intent.slots.Query.value;

        const speechOutput = "The steps you have taken to prevent further issues are "
        + sessionAttributes.qst3 + ". Is this correct?";

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
 **/

 /*
 * DevNote: This works, but I think there are better ways to do this using the dialog model
 * tools. Will investigate this next sprint. -Jeremy
 * */
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    handle(handlerInput) {
        var speechOutput = "";
        var reprompt = "";

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var prevIntent = sessionAttributes.previousIntent;

        // Question 1 Root Cause
        if (prevIntent === 'LaunchRequest' 
        	|| prevIntent === 'AMAZON.HelpIntent' 
        		|| prevIntent === 'noContinue') {
            
        	reprompt = "I'm sorry, I didn't get that. What is the root cause of the issue?";
        	// US44_TSK45 Steven Foust
            if(prevIntent === 'noContinue') {                
            	speechOutput = 'Ok, let\'s try this again. What is the root cause of the issue?';            	
            } else {                
            	speechOutput = "Great, let's get started. What is the root cause of the issue?";            	
            }
            
            sessionAttributes.previousIntent = 'Continue';
        }


        // Question 2 Action Taken
        else if (prevIntent === 'RootCause'
        	|| prevIntent === 'noActionTaken') {
        	
        	// US44_TSK46 Steven Foust
        	if (prevIntent === 'noActionTaken') {	
        		speechOutput = 'Ok, let\'s try this again. What actions have you taken to resolve the issue?';
        	} else {
        		speechOutput = "Okay! What actions have you taken to resolve the issue?";
        	}
            
            sessionAttributes.previousIntent = 'GoToActionTaken';
        }

        // Question 3 Steps Taken
        else if (prevIntent === 'ActionTaken'){
            speechOutput = "Okay, what steps have you taken to prevent this from happening again?";
            sessionAttributes.previousIntent = 'GoToStepsTaken';
        }

        // Completion
        else if (prevIntent === 'StepsTaken'){
            speechOutput = "This completes the appeals process. Please wait to hear from Amazon " +
            "regarding the status of your reinstatement.";
        }

        //From cancel intent
        else if (prevIntent === 'AMAZON.CancelIntent') {
            speechOutput = 'Okay.  Please complete the appeal process at your earliest convenience to reinstate your account.  Good bye.';
            
            /* Repeated code
            return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();
            */
        }

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();

    }
}

// US44_TSK45 Steven Foust
const NoIntentHandler = {
	    canHandle(handlerInput) {
	        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
	            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
	    },
	    handle(handlerInput) {
	        var speechOutput = "There is an error";
            var reprompt = "";
            
	        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
	        var prevIntent = sessionAttributes.previousIntent;
	        
	        // US44_TSK45 Steven Foust
	        if (prevIntent === 'RootCause') {
	            
	        	speechOutput = "Ok, would you like to try and answer root cause again?";
	            reprompt = "I didn't quite get that. You could say, yes, or you could say, cancel.";
	            
	            sessionAttributes.previousIntent = 'noContinue';
	        
	        // US44_TSK46 Steven Foust    
	        } else if (prevIntent === 'ActionTaken') {
	        	
	        	speechOutput = "Ok, would you like to try and answer action taken again?";
	        	reprompt = "I didn't quite get that. You could say, yes, or you could say, cancel.";
	        	
	        	sessionAttributes.previousIntent = 'noActionTaken';
	        
	        // US44_TSK46 Steven Foust
	        } else if (prevIntent === 'noContinue'
	        	|| prevIntent === 'noActionTaken'
	        		|| prevIntent === 'noStepsTaken') {
	        	speechOutput = 'Okay.  Please complete the appeal process at your earliest convenience to reinstate your account.  Good bye.';

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
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'AMAZON.HelpIntent';

        const speakOutput = 'To complete an appeal, you must explain the root cause of your issue, what you have done to resolve the issue, and how you will prevent this issue from happening again.  I will guide you through each question.  Are you ready to start now?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Your responses have not been saved and your account is still suspended.  Are you sure you want to stop?';

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'AMAZON.CancelIntent';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Are you sure you want to stop now?')
            .getResponse();
    }
};

const StopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Stop triggered';
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
        const speakOutput = 'Session Ended';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
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
        ActionTakenHandler,
        StepsTakenHandler,
        YesIntentHandler,
        NoIntentHandler,
        HelpIntentHandler,
        CancelIntentHandler,
        StopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler
    )
    .lambda();