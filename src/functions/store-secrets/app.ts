import { Context, SQSEvent } from "aws-lambda"

import SNS from "aws-sdk/clients/sns"
import SecretsManager from "aws-sdk/clients/secretsmanager"

const sns = new SNS()

const secretsManager = new SecretsManager()

const sendSNSNotification = async ({
    region,
    awsAccountId,
    userName,
}: {
    region: string
    awsAccountId: string
    userName: string
}) => {
    const snsParams = {
        Message: `User ${userName} has been updated`,
        TopicArn: `arn:aws:sns:${region}:${awsAccountId}:UpdatedAccessKeyAndStoredSecret`,
    }

    sns.publish(snsParams, (err, data) => {
        if (err) {
            return Promise.reject(err)
        } else {
            console.log("sns notification sent")
            return Promise.resolve(data)
        }
    })
}

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const awsAccountId = context.invokedFunctionArn.split(":")[4]

    return new Promise((resolve, reject) => {
        event.Records.map(async (record) => {
            const parsedBody = JSON.parse(record.body)

            const SecretsToStore = Object.entries(JSON.parse(record.body)).reduce(
                (acc, [key, value]) => {
                    if (key === "SecretId" || key == "Principle") {
                        return {}
                    }
                    return { ...acc, [key]: value }
                },
                {}
            )

            secretsManager.getSecretValue(
                {
                    SecretId: parsedBody.SecretId,
                },
                (err, data) => {
                    if (err) {
                        secretsManager.createSecret(
                            {
                                Name: parsedBody.SecretId,
                                SecretString: JSON.stringify({
                                    ...SecretsToStore,
                                }),
                            },
                            (err, data) => {
                                if (err) {
                                    console.error("Could not create secret")
                                    console.error(err)
                                    return reject(err)
                                } else {
                                    secretsManager.putResourcePolicy(
                                        {
                                            SecretId: parsedBody.SecretId,
                                            ResourcePolicy: JSON.stringify({
                                                Version: "2012-10-17",
                                                Statement: [
                                                    {
                                                        Sid: "EnableIAMUserPermissions",
                                                        Effect: "Allow",
                                                        Principal: {
                                                            AWS: `arn:aws:iam::${awsAccountId}:user/${parsedBody.UserName}`,
                                                        },
                                                        Action: [
                                                            "secretsmanager:GetSecretValue",
                                                            "secretsmanager:DescribeSecret",
                                                            "secretsmanager:ListSecretVersionIds",
                                                            "secretsmanager:GetResourcePolicy",
                                                        ],
                                                        Resource: data.ARN,
                                                    },
                                                    {
                                                        Sid: "AllowListingOfSecrets",
                                                        Effect: "Allow",
                                                        Principal: {
                                                            AWS: `arn:aws:iam::${awsAccountId}:user/${parsedBody.UserName}`,
                                                        },
                                                        Action: [
                                                            "secretsmanager:GetRandomPassword",
                                                            "secretsmanager:ListSecrets",
                                                        ],
                                                        Resource: "*",
                                                    },
                                                ],
                                            }),
                                        },
                                        (err, data) => {
                                            if (err) {
                                                console.error("Error putting resource policy")
                                                return reject(err)
                                            }
                                            sendSNSNotification({
                                                awsAccountId,
                                                region: record.awsRegion,
                                                userName: parsedBody.UserName,
                                            })
                                        }
                                    )
                                }
                            }
                        )
                    } else {
                        secretsManager.updateSecret(
                            {
                                SecretId: parsedBody.SecretId,
                                SecretString: JSON.stringify({
                                    ...SecretsToStore,
                                }),
                            },
                            (err, data) => {
                                if (err) {
                                    console.error("Error updating secret")
                                    console.error(err)
                                    return reject(err)
                                }
                                sendSNSNotification({
                                    awsAccountId,
                                    region: record.awsRegion,
                                    userName: parsedBody.UserName,
                                })
                            }
                        )
                    }
                }
            )
        })
    })
}
