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
            "If you choose to cancel, you must complete the appeal process at your earliest convenience to reinstate your account."
        ];

        return module.exports.randomize(responses);
    },

    randomize(arr) {
        var index = Math.floor(Math.random() * (arr.length));
        return arr[index];
    }
}