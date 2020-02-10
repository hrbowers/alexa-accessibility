const PlanOfAction_questions = [
    "What is the root cause of the issue? You can say things like,\
        the reason was, or the issue was.", 
    "How have you resolved the issue? You can say things like, I fixed this by,\
        or the steps I took were.", 
    "How have you prevented the issue from happening again? You can say things like, I plan to, \
        or I have prevented this by."
];
const PlanOfAction_questionsCheck = [
    "You have entered that the root cause of the issue was ", 
    "The steps you have taken are ",
    "The steps you have taken to prevent further issues are ",
    "To complete the self-reinstatement process, you must understand the violated policy,\
        Identify why the policy was violated, take steps to prevent further violations,\
        and acknowledge that further violations could result in permanent loss of selling privileges.\
        Your account will remain suspended until the self-reinstatement process is completed.  Goodbye.",
    'Ok, you can say, the root cause was, to explain the root cause of the issue.\
        Or you can say, i fixed this by, to explain how you resolved the issue.\
        Or you can say, i plan to, to explain how you will prevent this issue from happening again.'
];
const PlanOfAction_questionsReprompt = [
    "Please explain the root cause of the issue. Start by saying, the root cause was... \
        or, the reason this happened, followed by your response.",
    "Please explain the steps you have taken to resolve the issue. \
        Start by saying, the steps I took were... or, I fixed this by, followed by your response.",
    "Please explain how you will prevent this issue from happening again. \
        Start by saying, going forward... or, in the future... followed by your response."
];
const SelfReinstatement_questions = [
    'In order to reactivate your account, please confirm your agreement and understanding of the \
        following statements by saying yes. Do you understand the violated policy?',
    'Have you identified the cause of your policy violation and taken steps to prevent this issue \
        from happening again?',
    'Do you agree to maintain your business according to Amazon policy in order to meet customer\'s \
        expectations of shopping on Amazon?',
    'Do you understand that further violations could result in a permanent loss of your selling privileges?',
    'Thank you for completeing the self-reinstatement process. Your account should be reactivated shortly.'
];
const POA_Help = [
    'To complete an appeal, you must explain the root cause of your issue, \
        what you have done to resolve the issue, and how you will prevent this issue from happening again.  \
        I will guide you through each question.  Are you ready to start now?',
    'Please explain why this issue happened.  \
        You can say things like, the reason this happened was, or the root cause was.  \
        What is the root cause of the issue?',
    'Please explain how you fixed the issue.  \
        You can say things like, I fixed this by, or the steps I took were.  \
        How have you fixed the issue?',
    'Please explain how you have prevented this from happening again.  \
        You can say things like, going forward I will, or I plan to.  \
        How will you prevent this issue from happening again?'
];
const SR_Help = [
    ' Do you understand the violated policy?',
    ' Have you identified why the policy was violated and taken steps to prevent further violations?',
    ' Do you agree to maintain your business according to Amazon policy in order to meet customer\'s expectations\
    of shopping on Amazon?',
    ' Do you understand that further violations could result in a permanent loss of your selling privileges?'
];

let getQuestions = (status) => {
    switch(status)
    {
        case 1: return PlanOfAction_questions;
        case 2: return SelfReinstatement_questions;
    }
};
let getQuestionsCheck = () => {
    return PlanOfAction_questionsCheck;
}
let getQuestionsReprompt = () => {
    
    return PlanOfAction_questionsReprompt;
}
let getSubmissionText = (ansObj) => {
    const PlanOfAction_submissions = `Here is your completed plan of action. \ 
                                        You said the root cause of your issue was ${ansObj[0]}, \ 
                                        you fixed this issue by ${ansObj[1]}, \
                                        and this won't happen again because you will ${ansObj[2]}. \
                                        Is this what you would like to submit?`;
    return PlanOfAction_submissions;
}
let getHelp = (status) => {
    switch(status)
    {
        case 1: return POA_Help;
        case 2: return SR_Help;
    }
}
module.exports = {
    getQuestions,
    getQuestionsCheck, 
    getQuestionsReprompt,
    getSubmissionText,
    getHelp
}