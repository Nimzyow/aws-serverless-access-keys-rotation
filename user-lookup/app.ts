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
 *     |
 *     |
 *     |
 *    \ /
 *     |
 * SQS Queue - StoreSecretsQueue - receives a message with:
 *                                          secretId - DONE
 *                                          key of accessKeyId - value of accessKeyId - DONE
 *                                          key of secretAccessKey - value of secretAccessKey - DONE
 *     |
 *     |
 *    \ /
 *     |
 * Lambda - StoreSecrets - Polls StoreSecretsQueue - stores or updates secret with access key - DONE
 *
 *     |
 *     |
 *    \ /
 *     |
 * SNS - Topic UpdatedUserAccessKey - SES subscribes to this topic and sends an email to the user.
 *
 *     |                                                                                      |
 *     |                                                                                      |
 *    \ /                                                                                    \ /
 *     |                                                                                      |
 * SQS Queue - DeleteOldAccessKeyQueue - receives a message with:                     SQS Queue - SendEmailQueue - receives a message with:
 *                                       UserName - Done                              UserName
 *     |                                                                                  |
 *     |                                                                                  |
 *    \ /                                                                                \ /
 *     |                                                                                  |
 * Lambda - DeleteOldAccessKey - Polls DeleteOldAccessKeyQueue                      Lambda - SendEmail - Polls SendEmailQueue
 *                              - lookup access keys - DONE
 *                              - delete oldest access key - DONE
 */

export const lambdaHandler = async (event: ScheduledEvent, context: Context) => {
    try {
        const listUsers = await iam.listUsers().promise();

        let iterator = 0;
        const end = listUsers.Users.length;

        while (iterator < end) {
            console.log('Begin to send to SQS');
            const params: AWS.SQS.SendMessageRequest = {
                QueueUrl: `https://sqs.${event.region}.amazonaws.com/${
                    context.invokedFunctionArn.split(':')[4]
                }/UserQueue`,
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
