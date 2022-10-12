import { Context, SQSEvent } from "aws-lambda"

import AWS from "aws-sdk"
const iam = new AWS.IAM()
const sqs = new AWS.SQS()

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const awsAccountId = context.invokedFunctionArn.split(":")[4]

    let iterator = 0
    const end = event.Records.length

    while (iterator < end) {
        const userName = event.Records[iterator].messageAttributes.UserName.stringValue

        const accessKeysForUser = await iam.listAccessKeys({ UserName: userName }).promise()
        try {
            if (accessKeysForUser.AccessKeyMetadata.length > 0) {
                const sortedAccessKeys = accessKeysForUser.AccessKeyMetadata.sort((a, b) => {
                    if (a.CreateDate && b.CreateDate) {
                        return b.CreateDate.getTime() - a.CreateDate.getTime()
                    } else {
                        return 0
                    }
                })

                const accessKeysToDelete = sortedAccessKeys.slice(1)

                for (const accessKey of accessKeysToDelete) {
                    if (accessKey.AccessKeyId) {
                        await iam
                            .deleteAccessKey({ AccessKeyId: accessKey.AccessKeyId, UserName: userName })
                            .promise()
                    }
                }
            }
        } catch (error) {
            console.log(error)
            throw new Error(`Couldn't delete oldest access key for user: ${userName}`)
        }

        try {
            const createUserAccessKey = await iam.createAccessKey({ UserName: userName }).promise()
            await sqs
                .sendMessage({
                    MessageBody: "User access key created",
                    QueueUrl: `https://sqs.${event.Records[iterator].awsRegion}.amazonaws.com/${awsAccountId}/StoreSecretsQueue`,
                    MessageAttributes: {
                        SecretId: {
                            DataType: "String",
                            StringValue: `${userName}-access-key`,
                        },
                        Principle: {
                            DataType: "String",
                            StringValue: `${userName}`,
                        },
                        AccessKeyId: {
                            DataType: "String",
                            StringValue: createUserAccessKey.AccessKey.AccessKeyId,
                        },
                        SecretAccessKey: {
                            DataType: "String",
                            StringValue: createUserAccessKey.AccessKey.SecretAccessKey,
                        },
                    },
                })
                .promise()
        } catch (error) {
            console.log(error)
            throw new Error("Couldn't create user access key")
        }
        iterator++
    }
}
