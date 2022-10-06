import { Context, SQSEvent } from "aws-lambda"

import AWS, { IAM } from "aws-sdk"
import { PromiseResult } from "aws-sdk/lib/request"
const iam = new AWS.IAM()
const sqs = new AWS.SQS()

const checkKey = async ({
    accessKeyId,
    createDate,
    userName,
    awsAccountId,
    region,
}: {
    accessKeyId: NonNullable<IAM.AccessKeyMetadata["AccessKeyId"]>
    createDate: NonNullable<IAM.AccessKeyMetadata["CreateDate"]>
    userName: string
    awsAccountId: string
    region: string
}) => {
    const diff = new Date().getTime() - createDate.getTime()
    const diffDays = Math.ceil(diff / (1000 * 3600 * 24))
    const isTimeToRotateAccessKeys = diffDays > 90

    if (isTimeToRotateAccessKeys) {
        console.log(userName + "s Access key of " + accessKeyId + " REQUIRES rotation")
        const params: AWS.SQS.SendMessageRequest = {
            QueueUrl: `https://sqs.${region}.amazonaws.com/${awsAccountId}/UpdateUserAccessKeyQueue`,
            MessageAttributes: {
                AccessKeyId: {
                    DataType: "String",
                    StringValue: accessKeyId,
                },
                UserName: {
                    DataType: "String",
                    StringValue: userName,
                },
            },
            MessageBody: `Rotate ${userName}s access key`,
        }
        const response = await sqs.sendMessage(params).promise()
        console.log("message sent with id of " + response.MessageId)
    } else {
        console.log(userName + "s Access key of " + accessKeyId + " DOES NOT require rotation")
    }
}

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    console.log("UserAccessLookUp started")

    let iterator = 0
    const end = event.Records.length

    while (iterator < end) {
        const userName = event.Records[iterator].messageAttributes.UserName.stringValue
        let listAccessKeysForUser: PromiseResult<IAM.ListAccessKeysResponse, AWS.AWSError>
        try {
            listAccessKeysForUser = await iam.listAccessKeys({ UserName: userName }).promise()
        } catch (error) {
            throw new Error(`Couldn't list access keys for user: ${userName}`)
        }

        if (listAccessKeysForUser.AccessKeyMetadata.length > 1) {
            if (
                listAccessKeysForUser.AccessKeyMetadata[0].CreateDate &&
                listAccessKeysForUser.AccessKeyMetadata[1].CreateDate &&
                listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId &&
                listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId &&
                new Date(listAccessKeysForUser.AccessKeyMetadata[0].CreateDate) >
                    new Date(listAccessKeysForUser.AccessKeyMetadata[1].CreateDate)
            ) {
                try {
                    await iam
                        .deleteAccessKey({
                            AccessKeyId: listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId,
                        })
                        .promise()
                } catch (error) {
                    console.log(error)
                    throw new Error("Couldn't delete access key")
                }
                try {
                    await checkKey({
                        accessKeyId: listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId,
                        createDate: listAccessKeysForUser.AccessKeyMetadata[0].CreateDate,
                        userName:
                            event.Records[iterator].messageAttributes.UserName.stringValue || "unknown",
                        awsAccountId: context.invokedFunctionArn.split(":")[4],
                        region: event.Records[iterator].awsRegion,
                    })
                } catch (error) {
                    console.log(error)
                    throw new Error("Couldn't check key")
                }
            } else if (
                listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId &&
                listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId &&
                listAccessKeysForUser.AccessKeyMetadata[1].CreateDate
            ) {
                try {
                    await iam
                        .deleteAccessKey({
                            AccessKeyId: listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId,
                        })
                        .promise()
                } catch (error) {
                    console.log(error)
                    throw new Error("Couldn't delete access key")
                }
                try {
                    await checkKey({
                        accessKeyId: listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId,
                        createDate: listAccessKeysForUser.AccessKeyMetadata[1].CreateDate,
                        userName:
                            event.Records[iterator].messageAttributes.UserName.stringValue || "unknown",
                        awsAccountId: context.invokedFunctionArn.split(":")[4],
                        region: event.Records[iterator].awsRegion,
                    })
                } catch (error) {
                    console.log(error)
                    throw new Error("Couldn't check key")
                }
            }
        } else if (
            listAccessKeysForUser.AccessKeyMetadata[0].CreateDate &&
            listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId
        ) {
            try {
                await checkKey({
                    accessKeyId: listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId,
                    createDate: listAccessKeysForUser.AccessKeyMetadata[0].CreateDate,
                    userName:
                        event.Records[iterator].messageAttributes.UserName.stringValue || "unknown",
                    awsAccountId: context.invokedFunctionArn.split(":")[4],
                    region: event.Records[iterator].awsRegion,
                })
            } catch (error) {
                console.log(error)
                throw new Error("Couldn't check key")
            }
        }
        iterator++
    }
    console.log("UserAccessLookUp finished")
}
