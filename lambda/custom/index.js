const Alexa = require('ask-sdk');
const dbHelper = require("./dbConnect");
const responses = require("./response");
const mail = require("./mailer");
const util = require("./util");
const c = require("./constants");

/* Skill initiation handler, determines status of account
 * and responds to user accordingly */
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {

        //Set initial session attributes to setup initial routing
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        sessionAttributes.poaId = 0;
        sessionAttributes.currentState = '';
        sessionAttributes.infractionIndex = 0;
        sessionAttributes.poa = false;

        await dbHelper.getInfractionArray()
            .then((data) => {
                sessionAttributes.infractionArray = data.Item.infractionArray;
            })
            .catch((err) => {
                console.log("Error occured while getting data", err);
                var speakOutput = 'Error getting infraction';
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();
            })

        await dbHelper.getInfraction(sessionAttributes.infractionArray[0])
            .then((data) => {
                // Retrieve the infraction descriptions
                sessionAttributes.infraction_DetailedDescription = data.Item.descriptionL;
                sessionAttributes.infraction_ShorthandDescription = data.Item.descriptionS;
                sessionAttributes.poa = data.Item.poa;
            })
            .catch((err) => {
                console.log("Error occured while getting data", err);
                var speakOutput = 'Error getting infraction';
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();
            })
        //Get test account status
        return dbHelper.getTestValue()
            .then((data) => {
                console.log(data, typeof (data));
                var speakOutput = '';

                //Account does not exist
                if (data.length == 0) {
                    speakOutput = "No account information available";
                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                }
                if(sessionAttributes.infraction_ShorthandDescription == 'Under Review') {
                    speakOutput += '. The rest of your infractions are under review. Good bye.';
                    return handlerInput.responseBuilder
                    .speak(speakOutput)
                 } else if(sessionAttributes.infractionArray.length > 0 && sessionAttributes.poa == false){
                    speakOutput = "Your account status is currently, suspended. The number of infractions you have is, " + sessionAttributes.infractionArray.length
                    + ". Your first infraction is " + sessionAttributes.infraction_ShorthandDescription 
                    + ". If you would like to reinstate your account, begin by saying reinstate my account.";
                    sessionAttributes.currentState = 'LaunchSR';
                } else if (sessionAttributes.infractionArray.length > 0 && sessionAttributes.poa == true){
                    speakOutput = "Your account status is currently, suspended. The number of infractions you have is, " + sessionAttributes.infractionArray.length
                    + ". Your first infraction is " + sessionAttributes.infraction_ShorthandDescription 
                    + "and requires a complete plan of action. If you would like to reinstate your account, begin by saying plan of action.";
                    sessionAttributes.currentState = 'LaunchPOA';
                }  else if(sessionAttributes.status === false) {
                        speakOutput = "Your account status is currently, suspended. The number of infractions you have is, " + sessionAttributes.infractionArray.length
                        + ". Your first infraction is " + sessionAttributes.infraction_ShorthandDescription + " and is eligible for the self-reinstatement process."
                        + ". If you would like to reinstate your account, begin by saying reinstate my account.";
                        sessionAttributes.currentState = 'LaunchSR';
                    } else if(sessionAttributes.status === true) {
                        speakOutput = "Your account status is currently, suspended. The number of infractions you have is, " + sessionAttributes.infractionArray.length
                        + ". Your first infraction is " + sessionAttributes.infraction_ShorthandDescription + " which requires a complete plan of action."
                        + ". If you would like to reinstate your account, begin by saying plan of action.";
                        sessionAttributes.currentState = 'LaunchPOA';
                    } else {
                        sessionAttributes.currentState = 'LaunchOK';
                        speakOutput = c.LAUNCH_STATUS_OK;
                    }

                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(c.REPROMPT)
                    //.withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                    .getResponse();
            })
            .catch((err) => {
                console.log("Error occured while getting data", err);
                var speakOutput = 'Error getting status ' + err;
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();
            })
    }
};

/**
 * Allow the user to append more information to an already submitted POA.
 */
const ReplyHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'Reply'
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        const current = handlerInput.requestEnvelope.request.intent;
        sessionAttributes.currentState = 'Reply';

        if (handlerInput.requestEnvelope.request.dialogState === 'COMPLETED') {
            return dbHelper.updatePOA(sessionAttributes.poaId, current.slots.Query.value)
                .then((data) => {
                    console.log(data, typeof (data));
                    var speakOutput = c.REPLY_SUCCESS;

                    var REPLY_CONFIRM_MESSAGE = responses.makeReplyResponse(current.slots.Query.value);
                    mail.handler(c.REPLY_SUBJECT, REPLY_CONFIRM_MESSAGE);

                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                })
                .catch((err) => {
                    console.log("Error occured while updating", err);
                    var speakOutput = 'Error updating';
                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                })
        } else {
            return handlerInput.responseBuilder
                .addDelegateDirective()
                .getResponse();
        }
    }
};

/**
 * Handler triggers the dialog model for handling the plan of action
 * process.  At successful completion, saves completed POA to
 * DynamoDB table.
 */
const POAHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PlanOfAction'
    },
    async handle(handlerInput) {
        const { attributesManager, requestEnvelope } = handlerInput;
        const sessionAttributes = attributesManager.getSessionAttributes();
        sessionAttributes.currentState = 'POA';
        var speakOutput = '';

        //If dialog is complete, save POA
        if (handlerInput.requestEnvelope.request.dialogState === 'COMPLETED') {

            sessionAttributes.currentState = 'POAFinished';
            let d1 = Alexa.getSlotValue(requestEnvelope, 'Q.One');
            let d2 = Alexa.getSlotValue(requestEnvelope, 'Q.Two');
            let d3 = Alexa.getSlotValue(requestEnvelope, 'Q.Three');

            sessionAttributes.d1 = d1;
            sessionAttributes.d2 = d2;
            sessionAttributes.d3 = d3;

            //Confirm final submission via YesIntent and NoIntent.
            speakOutput += `You entered the cause of the issue was ${d1}, \
                the issue is fixed because ${d2}, \
                and this will not happen again because ${d3}. \
                Is this correct?`

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(c.REPROMPT + ' ' + speakOutput)
                .getResponse();

        } else { //If dialog is not complete, delegate to dialog model  

            let temp1 = Alexa.getSlotValue(requestEnvelope, 'Q.One'); //Answer to Q1   
            let temp2 = Alexa.getSlotValue(requestEnvelope, 'Q.Two');  //Answer to Q2
            let temp3 = Alexa.getSlotValue(requestEnvelope, 'Q.Three');  //Answer to Q3

            //Filter user input to trigger either the help intent or cancel intent if needed
            if (temp1 === 'help' || temp2 === 'help' || temp3 === 'help') {
                return HelpIntentHandler.handle(handlerInput);
            } else if (temp1 === 'cancel' || temp2 === 'cancel' || temp3 === 'cancel') {
                return CancelIntentHandler.handle(handlerInput);
            } else {
                return handlerInput.responseBuilder
                    .addDelegateDirective()
                    .getResponse();
            }
        }
    }
}

/**
 * Handler triggers the dialog model for handling the self-reinstatement
 * process.  At completion, update status of account to '0' for
 * all clear.
 */
const SRHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'Self'
    },
    async handle(handlerInput) {
        const { attributesManager, requestEnvelope } = handlerInput;
        const sessionAttributes = attributesManager.getSessionAttributes();
        const currentIntent = handlerInput.requestEnvelope.request.intent;
        sessionAttributes.currentState = 'Self';
        var speakOutput = '';

        //If dialog is complete, end reinstatement and set account status to 0
        if (requestEnvelope.request.dialogState === 'COMPLETED') {

            //If any of the questions received a 'no' response, inform user and end skill w/o updating status
            if (currentIntent.slots["CheckTwo"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No'
                || currentIntent.slots["CheckThree"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No'
                || currentIntent.slots["CheckFour"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No') {

                if (currentIntent.slots["CheckTwo"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No') {
                    speakOutput += c.NO_ACTION;
                }

                if (currentIntent.slots["CheckThree"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No') {
                    speakOutput += c.NO_QUALITY;
                }

                if (currentIntent.slots["CheckFour"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No') {
                    speakOutput += c.NO_PERMANENT_LOSS;
                }

                speakOutput += c.SR_FAIL;

                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();

            } else {
                return dbHelper.updateStatus(0, 'noPOA')
                    .then(() => {
                        // Increment the infraction array index
                        var index = ++sessionAttributes.infractionIndex;
                        var length = sessionAttributes.infractionArray.length;


                        if (index < length) {
                            speakOutput = 'Thank you for submitting your response to ' + sessionAttributes.infraction_ShorthandDescription;
                            mail.handler(c.SR_SUBJECT, c.SR_CONFIRM_MESSAGE);

                            return dbHelper.getInfraction(sessionAttributes.infractionArray[index])
                                .then((data) => {
                                    // Retrieve the infraction descriptions
                                    return dbHelper.updateInfractionArray(sessionAttributes.infractionArray, sessionAttributes.infractionIndex, 2)
                                    .then((data1) => {
                                        sessionAttributes.infraction_DetailedDescription = data.Item.descriptionL;
                                        sessionAttributes.infraction_ShorthandDescription = data.Item.descriptionS;
                                        sessionAttributes.poa = data.Item.poa;
                                        if(sessionAttributes.infraction_ShorthandDescription == 'Under Review') {
                                            speakOutput += '. The rest of your infractions are under review. Good bye.';
                                            return handlerInput.responseBuilder
                                            .speak(speakOutput)
                                         } else if(sessionAttributes.poa == false) {
                                            speakOutput += '. Your next infraction is ' + sessionAttributes.infraction_ShorthandDescription + '. If you would like '
                                            + 'to resolve this infraction, begin by saying reinstate my account.';
                                            sessionAttributes.currentState = 'LaunchSR';
                                        } else {
                                            speakOutput += '. Your next infraction is ' + sessionAttributes.infraction_ShorthandDescription + ' and requires a complete plan of action. If you would like '
                                            + 'to resolve this infraction, begin by saying plan of action.';
                                            sessionAttributes.currentState = 'LaunchPOA';
                                        }
                                        repromptMessage = 'Sorry I did not hear a response, please respond or the session will be closed.'
                                        return handlerInput.responseBuilder
                                            .speak(speakOutput)
                                            .reprompt(repromptMessage)
                                            .getResponse();
                                            })
                                    })
                                .catch((err) => {
                                    console.log("Error occured while getting data", err);
                                    var speakOutput = 'Error getting infraction ' + err;
                                    return handlerInput.responseBuilder
                                        .speak(speakOutput)
                                        .withShouldEndSession(true)
                                        .getResponse();
                                })
                        } else {
                            sessionAttributes.currentState = 'LaunchOK';
                            speakOutput = c.SR_SUCCESS;

                            mail.handler(c.SR_SUBJECT, c.SR_CONFIRM_MESSAGE);

                            //Output message and don't reprompt to exit skill
                            return handlerInput.responseBuilder
                                .speak(speakOutput)
                                .getResponse();
                        }
                    })
                    .catch((err) => {
                        console.log("Error occured while updating", err);
                        var speakOutput = 'Error updating status ' + err;
                        return handlerInput.responseBuilder
                            .speak(speakOutput)
                            .withShouldEndSession(true)
                            .getResponse();
                    })
            }
        } else if (currentIntent.slots["CheckOne"].hasOwnProperty("value") && sessionAttributes.understood === false) {
            //Special case: The user must agree with the first question to continue on in the process.
            //Any other 'no' responses will be handled at the end of the process.
            //If the user doesn't understand the policy, read it back re prompt for agreement.
            if (currentIntent.slots["CheckOne"].resolutions.resolutionsPerAuthority[0].values[0].value.name === "No") {
                speakOutput = 'Your violation is as follows: ' +
                    sessionAttributes.infraction_ShorthandDescription + '. ' +
                    sessionAttributes.infraction_DetailedDescription +
                    '. This is a violation of Amazons policy.'

                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .addDelegateDirective({
                        name: "Self",
                        slots: {
                            "CheckOne": {
                                name: "CheckOne"
                            },
                            "CheckTwo": {
                                name: "CheckTwo"
                            },
                            "CheckThree": {
                                name: "CheckThree"
                            },
                            "CheckFour": {
                                name: "CheckFour"
                            }
                        }
                    })
                    .getResponse();

            } else {
                sessionAttributes.understood = true;
                return handlerInput.responseBuilder
                    .addDelegateDirective({
                        name: "Self",
                        slots: {
                            "CheckOne": {
                                name: "CheckOne",
                                value: "Yes"
                            },
                            "CheckTwo": {
                                name: "CheckTwo"
                            },
                            "CheckThree": {
                                name: "CheckThree"
                            },
                            "CheckFour": {
                                name: "CheckFour"
                            }
                        }
                    })
                    .getResponse();
            }
        } else {
            //If dialog is not complete, delegate to dialog model            
            return handlerInput.responseBuilder
                .addDelegateDirective()
                .getResponse();
        }
    }
}
async function updateStatus() {

}
/**
 * The yes intent will handle confirmation of completed plans of action.  If the 
 * POA is approved, data is saved to a DynamoDB table.
 * 
 * The yes intent will also handle a cancel request and setting up a reminder to fix
 * the account
 */
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        var speakOutput = "";
        var reprompt = "";

        //Get current set of attributes to route to the correct response
        const attributesManager = handlerInput.attributesManager;
        const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var current = sessionAttributes.currentState;

        //Yes response when confirming submitted POA
        if (current === 'POAFinished') {
            //Retrieve and increment POA id from persistence store
            if (Object.keys(persistentAttributes).length === 0) {
                sessionAttributes.poaId = 1;
                persistentAttributes.poaId = 2;
                attributesManager.setPersistentAttributes(persistentAttributes);
                await attributesManager.savePersistentAttributes();
            } else {
                sessionAttributes.poaId = persistentAttributes.poaId;
                persistentAttributes.poaId += 1;
                attributesManager.setPersistentAttributes(persistentAttributes);
                await attributesManager.savePersistentAttributes();
            }

            //Save data values (d1,d2,d3) to POA storage in dynamo
            let id = `${sessionAttributes.poaId}`;
            let d1 = sessionAttributes.d1;
            let d2 = sessionAttributes.d2;
            let d3 = sessionAttributes.d3;

            let dbSave = util.saveAppeal(id, d1, d2, d3);

            if (dbSave) {
                return dbHelper.updateStatus(4, id)
                    .then((data) => {
                        return dbHelper.updateInfractionArray(sessionAttributes.infractionArray, sessionAttributes.infractionIndex, 2)
                            .then((data1) => {
                                var index = ++sessionAttributes.infractionIndex;
                                var length = sessionAttributes.infractionArray.length;
                                //email confirmation of poa submission.                        
                                var POA_CONFIRM_MESSAGE = responses.makeResponse(d1,d2,d3);
                                mail.handler(c.POA_SUBJECT,POA_CONFIRM_MESSAGE);

                                if(index < length) {
                                    speakOutput = 'Thank you for submitting your response to ' + sessionAttributes.infraction_ShorthandDescription;

                                    return dbHelper.getInfraction(sessionAttributes.infractionArray[index])
                                        .then((data2) => {
                                        // Retrieve the infraction descriptions
                                            sessionAttributes.infraction_DetailedDescription = data2.Item.descriptionL;
                                            sessionAttributes.infraction_ShorthandDescription = data2.Item.descriptionS;
                                            sessionAttributes.poa = data2.Item.poa;
                                            if(sessionAttributes.infraction_ShorthandDescription == 'Under Review') {
                                                speakOutput += '. The rest of your infractions are under review. Good bye.';
                                                return handlerInput.responseBuilder
                                                .speak(speakOutput)
                                            } else if(sessionAttributes.poa == false) {
                                                speakOutput += '. Your next infraction is ' + sessionAttributes.infraction_ShorthandDescription + '. If you would like '
                                                + 'to resolve this infraction, begin by saying reinstate my account.';
                                                sessionAttributes.currentState = 'LaunchSR';
                                            } else {
                                                speakOutput += '. Your next infraction is ' + sessionAttributes.infraction_ShorthandDescription + ' and requires a complete plan of action. If you would like '
                                                + 'to resolve this infraction, begin by saying plan of action.';
                                                sessionAttributes.currentState = 'LaunchPOA';
                                            }
                                            repromptMessage = 'Sorry I did not hear a response, please respond or the session will be closed.'
                                            return handlerInput.responseBuilder
                                                .speak(speakOutput)
                                                .reprompt(repromptMessage)
                                                .getResponse();
                                                })
                                        .catch((err) => {
                                            console.log("Error occured while getting data", err);
                                            var speakOutput = 'Error getting infraction ' + err;
                                            return handlerInput.responseBuilder
                                                .speak(speakOutput)
                                                .withShouldEndSession(true)
                                                .getResponse();
                                        })
                                } else {
                                        sessionAttributes.currentState = 'LaunchOK';
                                        speakOutput = responses.completion();
                                        //Prompt if the user wants notifications of future issues
                                        speakOutput += c.POA_REMIND;
                                }

                                return handlerInput.responseBuilder
                                    .speak(speakOutput)
                                    .reprompt()
                                    .getResponse();
                                })
                    })
                    .catch((err) => {
                        console.log("Error occured while updating", err);
                        var speakOutput = 'Error updating status ' + err;
                        return handlerInput.responseBuilder
                            .speak(speakOutput)
                            .withShouldEndSession(true)
                            .getResponse();
                    })
            } else {
                speakOutput = responses.dbFail();
            }
        }

        /**
         * Sets up the reminder to notify the user if anthing goes wrong
         * with the account in the future.
         */
        else if (current === "LaunchOK") {
            return dbHelper.updateStatus(1, 'noPOA')
                .then((data) => {
                    util.setReminder(handlerInput);
                    var speakOutput = c.REMIND_OK;

                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();

                })
                .catch((err) => {
                    console.log("Error occured while updating", err);
                    var speakOutput = 'Error updating status';
                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                })
        }

        /**
         * From cancel, ask if the user wants a reminder to fix the account.
         */
        else if (current === 'AMAZON.CancelIntent') {
            sessionAttributes.currentState = 'CancelRemind'
            speakOutput = c.REMIND_PRMOPT_FROM_CANCEL;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt()
                .getResponse();
        }

        /**
        * Set reminder to fix the account later.
        */
        else if (current === 'CancelRemind') {
            util.setReminder(handlerInput);
            var speakOutput = c.REMIND_OK_FROM_CANCEL;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(c.REPROMPT)
            .getResponse();
    }
}

/**
 * Handles various 'no' responses from the user.
 */
const NoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
    },
    handle(handlerInput) {
        var speakOutput = "There is an error";

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var current = sessionAttributes.currentState;

        /**
         * Uses the dialog directive to re-delegate to the PlanOfAction
         * intent and re-solicit answers from the user.  For simplicity,
         * the entire form must be filled out again rather than allowing
         * for individual answers.
         */
        if (current === 'POAFinished') {

            speakOutput = 'Ok, we can start again. '

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .addDelegateDirective({
                    name: 'PlanOfAction',
                    slots: {
                        "Q.Three": {
                            "name": "Q.Three",
                            "value": "",
                            "confirmationStatus": "NONE"
                        },
                        "Q.One": {
                            "name": "Q.One",
                            "value": "",
                            "confirmationStatus": "NONE"
                        },
                        "Q.Two": {
                            "name": "Q.Two",
                            "value": "",
                            "confirmationStatus": "NONE"
                        }
                    }
                })
                .getResponse();
        }

        /**
         * Skill finishes successfully but the user does not want audio notification of account issues.
         */
        else if (current === 'LaunchOK') {
            speakOutput = c.REMIND_NO;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }

        /**
        * User has canceled the skill and does not want reminders to fix the account.
        */
        else if (current === 'CancelRemind') {
            speakOutput = c.REMIND_NO_FROM_CANCEL;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }

        /**
         * User cancels, and then decides not to cancel at the confirmation of cancel.
         * Re-Delegates to appropriate intent based on sesstionAttributes.status.
         */
        else if (current === 'AMAZON.CancelIntent') {
            speakOutput = responses.startOver();

            //POA
            if (sessionAttributes.status === 1) {
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .addDelegateDirective({
                        name: 'PlanOfAction',
                        slots: {
                            "Q.Three": {
                                "name": "Q.Three",
                                "value": "",
                                "confirmationStatus": "NONE"
                            },
                            "Q.One": {
                                "name": "Q.One",
                                "value": "",
                                "confirmationStatus": "NONE"
                            },
                            "Q.Two": {
                                "name": "Q.Two",
                                "value": "",
                                "confirmationStatus": "NONE"
                            }
                        }
                    })
                    .getResponse();
            }

            //SR
            else if (sessionAttributes.status === 2) {
                return handlerInput.responseBuilder
                    .addDelegateDirective({
                        name: "Self",
                        slots: {
                            "CheckOne": {
                                name: "CheckOne"
                            },
                            "CheckTwo": {
                                name: "CheckTwo"
                            },
                            "CheckThree": {
                                name: "CheckThree"
                            },
                            "CheckFour": {
                                name: "CheckFour"
                            }
                        }
                    })
                    .getResponse();
            }
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(c.REPROMPT)
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
        var current = sessionAttributes.currentState;
        var speakOutput = '';

        if (current === 'LaunchPOA') {
            speakOutput = 'Your violation is as follows: ' +
                sessionAttributes.infraction_ShorthandDescription + '. ' +
                sessionAttributes.infraction_DetailedDescription + '. ' +
                c.HELP_FROM_LAUNCH;
        } else if (current === 'LaunchSR') {
            speakOutput = c.HELP_SR;
        } else if (current === 'LaunchReply') {
            speakOutput = c.HELP_REPLY;
        } else if (current === 'POAFinished') {
            speakOutput = c.HELP_POA_END;
        } else if (current === 'POA') {
            speakOutput = c.HELP_POA;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .addDelegateDirective({
                    name: "PlanOfAction",
                    slots: {
                        "Q.One": {
                            name: "Q.One",
                            confirmationStatus: "NONE"
                        },
                        "Q.Two": {
                            name: "Q.Two",
                            confirmationStatus: "NONE"
                        },
                        "Q.Three": {
                            name: "Q.Three",
                            confirmationStatus: "NONE"
                        }
                    }
                })
                .getResponse();
        } else if (current === 'Self') {
            speakOutput = c.HELP_SR;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .addDelegateDirective({
                    name: "Self",
                    slots: {
                        "CheckOne": {
                            name: "CheckOne"
                        },
                        "CheckTwo": {
                            name: "CheckTwo"
                        },
                        "CheckThree": {
                            name: "CheckThree"
                        },
                        "CheckFour": {
                            name: "CheckFour"
                        }
                    }
                })
                .getResponse();
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(c.REPROMPT + ' ' + speakOutput)
            .getResponse();
    }
};

const CancelIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent');
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.currentState = 'AMAZON.CancelIntent';

        if (sessionAttributes.status === 4) {
            const speakOutput = c.CANCEL_STATUS_4;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }
        else {
            const speakOutput = c.CANCEL_CONFIRM;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt('Are you sure you want to stop now?')
                .getResponse();
        }
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
        var current = sessionAttributes.currentState;
        var speakOutput = responses.reprompt();

        if (current === 'LaunchPOA') {
            speakOutput += 'You can say, Plan of Action, to fill out your reinstatement form'
        } else if (current === 'LaunchSR') {
            speakOutput += ' You can say, Reinstate, to start the self-reinstatement process';
        } else if (current === 'LaunchReply') {
            speakOutput += ' You can say, add more information, to add more information to your plan of action.';
        } else if (current === 'POAFinished') {
            speakOutput += ' If you are satisfied with your plan of action, say yes to submit it for review. Otherwise, you can say cancel to stop.';
        } else if (current === 'Self') {
            speakOutput += ' Say yes to the following questions to reinstate your account.'
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .addDelegateDirective({
                    name: "Self",
                    slots: {
                        "CheckOne": {
                            name: "CheckOne"
                        },
                        "CheckTwo": {
                            name: "CheckTwo"
                        },
                        "CheckThree": {
                            name: "CheckThree"
                        },
                        "CheckFour": {
                            name: "CheckFour"
                        }
                    }
                })
                .getResponse();
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(c.REPROMPT)
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
        ReplyHandler,
        POAHandler,
        SRHandler,
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
    //.withAutoCreateTable(true)
    .lambda();


