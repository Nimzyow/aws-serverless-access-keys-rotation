import { Context, SQSEvent } from "aws-lambda"

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import {
    IAMClient,
    ListAccessKeysCommand,
    DeleteAccessKeyCommand,
    CreateAccessKeyCommand,
} from "@aws-sdk/client-iam"

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const awsAccountId = context.invokedFunctionArn.split(":")[4]

    for (const record of event.Records) {
        const iam = new IAMClient({ region: record.awsRegion })
        const sqs = new SQSClient({ region: record.awsRegion })

        const { UserName }: { UserName: unknown } = JSON.parse(record.body)
        if (typeof UserName !== "string") {
            throw new Error("Invalid message")
        }
        const command = new ListAccessKeysCommand({ UserName: UserName })
        const response = await iam.send(command)

        const sortedAccessKeys = response.AccessKeyMetadata?.sort((a, b) => {
            if (a.CreateDate && b.CreateDate) {
                return b.CreateDate.getTime() - a.CreateDate.getTime()
            } else {
                return 0
            }
        })

        const accessKeysToDelete = sortedAccessKeys?.slice(1)
        if (accessKeysToDelete) {
            for (const accessKey of accessKeysToDelete) {
                if (accessKey.AccessKeyId) {
                    try {
                        const command = new DeleteAccessKeyCommand({
                            AccessKeyId: accessKey.AccessKeyId,
                            UserName,
                        })
                        iam.send(command)
                        console.log("Access key deleted" + accessKey.AccessKeyId)
                    } catch (error) {
                        console.log(`Couldn't delete oldest access key for user: ${UserName}`)
                        console.error(error)
                        throw new Error("Couldn't delete oldest access key")
                    }
                }
            }
        }

        const createAccessKeyCommand = new CreateAccessKeyCommand({ UserName })

        try {
            const response = await iam.send(createAccessKeyCommand)
            const accessKeyId = response.AccessKey?.AccessKeyId
            const secretAccessKey = response.AccessKey?.SecretAccessKey
            if (accessKeyId && secretAccessKey) {
                const params = {
                    QueueUrl: `https://sqs.${record.awsRegion}.amazonaws.com/${awsAccountId}/StoreSecretsQueue`,
                    MessageBody: JSON.stringify({
                        UserName,
                        AccessKeyId: accessKeyId,
                        SecretAccessKey: secretAccessKey,
                        SecretId: `${UserName}-access-key`,
                    }),
                }
                try {
                    const command = new SendMessageCommand(params)
                    await sqs.send(command)
                    console.log("message sent")
                } catch (error) {
                    console.error(error)
                    throw new Error("Could not send message to queue")
                }
            }
        } catch (error) {
            console.log(`Couldn't create access key for user: ${UserName}`)
            console.error(error)
            throw new Error("Error thrown")
        }
    }
}
