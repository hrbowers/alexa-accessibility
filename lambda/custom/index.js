const Alexa = require('ask-sdk');
const dbHelper = require("./dbConnect");
const responses = require("./response");
const remind = require("./reminder");
const mail = require("./mailer");

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
        var infraction_DetailedDescription;
        var infraction_ShorthandDescription;

        await dbHelper.getInfraction()
            .then((data) => {
                // Retrieve the infraction descriptions
                infraction_DetailedDescription = data.Item.descriptionL;
                infraction_ShorthandDescription = data.Item.descriptionS;
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
                var status = data.Item.statusCode;
                var poaId = data.Item.poaId;
                sessionAttributes.status = status;
                sessionAttributes.infraction_ShorthandDescription = infraction_ShorthandDescription;
                sessionAttributes.infraction_DetailedDescription = infraction_DetailedDescription;

                //Account does not exist
                if (data.length == 0) {
                    speakOutput = "No account information available";
                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                }

                //Error
                if (status === -1) {
                    speakOutput = 'There was an error getting your account status';
                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                }

                //Prompt the user based on retrieved account status
                if (status === 1) {
                    sessionAttributes.currentState = 'LaunchPOA';
                    speakOutput = "Your account has been suspended and requires a complete plan of action to be reinstated.\
                    You can say, Plan of Action, to begin the process.  If you are not ready to begin, say cancel."
                } else if (status === 2) {
                    sessionAttributes.currentState = 'LaunchSR';
                    sessionAttributes.understood = false;

                    speakOutput = "Your account has been suspended due to, " + infraction_ShorthandDescription + ", and is eligible for the self-reinstatement process.\
                    To begin you can say, reinstate.  Or, you can say cancel to reinstate your account at a later date."

                } else if (status === 4) {
                    sessionAttributes.poaId = poaId;
                    sessionAttributes.currentState = 'LaunchReply';
                    speakOutput = "Your account is under review for reinstatment.  You can add additional information \
                    to your plan of action by saying, add more information.  Or, you can say cancel to leave your plan of \
                    action unchanged."
                } else {
                    sessionAttributes.currentState = 'LaunchOK';
                    speakOutput = 'Your account is in good standing and does not need attention at this time.  Would you like me to notify you if something goes wrong with your account?';
                    //.withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                }

                repromptMessage = 'Sorry I did not hear a response, please respond or the session will be closed.'
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(repromptMessage)
                    .getResponse();
            })
            .catch((err) => {
                console.log("Error occured while getting data", err);
                var speakOutput = 'Error getting status';
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
                    var speakOutput = 'Your plan of action was successfully updated. Please wait to hear back from Amazon regarding the status of your account reinstatement.';

                    const REPLY_SUBJECT = 'Plan of Action Updated';
                    const REPLY_CONFIRM_MESSAGE = responses.makeResponse(current.slots.Query.value);

                    mail.handler(REPLY_SUBJECT,REPLY_CONFIRM_MESSAGE);

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
            speakOutput += `You entered the cause of the issue was ${d1}, the issue is fixed because ${d2}, and this will not happen again because ${d3}. \
                                    Is this correct?`

            repromptMessage = 'Sorry, I did not hear a response. Please respond or the session will be closed.'

            return handlerInput.responseBuilder

                .speak(speakOutput)
                .reprompt(repromptMessage + ' ' + speakOutput)
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
            var noAction = 'You must fix the cause of your violation and take steps to ensure it will not happen again.';
            var noQuality = ' Amazon customers expect the highest level of service. You must agree to provide a level of service that will meetour customer\'s expectations.';
            var noPermLoss = ' Repeated infractions could possibly result in the permanent loss of your seller account.';

            //If any of the questions received a 'no' response, inform user and end skill w/o updating status
            if (currentIntent.slots["CheckTwo"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No'
                || currentIntent.slots["CheckThree"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No'
                || currentIntent.slots["CheckFour"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No') {

                if (currentIntent.slots["CheckTwo"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No') {
                    speakOutput += noAction;
                }

                if (currentIntent.slots["CheckThree"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No') {
                    speakOutput += noQuality;
                }

                if (currentIntent.slots["CheckFour"].resolutions.resolutionsPerAuthority[0].values[0].value.name === 'No') {
                    speakOutput += noPermLoss;
                }

                speakOutput += ' Your account will remain suspended until you agree to everything outlined in this self-reinstatement process.  Good bye.'

                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();

            } else {
                return dbHelper.updateStatus(0, 'noPOA')
                    .then((data) => {
                        sessionAttributes.currentState = 'LaunchOK';
                        speakOutput = 'Thank you for completing the self-reinstatement process. Your account should be reactivated shortly.';
                        speakOutput += ' Would you like to be notified if something else goes wrong with your account?';

                        const SR_SUBJECT = 'Self-Reinstatement Success';
                        const SR_CONFIRM_MESSAGE = 'The self-reinstatement process was successfully completed and your account is reactivated.  Thank you.';

                        mail.handler(SR_SUBJECT,SR_CONFIRM_MESSAGE);

                        return handlerInput.responseBuilder
                            .speak(speakOutput)
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
        } else if (currentIntent.slots["CheckOne"].hasOwnProperty("value") && sessionAttributes.understood === false) {
            //Special case: The user must agree with the first question to continue on in the process.
            //Any other 'no' responses will be handled at the end of the process.
            //If the user doesn't understand the policy, read it back re prompt for agreement.
            if (currentIntent.slots["CheckOne"].resolutions.resolutionsPerAuthority[0].values[0].value.name === "No") {
                speakOutput = 'Your violation is as follows: ' + sessionAttributes.infraction_ShorthandDescription + '. ' + sessionAttributes.infraction_DetailedDescription
                    + '. This is a violation of Amazons policy.'

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

/**
 * The yes intent will handle confirmation of completed plans of action.  If the 
 * POA is approved, data is saved to a DynamoDB table.
 * 
 * The yes intent will also handle a cancel request and setting up a reminder to fix
 * the account.
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

            let dbSave = saveAppeal(id, d1, d2, d3);

            if (dbSave) {
                return dbHelper.updateStatus(4, id)
                    .then((data) => {
                        sessionAttributes.currentState = 'LaunchOK';

                        //email confirmation of poa submission.
                        const POA_SUBJECT = 'Plan of Action Submitted';
                        var POA_CONFIRM_MESSAGE = responses.makeResponse(d1,d2,d3);

                        mail.handler(POA_SUBJECT,POA_CONFIRM_MESSAGE);

                        speakOutput = responses.completion();
                        //Prompt if the user wants notifications of future issues
                        speakOutput += ' Would you like to be notified when there are issues with your account?'

                        return handlerInput.responseBuilder
                            .speak(speakOutput)
                            .reprompt()
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
                    setReminder(handlerInput);
                    var speakOutput = 'Ok, if something goes wrong I\'ll let you know. Good bye.';
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
            speakOutput = 'Would you like me to remind you to fix your account?'

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt()
                .getResponse();
        }

        /**
         * Set reminder to fix the account later.
         */
        else if (current === 'CancelRemind') {
            setReminder(handlerInput);
            var speakOutput = 'Ok, I\'ll remind you to fix your account later. Good bye.';
            return handlerInput.responseBuilder

                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }

        repromptMessage = "Sorry, I did not hear a response. Please respond or the session will be closed";
        //Speak output and await input
        return handlerInput.responseBuilder

            .speak(speakOutput)
            .reprompt(repromptMessage)
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
        var reprompt = "";

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
            speakOutput = 'Ok, I will not inform you of any issues with your account. Account notifications will still be sent to your email. Good bye.'
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }

        /**
        * User has canceled the skill and does not want reminders to fix the account.
        */
        else if (current === 'CancelRemind') {
            speakOutput = 'Ok, Please remember to fix your account at your earliest convenience. Good bye.'
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

        repromptMessage = 'Sorry, I did not hear a response. Please respond or the session will be closed.';

        //Output message and await response
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptMessage)
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
            speakOutput = 'Your violation is as follows: ' + sessionAttributes.infraction_ShorthandDescription + '. ' + sessionAttributes.infraction_DetailedDescription
                + '. This is a violation of Amazons policy. You will have to describe the reason the policy was violated, how you fixed your policy violation, \
                            and how you will prevent further violations. \
                            Simply say, Plan of Action to fill out your reinstatement form.'
        } else if (current === 'LaunchSR') {
            speakOutput = 'You must agree that you understand the policy that was violated. You must also agree that you know why the violation happened and that \
                            you have taken steps to prevent further violations. You must finally agree that you understand continued violations will result in a loss \
                            of your marketplace account.  Simply say, reinstate, in order to start the process.'
        } else if (current === 'LaunchReply') {
            speakOutput = 'You already have a plan of action under review.  If there is more information you need to add simply say, add more information.'
        } else if (current === 'POAFinished') {
            speakOutput = 'If you are satisfied with your plan of action, say yes to submit it for review.  Otherwise, you can say cancel to stop.'
        } else if (current === 'POA') {
            speakOutput = 'Please describe why the violation happened, how you fixed the violation, and why there will be no more violations in the future. \
                            I will prompt you for each piece of information.'
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
            speakOutput = 'You must agree that you understand the policy that was violated. You must also agree that you know why the violation happened and that \
            you have taken steps to prevent further violations. You must finally agree that you understand continued violations will result in a loss \
            of your marketplace account.'
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

        repromptMessage = 'Sorry, I did not hear a response. Please respond or the session will be closed.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptMessage + ' ' + speakOutput)
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
            const speakOutput = 'If you change your mind you can add more information to your plan of action later.  Good bye.';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }
        else {
            const speakOutput = 'The reinstatement process is not complete and your account is still suspended.  Are you sure you want to stop?';
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

        repromptMessage = "Sorry, I did not hear a response. Please respond or the session will be closed.";

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptMessage)
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

//Helper function to save new POA data to DynamoDB
async function saveAppeal(id, data1, data2, data3) {
    return dbHelper.addPoa(id, data1, data2, data3)
        .then((data) => {
            return true;
        })
        .catch((err) => {
            console.log("Error occured while saving data", err);
            return false;
        })
}

//Helper function to set a reminder
async function setReminder(handlerInput) {

    const { serviceClientFactory, requestEnvelope } = handlerInput;
    const deviceId = Alexa.getDeviceId(requestEnvelope);
    var timezone;

    //get timezone
    try {
        const upsServiceClient = serviceClientFactory.getUpsServiceClient();
        timezone = await upsServiceClient.getSystemTimeZone(deviceId);
        if (timezone) {
            console.log("Timezone " + timezone)
        }
    } catch (error) {
        console.log("Timezone error: " + error);
    }

    //create reminder
    try {
        const { permissions } = requestEnvelope.context.System.user;

        if (!(permissions && permissions.consentToken))
            throw { statusCode: 401, message: "permissions error" };

        const reminderServiceClient = serviceClientFactory.getReminderManagementServiceClient();
        const remindersList = await reminderServiceClient.getReminders();
        const reminder = remind.createReminder(timezone, Alexa.getLocale(requestEnvelope));
        const reminderResponse = await reminderServiceClient.createReminder(reminder);
        console.log('Reminder Created: ' + reminderResponse.alertToken);

        return 0;

    } catch (error) {
        console.log("Reminder error: " + error);
        console.log("Reminder error: " + JSON.stringify(error));

    }
}


