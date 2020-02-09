const PlanOfAction_questions = [
    "What is the root cause of the issue? You can say things like,\
        the reason was, or the issue was.", 
    "How have you resolved the issue? You can say things like, I fixed this by,\
        or the steps I took were.", 
    "How have you prevented the issue from happening again? You can say things like, I plan to, \
        or I have prevented this by."
];
const questionsCheck = [
    "You have entered that the root cause of the issue was ", 
    "The steps you have taken are ",
    "The steps you have taken to prevent further issues are "];

const questionsReprompt = [
    "Please explain the root cause of the issue. Start by saying, the root cause was... \
        or, the reason this happened, followed by your response.",
    "Please explain the steps you have taken to resolve the issue. \
        Start by saying, the steps I took were... or, I fixed this by, followed by your response.",
    "Please explain how you will prevent this issue from happening again. \
        Start by saying, going forward... or, in the future... followed by your response."
];
const SelfReinstatement_questions = 
[
    'In order to reactivate your account, please confirm your agreement and understanding of the \
        following statements by saying yes. Do you understand the violated policy?',
    'Have you identified the cause of your policy violation and taken steps to prevent this issue \
        from happening again?',
    'Do you agree to maintain your business according to Amazon policy in order to meet customer\'s \
        expectations of shopping on Amazon?',
    'Do you understand that further violations could result in a permanent loss of your selling privileges?',
    'Thank you for completeing the self-reinstatement process. Your account should be reactivated shortly.'
    ];

let getQuestions = (status) => {
    switch(status)
    {
        case 1: return PlanOfAction_questions;
        case 2: return SelfReinstatement_questions;
    }
};
let getQuestionsCheck = () => {
    return questionsCheck;
}
let getQuestionsReprompt = () => {
    return questionsReprompt;
}

module.exports = {
    getQuestions,
    getQuestionsCheck, 
    getQuestionsReprompt
}