const aws = require('aws-sdk');
const ses = new aws.SES({ region: 'us-east-1' });

exports.handler = () => {
    
    var params = {
       Destination: {
           ToAddresses: ["jpasimiotestmail@gmail.com"]
       },
       Message: {
           Body: {
               Text: { Data: "Test message from Amazon SES."
                   
               }
               
           },
           
           Subject: { Data: "Test Email from Alexa Skill"
               
           }
       },
       Source: "jeremypasimio@gmail.com"
   };

   
    ses.sendEmail(params, function (err, data) {
       //callback(null, {err: err, data: data});
       if (err) {
           console.log(err);
       } else {           
           console.log("Mail Sent: " + JSON.stringify(data));
       }
   });
};