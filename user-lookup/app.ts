import { Context, ScheduledEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
const iam = new AWS.IAM();
const sqs = new AWS.SQS();

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
        throw new Error("Couldn't send message to SQS");
    }
};
