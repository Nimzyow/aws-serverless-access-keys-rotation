import { ScheduledEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
const iam = new AWS.IAM();

//DONE: Get every username
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
        console.log('Start');
        console.log('lets list the access keys');

        const listUsers = await iam.listUsers().promise();
        console.log('And the list of users?');
        listUsers.Users.map((user) => console.log(user.UserName));

        const listAccessKeys = await iam.listAccessKeys({ UserName: 'nimzy' }).promise();
        console.log(JSON.stringify(listAccessKeys.AccessKeyMetadata));
        console.log('List Access keys Success');
    } catch (error) {
        console.log(error);
    }
};
