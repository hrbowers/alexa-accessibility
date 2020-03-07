const AWS = require('aws-sdk');

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

module.exports.createReminder = function createReminder(requestMoment, scheduledMoment, timezone, locale) {
    return {
        requestTime: requestMoment.format('YYYY-MM-DDTH:mm:00.000'),
        trigger: {
            type: 'SCHEDULED_ABSOLUTE',
            scheduledTime: scheduledMoment.format('YYYY-MM-DDTH:mm:00.000'),
            timeZoneId: timezone,
            recurrence:{
                freq:'DAILY'
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

