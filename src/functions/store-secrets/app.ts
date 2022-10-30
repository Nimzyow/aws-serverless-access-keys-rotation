import { Context, SQSEvent } from "aws-lambda"

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"
import {
    SecretsManagerClient,
    GetSecretValueCommand,
    CreateSecretCommand,
    PutResourcePolicyCommand,
    UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager"

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
    const snsClient = new SNSClient({ region })
    const snsCommand = new PublishCommand(snsParams)

    try {
        await snsClient.send(snsCommand)
        console.log("sns notification sent")
    } catch (err) {
        console.log("Could not publish to SNS topic")
        console.error(err)
        throw new Error("Could not publish to SNS topic")
    }
}

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const awsAccountId = context.invokedFunctionArn.split(":")[4]

    for (const record of event.Records) {
        const secretsManagerClient = new SecretsManagerClient({ region: record.awsRegion })
        const parsedBody = JSON.parse(record.body)
        const SecretsToStore = Object.entries(JSON.parse(record.body)).reduce((acc, [key, value]) => {
            if (key === "SecretId" || key == "Principle") {
                return {}
            }
            return { ...acc, [key]: value }
        }, {})
        const command = new GetSecretValueCommand({
            SecretId: parsedBody.SecretId,
        })

        try {
            await secretsManagerClient.send(command)
            const updateSecretCommand = new UpdateSecretCommand({
                SecretId: parsedBody.SecretId,
                SecretString: JSON.stringify({
                    ...SecretsToStore,
                }),
            })
            await secretsManagerClient.send(updateSecretCommand)
            sendSNSNotification({
                region: record.awsRegion,
                awsAccountId,
                userName: parsedBody.UserName,
            })
        } catch (error) {
            const createSecretCommand = new CreateSecretCommand({
                Name: parsedBody.SecretId,
                SecretString: JSON.stringify({
                    ...SecretsToStore,
                }),
            })

            const secretsManagerResponse = await secretsManagerClient.send(createSecretCommand)

            const putResourcePolicyCommand = new PutResourcePolicyCommand({
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
                            Resource: secretsManagerResponse.ARN,
                        },
                        {
                            Sid: "AllowListingOfSecrets",
                            Effect: "Allow",
                            Principal: {
                                AWS: `arn:aws:iam::${awsAccountId}:user/${parsedBody.UserName}`,
                            },
                            Action: ["secretsmanager:GetRandomPassword", "secretsmanager:ListSecrets"],
                            Resource: "*",
                        },
                    ],
                }),
            })
            await secretsManagerClient.send(putResourcePolicyCommand)
            sendSNSNotification({
                region: record.awsRegion,
                awsAccountId,
                userName: parsedBody.UserName,
            })
        }
    }
}
