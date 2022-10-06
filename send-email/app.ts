import { SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';
const ses = new AWS.SES();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const lambdaHandler = async (event: SQSEvent) => {
    let iterator = 0;
    const end = event.Records.length;

    while (iterator < end) {
        const userName = event.Records[iterator].messageAttributes.UserName.stringValue;
        let user: PromiseResult<AWS.DynamoDB.DocumentClient.GetItemOutput, AWS.AWSError>;
        try {
            user = await dynamoDb
                .get({
                    TableName: 'User',
                    Key: {
                        name: userName,
                    },
                })
                .promise();
        } catch (error) {
            console.log(error);
            throw new Error(`Couldn't get user: ${userName} from dynamodb`);
        }
        try {
            // amend this line if you know the verified email address verified in SES and put it in the source field
            const verifiedIdentities = await ses.listIdentities().promise();

            const params = {
                Destination: {
                    ToAddresses: [user.Item?.email],
                },
                Message: {
                    Body: {
                        Text: {
                            Charset: 'UTF-8',
                            Data: `Hello ${userName},\n\nYour access key has been created.\n\nYour old access key has been invalidated. Go to secrets manager to view your new access key.\n\nThanks,\n\nThe Team`,
                        },
                    },
                    Subject: {
                        Charset: 'UTF-8',
                        Data: 'Heads up - Access Key Created',
                    },
                },
                Source: verifiedIdentities.Identities[0],
            };
            await new AWS.SES().sendEmail(params).promise();
        } catch (error) {
            console.log(error);
            throw new Error(`Couldn't send email to user: ${userName}`);
        }
        iterator++;
    }
};