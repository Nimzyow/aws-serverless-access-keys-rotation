import { Context, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
const sns = new AWS.SNS();

const secretsManager = new AWS.SecretsManager();

const sendSNSNotification = async ({
    region,
    account,
    userName,
}: {
    region: string;
    account: string;
    userName: string;
}) => {
    const snsParams = {
        Message: `User ${userName} has been updated`,
        TopicArn: `arn:aws:sns:${region}:${account}:UpdatedAccessKeyAndStoredSecret`,
    };

    const response = await sns.publish(snsParams).promise();

    console.log('notification sent with id of ' + response.MessageId);
};

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const account = context.invokedFunctionArn.split(':')[4];

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
                    account,
                    region: event.Records[iterator].awsRegion,
                    userName,
                });
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
                    await sendSNSNotification({
                        account,
                        region: event.Records[iterator].awsRegion,
                        userName,
                    });
                } catch (error) {
                    console.log('Error during creation of secret and attaching resource policy');
                    console.log(error);
                }
            }
        }
        iterator++;
    }
};
