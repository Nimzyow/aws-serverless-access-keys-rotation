import { Context, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
// const sqs = new AWS.SQS();

const secretsManager = new AWS.SecretsManager();

// const sendSQSMessage = async ({ region, account, userName }: { region: string; account: string; userName: string }) => {
//     const params: AWS.SQS.SendMessageRequest = {
//         QueueUrl: `https://sqs.${region}.amazonaws.com/${account}/DeleteOldAccessKeyQueue`,
//         MessageAttributes: {
//             UserName: {
//                 DataType: 'String',
//                 StringValue: userName,
//             },
//         },
//         MessageBody: 'Delete old access keys',
//     };
//     const response = await sqs.sendMessage(params).promise();
//     console.log('message sent with id of ' + response.MessageId);
// };

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const account = context.invokedFunctionArn.split(':')[4];

    let iterator = 0;
    const end = event.Records.length;
    try {
        while (iterator < end) {
            const SecretId = event.Records[iterator].messageAttributes.SecretId.stringValue;
            const userName = event.Records[iterator].messageAttributes.Principle.stringValue;

            if (SecretId && userName) {
                const messageAttributesObject = Object.entries(event.Records[iterator].messageAttributes).reduce(
                    (acc, [key, value]) => {
                        if (key === 'SecretId' || key == 'Principle') {
                            return {};
                        }
                        return { ...acc, [key]: value.stringValue };
                    },
                    {},
                );
                try {
                    await secretsManager
                        .getSecretValue({
                            SecretId,
                        })
                        .promise();

                    await secretsManager
                        .updateSecret({
                            SecretId,
                            SecretString: JSON.stringify({
                                messageAttributesObject,
                            }),
                        })
                        .promise();
                    // await sendSQSMessage({
                    //     account,
                    //     region: event.Records[iterator].awsRegion,
                    //     userName,
                    // });
                } catch (error) {
                    try {
                        await secretsManager
                            .createSecret({
                                Name: SecretId,
                                SecretString: JSON.stringify({
                                    messageAttributesObject,
                                }),
                            })
                            .promise()
                            .then((data) => {
                                console.log('Secret Created');
                                secretsManager
                                    .putResourcePolicy({
                                        SecretId,
                                        ResourcePolicy: JSON.stringify({
                                            Version: '2012-10-17',
                                            Statement: [
                                                {
                                                    Sid: 'EnableIAMUserPermissions',
                                                    Effect: 'Allow',
                                                    Principal: {
                                                        AWS: `arn:aws:iam::${account}:user/${event.Records[iterator].messageAttributes.Principle.stringValue}`,
                                                    },
                                                    Action: [
                                                        'secretsmanager:GetSecretValue',
                                                        'secretsmanager:DescribeSecret',
                                                        'secretsmanager:ListSecretVersionIds',
                                                        'secretsmanager:GetResourcePolicy',
                                                    ],
                                                    Resource: data.ARN,
                                                },
                                                {
                                                    Sid: 'AllowListingOfSecrets',
                                                    Effect: 'Allow',
                                                    Principal: {
                                                        AWS: `arn:aws:iam::${account}:user/${event.Records[iterator].messageAttributes.Principle.stringValue}`,
                                                    },
                                                    Action: [
                                                        'secretsmanager:GetRandomPassword',
                                                        'secretsmanager:ListSecrets',
                                                    ],
                                                    Resource: '*',
                                                },
                                            ],
                                        }),
                                    })
                                    .promise();
                                console.log('Secrets Manager Resource Policy Updated');
                                console.log('Secret Created and Resource Policy Updated');
                            })
                            .catch((error) => {
                                console.log('error creating secret', error);
                            });
                        // await sendSQSMessage({
                        //     account,
                        //     region: event.Records[iterator].awsRegion,
                        //     userName,
                        // });
                    } catch (error) {
                        console.log('Error during creation of secret and attaching resource policy');
                        console.log(error);
                    }
                }
            }

            iterator++;
        }
    } catch (error) {
        console.log("Error while creating the user's access key");
        console.log(error);
    }
};
