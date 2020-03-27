const aws = require('aws-sdk');
const ses = new aws.SES({ region: 'us-east-1' });

exports.handler = (subject,msg) => {
    
    var params = {
       Destination: {
           ToAddresses: ["jpasimiotestmail@gmail.com"]
       },
       Message: {
           Body: {
               Text: { Data: msg
                   
               }
               
           },
           
           Subject: { Data: subject
               
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