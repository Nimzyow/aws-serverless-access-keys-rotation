import { Context, SQSEvent } from "aws-lambda"

import AWS, { IAM } from "aws-sdk"
import { PromiseResult } from "aws-sdk/lib/request"
const iam = new AWS.IAM()
const sqs = new AWS.SQS()

const isKeyOutOfDate = ({
    createDate,
}: {
    createDate: NonNullable<IAM.AccessKeyMetadata["CreateDate"]>
}) => {
    const diff = new Date().getTime() - createDate.getTime()
    const diffDays = Math.ceil(diff / (1000 * 3600 * 24))
    return diffDays > 90
}

const sendMessage = async ({
    accessKeyId,
    userName,
    region,
    awsAccountId,
}: {
    accessKeyId: NonNullable<IAM.AccessKeyMetadata["AccessKeyId"]>
    userName: string
    region: string
    awsAccountId: string
}) => {
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
                    new Date(listAccessKeysForUser.AccessKeyMetadata[1].CreateDate) &&
                isKeyOutOfDate({ createDate: listAccessKeysForUser.AccessKeyMetadata[0].CreateDate })
            ) {
                try {
                    await sendMessage({
                        accessKeyId: listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId,
                        userName: userName || "unknown",
                        region: event.Records[iterator].awsRegion,
                        awsAccountId: context.invokedFunctionArn.split(":")[4],
                    })
                } catch (error) {
                    console.log(error)
                    throw new Error("Couldn't send message to SQS")
                }
            } else if (
                listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId &&
                listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId &&
                listAccessKeysForUser.AccessKeyMetadata[1].CreateDate &&
                isKeyOutOfDate({
                    createDate: listAccessKeysForUser.AccessKeyMetadata[1].CreateDate,
                })
            ) {
                try {
                    await sendMessage({
                        accessKeyId: listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId,
                        userName: userName || "unknown",
                        region: event.Records[iterator].awsRegion,
                        awsAccountId: context.invokedFunctionArn.split(":")[4],
                    })
                } catch (error) {
                    console.log(error)
                    throw new Error("Couldn't send message to SQS")
                }
            }
        } else if (
            listAccessKeysForUser.AccessKeyMetadata[0].CreateDate &&
            listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId &&
            isKeyOutOfDate({
                createDate: listAccessKeysForUser.AccessKeyMetadata[0].CreateDate,
            })
        ) {
            try {
                await sendMessage({
                    accessKeyId: listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId,
                    userName: userName || "unknown",
                    region: event.Records[iterator].awsRegion,
                    awsAccountId: context.invokedFunctionArn.split(":")[4],
                })
            } catch (error) {
                console.log(error)
                throw new Error("Couldn't send message to SQS")
            }
        }
        iterator++
    }
    console.log("UserAccessLookUp finished")
}
