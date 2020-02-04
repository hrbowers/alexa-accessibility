
const Alexa = require('ask-sdk');
const dbHelper = require("./dbConnect");
const responses = require("./response");
var questions = [
    "Great, let's get started. What is the root cause of the issue? You can say things like,\
the reason was, or the issue was.", 
    "Okay! How have you resolved the issue? You can say things like, I fixed this by,\
or the steps I took were.", 
    "Okay! How have you prevented the issue from happening again? You can say things like, I plan to, \
or I have prevented this by."
];

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {        
        
        //Set initial session attributes to setup initial routing
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'LaunchRequest';
        sessionAttributes.singleAnswerEntry = 'false';
        sessionAttributes.POAFlag = 'false';
        sessionAttributes.reply = 'false';
        sessionAttributes.poaId = 0;

        //Get test account status
        return dbHelper.getTestValue()
        .then((data)=>{
            console.log(data, typeof(data));
            var speakOutput = '';
            var status = data.Item.statusCode;
            var poaId = data.Item.poaId;
            

            if (data.length == 0) {
                speakOutput = "No account information available";
                return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
            }

            if(status === -1){
                speakOutput = 'There was an error getting your account status';
                return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
            }
            
            if(status === 1){
                sessionAttributes.POAFlag = 'true';
                speakOutput = "Your account has been suspended and requires a complete plan of action to be reinstated.\
                    Would you like to fill out the plan of action now?"
            }else if(status === 2){
                speakOutput = "Your account has been suspended and is eligible for the self-reinstatement process.\
                    Would you like to begin the process now?"
            }else if(status === 4){
                sessionAttributes.reply = 'true';
                sessionAttributes.poaId = poaId;
                speakOutput = "Your account is under review for reinstatment.  Is there more information \
                    you would like to add to your plan of action?"
            }else{
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
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RootCause'

            && (sessionAttributes.previousIntent === 'Continue'||
                    sessionAttributes.previousIntent === 'noContinue'||
                        sessionAttributes.previousIntent === 'startOver');
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'RootCause';

        sessionAttributes.qst1 = handlerInput.requestEnvelope.request.intent.slots.Query.value;

        const speechOutput = "You have entered that the root cause of the issue was " + sessionAttributes.qst1 +
            ". Is this correct?";

        const repromptText = "Please explain the root cause of the issue. Start by saying, the root cause was..."
        + " or, the reason this happened, followed by your response."

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(repromptText)
            .getResponse();
    }
}

/**
 * Receive user input for the steps taken to resolve an issue.
 * Confirms entry before moving on to next question.  Routes
 * through Yes and No intents to either go to the next step or
 * enter an answer again.
 */
const ActionTakenHandler = {
    canHandle(handlerInput){
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ActionTaken'

            && (sessionAttributes.previousIntent === 'GoToActionTaken'||
                sessionAttributes.previousIntent === 'noActionTaken'||
                    sessionAttributes.previousIntent === 'startOver');
    },
    handle(handlerInput){
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'ActionTaken';

        sessionAttributes.qst2 = handlerInput.requestEnvelope.request.intent.slots.Query.value;

        const speechOutput = "The steps you have taken are " + sessionAttributes.qst2 +
            ". Is this correct?";

        const repromptText = "Please explain the steps you have taken to resolve the issue." +
        "Start by saying, the steps I took were... or, I fixed this by, followed by your response.";

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(repromptText)
            .getResponse();
    }
}

/**
 * Receive user input for the steps taken to prevent an issue from
 * recurring.  Confirms entry before moving on to finish.  Routes
 * through Yes and No intents to either go to the next step or
 * enter an answer again.
 */
const StepsTakenHandler = {
    canHandle(handlerInput){
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StepsTaken'

        && (sessionAttributes.previousIntent === 'GoToStepsTaken'||
            sessionAttributes.previousIntent === 'noStepsTaken'||
                sessionAttributes.previousIntent === 'startOver');
    },
    handle(handlerInput){
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.previousIntent = 'StepsTaken';

        sessionAttributes.qst3 = handlerInput.requestEnvelope.request.intent.slots.Query.value;

        const speechOutput = "The steps you have taken to prevent further issues are "
        + sessionAttributes.qst3 + ". Is this correct?";

        const repromptText = "Please explain how you will prevent this issue from happening again." +
        "Start by saying, going forward... or, in the future... followed by your response."

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(repromptText)
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

        //Get current set of attributes to route to the correct response
        const attributesManager = handlerInput.attributesManager;        
        const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var prevIntent = sessionAttributes.previousIntent;

        //Check if finished first.
        //Finish and save to dynamo
        if (prevIntent === 'finish'){
            
            //Collect poaId number and user input for storage into DynamoDb table
            let id = `${sessionAttributes.poaId}`;
            let d1 = sessionAttributes.qst1;
            let d2 = sessionAttributes.qst2;
            let d3 = sessionAttributes.qst3;

            let dbSave = saveAppeal(id,d1,d2,d3);

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
                    var speakOutput = 'Error updating status';
                    return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .getResponse();
                })
                

            }else{
                speechOutput = responses.dbFail();
            }
        }

        //From cancel intent
        else if (prevIntent === 'AMAZON.CancelIntent') {
            speechOutput = responses.cancel();
            
            //Output message and don't reprompt to exit skill
            return handlerInput.responseBuilder
                .speak(speechOutput)
                .getResponse();            
        }

        //TODO: Implement the reply process and update the POA with the new information.
        //Prompt from this point.
        //Prompt for reply
        else if(prevIntent === 'LaunchRequest' && sessionAttributes.reply === 'true'){
            speechOutput = `Adding information to plan of action number ${sessionAttributes.poaId}`;
        }

        //Prompt for self-reinstatment 1 of 4
        else if((prevIntent === 'LaunchRequest' 
                    || prevIntent === 'startOver')
                        &&sessionAttributes.POAFlag === 'false'){
            speechOutput = 'In order to reactivate your account, please confirm your agreement and understanding of the following statements by saying yes. \
                Do you understand the violated policy?';
                sessionAttributes.previousIntent = 'self1';
        }

        //Prompt for self-reinstatment 2 of 4
        else if(prevIntent === 'self1'){
            speechOutput = 'Have you identified the cause of your policy violation and taken steps to prevent this issue from happening again?';
            sessionAttributes.previousIntent = 'self2';
        }

        //Prompt for self-reinstatment 3 of 4
        else if(prevIntent === 'self2'){
            speechOutput = 'Do you agree to maintain your business according to Amazon policy in order to meet customer\'s expectations of shopping on Amazon?';
            sessionAttributes.previousIntent = 'self3';
        }

        //Prompt for self-reinstatment 4 of 4
        else if(prevIntent === 'self3'){
            speechOutput = 'Do you understand that further violations could result in a permanent loss of your selling privileges?';
            sessionAttributes.previousIntent = 'self4';
        }

        //Complete self-reinstatement and set account status back to 0 (all clear)
        else if(prevIntent === 'self4'){           
            return dbHelper.updateStatus(0,'noPOA')
            .then((data) => {
                console.log("Update at self ",data);
                speechOutput = 'Thank you for completeing the self-reinstatement process. Your account should be reactivated shortly.';
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
        
   
        // Prompt for POA Question 1 of 3
        else if ((prevIntent === 'LaunchRequest' 
                    || prevIntent === 'startOver') 
                        && sessionAttributes.singleAnswerEntry === 'false'
                            && sessionAttributes.POAFlag === 'true') {
            
          reprompt = responses.reprompt() + "What is the root cause of the issue?";         
           
          //retrieve id number from persistence, increment, and save new increment
          //back to persistence for next item.
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
            
            //If starting over, output appropriate response
            if(prevIntent === 'startOver') {                
                speechOutput = responses.startOver() + 'What is the root cause of the issue?';
            } else {                
                speechOutput = "Great, let's get started. What is the root cause of the issue? You can say things like,\
                    the reason was, or the issue was.";            	
            }

            sessionAttributes.previousIntent = 'Continue';
        }

        // Prompt for Question 2 of 3 Action Taken
        else if (prevIntent === 'RootCause' && sessionAttributes.singleAnswerEntry === 'false') {        	        	
            speechOutput = "Okay! How have you resolved the issue? You can say things like, I fixed this by,\
                or the steps I took were.";            
            sessionAttributes.previousIntent = 'GoToActionTaken';
        }

        // Prompt for Question 3 of 3 Steps Taken
        else if (prevIntent === 'ActionTaken' && sessionAttributes.singleAnswerEntry === 'false'){            
            speechOutput = "Okay! How have you prevented the issue from happening again? You can say things like, I plan to, \
                or I have prevented this by.";
            sessionAttributes.previousIntent = 'GoToStepsTaken';
        }

        //Confirm complete user entry before submission
        else if(prevIntent === 'StepsTaken'||sessionAttributes.singleAnswerEntry === 'true'){
          
            let d1 = sessionAttributes.qst1;
            let d2 = sessionAttributes.qst2;
            let d3 = sessionAttributes.qst3;

            speechOutput = `Here is your completed plan of action. \ 
                You said the root cause of your issue was ${d1}, you fixed this issue by ${d2}, and this won't happen again because you will ${d3}. \
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
            if(prevIntent === 'self1' ||
                        prevIntent === 'self2' ||
                            prevIntent === 'self3' ||
                                prevIntent === 'self4'){
                speechOutput = "to complete the self-reinstatement process, you must understand the violated policy,\
                                Identify why the policy was violated, take steps to prevent further violations,\
                                and acknowledge that further violations could result in permanent loss of selling privileges.\
                                Your account will remain suspended until the self-reinstatement process is completed.  Goodbye."
                                
                //Exit point at skill end
                return handlerInput.responseBuilder
	            .speak(speechOutput)
                .getResponse();
            }

            //Prompt for re-entry of question 1
	        else if (prevIntent === 'RootCause') {
	            
	        	speechOutput = responses.startOver() + "What was the root cause of your issue?";
	            reprompt = responses.reprompt() + "You could say, yes, or you could say, cancel.";
	            
	            sessionAttributes.previousIntent = 'noContinue';	        	         
            }

            //Prompt for re-entry of question 2
            else if (prevIntent === 'ActionTaken') {
	        	
	        	speechOutput = responses.startOver() + "How did you resolve your issue?";
	        	reprompt = responses.reprompt() + "You could say, yes, or you could say, cancel.";       	

	        	sessionAttributes.previousIntent = 'noActionTaken';        
            } 

            //Prompt for re-entry of question 3
            else if(prevIntent === 'StepsTaken'){
                
                speechOutput = responses.startOver() + "How will you prevent this issue from happening again?";
	        	reprompt = responses.reprompt() + "You could say, yes, or you could say, cancel.";
	        	
	        	sessionAttributes.previousIntent = 'noStepsTaken';
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

            //If only re-entering a single answer, briefly remind the user of the question prompts
            else if(prevIntent === 'startOver'){
                
                speechOutput = "Ok, you can say, the root cause was, to explain the root cause of the issue.\
                    Or you can say, i fixed this by, to explain how you resolved the issue.\
                        Or you can say, i plan to, to explain how you will prevent this issue from happening again.";
	        	reprompt = "I didn't quite get that. You could say, yes, or you could say, cancel.";
	        	
                sessionAttributes.singleAnswerEntry = 'true';
            }

            //User quits at the beginning of the skill
            else if (prevIntent === 'LaunchRequest') {              

                speechOutput = 'Okay. Please complete the appeal process at your earliest convenience to reinstate your account.  Good bye.';

                //Exit point at skill end
                return handlerInput.responseBuilder
	            .speak(speechOutput)
                .getResponse();
            }	     
            
            //User cancels, and then decides not to cancel at the confirmation of cancel
            else if (prevIntent === 'AMAZON.CancelIntent'){
                speechOutput = responses.startOver() + "Are you ready?";
                sessionAttributes.previousIntent = 'LaunchRequest';
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

        if(prev === 'Continue'){
            speakOutput = 'Please explain why this issue happened.  \
                            You can say things like, the reason this happened was, or the root cause was.  \
                            What is the root cause of the issue?';
        }else if(prev === 'GoToActionTaken'){
            speakOutput = 'Please explain how you fixed the issue.  \
                            You can say things like, I fixed this by, or the steps I took were.  \
                            How have you fixed the issue?';
        }else if(prev === 'GoToStepsTaken'){
            speakOutput = 'Please explain how you have prevented this from happening again.  \
                            You can say things like, going forward I will, or I plan to.  \
                            How will you prevent this issue from happening again?';
        }else if(prev === 'LaunchRequest'){
            if(sessionAttributes.POAFlag === 'true'){
                speakOutput = 'To complete an appeal, you must explain the root cause of your issue, \
                                what you have done to resolve the issue, and how you will prevent this issue from happening again.  \
                                I will guide you through each question.  Are you ready to start now?';
            }else{
                speakOutput = 'To complete the self-reinstatement process, you must agree that you understand the violated policy,\
                                agree that you have identified why the policy was violated and have taken steps to prevent further violations,\
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

        switch(sessionAttributes.previousIntent){
            case 'self1':
                speakOutput += ' Do you understand the violated policy?';
                break;
            case 'self2':
                speakOutput += ' Have you identified the cause of your policy violation and taken steps to prevent this issue from happening again?';
                break;
            case 'self3':
                speakOutput += ' Do you agree to maintain your business according to Amazon policy in order to meet customer\'s expectations of shopping on Amazon?';
                break;
            case 'self4':
                speakOutput += ' Do you understand that further violations could result in a permanent loss of your selling privileges?';
                break;
            case 'Continue':
                speakOutput += ' Please explain why this issue happened.\
                    You can say things like, the reason this happened was, or the root cause was.  What is the root cause of the issue?';
                break;
            case 'RootCause':
                speakOutput += ' You have entered that the root cause of the issue was ' + sessionAttributes.qst1 + '. Is this correct?';
                break;
            case 'GoToActionTaken':
                speakOutput += ' Please explain how you fixed the issue.  You can say things like, I fixed this by, or the steps I took were.  How have you fixed the issue?';
                break;
            case 'ActionTaken':
                speakOutput += ' The steps you have taken are ' + sessionAttributes.qst2 + '. Is this correct?';
                break;    
            case 'GoToStepsTaken':
                speakOutput += ' Please explain how you have prevented this from happening again.\
                    You can say things like, going forward I will, or I plan to.  How will you prevent this issue from happening again?';
                break;
            case 'StepsTaken':
                speakOutput += ' The steps you have taken to prevent further issues are ' + sessionAttributes.qst3 + '. Is this correct?';
                break;    
            case 'LaunchRequest':
                if(sessionAttributes.POAFlag === 'true'){
                    speakOutput += ' Are you ready to fill out your plan of action?';
                }else{
                    speakOutput += ' Are you ready to complete the self-reinstatment process?';
                }
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
        ActionTakenHandler,
        StepsTakenHandler,
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

    
