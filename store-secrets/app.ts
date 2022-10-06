import { Context, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
const sns = new AWS.SNS();

const secretsManager = new AWS.SecretsManager();

const sendSNSNotification = async ({
    region,
    awsAccountId,
    userName,
}: {
    region: string;
    awsAccountId: string;
    userName: string;
}) => {
    const snsParams = {
        Message: `User ${userName} has been updated`,
        TopicArn: `arn:aws:sns:${region}:${awsAccountId}:UpdatedAccessKeyAndStoredSecret`,
    };

    const response = await sns.publish(snsParams).promise();

    console.log('notification sent with id of ' + response.MessageId);
};

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const awsAccountId = context.invokedFunctionArn.split(':')[4];

    let iterator = 0;
    const end = event.Records.length;

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
                await sendSNSNotification({
                    awsAccountId,
                    region: event.Records[iterator].awsRegion,
                    userName,
                });
            } catch (error) {
                try {
                    const secretsManagerResponse = await secretsManager
                        .createSecret({
                            Name: SecretId,
                            SecretString: JSON.stringify({
                                messageAttributesObject,
                            }),
                        })
                        .promise();

                    await secretsManager
                        .putResourcePolicy({
                            SecretId,
                            ResourcePolicy: JSON.stringify({
                                Version: '2012-10-17',
                                Statement: [
                                    {
                                        Sid: 'EnableIAMUserPermissions',
                                        Effect: 'Allow',
                                        Principal: {
                                            AWS: `arn:aws:iam::${awsAccountId}:user/${event.Records[iterator].messageAttributes.Principle.stringValue}`,
                                        },
                                        Action: [
                                            'secretsmanager:GetSecretValue',
                                            'secretsmanager:DescribeSecret',
                                            'secretsmanager:ListSecretVersionIds',
                                            'secretsmanager:GetResourcePolicy',
                                        ],
                                        Resource: secretsManagerResponse.ARN,
                                    },
                                    {
                                        Sid: 'AllowListingOfSecrets',
                                        Effect: 'Allow',
                                        Principal: {
                                            AWS: `arn:aws:iam::${awsAccountId}:user/${event.Records[iterator].messageAttributes.Principle.stringValue}`,
                                        },
                                        Action: ['secretsmanager:GetRandomPassword', 'secretsmanager:ListSecrets'],
                                        Resource: '*',
                                    },
                                ],
                            }),
                        })
                        .promise();
                    console.log('Secret Created');
                    console.log('Secrets Manager Resource Policy Updated');
                    console.log('Secret Created and Resource Policy Updated');
                } catch (error) {
                    console.log('error creating secret and attach policy', error);
                    throw new Error("Couldn't create secret");
                }
                try {
                    await sendSNSNotification({
                        awsAccountId,
                        region: event.Records[iterator].awsRegion,
                        userName,
                    });
                } catch (error) {
                    console.log("Couldn't send notification", error);
                    throw new Error("Couldn't send notification");
                }
            }
        }
        iterator++;
    }
};
