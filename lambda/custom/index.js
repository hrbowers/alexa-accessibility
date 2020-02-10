const Alexa = require('ask-sdk');
const dbHelper = require("./dbConnect");
const responses = require("./Model/response");
const questionsFile = require('./Model/questions');
// Retrieve the POA questions
const questionsCheck = questionsFile.getQuestionsCheck();
const questionsReprompt = questionsFile.getQuestionsReprompt();

//////////////////////////////////////////////////////////////////////////
///////////////////////////    LAUNCH METHOD   ///////////////////////////
//////////////////////////////////////////////////////////////////////////
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {        
        
        //Set initial session attributes to setup initial routing
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // Tracking where we came from. 'Launch' only matters for first question and first cancel
        sessionAttributes.previousIntent = 'Launch';
        // For tracking which questions/check/reprompt/help to ask
        sessionAttributes.i = 0;
        // For storing the users anser. Array style helps place answers at sessionAttributes.i
        sessionAttributes.answer = {};
        // True when user wants to retry one of the questions.
        sessionAttributes.singleAnswerEntry = 'false';
        // For determining if we need to ask a series of POA, or Self-Reinstatement, questions
        sessionAttributes.POAFlag = 'false';
        // To ensure that we don't continuously increment the user ID in the repeated questions
        sessionAttributes.idChecked = false;
        
        //Get test account status
        return dbHelper.getTestValue()
        .then((data)=>{
            console.log(data, typeof(data));
            var speechOutput = '';
            var status = data.Item.statusCode;
            // User does not exist
            if (data.length == 0) {
                speechOutput = "No account information available";
                return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();
            }
            // Error - Account Retrieval
            if(status === -1){
                speechOutput = 'There was an error getting your account status';
                return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();
            }
            // Get the situation specific questions.
            sessionAttributes.questions = questionsFile.getQuestions(status);
            sessionAttributes.helpQuestions = questionsFile.getHelp(status);
            
            // POA Questions Required
            if(status === 1){
                sessionAttributes.POAFlag = 'true';
                speechOutput = "Your account has been suspended and requires a complete plan of action to be reinstated.\
                    Would you like to fill out the plan of action now?"
            }
            // Self-Reinstatement Questions
            else if(status === 2){
                speechOutput = "Your account has been suspended and is eligible for the self-reinstatement process.\
                    Would you like to begin the process now?"
            }
            // User is in good standing
            else{
                speechOutput = 'Your account is in good standing and does not need attention at this time.'
                // Exit program
                return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();
            }
            // Send formed response
            return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt()
            .getResponse();
        })
        .catch((err)=>{
            console.log("Error occured while getting data", err);
            var speechOutput = 'Error getting status';
            return handlerInput.responseBuilder
            .speak(speechOutput)
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
//////////////////////////////////////////////////////////////////////////
//////////////////////////    QUESTION METHOD   //////////////////////////
//////////////////////////////////////////////////////////////////////////
const VerifyHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'RootCause'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'ActionTaken'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'StepsTaken')
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // Go to verify the users questions, or handle No/Help/Fallback accordingly
        sessionAttributes.previousIntent = ('verifyQuestion');
        // Track where to place answer
        var index = sessionAttributes.i-1;
        // Handle a single answer entry
        if(sessionAttributes.singleAnswerEntry === 'true') {
            var currIntent = Alexa.getIntentName(handlerInput.requestEnvelope);
            switch(currIntent)
            {
                case 'RootCause': index = 0; break;
                case 'ActionTaken': index = 1; break;
                case 'StepsTaken': index = 2; break;
            }
        }
        // Save the array of user answers into a temporary mutable array
        var ansObj = sessionAttributes.answer;
        // Insert users current answer into array
        ansObj[index] = handlerInput.requestEnvelope.request.intent.slots.Query.value;
        // Set tracked answers to new answer array
        sessionAttributes.answer = ansObj;
        // Send verification question
        return handlerInput.responseBuilder
            .speak(questionsCheck[index] + ansObj[index] + ". Is this correct?")
            .reprompt(questionsReprompt[index])
            .getResponse();
    }
}
//////////////////////////////////////////////////////////////////////////
///////////////////////////    YES METHOD   //////////////////////////////
//////////////////////////////////////////////////////////////////////////
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        var speechOutput = "There is an error";
        var reprompt = "";

        //Get current set of attributes to route to the correct response
        const attributesManager = handlerInput.attributesManager;        
        const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // Where did we come from?
        var prevIntent = sessionAttributes.previousIntent;
        // All submitted answers
        var ansObj = sessionAttributes.answer;
        
        /////////////////////////////////////////////
        /////////    POA DB SUBMISSION    //////////
        /////////////////////////////////////////////
        if (prevIntent === 'finish'){
            // User ID
            var id = `${sessionAttributes.poaId}`;
            // Save answer into users dynamoDB table
            let dbSave = saveAppeal(id, ansObj);
            if(dbSave){
                return dbHelper.updateStatus(4,id)
                .then((data) =>{
                    console.log("Update at POA ",data);
                    speechOutput = responses.completion();

                    //Exit point at end of skill
                    return handlerInput.responseBuilder
                    .speak(speechOutput)
                    .getResponse();
                })
                .catch((err)=>{
                    console.log("Error occured while updating", err);
                    var speechOutput = 'Error updating status';
                    return handlerInput.responseBuilder
                    .speak(speechOutput)
                    .getResponse();
                })
            }else{
                speechOutput = responses.dbFail();
            }
        }
        /////////////////////////////////////////////
        //////////    SR DB SUBMISSION    ///////////
        /////////////////////////////////////////////
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
                var speechOutput = 'Error updating status';
                return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();
            }) 
        }
        /////////////////////////////////////////////
        ////////////    SR Questions    /////////////
        /////////////////////////////////////////////
        else if(sessionAttributes.POAFlag === 'false'){
            sessionAttributes.previousIntent = 'askQuestion';
            // Get question from array, then increment tracked index (sessionAttributes.i)
            speechOutput = sessionAttributes.questions[sessionAttributes.i++];
            // If all SR questions are asked, finish.
            if(sessionAttributes.i == sessionAttributes.questions.length) {
                sessionAttributes.previousIntent = 'SR_Finish';
            }
        }
        /////////////////////////////////////////////
        ////////////    POA Questions    ////////////
        /////////////////////////////////////////////
        else if ((prevIntent === ('verifyQuestion') || prevIntent === ('Launch')) 
                // If singleAnswerentry is true, then we are here to finish, not to ask another question
                && sessionAttributes.singleAnswerEntry === 'false'
                // If we asked all of the questions, no reason to enter
                && sessionAttributes.i < sessionAttributes.questions.length) {
           
            reprompt = responses.reprompt() + sessionAttributes.questions[sessionAttributes.i];      
            sessionAttributes.previousIntent = 'askQuestion';
            /* Retrieve id number from persistence, increment id, 
               then save new increment back to persistence for next item. */
            if(!sessionAttributes.idChecked) {
                sessionAttributes.idChecked = true;
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
            }
            // Ask the question
            speechOutput = sessionAttributes.questions[sessionAttributes.i++]; 
        } 
        /////////////////////////////////////////////
        /////////////    START OVER    //////////////
        /////////////////////////////////////////////
        else if(prevIntent === 'startOver') {
            // Reset question positioning
            sessionAttributes.i = 0;
            // Ask first question, then increment tracked index (sessionAttributes.i)
            speechOutput = responses.startOver() + sessionAttributes.questions[sessionAttributes.i++];
        }
        /////////////////////////////////////////////
        //////////////    CANCEL?    ////////////////
        /////////////////////////////////////////////
        else if (prevIntent === 'AMAZON.CancelIntent') {
            speechOutput = responses.cancel();   
            return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();      
        }
        /////////////////////////////////////////////
        //////////    SUBMISSION VERIFY   ///////////
        /////////////////////////////////////////////
        else {
            // Get formed text using ansObj
            speechOutput = questionsFile.getSubmissionText(ansObj);
            sessionAttributes.previousIntent = 'finish';
        }
        //Speak output and await reprompt
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}
//////////////////////////////////////////////////////////////////////////
/////////////////////////////    NO METHOD   /////////////////////////////
//////////////////////////////////////////////////////////////////////////
const NoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
    },
    handle(handlerInput) {
        var speechOutput = "There is an error";
        var reprompt = "";
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // Get previous intent now so we don't have to call on attribute repeatedly
        var prevIntent = sessionAttributes.previousIntent;
        
        /////////////////////////////////////////////
        ///    SR - USER SAID NO - END SESSION   ////
        /////////////////////////////////////////////
        if(sessionAttributes.POAFlag === 'false'){
            // Tell user that a no to these questions will not reinstate their account
            speechOutput = questionsCheck[questionsCheck.length - 2];
            // End session with final speech
            return handlerInput.responseBuilder
            .speak(speechOutput)
            .getResponse();
        }
        /////////////////////////////////////////////
        ////    USER REJECTS FINAL SUBMISSION    ////
        /////////////////////////////////////////////
        else if(prevIntent === 'finish'){
            // Offer a chance to start over, change a single answer, or cancel. 
            speechOutput = "If you need to change more than one answer, I would recommend starting over from the beginning.\
                Would you like to start again from the beginning?  You can say yes to start over,\
                say no to change just a single answer, or say cancel to quit and finish your plan of action at a later date.";
            reprompt = "I didn't quite get that. You could say, yes, no, or you could say cancel.";
            
            sessionAttributes.previousIntent = 'startOver';
            sessionAttributes.singleAnswerEntry = 'false'
        }
        /////////////////////////////////////////////
        ////////////    LAUNCH QUIT    //////////////
        /////////////////////////////////////////////
        else if (prevIntent === ('Launch')) {              
            speechOutput = 'Okay. Please complete the appeal process at your earliest convenience to reinstate your account.  Good bye.';
            return handlerInput.responseBuilder
            .speak(speechOutput)
            .getResponse();
        }	
        /////////////////////////////////////////////
        //////////////    POA NO    /////////////////
        /////////////////////////////////////////////
        else if (prevIntent === 'verifyQuestion') {
            speechOutput = responses.startOver() + sessionAttributes.questions[sessionAttributes.i - 1];
            reprompt = responses.reprompt() + sessionAttributes.questions[sessionAttributes.i - 1];
            sessionAttributes.previousIntent = 'askQuestion';
        }
        /////////////////////////////////////////////
        ////////    SINGLE ANSWER PROMPT    /////////
        /////////////////////////////////////////////
        else if(prevIntent === 'startOver'){
            speechOutput = questionsCheck[questionsCheck.length - 1];
            sessionAttributes.singleAnswerEntry = 'true';
        }
        /////////////////////////////////////////////
        ///////////   CANCELED CANCEL    ////////////
        /////////////////////////////////////////////
        else if (prevIntent === 'AMAZON.CancelIntent'){
            speechOutput = responses.startOver() + "Are you ready?";
            sessionAttributes.previousIntent = 'askQuestion';
        }
        //Output message and await response
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}

//////////////////////////////////////////////////////////////////////////
////////////////////////////    HELP METHOD   ////////////////////////////
//////////////////////////////////////////////////////////////////////////
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var prev = sessionAttributes.previousIntent;
        var speechOutput = '';
        /////////////////////////////////////////////
        /////////////   LAUNCH HELP    //////////////
        /////////////////////////////////////////////
        if(prev === 'Launch') {
            var helpMessage = sessionAttributes.helpQuestions;
            speechOutput = helpMessage[0];
        }
        /////////////////////////////////////////////
        ////////////   QUESTION HELP    /////////////
        /////////////////////////////////////////////
        else if(prev === ('askQuestion')) {
            var helpMessage = sessionAttributes.helpQuestions;
            speechOutput = helpMessage[sessionAttributes.i];
        } 
        /////////////////////////////////////////////
        ///////////   POA VERIFY HELP    ////////////
        /////////////////////////////////////////////
        else if(prev === ('verifyQuestion')) {
            speechOutput = 'Verify your answer entry by saying yes, or no. If you answer no, you will be asked the last question again \
            and will have a chance to retry you reply.';
        }
        /////////////////////////////////////////////
        ///////////   POA FINISH HELP    ////////////
        /////////////////////////////////////////////
        else if(prev === 'finish') {
            speechOutput = 'If you confirm your submission, we review your submission within 72 hours. Confirm by saying yes, or say no to resubmit one of your answers.'
            speechOutput += questionsFile.getSubmissionText(sessionAttributes.answer);
            // Keep previousIntent as finish.
        } 
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(speechOutput)
            .getResponse();
    }
};
/**
 * FallbackIntentHandler catches all unexpected input from the user and prompts for user
 * re-entry with prompts based on where in the skill process the user is currently at.
 */
//////////////////////////////////////////////////////////////////////////
//////////////////////////    FALLBACK METHOD   //////////////////////////
//////////////////////////////////////////////////////////////////////////
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent');
    },

    //testing response, not permanent
    handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    var speechOutput = responses.reprompt();
    var helpMessage = sessionAttributes.helpQuestions;

    switch(sessionAttributes.previousIntent){
        case sessionAttributes.i:
        case 'askQuestion':
            speechOutput += helpMessage[sessionAttributes.i];
            break;
        case ('verifyQuestion'):
            var ansObj = sessionAttributes.answer;
            speechOutput += questionsCheck[sessionAttributes.i- 1] + ansObj[sessionAttributes.i - 1] + '. Is this correct?';
            sessionAttributes.previousIntent = 'verifyQuestion';
            break; 
        case 'LaunchRequest':
            speechOutput += ' Are you ready to begin the appeal process?';
            break;
        case 'finish':
            speechOutput += ' Are you satisfied with your appeal entry?';
            break;
        case 'startOver':
            if(sessionAttributes.singleAnswerEntry === 'true'){
                speechOutput += questionsCheck[questionsCheck.length-1];
            }else{
                speechOutput += ' You can say yes to start over, or say no to change just a single answer.';
            }
            break;
        case 'AMAZON.CancelIntent':
            speechOutput += ' Your progress has not been saved, are you sure you want to cancel?';
            break;
        default:
            speechOutput += ' If you are unsure of what to do, say help.  Or, you can say cancel to complete the process at a later date.';
    }        

    return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt('Sorry, please try again')
        .getResponse();
    }
}
//////////////////////////////////////////////////////////////////////////
///////////////////////////    CANCEL METHOD   ///////////////////////////
//////////////////////////////////////////////////////////////////////////
const CancelIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent');
    },
    handle(handlerInput) {
        const speechOutput = 'Your responses have not been saved and your account is still suspended.  Are you sure you want to stop?';

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'AMAZON.CancelIntent';

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt('Are you sure you want to stop now?')
            .getResponse();
    }
};
//////////////////////////////////////////////////////////////////////////
//////////////////////////    DB SAVE HELPER    //////////////////////////
//////////////////////////////////////////////////////////////////////////
async function saveAppeal(id, ansObj){
    return dbHelper.addPoa(id, ansObj[0], ansObj[1], ansObj[2])
        .then((data)=>{
            return true;
        })
        .catch((err)=>{
            console.log("Error occured while saving data", err);
            return false;
        })      
}
//////////////////////////////////////////////////////////////////////////
//////////////////////////    ALEXA REQUIRED    //////////////////////////
//////////////////////////////////////////////////////////////////////////
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
        const speechOutput = 'Stop triggered';
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        const speechOutput = 'Session Ended';
        return handlerInput.responseBuilder
            .speak(speechOutput)
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
        const speechOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speechOutput)
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
        const speechOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(speechOutput)
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
        VerifyHandler,
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

    
