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
    handle(handlerInput) {

        return handlerInput.responseBuilder
            .addRenderTemplateDirective(util.makeCard('Amazon Seller Services',"Welcome to Amazon Seller Services","You can say, 'Get account status' to get started.",''))
            .speak(c.WELCOME)
            .reprompt()
            .getResponse();
    }
}

const EntryHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'Entry';
    },
    async handle(handlerInput) {

        //Set initial session attributes to setup initial routing
        const responseBuilder = handlerInput.responseBuilder;
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        sessionAttributes.poaId = 0;
        sessionAttributes.currentState = '';
        sessionAttributes.infractionIndex = 0;

        //Get test account status
        await dbHelper.getTestValue()
            .then((data) => {
                console.log(data, typeof (data));
                var speakOutput = '';
                sessionAttributes.locale = data.Item.locale;
                sessionAttributes.infractionArray = Object.values(data.Item.infractionArray)[1];

                //Account does not exist
                if (data.length == 0) {
                    speakOutput = "No account information available";
                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                }
            })
            .catch((err) => {
                console.log("Error occured while getting data", err);
                var speakOutput = 'Error getting status ' + err;
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();
            })

        if (sessionAttributes.infractionArray.length > 0) {

            //If infraction(s) exist, get first infraction
            await dbHelper.getInfraction(sessionAttributes.infractionArray[0])
                .then((data) => {
                    // Retrieve the infraction descriptions
                    sessionAttributes.infraction_DetailedDescription = data.Item.descriptionL;
                    sessionAttributes.infraction_ShorthandDescription = data.Item.descriptionS;
                    sessionAttributes.status = data.Item.poa;
                    console.log("Status: " + sessionAttributes.status);
                })
                .catch((err) => {
                    console.log("Error occured while getting data", err);
                    var speakOutput = 'Error getting infraction';
                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                })

            if (sessionAttributes.infraction_ShorthandDescription === 'Under Review') {
                speakOutput = sessionAttributes.infraction_DetailedDescription;

                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();
            } else if (sessionAttributes.status === false) {
                speakOutput = `Your ${sessionAttributes.locale} Marketplace Seller account status is currently, suspended. The number of infractions you have is, ` + sessionAttributes.infractionArray.length
                    + ". Your first infraction is " + sessionAttributes.infraction_ShorthandDescription + " and is eligible for the self-reinstatement process."
                    + ". If you would like to reinstate your account, begin by saying reinstate my account.";

                sessionAttributes.currentState = 'LaunchSR';
                sessionAttributes.understood = false;

                responseBuilder.addRenderTemplateDirective(util.makeCard("Account Status",
                                                                            "Status: Suspended",
                                                                            `Number of infractions: ${sessionAttributes.infractionArray.length}`,
                                                                            `Your first infraction is ${sessionAttributes.infraction_ShorthandDescription}. You can say, 'Reinstate' to self-reinstate your account.`));

            } else if (sessionAttributes.status === true) {
                speakOutput = `Your ${sessionAttributes.locale} Marketplace Seller account status is currently, suspended. The number of infractions you have is, ` + sessionAttributes.infractionArray.length
                    + ". Your first infraction is " + sessionAttributes.infraction_ShorthandDescription + " which requires a complete plan of action."
                    + ". If you would like to reinstate your account, begin by saying plan of action.";
                sessionAttributes.currentState = 'LaunchPOA';

                responseBuilder.addRenderTemplateDirective(util.makeCard("Account Status",
                "Status: Suspended",
                `Number of infractions: ${sessionAttributes.infractionArray.length}`,
                `Your first infraction is ${sessionAttributes.infraction_ShorthandDescription}. You can say, 'Plan of Action' to self-reinstate your account.`));

            } else {
                speakOutput = "Could not determine the status. " + sessionAttributes.status;
            }

        } else {
            sessionAttributes.currentState = 'LaunchOK';
            speakOutput = c.LAUNCH_STATUS_OK;
        }

        return responseBuilder
            .speak(speakOutput)
            .reprompt(c.REPROMPT)
            //.withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
            .getResponse();
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
        const responseBuilder = handlerInput.responseBuilder;
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

                    responseBuilder.addRenderTemplateDirective(util.makeCard("Additional Information",
                                                                                `You added to your Plan of Action: ${current.slots.Query.value}`,
                                                                                '',''));

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
        const responseBuilder = handlerInput.responseBuilder;
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

            responseBuilder.addRenderTemplateDirective(util.makeCard("Plan of Action Summary",
                                                        `Cause of the issue: ${d1}`,
                                                        `Issue solution: ${d2}`,
                                                        `Preventative measures: ${d3}`));

            return responseBuilder
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
        const responseBuilder = handlerInput.responseBuilder;
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

                responseBuilder.addRenderTemplateDirective({
                    type: "BodyTemplate1",
                    backButton: "HIDDEN",
                    title: "Account Status",
                    textContent: {
                        primaryText: {
                            text: "Self-Reinstatement: Failed",
                            type: "PlainText"
                        },
                        secondaryText: {
                            text: 'You must agree to all statements by saying \'yes\' when prompted.',
                            type: "PlainText"
                        },
                        tertiaryText: {
                            text: '',
                            type: "PlainText"
                        }
                    }
                });

                return responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();

            } else {
                return dbHelper.updateStatus(0, 'noPOA')
                    .then(() => {
                        // Increment the infraction array index
                        var index = ++sessionAttributes.infractionIndex;
                        var length = sessionAttributes.infractionArray.length;
                        var remaining = length-index;

                        if (index < length) {
                            speakOutput = 'Thank you for submitting your response to ' + sessionAttributes.infraction_ShorthandDescription;
                            mail.handler(c.SR_SUBJECT, c.SR_CONFIRM_MESSAGE);

                            return dbHelper.getInfraction(sessionAttributes.infractionArray[index])
                                .then((data) => {
                                    // Retrieve the infraction descriptions
                                    sessionAttributes.infraction_DetailedDescription = data.Item.descriptionL;
                                    sessionAttributes.infraction_ShorthandDescription = data.Item.descriptionS;
                                    sessionAttributes.status = data.Item.poa;
                                    var tertiary = '';

                                    if (sessionAttributes.status === false) {
                                        speakOutput += '. Your next infraction is ' + sessionAttributes.infraction_ShorthandDescription + ' and is also'
                                            + ' eligible for self-reinstatement. If you would like '
                                            + 'to resolve this infraction, begin by saying reinstate my account.';
                                        tertiary = `Your next infraction is ${sessionAttributes.infraction_ShorthandDescription} and is also eligible for self-reinstatement.`

                                        sessionAttributes.currentState = 'LaunchSR';
                                        sessionAttributes.understood = false;

                                    } else if (sessionAttributes.status === true) {
                                        speakOutput += "Your next infraction is " + sessionAttributes.infraction_ShorthandDescription + ", which requires a complete plan of action."
                                            + ". If you would like to reinstate your account, begin by saying plan of action.";
                                        tertiary = `Your next infraction is ${sessionAttributes.infraction_ShorthandDescription} and requires a complete Plan of Action.`

                                        sessionAttributes.currentState = 'LaunchPOA';
                                    }

                                    responseBuilder.addRenderTemplateDirective(util.makeCard("Self-Reinstate","Self-Reinstatement: Complete",`Number of remaining infractions: ${remaining}`,tertiary));

                                    return responseBuilder
                                        .speak(speakOutput)
                                        .reprompt(c.REPROMPT)
                                        .getResponse();
                                })
                                .catch((err) => {
                                    console.log("Error occured while getting data", err);
                                    var speakOutput = 'Error getting infraction';
                                    return responseBuilder
                                        .speak(speakOutput)
                                        .withShouldEndSession(true)
                                        .getResponse();
                                })
                        } else {
                            sessionAttributes.currentState = 'LaunchOK';
                            speakOutput = c.SR_SUCCESS;

                            //Email success confirmation
                            mail.handler(c.SR_SUBJECT, c.SR_CONFIRM_MESSAGE);

                            responseBuilder.addRenderTemplateDirective(util.makeCard("Self-Reinstatement",
                                                                                    "Self-Reinstatement: Complete",
                                                                                    `Your account should be reinstated shortly.  A confirmation has been sent to your email.`,
                                                                                    '(If you have a Plan of Action under review your reinstatement may be delayed.)'));

                            return responseBuilder
                                .speak(speakOutput)
                                .reprompt(c.REPROMPT)
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
            console.log('Print this');
            //Special case: The user must agree with the first question to continue on in the process.
            //Any other 'no' responses will be handled at the end of the process.
            //If the user doesn't understand the policy, read it back re prompt for agreement.
            if (currentIntent.slots["CheckOne"].resolutions.resolutionsPerAuthority[0].values[0].value.name === "No") {
                speakOutput = 'Your violation is as follows: ' +
                    sessionAttributes.infraction_ShorthandDescription + '. ' +
                    sessionAttributes.infraction_DetailedDescription +
                    '. This is a violation of Amazons policy.'

                return responseBuilder
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
                return responseBuilder
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
            return responseBuilder
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
 * the account.
 */
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        var speakOutput = "";

        //Get current set of attributes to route to the correct response
        const responseBuilder = handlerInput.responseBuilder;
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
                        var index = ++sessionAttributes.infractionIndex;
                        var length = sessionAttributes.infractionArray.length;
                        var remaining = length-index;
                        if (index < length) {
                            speakOutput = 'Thank you for submitting your response to ' + sessionAttributes.infraction_ShorthandDescription;

                            //email confirmation of poa submission.                        
                            var POA_CONFIRM_MESSAGE = responses.makeResponse(d1, d2, d3);
                            mail.handler(c.POA_SUBJECT, POA_CONFIRM_MESSAGE);

                            return dbHelper.getInfraction(sessionAttributes.infractionArray[index])
                                .then((data1) => {
                                    // Retrieve the infraction descriptions
                                    sessionAttributes.infraction_DetailedDescription = data1.Item.descriptionL;
                                    sessionAttributes.infraction_ShorthandDescription = data1.Item.descriptionS;
                                    sessionAttributes.status = data1.Item.poa;
                                    var tertiary;

                                    if (sessionAttributes.status === false) {
                                        speakOutput += '. Your next infraction is ' + sessionAttributes.infraction_ShorthandDescription + ' and is'
                                            + ' eligible for self-reinstatement. If you would like '
                                            + 'to resolve this infraction, begin by saying reinstate my account.';
                                        tertiary = `Your next infraction is ${sessionAttributes.infraction_ShorthandDescription} and is eligible for self-reinstatement.`
                                        sessionAttributes.currentState = 'LaunchSR';
                                        sessionAttributes.understood = false;

                                    } else if (sessionAttributes.status === true) {
                                        speakOutput = "Your next infraction is " + sessionAttributes.infraction_ShorthandDescription + " which also requires a complete plan of action."
                                            + ". If you would like to reinstate your account, begin by saying plan of action.";
                                        tertiary = `Your next infraction is ${sessionAttributes.infraction_ShorthandDescription} and requires a complete Plan of Action.`

                                        sessionAttributes.currentState = 'LaunchPOA';
                                    }

                                    responseBuilder.addRenderTemplateDirective(util.makeCard("Plan of Action",
                                                                                "Plan of Action: Complete",
                                                                                `Number of remaining infractions: ${remaining}`,
                                                                                tertiary));

                                    return responseBuilder
                                        .speak(speakOutput)
                                        .reprompt(c.REPROMPT)
                                        .getResponse();
                                })
                                .catch((err) => {
                                    console.log("Error occured while getting data", err);
                                    var speakOutput = 'Error getting infraction';
                                    return handlerInput.responseBuilder
                                        .speak(speakOutput)
                                        .withShouldEndSession(true)
                                        .getResponse();
                                })
                        } else {
                            sessionAttributes.currentState = 'LaunchOK';

                            //email confirmation of poa submission.                        
                            var POA_CONFIRM_MESSAGE = responses.makeResponse(d1, d2, d3);
                            mail.handler(c.POA_SUBJECT, POA_CONFIRM_MESSAGE);

                            speakOutput = responses.completion();
                            //Prompt if the user wants notifications of future issues
                            speakOutput += c.POA_REMIND;

                            responseBuilder.addRenderTemplateDirective(util.makeCard("Plan of Action",
                                                                        "Plan of Action: Complete",
                                                                        'You have finished the Plan of Action.  You will be contacted when its review is complete.',''));

                            return responseBuilder
                                .speak(speakOutput)
                                .reprompt()
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

                    responseBuilder.addRenderTemplateDirective(util.makeCard("Notifications","Reminder: Set",c.REMIND_OK,''));

                    return responseBuilder
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

            responseBuilder.addRenderTemplateDirective(util.makeCard("Notifications","Reminder: Pending",c.REMIND_PRMOPT_FROM_CANCEL,''));

            return responseBuilder
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

            responseBuilder.addRenderTemplateDirective(util.makeCard("Notifications","Reminder: Set",c.REMIND_OK_FROM_CANCEL,''));

            return responseBuilder
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

        const responseBuilder = handlerInput.responseBuilder;
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

            responseBuilder.addRenderTemplateDirective({
                type: "BodyTemplate1",
                backButton: "HIDDEN",
                title: "Would you notifications?",
                textContent: {
                    primaryText: {
                        text: "Reminder: Declined",
                        type: "PlainText"
                    },
                    secondaryText: {
                        text: "You will not receive audio reminders.",
                        type: "PlainText"
                    },
                    tertiaryText: {
                        text: 'Notifications will be emailed to you.',
                        type: "PlainText"
                    }
                }
            });

            return responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }

        /**
        * User has canceled the skill and does not want reminders to fix the account.
        */
        else if (current === 'CancelRemind') {
            speakOutput = c.REMIND_NO_FROM_CANCEL;

            responseBuilder.addRenderTemplateDirective(util.makeCard("Notifications","Reminder: Declined",c.REMIND_NO_FROM_CANCEL,''));

            return responseBuilder
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
        const responseBuilder = handlerInput.responseBuilder;

        if (current === 'LaunchPOA') {
            speakOutput = 'Your violation is as follows: ' +
                sessionAttributes.infraction_ShorthandDescription + '. ' +
                sessionAttributes.infraction_DetailedDescription + '. ' +
                c.HELP_FROM_LAUNCH;

                responseBuilder.addRenderTemplateDirective(util.makeCard("Violation Details",
                                                                        sessionAttributes.infraction_ShorthandDescription,
                                                                        sessionAttributes.infraction_DetailedDescription,
                                                                        c.HELP_FROM_LAUNCH));
        } else if (current === 'LaunchSR') {
            speakOutput = c.HELP_SR;
        } else if (current === 'LaunchReply') {
            speakOutput = c.HELP_REPLY;
        } else if (current === 'POAFinished') {
            speakOutput = c.HELP_POA_END;
        } else if (current === 'POA') {
            speakOutput = c.HELP_POA;
        } else if (current === 'Self') {
            speakOutput = c.HELP_SR;
        } else if (current === 'Help') {
            speakOutput = 'You can get in touch with Amazon Seller Central by calling, 1, 8 6 6, 2 1 6, 1 0 7 2. \
                            Say, get account status, to start over.'

            responseBuilder.addRenderTemplateDirective(util.makeCard("Help",
                                                                    'You can get in touch with Amazon Seller Central by calling:',
                                                                    '1-866-216-1072',''));

            return responseBuilder
                .speak(speakOutput)
                .reprompt(c.REPROMPT + ' ' + speakOutput)
                .getResponse();
        }

        sessionAttributes.currentState = 'Help';

        responseBuilder.addRenderTemplateDirective(util.makeCard("Help",speakOutput,'',''));

        speakOutput += ' If you need more assisstance you can say help again.'

        return responseBuilder
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
        const responseBuilder = handlerInput.responseBuilder;
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.currentState = 'AMAZON.CancelIntent';

        if (sessionAttributes.status === 4) {
            const speakOutput = c.CANCEL_STATUS_4;

            responseBuilder.addRenderTemplateDirective(util.makeCard("Cancel","Action Cancelled", c.CANCEL_STATUS_4,''));

            return responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }
        else {
            const speakOutput = c.CANCEL_CONFIRM;

            responseBuilder.addRenderTemplateDirective(util.makeCard("Cancel","Action Cancelled",c.CANCEL_CONFIRM,''));

            return responseBuilder
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
        EntryHandler,
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


