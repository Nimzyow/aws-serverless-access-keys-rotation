import { Context, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
const iam = new AWS.IAM();
const secretsManager = new AWS.SecretsManager();

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const arn = context.invokedFunctionArn.split(':')[4];

    let iterator = 0;
    const end = event.Records.length;
    try {
        while (iterator < end) {
            const userName = event.Records[iterator].messageAttributes.UserName.stringValue;
            const createUserAccessKey = await iam.createAccessKey({ UserName: userName }).promise();
            console.log('Getting the secret');
            try {
                await secretsManager
                    .getSecretValue({
                        SecretId: `${userName}-access-key`,
                    })
                    .promise();
                await secretsManager
                    .updateSecret({
                        SecretId: `${userName}-access-key`,
                        SecretString: JSON.stringify({
                            accessKeyId: createUserAccessKey.AccessKey.AccessKeyId,
                            secretAccessKey: createUserAccessKey.AccessKey.SecretAccessKey,
                        }),
                    })
                    .promise();
            } catch (error) {
                try {
                    await secretsManager
                        .createSecret({
                            Name: `${userName}-access-key`,
                            SecretString: JSON.stringify({
                                accessKeyId: createUserAccessKey.AccessKey.AccessKeyId,
                                secretAccessKey: createUserAccessKey.AccessKey.SecretAccessKey,
                            }),
                        })
                        .promise()
                        .then((data) => {
                            console.log('Secret Created');
                            secretsManager
                                .putResourcePolicy({
                                    SecretId: `${userName}-access-key`,
                                    ResourcePolicy: JSON.stringify({
                                        Version: '2012-10-17',
                                        Statement: [
                                            {
                                                Sid: 'EnableIAMUserPermissions',
                                                Effect: 'Allow',
                                                Principal: {
                                                    AWS: `arn:aws:iam::${arn}:user/${userName}`,
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
                                                    AWS: `arn:aws:iam::${arn}:user/${userName}`,
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
                } catch (error) {
                    console.log('Error during creation of secret and attaching resource policy');
                    console.log(error);
                }
            }
            iterator++;
        }
    } catch (error) {
        console.log("Error while creating the user's access key");
        console.log(error);
    }
};
