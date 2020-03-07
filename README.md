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
The reminders API was used to simulate a proof of concept in which the user can be automatically notified through their Alexa device when their account needs attention.  To simulate this scenario, if the user's account status is 'all-clear', a reminder is created behind the scenes and the account status is changed to 'POA-required'.  This simulates the account going from all-clear, to violating a policy, to needing a plan of action.  This functionality is only available on branch 124_126-ReminderTest.  This was left separate from the rest of the functionality because this is more of a proof of concept, rather than actual user functionality.  To be fully realized, this feature would liekly require Amazon engineers to manipulate functionality in the Alexa OS to enable setting a reminder on a user's device without the user's participation.
### In Development
In order to cater to the widest possible audience, support for Alexa devices with built in screens is also under development. Use of the VUI allows even users with vision impairment to use the skill, but if the user has no vision impairment they may want to be able to see what results the VUI is producing.  There exists a selection of Alexa devices that have built in screens, and it will add another level of completeness to include support for these devices.
### Future Development
+ It is possible for an account to have multiple infraction on file that are keeping the account suspended.  The current state of the skill only handles a single infraction.  It would make the skill more complete for it to be able to easily guide the user through resolving all of the infractions that may exist on the account.

+ Though it may be an unlikely scenario, support for a partially completed plan of action would increase the overall functionality of the skill.  This would entail the user answering 1 or 2 of the 3 questions, stopping the skill, and having their answers saved so they can answer the remaining questions at a later date.  This could potentially be extended to allow the user to edit their answers to an already completed plan of action if they rezlise that an error was made in their entry.