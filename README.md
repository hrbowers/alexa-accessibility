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
Note: This was another of the last features developed for this skill and time ran out before its functionality could be maximized.  If a user wishes to add information with the reply feature they will only be able to change the most recently submitted plan of action.  If there is more than one plan of action under review, there is currently no way for the user to select which plan of action they would like to add a reply to.
### Save and Resume
Though unlikely, it is possible that the user may wish to exit the plan of action process in the middle and complete it later.  The skill is capable of saving an incomplete plan of action and allowing the user to finish it in a separate session.
### Email Confirmation
At successful completion of the skill process, a confirmation email is sent to the specified account.  This feature is redundant to current Amazon correspondence practices and was implemented as an exercise in using Amazon Simple Email Service (SES).  Functionality is easily removed.
## DynamoDB
The backend of this skill is implemented via a set of DynamoDB tables.  The tables, their attributes, and how they function with the skill are outlined below.  Note that these tables were created primarily to be place holders to demonstrate functionality.  The table schemas could be adjusted as necessary with minor refactoring to the main code base.
### infraction
The infraction table is meant to be a repository for the various infractions that can be enforced on an account.  Current state of the table is mostly just place holder values.
+ infractionId: Each infraction is meant to have a unique identifier which is used to retrieve the other infraction attributes.
+ descriptionS: A summary of the infraction.  Could be thought of as the title of the infraction.  This is what is explained to the user by default.  e.g. "Your first infraction is 'short description'.  You can get started by..."
+ descriptionL: A detailed overview of the infraction.  This is meant to be what is output to the user on an invocation of help.
+ poa: Indicates whether an infraction requires a Plan of Action or can be self-reinstated.  poa == true requires a plan of action.
### poa-storage
Plan of actions at any level of completeness are stored here.
+ poaId: unique identifier used to retrieve plan of actions either for completion or for adding more information.  For the purpose of demonstrating functionality, this is implemented as a simple incrementing number.  Practically, this would need to be changed to a much more robust identifier, likely using aspects of the user's account id, date, time, etc.
+ rootCause: User answer to 'What is the root cause of issue?'
+ actionTaken: User answer to 'How have you fixed this issue?'
+ preventativeMeasure: User answer to 'How will you prevent this from happening again?'
+ reply: User input when adding to a complete plan of action.
### sample-account-status
This table serves as a dummy account from which the skill retrieves necessary information about the account.
+ accountId: For the purpose of demonstrating functionality, this is just a number.  In practice, this would be the user's Amazon Seller Account id.
+ infactionArray: A list object that stores a list of infraction id numbers, each corresponding to an infraction from the infraction table.
+ locale: General location of the seller account.  i.e. North America, Asia, etc.
+ poaId: If there is a plan of action on the account, either incomplete or complete, this is the corresponding id number.  If there is no plan of action on the account it is set to 'noPOA'.
+ statusCode: This value determines what action the skill will take at launch.  Valid status codes are numbers 0-3.
  0. Account in good standing.
  1. Account enforced.  Skill will then check if infraction should follow the Plan of Action or Self-Reinstatement route.
  2. Plan of Action In-Progress: Skill will retrieve incomplete plan of action and prompt the user to complete it.
  3. Plan of Action Under Review: Skill will retrieve the completed plan of action and give the user the option to add more information.
### poa-id-numbers
This is simply the storage of an incrementing number value used for generating the plan of action id numbers.  