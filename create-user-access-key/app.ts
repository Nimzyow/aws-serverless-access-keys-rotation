import { Context, SQSEvent } from 'aws-lambda';

import AWS, { IAM } from 'aws-sdk';
const iam = new AWS.IAM();
const secretsManager = new AWS.SecretsManager();

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    console.log(JSON.stringify(event.Records[0].messageAttributes));

    let iterator = 0;
    const end = event.Records.length;
    try {
        while (iterator < end) {
            const createUserAccessKey = await iam
                .createAccessKey({ UserName: event.Records[iterator].messageAttributes.UserName.stringValue })
                .promise();

            // console.log(JSON.stringify(createUserAccessKey));

            // store secrets in aws secrets manager
            console.log('Getting the secret');
            try {
                await secretsManager
                    .getSecretValue({
                        SecretId: `${event.Records[iterator].messageAttributes.UserName.stringValue}-access-key`,
                    })
                    .promise();
                await secretsManager
                    .updateSecret({
                        SecretId: `${event.Records[iterator].messageAttributes.UserName.stringValue}-access-key`,
                        SecretString: JSON.stringify({
                            accessKeyId: createUserAccessKey.AccessKey.AccessKeyId,
                            secretAccessKey: createUserAccessKey.AccessKey.SecretAccessKey,
                        }),
                    })
                    .promise();
            } catch (error) {
                // if secret does not exist, create it
                try {
                    const createUserSecret = await secretsManager
                        .createSecret({
                            Name: `${event.Records[iterator].messageAttributes.UserName.stringValue}-access-key`,
                            SecretString: JSON.stringify({
                                accessKeyId: createUserAccessKey.AccessKey.AccessKeyId,
                                secretAccessKey: createUserAccessKey.AccessKey.SecretAccessKey,
                            }),
                        })
                        .promise()
                        .then((data) => {
                            const arn = context.invokedFunctionArn.split(':')[4];
                            secretsManager
                                .putResourcePolicy({
                                    SecretId: `${event.Records[iterator].messageAttributes.UserName.stringValue}-access-key`,
                                    ResourcePolicy: JSON.stringify({
                                        Version: '2012-10-17',
                                        Statement: [
                                            {
                                                Sid: 'Enable IAM User Permissions',
                                                Effect: 'Allow',
                                                Principal: {
                                                    AWS: `arn:aws:iam::${arn}:user/${event.Records[iterator].messageAttributes.UserName.stringValue}`,
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
                                                Sid: 'allow listing of secrets',
                                                Effect: 'Allow',
                                                Principal: {
                                                    AWS: `arn:aws:iam::${
                                                        context.invokedFunctionArn.split(':')[4]
                                                    }:user/${
                                                        event.Records[iterator].messageAttributes.UserName.stringValue
                                                    }`,
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
                        });

                    console.log(JSON.stringify(createUserSecret));
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
