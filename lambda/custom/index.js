
const Alexa = require('ask-sdk');
const dbHelper = require("./dbConnect");
const responses = require("./response.js");
const questionsFile = require('./questions.js');
// Retrieve the questions
const questionsCheck = questionsFile.getQuestionsCheck();
const questionsReprompt = questionsFile.getQuestionsReprompt();

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {        
        
        //Set initial session attributes to setup initial routing
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.i = 0;
        sessionAttributes.answer = {};
        sessionAttributes.previousIntent = ('Question'+0);
        sessionAttributes.singleAnswerEntry = 'false';
        sessionAttributes.POAFlag = 'false';
        sessionAttributes.idChecked = false;
        

        //Get test account status
        return dbHelper.getTestValue()
        .then((data)=>{
            console.log(data, typeof(data));
            var speakOutput = '';
            var status = data.Item.statusCode;
            // User does not exist
            if (data.length == 0) {
                speakOutput = "No account information available";
                return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
            }
            // Error - Account Retrieval
            if(status === -1){
                speakOutput = 'There was an error getting your account status';
                return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
            }
            // POA Questions
            if(status === 1){
                sessionAttributes.POAFlag = 'true';
                speakOutput = "Your account has been suspended and requires a complete plan of action to be reinstated.\
                    Would you like to fill out the plan of action now?"
                sessionAttributes.questions = questionsFile.getQuestions(status);
            }
            // Self-Reinstatement Questions
            else if(status === 2){
                speakOutput = "Your account has been suspended and is eligible for the self-reinstatement process.\
                    Would you like to begin the process now?"
                sessionAttributes.questions = questionsFile.getQuestions(status);
            }
            // Good standing
            else{
                speakOutput = 'Your account is in good standing and does not need attention at this time.'
                return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
            }
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
        })
        .catch((err)=>{
            console.log("Error occured while getting data", err);
            var speakOutput = 'Error getting status';
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
        })        
    }
};

/**
 * Receive user input for the root cause of an issue.
 * Confirms entry before moving on to next question.  Routes
 * through Yes and No intents to either go to the next step or
 * enter an answer again.
 */
const RootCauseHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'RootCause'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'ActionTaken'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'StepsTaken')
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = ('Question'+sessionAttributes.i);

        var index = sessionAttributes.i-1;
        var ansObj = sessionAttributes.answer;
        ansObj[index] = handlerInput.requestEnvelope.request.intent.slots.Query.value;
        sessionAttributes.answer = ansObj;

        return handlerInput.responseBuilder
            .speak(questionsCheck[index] + ansObj[index] + ". Is this correct?")
            .reprompt(questionsReprompt[index])
            .getResponse();
    }
}
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        var speechOutput = "";
        var reprompt = "";

        //Get current set of attributes to route to the correct response
        const attributesManager = handlerInput.attributesManager;        
        const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var prevIntent = sessionAttributes.previousIntent;
        var ansObj = sessionAttributes.answer;

        //Check if finished first.
        //Finish and save to dynamo
        if (prevIntent === 'finish'){
            //Collect poaId number and user input for storage into DynamoDb table
            let dbSave = saveAppeal(`${sessionAttributes.poaId}`,ansObj[0],ansObj[1],ansObj[2]);

            if(dbSave){
                speechOutput = responses.completion();
            }else{
                speechOutput = responses.dbFail();
            }
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        }

        //From cancel intent
        else if (prevIntent === 'AMAZON.CancelIntent') {
            speechOutput = responses.cancel();   
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();      
        }

        else if(prevIntent === 'SR_Finish') {
            return dbHelper.updateStatus(0)
            .then((data) => {
                console.log(data);
                speechOutput = sessionAttributes.questions[sessionAttributes.i++];
                //Output message and don't reprompt to exit skill
                return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();
            })
            .catch((err)=>{
                console.log("Error occured while updating", err);
                var speakOutput = 'Error updating status';
                return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
            }) 
        }
        //If starting over, output appropriate response
        else if(prevIntent === 'startOver') {
            sessionAttributes.i = 0;
            speechOutput = responses.startOver() + sessionAttributes.questions[sessionAttributes.i++];
        }
        //Prompt for self-reinstatment 1 ~ 4
        else if(sessionAttributes.POAFlag === 'false'){
            speechOutput = sessionAttributes.questions[sessionAttributes.i++];
            if(sessionAttributes.i == sessionAttributes.questions.length) {
                sessionAttributes.previousIntent = 'SR_Finish';
            }
        }
        // Prompt for POA Question 1 ~ 3
        else if ((prevIntent === ('Question'+sessionAttributes.i)) 
                // If singleAnswerentry is true, then we are here to finish, not to ask another question
                && sessionAttributes.singleAnswerEntry === 'false'
                // If we asked all of the questions, no reason to enteri
                && sessionAttributes.i < sessionAttributes.questions.length) {
            
            reprompt = responses.reprompt() + sessionAttributes.questions[sessionAttributes.i];         
           
            //retrieve id number from persistence, increment, and save new increment
            //back to persistence for next item.
            if(!sessionAttributes.idChecked) {
                if(Object.keys(persistentAttributes).length ===0){
                    sessionAttributes.idChecked = true;
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
            }
            // Ask the question
            speechOutput = sessionAttributes.questions[sessionAttributes.i++]; 
            sessionAttributes.previousIntent = sessionAttributes.i;
        } 
        // Else summarize responses, with a final question to ask 'yes/no' to submit 
        else {
            speechOutput = `Here is your completed plan of action. \ 
                You said the root cause of your issue was ${ansObj[0]}, \ 
                you fixed this issue by ${ansObj[1]}, \
                and this won't happen again because you will ${ansObj[2]}. \
                Is this what you would like to submit?`;
            sessionAttributes.previousIntent = 'finish';
        }
        //Speak output and await reprompt
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}

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
            
            //If a no response is received during self-reinstatement, cancel process with
            //appropriate message
            if(sessionAttributes.POAFlag === 'false'){
                speechOutput = "to complete the self-reinstatement process, you must understand the violated policy,\
                                Identify why the policy was violated, take steps to prevent further violations,\
                                and acknowledge that further violations could result in permanent loss of selling privileges.\
                                Your account will remain suspended until the self-reinstatement process is completed.  Goodbye."
                                
                //Exit point at skill end
                return handlerInput.responseBuilder
	            .speak(speechOutput)
                .getResponse();
            }
            //If final confirmation is rejected, offer to start over or change a single answer.
            else if(prevIntent === 'finish'){
                
                speechOutput = "If you need to change more than one answer, I would recommend starting over from the beginning.\
                    Would you like to start again from the beginning?  You can say yes to start over,\
                    say no to change just a single answer, or say cancel to quit and finish your plan of action at a later date.";
	        	reprompt = "I didn't quite get that. You could say, yes, or you could say, cancel.";
	        	
                sessionAttributes.previousIntent = 'startOver';
                sessionAttributes.singleAnswerEntry = 'false'
            }
            //User quits at the beginning of the skill
            else if (prevIntent === ('Question'+0)) {              
                speechOutput = 'Okay. Please complete the appeal process at your earliest convenience to reinstate your account.  Good bye.';
            }	
            // If said no to a POA question
            else if (prevIntent === ('Question'+sessionAttributes.i)) {
                speechOutput = responses.startOver() + sessionAttributes.questions[sessionAttributes.i-1];
                reprompt = responses.reprompt() + "You could say, yes, or you could say, cancel.";
                sessionAttributes.previousIntent = 'verifyQuestion';
            }
            //If only re-entering a single answer, briefly remind the user of the question prompts
            else if(prevIntent === 'startOver'){
                speechOutput = "Ok, you can say, the root cause was, to explain the root cause of the issue.\
                    Or you can say, i fixed this by, to explain how you resolved the issue.\
                        Or you can say, i plan to, to explain how you will prevent this issue from happening again.";
	        	reprompt = "I didn't quite get that. You could say, yes, or you could say, cancel.";
	        	
                sessionAttributes.singleAnswerEntry = 'true';
            }

                 
            
            //User cancels, and then decides not to cancel at the confirmation of cancel
            else if (prevIntent === 'AMAZON.CancelIntent'){
                speechOutput = responses.startOver() + "Are you ready?";
                sessionAttributes.previousIntent = ('Question'+0);
            }

            //Output message and await response
	        return handlerInput.responseBuilder
	            .speak(speechOutput)
	            .reprompt(reprompt)
	            .getResponse();
	    }
	}

/**
 * Custom help messages for the major steps of the skill
 */
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var prev = sessionAttributes.previousIntent;
        var speakOutput = '';

        if(prev === ('Question'+1) || prev === 1){
            speakOutput = 'Please explain why this issue happened.  \
                            You can say things like, the reason this happened was, or the root cause was.  \
                            What is the root cause of the issue?';
        }else if(prev === ('Question'+2) || prev === 2){
            speakOutput = 'Please explain how you fixed the issue.  \
                            You can say things like, I fixed this by, or the steps I took were.  \
                            How have you fixed the issue?';
        }else if(prev === ('Question'+3) || prev === 3){
            speakOutput = 'Please explain how you have prevented this from happening again.  \
                            You can say things like, going forward I will, or I plan to.  \
                            How will you prevent this issue from happening again?';
        }else if(prev === ('Question'+0)){
            if(sessionAttributes.POAFlag === 'true'){
                speakOutput = 'To complete an appeal, you must explain the root cause of your issue, \
                                what you have done to resolve the issue, and how you will prevent this issue from happening again.  \
                                I will guide you through each question.  Are you ready to start now?';
            }else{
                speakOutput = 'To complete the self-reinstatement process, you must agree that you understand the violated policy,\
                                agree that you have identified why the policy was violated and taken steps to prevent further violations,\
                                and indicate you understand further violations could result in permanent loss of selling privileges.\
                                Simply say yes when prompted to indicate your understanding and agreement.  Are you ready to begin?';
            }
        }else if(prev === 'self1' || prev === 'self2' || prev === 'self3' || prev === 'self4'){
            speakOutput = 'Simply say yes to indicate your understanding and agreement.  If you do not agree with or understand the statement, say no\
                            to leave your account suspended and end the self-reinstatement process.';
            
            if(prev === 'self1'){
                speakOutput += ' Do you understand the violated policy?';
            }else if(prev === 'self2'){
                speakOutput += ' Have you identified why the policy was violated and taken steps to prevent further violations?';
            }else if(prev === 'self3'){
                speakOutput += ' Do you agree to maintain your business according to Amazon policy in order to meet customer\'s expectations\
                                of shopping on Amazon?';
            }else{
                speakOutput += ' Do you understand that further violations could result in a permanent loss of your selling privileges?'
            }
        }

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

/**
 * Typically, Cancel and Stop are in a single intent handler. Breaking the stop
 * command into its own intent handler just allows for a faster exit mid skill for development
 * purposes, rather than going through the cancel confirmation message. Will merge back into
 * a single handler at the end of the project.
 */
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

/**
 * FallbackIntentHandler catches all unexpected input from the user and prompts for user
 * re-entry with prompts based on where in the skill process the user is currently at.
 */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent');
      },

        //testing response, not permanent
      handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var speakOutput = responses.reprompt();
        var ansObj = sessionAttributes.answer;

        switch(sessionAttributes.previousIntent){
            case ('Question'+0):
                speakOutput += ' Please explain why this issue happened.\
                    You can say things like, the reason this happened was, or the root cause was.  What is the root cause of the issue?';
                break;
            case 1:
            case 2:
            case 3:
                speakOutput += questionsCheck[sessionAttributes.previousIntent - 1] + ansObj[sessionAttributes.previousIntent - 1] + '. Is this correct?';
                break;
            case ('Question'+1):
                speakOutput += ' Please explain how you fixed the issue.  You can say things like, I fixed this by, or the steps I took were.  How have you fixed the issue?';
                break;   
            case ('Question'+2):
                speakOutput += ' Please explain how you have prevented this from happening again.\
                    You can say things like, going forward I will, or I plan to.  How will you prevent this issue from happening again?';
                break;  
            case 'LaunchRequest':
                speakOutput += ' Are you ready to begin the appeal process?';
                break;
            case 'finish':
                speakOutput += ' Are you satisfied with your appeal entry?';
                break;
            case 'startOver':
                if(sessionAttributes.singleAnswerEntry === 'true'){
                    speakOutput += ' You can say, the root cause was, to explain the root cause of the issue.\
                        Or you can say, i fixed this by, to explain how you resolved the issue.\
                            Or you can say, i plan to, to explain how you will prevent this issue from happening again.';
                }else{
                    speakOutput += ' You can say yes to start over, or say no to change just a single answer.';
                }
                break;
            case 'AMAZON.CancelIntent':
                speakOutput += ' Your progress has not been saved, are you sure you want to cancel?';
                break;
            default:
                speakOutput += ' If you are unsure of what to do, say help.  Or, you can say cancel to complete the process at a later date.';
        }        

        return handlerInput.responseBuilder
          .speak(speakOutput)
          .reprompt('Sorry, please try again')
          .getResponse();
      }
}

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
        YesIntentHandler,
        NoIntentHandler,
        FallbackIntentHandler,
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

    
