import { Context, ScheduledEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
const iam = new AWS.IAM();
const sqs = new AWS.SQS();

/**
 *
 * event bridge - DONE
 *     |
 *     |
 *    \ /
 *     |
 * Lambda - UserLookup - triggered 1/day by event bridge - lambda list users and send username to SQS queue - DONE
 *     |
 *     |
 *    \ /
 *     |
 * SQS Queue - UserQueue - receives a message with username in message attribute - DONE
 *     |
 *     |
 *    \ /
 *     |
 * Lambda - UserAccessKeyLookup - Polls UserQueue - Checks for age of access key - DONE
 * - if age is < 90 days, return and terminate flow. if > 90 days, send access key id to SQS queue - DONE
 *     |
 *     |
 *    \ /
 *     |
 * SQS Queue - UpdateUserAccessKeyQueue - receives a message with access key id in message attribute - DONE
 *                                      - Include username in message attributes - DONE
 *     |
 *     |
 *    \ /
 *     |
 * Lambda - CreateUserAccessKey - Polls UpdateUserAccessKeyQueue - Create new access key - DONE
 *                                          -> delete old access key - TO BE DONE IN ANOTHER LAMBDA FUNCTION
 *                                          -> send notification to SNS Topic - TO BE DONE IN ANOTHER LAMBDA FUNCTION
 *     |
 *     |
 *    \ /
 *     |
 * SQS Queue - StoreSecretsQueue - receives a message with: 
 *                                          secretId
 *                                          key of accessKeyId - value of accessKeyId
 *                                          key of secretAccessKey - value of secretAccessKey
 *
 *     |
 *     |
 *    \ /
 *     |
 * SNS - Topic UpdatedUserAccessKey - SES subscribes to this topic and sends an email to the user.
 */

export const lambdaHandler = async (event: ScheduledEvent, context: Context) => {
    AWS.config.update({ region: 'eu-west-2' });

    try {
        const listUsers = await iam.listUsers().promise();

        let iterator = 0;
        const end = listUsers.Users.length;

        while (iterator < end) {
            console.log('Begin to send to SQS');
            const params: AWS.SQS.SendMessageRequest = {
                QueueUrl: `https://sqs.eu-west-2.amazonaws.com/${context.invokedFunctionArn.split(':')[4]}/UserQueue`,
                MessageAttributes: {
                    UserName: {
                        DataType: 'String',
                        StringValue: listUsers.Users[iterator].UserName,
                    },
                },
                MessageBody: 'user to check',
            };
            const response = await sqs.sendMessage(params).promise();
            console.log('message sent with id of ' + response.MessageId);
            iterator++;
        }
    } catch (error) {
        console.log(error);
    }
};
