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
            .addRenderTemplateDirective(util.makeCard('Amazon Seller Services', "Welcome to Amazon Seller Services", "You can say, 'Get account status' to get started.", ''))
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
        sessionAttributes.poaId = 'noPOA';
        sessionAttributes.currentState = '';
        sessionAttributes.infractionIndex = 0;
        sessionAttributes.poa = false;
        sessionAttributes.resume = false;
        sessionAttributes.understood = false
        var status = -1;
        var speakOutput = '';
        var tertiary = '';


        //Get account status first
        await dbHelper.getAccount()
            .then((data) => {
                console.log(data, typeof (data));

                //Account does not exist, Exit skill
                if (data.length == 0) {
                    speakOutput = "No account information available";
                    return responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                }

                //If data exists, set status session Attribute
                sessionAttributes.status = data.Item.statusCode;
                sessionAttributes.updatedStatus = data.Item.statusCode;
                status = sessionAttributes.status;
                sessionAttributes.infractionArray = data.Item.infractionArray;
                sessionAttributes.locale = data.Item.locale;

                //If in progress POA exists and status is either Resume or Reply, get id.
                if (data.Item.poaId != 'noPOA' && (status === 2 || status === 3)) {
                    sessionAttributes.poaId = data.Item.poaId;
                }

            })
            .catch((err) => {
                console.log("Error occured while getting data", err);
                var speakOutput = 'Error getting status ' + err;
                return responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();
            })


        //If status == 0, account is in good standing.  Output message and prompt for notifications.
        if (status === 0) {
            sessionAttributes.currentState = 'LaunchOK';

            return responseBuilder
                .addRenderTemplateDirective(util.makeCard('Amazon Seller Services', "Your account is in good standing.", '', ''))
                .speak(c.LAUNCH_STATUS_OK)
                .getResponse();
        }

        //If status == 1, account is suspended.  Dive deeper for resolution type.
        if (status === 1) {

            //Get the infraction to determine if a POA is required.
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
                    return responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();

                })

            //If no POA required, prompt the user to begin the SR process.  Else, prompt for the POA process.
            if (sessionAttributes.poa == false) {
                speakOutput = "Your account is currently suspended and has " + sessionAttributes.infractionArray.length
                    + " infractions. Your first infraction is " + sessionAttributes.infraction_ShorthandDescription
                    + ". If you would like to reinstate your account, begin by saying, reinstate.";
                tertiary = "Say 'Reinstate' to get started."
                sessionAttributes.currentState = 'LaunchSR';
            } else if (sessionAttributes.poa == true) {
                speakOutput = "Your account is currently suspended and has " + sessionAttributes.infractionArray.length
                    + " infractions. Your first infraction is " + sessionAttributes.infraction_ShorthandDescription
                    + " and requires a complete plan of action. If you would like to reinstate your account, begin by saying plan of action.";
                tertiary = "Say 'Plan of Action' to get started."
                sessionAttributes.currentState = 'LaunchPOA';
            }

            responseBuilder.addRenderTemplateDirective(
                util.makeCard(
                    'Amazon Seller Services', "Status: Suspended", `Infractions: ${sessionAttributes.infractionArray.length}`, tertiary));
        }

        //If status == 2, In-Progress is available.  Prompt for resume.
        if (status === 2) {
            sessionAttributes.currentState = "LaunchResume";
            speakOutput = c.RESUME_GREETING;

            responseBuilder.addRenderTemplateDirective(
                util.makeCard(
                    'Amazon Seller Services', "Status: In-Progress", "Say 'Resume' to finish you plan of action", ''));
        }

        //If status == 3, Reply availalbe.  Prompt to add more information.
        if (status === 3) {

            //Retrieve the completed POA
            await dbHelper.getPOA(sessionAttributes.poaId)
                .then((data) => {
                    sessionAttributes.d1 = data.Item.rootCause;
                    sessionAttributes.d2 = data.Item.actionTaken;
                    sessionAttributes.d3 = data.Item.preventativeMeasure;

                    sessionAttributes.currentState = 'LaunchReply';
                    speakOutput = c.REPLY_GREETING;

                })
                .catch((err) => {
                    console.log("Error occured getting POA", err);
                    var speakOutput = 'Error getting plan of action';

                    return responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                })


            if (sessionAttributes.infractionArray.length > 0) {
                await dbHelper.getInfraction(sessionAttributes.infractionArray[0])
                    .then((data) => {
                        if (data.Item.poa === false) {
                            speakOutput += ` You can also address your next infraction, ${data.Item.descriptionS}, by saying, reinstate.`;
                            responseBuilder.addRenderTemplateDirective(
                                util.makeCard(
                                    'Amazon Seller Services', "Status: Under Review", "Say, 'Add More Information' to add to your plan of action", "Or say 'Reinstate' to address your other infractions."));
                        } else {
                            speakOutput += ` You can also address your next infraction, ${data.Item.descriptionS}, by saying, plan of action.`;
                            responseBuilder.addRenderTemplateDirective(
                                util.makeCard(
                                    'Amazon Seller Services', "Status: Under Review", "Say, 'Add More Information' to add to your plan of action", "Or say 'Plan of Action' to address your other infractions."));
                        }
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
                responseBuilder.addRenderTemplateDirective(
                    util.makeCard(
                        'Amazon Seller Services', "Status: Under Review", "Say, 'Add More Information' to add to your plan of action", ''));
            }
        }

        //Outputs the prompt to the user based on the options above.
        return responseBuilder
            .speak(speakOutput)
            .reprompt(c.REPROMPT)
            //.withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
            .getResponse();

    }
};

/**
 * Allow the user to resume an incomplete POA by retrieving the in-progress
 * POA and delegating the skill to appropriate point in the POA process.
 */
const ResumeHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'Resume'
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();
        const responseBuilder = handlerInput.responseBuilder;
        sessionAttributes.currentState = 'Resume';
        sessionAttributes.resume = true;

        //Retrieve incomplete POA and set values to session attributes for later retrieval
        await dbHelper.getPOA(sessionAttributes.poaId)
            .then((data) => {
                console.log("POA data: " + JSON.stringify(data));
                sessionAttributes.d1 = data.Item.rootCause;
                sessionAttributes.d2 = data.Item.actionTaken;
                sessionAttributes.d3 = data.Item.preventativeMeasure;
            })
            .catch((err) => {
                console.log("Error occured getting POA", err);
                var speakOutput = 'Error getting plan of action';

                return responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();

            })

        //After retrieving in-progress POA, fill in current values and delegate to the POA handler
        if (sessionAttributes.d2 === 'noEntry') {
            return responseBuilder
                .speak('You have said so far that the root cause of your issue was ' + sessionAttributes.d1)
                .addDelegateDirective({
                    name: 'PlanOfAction',
                    slots: {
                        "Q.Three": {
                            "name": "Q.Three",
                            "value": "",
                            "confirmationStatus": "NONE"
                        },
                        "Q.Two": {
                            "name": "Q.Two",
                            "value": "",
                            "confirmationStatus": "NONE"
                        },
                        "Q.One": {
                            "name": "Q.One",
                            "value": sessionAttributes.d1,
                            "confirmationStatus": "CONFIRMED"
                        }
                    }
                })
                .getResponse();
        } else {
            return responseBuilder
                .speak('You have said so far that the root cause of your issue was ' + sessionAttributes.d1
                    + ', and the way you fixed this issue was ' + sessionAttributes.d2)
                .addDelegateDirective({
                    name: 'PlanOfAction',
                    slots: {
                        "Q.Three": {
                            "name": "Q.Three",
                            "value": "",
                            "confirmationStatus": "NONE"
                        },
                        "Q.Two": {
                            "name": "Q.Two",
                            "value": sessionAttributes.d2,
                            "confirmationStatus": "CONFIRMED"
                        },
                        "Q.One": {
                            "name": "Q.One",
                            "value": sessionAttributes.d1,
                            "confirmationStatus": "CONFIRMED"
                        }
                    }
                })
                .getResponse();
        }
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

        //Once the dialog is complete, save updated POA
        if (handlerInput.requestEnvelope.request.dialogState === 'COMPLETED') {

            await dbHelper.updatePOA(sessionAttributes.poaId,
                sessionAttributes.d1,
                sessionAttributes.d2,
                sessionAttributes.d3,
                current.slots.Query.value)

                .catch((err) => {
                    console.log("Error occured while updating", err);
                    var speakOutput = 'Error updating';
                    return responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                })

            //If there are more infractions, iterate to the next one.
            // Increment the infraction array index
            var index = ++sessionAttributes.infractionIndex;
            var length = sessionAttributes.infractionArray.length;
            var remaining = length - index;

            if (index < length) {
                speakOutput = 'Thank you for you response.';
                //email confirmation of complete SR.
                mail.handler(c.SR_SUBJECT, c.SR_CONFIRM_MESSAGE);

                //Get the next infraction
                await dbHelper.getInfraction(sessionAttributes.infractionArray[index])
                    .then((data) => {
                        // Retrieve the infraction descriptions
                        sessionAttributes.infraction_DetailedDescription = data.Item.descriptionL;
                        sessionAttributes.infraction_ShorthandDescription = data.Item.descriptionS;
                        sessionAttributes.poa = data.Item.poa;
                    })
                    .catch((err) => {
                        console.log("Error occured while getting data", err);
                        var speakOutput = 'Error getting infraction ' + err;
                        return responseBuilder
                            .speak(speakOutput)
                            .withShouldEndSession(true)
                            .getResponse();
                    })

                if (sessionAttributes.poa == false) {
                    speakOutput += ` You have ${remaining} more infractions. Your next infraction is `
                        + sessionAttributes.infraction_ShorthandDescription
                        + '. If you would like to resolve this infraction you can begin by saying, reinstate.';

                    sessionAttributes.currentState = 'LaunchSR';
                    sessionAttributes.understood === false

                    responseBuilder.addRenderTemplateDirective(util.makeCard("Additional Information",
                        `You added to your Plan of Action: ${current.slots.Query.value}`,
                        "You can say 'Reinstate' to address your other infraction(s)", ''));

                } else {
                    speakOutput += ` You have ${remaining} more infractions. Your next infraction is `
                        + sessionAttributes.infraction_ShorthandDescription
                        + ' and requires a complete plan of action. If you would like '
                        + 'to resolve this infraction say, plan of action.';
                    sessionAttributes.currentState = 'LaunchPOA';

                    responseBuilder.addRenderTemplateDirective(util.makeCard("Additional Information",
                        `You added to your Plan of Action: ${current.slots.Query.value}`,
                        "You can say 'Plan of Action' to address your other infraction(s)", ''));
                }

                return responseBuilder
                    .speak(speakOutput)
                    .reprompt(c.REPROMPT)
                    .getResponse();

            } else {
                var speakOutput = c.REPLY_SUCCESS;

                //Constructs and sends an email confirmation of the added information
                var REPLY_CONFIRM_MESSAGE = responses.makeReplyResponse(current.slots.Query.value);
                mail.handler(c.REPLY_SUBJECT, REPLY_CONFIRM_MESSAGE);

                responseBuilder.addRenderTemplateDirective(util.makeCard("Additional Information",
                    `You added to your Plan of Action: ${current.slots.Query.value}`,
                    '', ''));


                return responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();
            }
        } else {
            //Delegate the dialog control to the skill in order to get user input
            return responseBuilder
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
        const responseBuilder = handlerInput.responseBuilder;
        const currentIntent = handlerInput.requestEnvelope.request.intent;
        sessionAttributes.currentState = 'POA';
        var speakOutput = '';

        //Default values to save if the user stops part way through and wants to save progress.
        sessionAttributes.d1 = 'noEntry';
        sessionAttributes.d2 = 'noEntry';
        sessionAttributes.d3 = 'noEntry';

        //If dialog is complete, save POA
        if (handlerInput.requestEnvelope.request.dialogState === 'COMPLETED') {

            sessionAttributes.currentState = 'POAFinished';

            sessionAttributes.d1 = Alexa.getSlotValue(requestEnvelope, 'Q.One');
            sessionAttributes.d2 = Alexa.getSlotValue(requestEnvelope, 'Q.Two');
            sessionAttributes.d3 = Alexa.getSlotValue(requestEnvelope, 'Q.Three');

            //Confirm final submission via YesIntent and NoIntent.
            speakOutput += `You entered the cause of the issue was ${sessionAttributes.d1}, \
                the issue is fixed because ${sessionAttributes.d2}, \
                and this will not happen again because ${sessionAttributes.d3}. \
                Is this correct?`

            responseBuilder.addRenderTemplateDirective(util.makeCard("Plan of Action Summary",
                `Cause of the issue: ${sessionAttributes.d1}`,
                `Issue solution: ${sessionAttributes.d2}`,
                `Preventative measures: ${sessionAttributes.d3}`));

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
            }
            //Cancel functionality for saving incomplete POA
            //If slot 1 is empty, nothing to save
            else if (temp1 === 'cancel') {
                return CancelIntentHandler.handle(handlerInput);
            }
            //If slot 2 or 3 is cancel, save current input
            else if (temp2 === 'cancel' || temp3 === 'cancel') {

                sessionAttributes.currentState = 'IncompleteSave';
                sessionAttributes.updatedStatus = 2;

                sessionAttributes.d1 = Alexa.getSlotValue(requestEnvelope, 'Q.One');
                if (currentIntent.slots["Q.Two"].hasOwnProperty("value")) {
                    sessionAttributes.d2 = Alexa.getSlotValue(requestEnvelope, 'Q.Two');
                }
                if (currentIntent.slots["Q.Three"].hasOwnProperty("value")) {
                    sessionAttributes.d3 = Alexa.getSlotValue(requestEnvelope, 'Q.Three');
                }

                responseBuilder.addRenderTemplateDirective(util.makeCard("Plan of Action Summary",
                    `Cause of the issue: ${sessionAttributes.d1}`,
                    `Issue solution: ${sessionAttributes.d2}`,
                    `Preventative measures: ${sessionAttributes.d3}`));

                return responseBuilder
                    .speak(c.POA_SAVE)
                    .reprompt(c.REPROMPT + ' ' + c.POA_SAVE)
                    .getResponse();

            } else {
                return responseBuilder
                    .addDelegateDirective()
                    .getResponse();
            }
        }
    }
}

/**
 * Handler triggers the dialog model for handling the self-reinstatement
 * process.  At completion, update status of account to '0' for
 * all clear and set the poaId on the account to noPOA.
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
        var tertiary = '';

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

                //If there are more infractions, iterate to the next one.
                // Increment the infraction array index
                var index = ++sessionAttributes.infractionIndex;
                var length = sessionAttributes.infractionArray.length;
                var remaining = length - index;

                if (index < length) {
                    speakOutput = 'Thank you for you response.';
                    //email confirmation of complete SR.
                    mail.handler(c.SR_SUBJECT, c.SR_CONFIRM_MESSAGE);

                    //Get the next infraction
                    await dbHelper.getInfraction(sessionAttributes.infractionArray[index])
                        .then((data) => {
                            // Retrieve the infraction descriptions
                            sessionAttributes.infraction_DetailedDescription = data.Item.descriptionL;
                            sessionAttributes.infraction_ShorthandDescription = data.Item.descriptionS;
                            sessionAttributes.poa = data.Item.poa;
                        })
                        .catch((err) => {
                            console.log("Error occured while getting data", err);
                            var speakOutput = 'Error getting infraction ' + err;
                            return responseBuilder
                                .speak(speakOutput)
                                .withShouldEndSession(true)
                                .getResponse();
                        })

                    if (sessionAttributes.poa == false) {
                        speakOutput += ` You have ${remaining} more infractions. Your next infraction is `
                            + sessionAttributes.infraction_ShorthandDescription
                            + '. If you would like to resolve this infraction you can begin by saying, reinstate.';

                        tertiary = "Say 'Reinstate' to address your next infraction."
                        sessionAttributes.currentState = 'LaunchSR';
                        sessionAttributes.understood === false

                        responseBuilder.addRenderTemplateDirective(
                            util.makeCard(
                                "Self-Reinstate", "Self-Reinstatement: Complete", `Number of remaining infractions: ${remaining}`, tertiary));
                    } else {
                        speakOutput += ` You have ${remaining} more infractions. Your next infraction is `
                            + sessionAttributes.infraction_ShorthandDescription
                            + ' and requires a complete plan of action. If you would like '
                            + 'to resolve this infraction say, plan of action.';

                        tertiary = "Say 'Plan of Action' to address your next infraction."
                        sessionAttributes.currentState = 'LaunchPOA';

                        responseBuilder.addRenderTemplateDirective(
                            util.makeCard(
                                "Self-Reinstate", "Self-Reinstatement: Complete", `Number of remaining infractions: ${remaining}`, tertiary));
                    }

                    return responseBuilder
                        .speak(speakOutput)
                        .reprompt(c.REPROMPT)
                        .getResponse();

                } else {
                    sessionAttributes.currentState = 'LaunchOK';
                    speakOutput = c.SR_SUCCESS;

                    //email confirmation of SR completion
                    mail.handler(c.SR_SUBJECT, c.SR_CONFIRM_MESSAGE);

                    await dbHelper.updateInfractionArray(sessionAttributes.infractionArray, index, 1)
                        .catch((err) => {
                            console.log("Error updating array", err);
                            return responseBuilder
                                .speak('Array update error')
                                .withShouldEndSession(true)
                                .getResponse();
                        })

                    //Update the account status based on if there is a POA under review
                    var newStatus;
                    if (sessionAttributes.updatedStatus === 1) {
                        newStatus = 0;
                        sessionAttributes.poaId = 'noPOA';
                    } else {
                        newStatus = sessionAttributes.updatedStatus;
                    }

                    //Update status and prompt for reminders.
                    return dbHelper.updateStatus(newStatus, sessionAttributes.poaId)
                        .then(() => {
                            responseBuilder.addRenderTemplateDirective(
                                util.makeCard(
                                    "Self-Reinstate", "Self-Reinstatement: Complete", '', ''));
                            return responseBuilder
                                .speak(c.SR_SUCCESS)
                                .getResponse();
                        })
                        .catch((err) => {
                            console.log("Error occured while updating", err);
                            var speakOutput = 'Error updating status ' + err;
                            return responseBuilder
                                .speak(speakOutput)
                                .withShouldEndSession(true)
                                .getResponse();
                        })
                }
            }
        } else if (currentIntent.slots["CheckOne"].hasOwnProperty("value") && sessionAttributes.understood === false) {
            console.log('Print this');
            //Special case: The user must agree with the first question to continue on in the process.
            //Any other 'no' responses will be handled at the end of the process.
            //If the user doesn't understand the policy, read it back re prompt for agreement.
            if (currentIntent.slots["CheckOne"].resolutions.resolutionsPerAuthority[0].values[0].value.name === "No") {
                //Construct response
                speakOutput = 'Your violation is as follows: ' +
                    sessionAttributes.infraction_ShorthandDescription + '. ' +
                    sessionAttributes.infraction_DetailedDescription +
                    '. This is a violation of Amazons policy.'


                //Output response and delegate back to the dialog
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
                //If the user responds yes to the first question, save the value and delegate
                //back to the dialog.
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

/**
 * The yes intent will handle confirmation of completed plans of action.  If the 
 * POA is approved, data is saved to a DynamoDB table.
 * 
 * The yes intent will also handle the responses for a  cancel request and setting up a reminder to fix
 * the account
 */
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        var speakOutput = "There was an error";

        //Get current set of attributes to route to the correct response
        const responseBuilder = handlerInput.responseBuilder;
        const attributesManager = handlerInput.attributesManager;
        const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        var current = sessionAttributes.currentState;

        sessionAttributes.infractionIndex;
        var length = sessionAttributes.infractionArray.length;
        var remaining = length;

        var id, d1, d2, d3;

        //Yes response when confirming submitted POA/incomplete POA
        if (current === 'POAFinished' || current === 'IncompleteSave') {
            //Retrieve and increment POA id from persistence store
            if (sessionAttributes.poaId === 'noPOA') {
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
            }

            //Save data values (d1,d2,d3) to POA storage in dynamo        
            id = `${sessionAttributes.poaId}`;
            d1 = sessionAttributes.d1;
            d2 = sessionAttributes.d2;
            d3 = sessionAttributes.d3;

            if (d2 === 'cancel') {
                d2 = 'noEntry';
            }


            if (d3 === 'cancel') {
                d3 = 'noEntry';
            }

            //If finishing an incomplete POA, updatePOA
            //else addPOA
            if (sessionAttributes.resume === true) {
                sessionAttributes.updatedStatus = 3;
                await dbHelper.updatePOA(id, d1, d2, d3, 'noReply')
                    .catch((err) => {
                        console.log("Error occured while updating", err);
                        var speakOutput = 'Error updating status';
                        return responseBuilder
                            .speak(speakOutput)
                            .withShouldEndSession(true)
                            .getResponse();
                    })


                //email confirmation of poa submission.                        
                var POA_CONFIRM_MESSAGE = responses.makeResponse(d1, d2, d3);
                mail.handler(c.POA_SUBJECT, POA_CONFIRM_MESSAGE);


            } else {
                sessionAttributes.updatedStatus = 3;
                await dbHelper.addPoa(id, d1, d2, d3)
                    .catch((err) => {
                        console.log("Error occured while adding", err);
                        var speakOutput = 'Error adding plan of action';
                        return responseBuilder
                            .speak(speakOutput)
                            .withShouldEndSession(true)
                            .getResponse();
                    })

                //email confirmation of poa submission.                        
                var POA_CONFIRM_MESSAGE = responses.makeResponse(d1, d2, d3);
                mail.handler(c.POA_SUBJECT, POA_CONFIRM_MESSAGE);
            }
        }

        /**
         * If the current POA is complete, check for more infractions
         */
        if (current === 'POAFinished') {
            sessionAttributes.infractionIndex++;
            remaining = length - sessionAttributes.infractionIndex;

            //If there are more infractions, continue on to the next one.
            if (sessionAttributes.infractionIndex < length) {
                speakOutput = 'Thank you for submitting your response.';

                await dbHelper.getInfraction(sessionAttributes.infractionArray[sessionAttributes.infractionIndex])
                    .then((data2) => {
                        // Retrieve the infraction descriptions
                        sessionAttributes.infraction_DetailedDescription = data2.Item.descriptionL;
                        sessionAttributes.infraction_ShorthandDescription = data2.Item.descriptionS;
                        sessionAttributes.poa = data2.Item.poa;

                    })
                    .catch((err) => {
                        console.log("Error occured while getting data", err);
                        var speakOutput = 'Error getting infraction ' + err;
                        return responseBuilder
                            .speak(speakOutput)
                            .withShouldEndSession(true)
                            .getResponse();
                    })

                if (sessionAttributes.poa == false) {
                    speakOutput += ` You have ${remaining} more infractions. Your next infraction is `
                        + sessionAttributes.infraction_ShorthandDescription
                        + '. If you would like to resolve this infraction you can begin by saying, reinstate.';

                    tertiary = "Say 'Reinstate' to address your next infraction."
                    sessionAttributes.currentState = 'LaunchSR';
                    sessionAttributes.understood === false

                    responseBuilder.addRenderTemplateDirective(
                        util.makeCard(
                            "Plan of Action", "Plan of Action: Complete", `Number of remaining infractions: ${remaining}`, tertiary));
                } else {
                    speakOutput += ` You have ${remaining} more infractions. Your next infraction is `
                        + sessionAttributes.infraction_ShorthandDescription
                        + ' and requires a complete plan of action. If you would like '
                        + 'to resolve this infraction say, plan of action.';

                    tertiary = "Say 'Reinstate' to address your next infraction."
                    sessionAttributes.currentState = 'LaunchPOA';

                    responseBuilder.addRenderTemplateDirective(
                        util.makeCard(
                            "Plan of Action", "Plan of Action: Complete", `Number of remaining infractions: ${remaining}`, tertiary));
                }
            }

            /**
             * If there are no more infractions, update the list of infractions and update status
             */
            else {
                sessionAttributes.currentState = 'LaunchOK';

                await dbHelper.updateInfractionArray(sessionAttributes.infractionArray, sessionAttributes.infractionIndex, 1)
                    .catch((err) => {
                        console.log("Error updating array", err);
                        return responseBuilder
                            .speak('Array update error')
                            .withShouldEndSession(true)
                            .getResponse();
                    })

                await dbHelper.updateStatus(3, id)
                    .catch((err) => {
                        console.log("Error occured while updating", err);
                        var speakOutput = 'Error updating status ' + err;
                        return responseBuilder
                            .speak(speakOutput)
                            .withShouldEndSession(true)
                            .getResponse();
                    })

                speakOutput = responses.completion();
                //Prompt if the user wants notifications of future issues
                speakOutput += c.POA_REMIND;

                responseBuilder.addRenderTemplateDirective(
                    util.makeCard(
                        "Plan of Action", "Plan of Action: Complete", 'Would you like notifications of future issues?', ''));
            }

            return responseBuilder
                .speak(speakOutput)
                .reprompt(c.REPROMPT)
                .getResponse();
        }

        /**
         * If the POA is incomplete, update status accordingly
         */
        else if (current === 'IncompleteSave') {

            //If there are other infractions that were resolved, update the list
            if (sessionAttributes.infractionIndex > 0) {
                await dbHelper.updateInfractionArray(sessionAttributes.infractionArray, sessionAttributes.infractionIndex, 1)
                    .catch((err) => {
                        console.log("Error updating array", err);
                        return responseBuilder
                            .speak('Array update error')
                            .withShouldEndSession(true)
                            .getResponse();
                    })
            }

            //update status and prompt for exit
            return dbHelper.updateStatus(2, id)
                .then(() => {

                    //email confirmation of poa submission.                        
                    var POA_CONFIRM_MESSAGE = responses.makeResponse(d1, d2, d3);
                    mail.handler(c.POA_SUBJECT, POA_CONFIRM_MESSAGE);

                    sessionAttributes.currentState = 'LaunchOK';
                    speakOutput = responses.completion();
                    //Prompt if the user wants notifications of future issues
                    speakOutput += c.POA_REMIND;

                    responseBuilder.addRenderTemplateDirective(
                        util.makeCard(
                            "Plan of Action", "Plan of Action: Saved", 'Would you like notifications of future issues?', ''));

                    return responseBuilder
                        .speak(speakOutput)
                        .reprompt(c.REPROMPT)
                        .getResponse();

                })
                .catch((err) => {
                    console.log("Error occured while updating", err);
                    var speakOutput = 'Error updating status ' + err;
                    return responseBuilder
                        .speak(speakOutput)
                        .withShouldEndSession(true)
                        .getResponse();
                })
        }

        /**
         * Sets up the reminder to notify the user if anthing goes wrong
         * with the account in the future.
         */
        else if (current === "LaunchOK") {
            return dbHelper.updateStatus(1, 'noPOA')
                .then(() => {
                    util.setReminder(handlerInput);

                    responseBuilder.addRenderTemplateDirective(
                        util.makeCard(
                            "Notifications", "I will notify you if anything else goes wrong.", 'Good bye.', ''));

                    return responseBuilder
                        .speak(c.REMIND_OK)
                        .withShouldEndSession(true)
                        .getResponse();

                })
                .catch((err) => {
                    console.log("Error occured while updating", err);
                    return responseBuilder
                        .speak('Error updating status')
                        .withShouldEndSession(true)
                        .getResponse();
                })
        }

        /**
         * From cancel, ask if the user wants a reminder to fix the account.
         */
        else if (current === 'AMAZON.CancelIntent') {
            sessionAttributes.currentState = 'CancelRemind'

            //Skill is about to exit.  Update list of infractions if any have been resolved
            if (sessionAttributes.infractionIndex > 0) {
                await dbHelper.updateInfractionArray(sessionAttributes.infractionArray, sessionAttributes.infractionIndex, 1)
                    .catch((err) => {
                        console.log("Error updating array", err);
                        return responseBuilder
                            .speak('Array update error')
                            .withShouldEndSession(true)
                            .getResponse();
                    })

                await dbHelper.updateStatus(sessionAttributes.updatedStatus, sessionAttributes.poaId)
                    .catch((err) => {
                        console.log("Error occured while updating", err);
                        return responseBuilder
                            .speak('Update error')
                            .withShouldEndSession(true)
                            .getResponse();
                    })
            }

            responseBuilder.addRenderTemplateDirective(
                util.makeCard(
                    "Notifications", "Would you like to be reminded to fix your account?", '', ''));

            return responseBuilder
                .speak(c.REMIND_PRMOPT_FROM_CANCEL)
                .reprompt(c.REPROMPT)
                .getResponse();
        }

        /**
        * Set reminder to fix the account later.
        */
        else if (current === 'CancelRemind') {
            util.setReminder(handlerInput);

            responseBuilder.addRenderTemplateDirective(
                util.makeCard(
                    "Notifications", "Ok.  I will remind you to fix your account", 'Good bye.', ''));

            return responseBuilder
                .speak(c.REMIND_OK_FROM_CANCEL)
                .withShouldEndSession(true)
                .getResponse();
        }

        return responseBuilder
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
        var speakOutput = '';

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

            return responseBuilder
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

            responseBuilder.addRenderTemplateDirective({
                type: "BodyTemplate1",
                backButton: "HIDDEN",
                title: "Notifications",
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
                .speak(c.REMIND_NO)
                .withShouldEndSession(true)
                .getResponse();
        }

        /**
        * User has canceled the skill and does not want reminders to fix the account.
        */
        else if (current === 'CancelRemind') {
            responseBuilder.addRenderTemplateDirective(util.makeCard("Notifications", "Reminder: Declined", c.REMIND_NO_FROM_CANCEL, ''));
            return responseBuilder
                .speak(c.REMIND_NO_FROM_CANCEL)
                .withShouldEndSession(true)
                .getResponse();
        }


        /**
         * User has cancelled the skill mid-POA and chooses not to save.
         */
        else if (current === 'IncompleteSave') {
            responseBuilder.addRenderTemplateDirective(util.makeCard("Seller Services", "Plan of Action: Cancelled", c.REMIND_NO_FROM_CANCEL, ''));
            return responseBuilder
                .speak('Okay, responses will not be saved.  Good bye.')
                .withShouldEndSession(true)
                .getResponse();
        }

        /**
         * User cancels, and then decides not to cancel at the confirmation of cancel.
         * Re-Delegates to appropriate intent based on sesstionAttributes.poa.
         */
        else if (current === 'AMAZON.CancelIntent') {
            speakOutput = responses.startOver();

            //POA
            if (sessionAttributes.poa === true) {
                return responseBuilder
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
            else if (sessionAttributes.poa === false) {
                return responseBuilder
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

        return responseBuilder
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
                '1-866-216-1072', ''));

            return responseBuilder
                .speak(speakOutput)
                .reprompt(c.REPROMPT + ' ' + speakOutput)
                .getResponse();
        }

        sessionAttributes.currentState = 'Help';

        responseBuilder.addRenderTemplateDirective(util.makeCard("Help", speakOutput, '', ''));

        speakOutput += ' If you need more assistance you can say help again.'

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


        if (sessionAttributes.status === 3) {
            responseBuilder.addRenderTemplateDirective(util.makeCard("Cancel", "Action Cancelled", c.CANCEL_STATUS_3, ''));
            return responseBuilder
                .speak(c.CANCEL_STATUS_3)
                .withShouldEndSession(true)
                .getResponse();
        }
        else {

            responseBuilder.addRenderTemplateDirective(util.makeCard("Cancel", "Action Cancelled", c.CANCEL_CONFIRM, ''));

            return handlerInput.responseBuilder
                .speak(c.CANCEL_CONFIRM)
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
    async handle(handlerInput) {
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
        ResumeHandler,
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


