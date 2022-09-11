import { ScheduledEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
const iam = new AWS.IAM();

/**
 *
 * event bridge
 *     |
 *     |
 *    \ /
 *     |
 * Lambda - triggered 1/day by event bridge - lambda list users and send username to SQS queue 'check access key age'
 *     |
 *     |
 *    \ /
 *     |
 * SQS Queue - CheckAccessKeyAgeOfUserQueue - receives a message with username in message attribute
 *     |
 *     |
 *    \ /
 *     |
 * Lambda - Polls CheckAccessKeyAgeOfUserQueue - Checks for age of access key
 * - if age is < 90 days, return and terminate flow. if > 90 days, carry on with flow
 */

//DONE: Get every username
//TODO: send username to SQS queue as message
//TODO: Look at the access create and see if it's greater than 90 days
//TODO: If not - do nothing and exit out of lambda function
//DONE: Create DLQ for the SQS UserAccessKeyRotationQueue
//TODO: Create SAM pipeline for test and production
//TODO: Deploy and get the URL of UserAccessKeyRotationQueue

//TODO: If yes, send an SQS Queue with the Username in the body of the SQS Message.

export const lambdaHandler = async (event: ScheduledEvent) => {
    AWS.config.update({ region: 'eu-west-2' });

    // console.log(event['id']);
    // console.log(event['detail-type']);
    try {
        const listUsers = await iam.listUsers().promise();

        listUsers.Users.map((user) => console.log(user.UserName));

        // listUsers.Users.map(async (user) => {
        //     console.log(user.UserName);
        //     try {
        //         console.log('do i even get here?');
        //         const accessKeys = await iam.listAccessKeys({ UserName: user.UserName }).promise();
        //         console.log('do i even get there?');

        //         console.log(JSON.stringify(accessKeys));
        //         accessKeys.AccessKeyMetadata.map((accessKey) => {
        //             console.log(user.UserName + accessKey.CreateDate);
        //             if (!accessKey.CreateDate) {
        //                 return;
        //             } else {
        //                 const diff = Math.abs(accessKey.CreateDate.getTime() - new Date().getTime());
        //                 const diffDays = Math.ceil(diff / (1000 * 3600 * 24));

        //                 const isTimeToRotateAccessKeys = diffDays > 90;
        //                 if (isTimeToRotateAccessKeys) {
        //                     console.log(
        //                         user.UserName + 's Access key of ' + accessKey.AccessKeyId + ' REQUIRES rotation',
        //                     );
        //                 } else {
        //                     console.log(
        //                         user.UserName +
        //                             's Access key of ' +
        //                             accessKey.AccessKeyId +
        //                             ' DOES NOT require rotation',
        //                     );
        //                 }
        //             }
        //         });
        //     } catch (error) {
        //         console.log(error);
        //     }
        // });

        // const listAccessKeys = await iam.listAccessKeys({ UserName: 'nimzy' }).promise();
        // console.log(JSON.stringify(listAccessKeys.AccessKeyMetadata));
        // console.log('List Access keys Success');
    } catch (error) {
        console.log(error);
    }
};
