const nodemailer = require('nodemailer');

var mailer = function () { };

mailer.prototype.sendConfirmation = (emailTo, confirmSubject, msg) => {
    var transporter = nodemailer.createTransport({
        service: '',
        auth: {
            user: '',
            pass: ''
        }
    });

    var mailOptions = {
        from:'asualexacapstone@gmail.com',
        to: emailTo,
        subject: confirmSubject,
        text: msg
    }

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
            return false;
        } else {
            console.log('Confirmation sent: ' + info.response);
        }
    });

    return true;
}

module.exports = new mailer();