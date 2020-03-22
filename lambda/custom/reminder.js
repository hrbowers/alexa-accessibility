const moment = require('moment-timezone');
const util = require('./util');

module.exports.createReminder = function createReminder(timezone, locale) {
    moment.locale(locale);
    const requestMoment = moment.tz(timezone);
    const createdMoment = moment.tz(timezone);
    const triggerMoment = createdMoment.startOf('day').add(12,'hours');

    return util.createReminder(requestMoment, triggerMoment, timezone, locale);
}
