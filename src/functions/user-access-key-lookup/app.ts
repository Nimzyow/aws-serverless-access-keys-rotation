import { SQSEvent } from "aws-lambda"

import { IAMClient, ListAccessKeysCommand } from "@aws-sdk/client-iam"
import { SendMessageCommand, SQSClient, SendMessageCommandInput } from "@aws-sdk/client-sqs"

const isKeyOutOfDate = ({ createDate }: { createDate?: Date }) => {
    if (!createDate) {
        return false
    }
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
    accessKeyId: string
    userName: string
    region: string
    awsAccountId: string
}) => {
    const sqsClient = new SQSClient({ region })
    const params: SendMessageCommandInput = {
        QueueUrl: `https://sqs.${region}.amazonaws.com/${awsAccountId}/CreateUserAccessKeyQueue`,
        MessageBody: JSON.stringify({
            UserName: userName,
            AccessKeyId: accessKeyId,
        }),
    }
    try {
        const command = new SendMessageCommand(params)
        await sqsClient.send(command)
        console.log("message sent")
    } catch (error) {
        console.error(error)
        throw new Error("Error thrown")
    }
}

export const lambdaHandler = async (event: SQSEvent) => {
    console.log("UserAccessLookUp started")
    for (const record of event.Records) {
        const message = JSON.parse(record.body)
        const userName = message.UserName
        const region = message.region
        const awsAccountId = message.awsAccountId
        const iamClient = new IAMClient({ region })
        const command = new ListAccessKeysCommand({ UserName: userName })
        const response = await iamClient.send(command)
        if (!response.AccessKeyMetadata) {
            console.log("No access keys found")
            return
        }
        for (const accessKey of response.AccessKeyMetadata) {
            if (accessKey.AccessKeyId && isKeyOutOfDate({ createDate: accessKey.CreateDate })) {
                await sendMessage({
                    accessKeyId: accessKey.AccessKeyId,
                    userName,
                    region,
                    awsAccountId,
                })
            }
        }
    }
}
