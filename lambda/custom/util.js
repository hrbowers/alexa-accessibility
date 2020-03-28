const AWS = require('aws-sdk');
const dbHelper = require("./dbConnect");
const Alexa = require('ask-sdk');
const remind = require("./reminder");

const s3SigV4Client = new AWS.S3({
    signatureVersion: 'v4'
});

module.exports.getS3PreSignedUrl = function getS3PreSignedUrl(s3ObjectKey) {

    const bucketName = process.env.S3_PERSISTENCE_BUCKET;
    const s3PreSignedUrl = s3SigV4Client.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: s3ObjectKey,
        Expires: 60 * 1 // the Expires is capped for 1 minute
    });
    console.log(`Util.s3PreSignedUrl: ${s3ObjectKey} URL ${s3PreSignedUrl}`);
    return s3PreSignedUrl;

}

module.exports.setReminder = async function setReminder(handlerInput) {

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

module.exports.createReminder = function createReminder(requestMoment, scheduledMoment, timezone, locale) {
    return {
        requestTime: requestMoment.format('YYYY-MM-DDTH:mm:00.000'),
        trigger: {
            type: 'SCHEDULED_ABSOLUTE',
            scheduledTime: scheduledMoment.format('YYYY-MM-DDTH:mm:00.000'),
            timeZoneId: timezone,
            recurrence: {
                freq: 'DAILY'
            }
        },
        alertInfo: {
            spokenInfo: {
                content: [{
                    locale: locale,
                    text: 'Your account has been suspended and requires attention.  You can fix your account by saying, fix my account.'
                }]
            }
        },
        pushNotification: {
            status: 'ENABLED'
        }
    }
}

module.exports.saveAppeal = async function saveAppeal(id, data1, data2, data3) {
    return dbHelper.addPoa(id, data1, data2, data3)
        .then((data) => {
            return true;
        })
        .catch((err) => {
            console.log("Error occured while saving data", err);
            return false;
        })
}