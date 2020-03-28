module.exports = {
    reprompt() {
        var responses = [
            "I didn\'t quite get that. ",
            "Hmm. I didn\'t get that. ",
            "Sorry, I\'m not sure I heard that. ",
            "Apologies, I did not get that. "
        ];

        return module.exports.randomize(responses);
    },
    
    completion() {
        var responses = [
            "This completes the appeal process. Please wait to hear from Amazon regarding the status of your reinstatement.",
            "The appeal process is complete. Please wait to hear from Amazon regarding the status of your reinstatement.",
            "Perfect! You have completed the appeal process. Please wait to hear from Amazon regarding the status of your reinstatement.",
            "Great! The appeal process is complete. Please wait to hear from Amazon regarding the status of your reinstatement."
        ];

        return module.exports.randomize(responses);
    },
    
    dbFail() {
        var responses = [
            "Uh oh! Looks like I couldn\'t connect to the database.",
            "Sorry, connection to the database failed.",
            "Database connection failed.",
            "Unable to establish connection to the database."
        ];

        return module.exports.randomize(responses);
    },
    
    startOver() {
        var responses = [
            "Let's start over. ",
            "Let's do it again. ",
            "Let's try this again. "
        ];

        return module.exports.randomize(responses);
    },
    
    cancel() {
        var responses = [
            "Okay. Please complete the appeal process at your earliest convenience to reinstate your account. Good bye.",
            "No problem. Please complete the appeal process when you can to reinstate your account. Good bye.",
        ];

        return module.exports.randomize(responses);
    },

    randomize(arr) {
        var index = Math.floor(Math.random() * (arr.length));
        return arr[index];
    },
    
    makeResponse(d1, d2, d3) {
        var response = 'Your plan of action has been successfully submitted for review. A summary of your plan of action is included below.'+
                        '\n\nThe root cause of the issue: '+ d1 + 
                        '\nThe steps you took to fix the issue: ' + d2 + 
                        '\nThe steps you took to prevent this from happening again: '+ d3 + 
                        '\n\n You will be notified when your account is reinstated.  Thank you for being an Amazon Marketplace Seller.';
    
        return response;
    },

    makeReplyResponse(d1) {
        var response = 'Your plan of action has been successfully updated with the following information:'+
                        '\n\n'+ d1 + 
                        '\n\n You will be notified when your account is reinstated.  Thank you for being an Amazon Marketplace Seller.';
    
        return response;
    }
}