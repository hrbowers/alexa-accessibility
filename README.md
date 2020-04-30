# Amazon Marketplace Account Reinstatement Alexa Skill - ASU SER 401/402
### Summary
The purpose of this project is to develop an Alexa skill that will allow an Amazon marketplace vendor to reinstate their suspended account by using an Alexa enabled device rather than the existing web form.  By developing this skill we are furthering Amazon's efforts towards maximizing accessibility for all users of Amazon services.  This skill is intended to make it possible for anyone that has difficulty or is incapable of using a standard mouse and keyboard setup to be able to recover a suspended marketplace account. Additionally, use of a Voice User Interface (VUI) enables those with vision impairments to also be able to easily recover their account.
## Functionality
### Plan of Action
If a user has their account suspended, the primary form of recovery is to submit a plan of action.  A plan of action consists of 3 parts:  
1. Explain the root cause of what caused the infraction
2. Explain how the infraction has been resolved
3. Explain what steps have been taken to prevent the infraction from recurring

The Alexa VUI takes this 3-step process from a traditional web form to a natural conversation.  Alexa uses natural sounding questions to prompt the user to answer the 3 questions and saves the answer to a DynamoDB table. The skill is set up to allow the user to answer naturally, without having to fulfill any awkward conversation formats. By letting the user say whatever is natural to them, the process becomes accessible to anyone.
### Reply
For a plan of action that has already been submitted, it is possible for the user to add additional information that may have been forgotten in the initial submission.  If the user invokes the Alexa skill and their account status indicates a plan of action has already been submitted, the user is informed that their account is under review and that they have the option to add additional information.  If they choose to add information, their input is appended to the original plan of action.
### Self-Reinstatement
Certain infractions that cause an account suspension are eligible for self-reinstatement.  This allows the user to reinstate their account without filling out a plan of action. The web form version of this process lets the user click 4 check boxes to indicate agreement, and then the user can reinstate their account with the click of a button.  To convert this into a VUI process, Alexa simply asks the user 4 questions that require a Yes/No response.  
1. "Do you understand the violated policy?"
2. "Have you identified the reason this policy was violated and taken steps to prevent it from happening again?"
3. "Do you agree to maintain your business according to Amazon policy in order to meet customer's expectations of shopping on Amazon?"
4. "Do you understand that further violations could result in a permanent loss of your selling privileges?"

Answering 'yes' to all 4 questions results in the reinstatement of the user's account.
### About the Reminders API
The reminders API was used to simulate a proof of concept in which the user can be automatically notified through their Alexa device when their account needs attention.  In practice, reminders can only be set during an active Alexa session and require user input to create.  In order to have Alexa automatically notify a user via an Echo or similar device is beyond the current capability of custom Alexa skills.  Though a rudimentary system is in place for setting reminders in this skill, it does not have much practical use and was mostly an exercise in using the Alexa Skills Kit.
### Screen Support
In an effort to maximize the skill's capabilities, basic support has been included for devices with screens such as the Echo Show.  It is important to note that driving force behind the core interactions of the skill are Dialog Delegation.  Unfortunately, use of the dialogDirective is not compatible with the renderTemplateDirective which is used for displaying on an Alexa screen.  This means that screen support is only enabled for portions of the skill that don't rely dialog delegation.  There is a potential workaround by using Alexa Presentation Language (APL) in conjunction with the elicitSlotDirective in order to output to the screen while using dialog delegation, but this was one of the last features developed and time ran out before use of APL could be learned.
### Multiple Infractions
The skill is set up to handle the scenario of an account having multiple infraction being enforced.  It will successfully iterate through a list of infractions and allow the user to resolve them one at a time.  The user can stop at any point and the list of infractions will be updated to reflect any infractions that have been resolved.
Note: This was another of the last features developed for this skill and time ran out before it's functionality could be maximized.  If a user wishes to add information with the reply feature they will only be able to change the most recently submitted plan of action.  If there is more than one plan of action under review, there is currently no way for the user to select which plan of action they would like to add a reply to.
### Save and Resume
Though unlikely, it is possible that the user may wish to exit the plan of action process in the middle and complete it later.  The skill is capable of saving an incomplete plan of action and allowing the user to finish it in a separate session.