
const Alexa = require('ask-sdk');
const dbHelper = require("./dbConnect");

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {        
        
        /**
         * sessionAttributes - Directs user path by tracking which intent they came from.
         * sessionAttributes.previousIntent - Must be manually set in order to track it.
         *  Value of previousIntent can be checked to determine what the 'yes' was in 
         *  response to.
         * 
         * This allows us to use the 'yes' response to more than one question.
         * */
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'LaunchRequest';


        const speakOutput = 'Welcome to the appeal process. Would you like to begin with the first question?';


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
            && (sessionAttributes.previousIntent === 'Continue'||sessionAttributes.previousIntent === 'startOver'||sessionAttributes.previousIntent === 'AMAZON.HelpIntent');
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'RootCause';

        sessionAttributes.qst1 = handlerInput.requestEnvelope.request.intent.slots.Query.value;

        const speechOutput = "You have entered that the root cause of the issue was " + sessionAttributes.qst1 +
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
            && (sessionAttributes.previousIntent === 'GoToActionTaken'||sessionAttributes.previousIntent === 'AMAZON.HelpIntent');
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
        && (sessionAttributes.previousIntent === 'GoToStepsTaken'||sessionAttributes.previousIntent === 'AMAZON.HelpIntent');
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

const StartOverHandler = {
    canHandle(handlerInput){
        console.log('start over can handle');
        console.log('request type ',Alexa.getRequestType(handlerInput.requestEnvelope));
        console.log('intent name ',Alexa.getIntentName(handlerInput.requestEnvelope));
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StartOver';
        
    },
    handle(handlerInput){
        console.log('start over main handler');
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.singleAnswerEntry = 'false';

        const speechOutput = "Ok, let us start again. What was the root cause of your issue?";

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
    async handle(handlerInput) {
        var speechOutput = "";
        var reprompt = "";


      const attributesManager = handlerInput.attributesManager;        
        const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var prevIntent = sessionAttributes.previousIntent;

        
        // Question 1
        if (prevIntent === 'LaunchRequest' || prevIntent === 'AMAZON.HelpIntent'|| prevIntent === 'noContinue') {
               
          reprompt = "I'm sorry, I didn't get that. What is the root cause of the issue?";         
            
          if(Object.keys(persistentAttributes).length ===0){
                sessionAttributes.poaId = 1;
                persistentAttributes.poaId = 2;
                attributesManager.setPersistentAttributes(persistentAttributes);
                await attributesManager.savePersistentAttributes();
            }else{
                sessionAttributes.poaId = persistentAttributes.poaId;
                persistentAttributes.poaId += 1;
                attributesManager.setPersistentAttributes(persistentAttributes);
                await attributesManager.savePersistentAttributes();
            }
            
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
        else if (prevIntent === 'ActionTaken'|| prevIntent === 'noStepsTaken'){
            if (prevIntent === 'noStepsTaken') {	
        		speechOutput = 'Ok, let\'s try this again. What steps have you taken to prevent this issue from happening again?';
        	} else {
        		speechOutput = "Okay! What steps have you taken to prevent this issue from happening again?";
        	}

            sessionAttributes.previousIntent = 'GoToStepsTaken';
        }

        //Confirm complete user entry before submission
        else if(prevIntent === 'StepsTaken'){
            let d1 = sessionAttributes.qst1;
            let d2 = sessionAttributes.qst2;
            let d3 = sessionAttributes.qst3;

            speechOutput = `Here is your completed plan of action. \ 
                You said the root cause of your issue was ${d1}, you fixed this issue by ${d2}, and this won't happen again because you will ${d3}. \
                  Does that sound right?`;

                sessionAttributes.previousIntent = 'finish';
        }
        
        //Finish and save to dynamo
        else if (prevIntent === 'finish'){
            
            //Collect poaId number and user input for storage into DynamoDb table
            let id = `${sessionAttributes.poaId}`;
            let d1 = sessionAttributes.qst1;
            let d2 = sessionAttributes.qst2;
            let d3 = sessionAttributes.qst3;

            let dbSave = saveAppeal(id,d1,d2,d3);

            if(dbSave){
                speechOutput = "This completes the appeals process. Please wait to hear from Amazon " +
                "regarding the status of your reinstatement.";

                //Exit point at end of skill
                return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();

            }else{
                speechOutput = "Database access failed";
            }
        }

        //From cancel intent
        else if (prevIntent === 'AMAZON.CancelIntent') {
            speechOutput = 'Okay.  Please complete the appeal process at your earliest convenience to reinstate your account.  Good bye.';
            
            //This is not repeated code.
            //This is an exit point so the skill can quit on a cancel request.
            //That's why there is no reprompt.
            // -JP
            return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();
            
        }

        //Speak output and await reprompt
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
            } 

            else if(prevIntent === 'StepsTaken'){
                
                speechOutput = "Ok, would you like to try and answer steps taken again?";
	        	reprompt = "I didn't quite get that. You could say, yes, or you could say, cancel.";
	        	
	        	sessionAttributes.previousIntent = 'noStepsTaken';
            }

            else if(prevIntent === 'finish'){
                
                speechOutput = "Ok, you can say, start again, to begin the process again. \
                    Or, you can just answer a single question by saying the root cause was, i fixed this by, or i plan to.";
	        	reprompt = "I didn't quite get that. You could say, yes, or you could say, cancel.";
	        	
                sessionAttributes.previousIntent = 'startOver';
                sessionAttributes.singleAnswerEntry = 'true';
            }

            // US44_TSK46 Steven Foust
            else if (prevIntent === 'noContinue'
	        	|| prevIntent === 'noActionTaken'
                    || prevIntent === 'noStepsTaken'
                        || prevIntent === 'LaunchRequest') {
                speechOutput = 'Okay. Please complete the appeal process at your earliest convenience to reinstate your account.  Good bye.';

                //Exit point at skill end
                return handlerInput.responseBuilder
	            .speak(speechOutput)
                .getResponse();
            }	     
            
            //US9_TSK35 Ray Bowers
            else if (prevIntent === 'AMAZON.CancelIntent'){
                speechOutput = "Okay let's start over. Are you ready?";
                sessionAttributes.previousIntent = 'LaunchRequest';

                //Exit point at skill end
            return handlerInput.responseBuilder
            .speak(speechOutput)
            .getResponse();
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
        var speakOutput = '';

        switch(sessionAttributes.previousIntent){
            case 'Continue':
                speakOutput = 'Please explain why this issue happened.  \
                    You can say things like, the reason this happened was, or the root cause was.  \
                        What is the root cause of the issue?';
                break;
            case 'GoToActionTaken':
                speakOutput = 'Please explain how you fixed the issue.  \
                    You can say things like, I fixed this by, or the steps I took were.  \
                        How have you fixed the issue?';
                break;
            case 'GoToStepsTaken':
                speakOutput = 'Please explain how you have prevented this from happening again.  \
                    You can say things like, going forward I will, or I plan to.  \
                        How will you prevent this issue from happening again?';
                break;
            case 'startOver':
                speakOutput = "To start the appeal process from the beginning, please say, start again.  \
                    If you want to change you answer to just a single question, you can say things like, the root cause was, to explain the root cause of the issue,\
                        or you can say things like, i fixed this by, to explain how you fixed the issue,\
                            or you can say things like, i plan to, to explain how you will prevent the issue from happening again.";
                break;
            default:
                speakOutput = 'To complete an appeal, you must explain the root cause of your issue, \
                    what you have done to resolve the issue, and how you will prevent this issue from happening again.  \
                        I will guide you through each question.  Are you ready to start now?';
        }        

        sessionAttributes.previousIntent = 'AMAZON.HelpIntent';
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
const skillBuilder = Alexa.SkillBuilders.standard();

exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequestHandler,
        RootCauseHandler,
        ActionTakenHandler,
        StepsTakenHandler,
        StartOverHandler,
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
    .withTableName('poa-id-numbers')
    .withAutoCreateTable(true)
    .lambda();

    //Helper function to save new POA data to DynamoDB
    async function saveAppeal(id,data1,data2,data3){
        return dbHelper.addPoa(id,data1,data2,data3)
            .then((data)=>{
                return true;
            })
            .catch((err)=>{
                console.log("Error occured while saving data", err);
                return false;
            })      
    }
