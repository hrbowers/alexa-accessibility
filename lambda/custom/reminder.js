const moment = require('moment-timezone');
const util = require('./util');

module.exports.createReminder = function createReminder(timezone, locale) {
    moment.locale(locale);
    const createdMoment = moment.tz(timezone);
    let triggerMoment = createdMoment;

    console.log("Current Reminders: " + triggerMoment.format('YYYY-MM-DDTH:mm:00.000'));

    return util.createReminder(createdMoment, triggerMoment, timezone, locale);
}
