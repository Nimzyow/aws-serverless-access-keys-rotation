import { Context, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';

const secretsManager = new AWS.SecretsManager();

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const arn = context.invokedFunctionArn.split(':')[4];

    let iterator = 0;
    const end = event.Records.length;
    try {
        while (iterator < end) {
            const SecretId = event.Records[iterator].messageAttributes.SecretId.stringValue;

            if (SecretId) {
                // const createUserAccessKey = await iam.createAccessKey({ UserName: userName }).promise();

                // console.log('Getting the secret');
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
                                                        AWS: `arn:aws:iam::${arn}:user/${event.Records[iterator].messageAttributes.Principle}`,
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
                                                        AWS: `arn:aws:iam::${arn}:user/${event.Records[iterator].messageAttributes.Principle}`,
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
                        // TODO: Get old access key and delete it
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
