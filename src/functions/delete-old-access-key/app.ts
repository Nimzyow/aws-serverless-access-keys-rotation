import { Context, SNSEvent } from "aws-lambda"

import { IAMClient, DeleteAccessKeyCommand, ListAccessKeysCommand } from "@aws-sdk/client-iam"

export const lambdaHandler = async (event: SNSEvent, context: Context) => {
    const region = context.invokedFunctionArn.split(":")[3]

    for (const record of event.Records) {
        const iamClient = new IAMClient({ region })

        const { UserName }: { UserName: string } = JSON.parse(record.Sns.Message)

        const listAccessKeysCommand = new ListAccessKeysCommand({ UserName })

        const response = await iamClient.send(listAccessKeysCommand)

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
                    const deleteAccessKeyCommand = new DeleteAccessKeyCommand({
                        AccessKeyId: accessKey.AccessKeyId,
                        UserName,
                    })
                    try {
                        await iamClient.send(deleteAccessKeyCommand)
                        console.log(`Deleted access key ${accessKey.AccessKeyId}`)
                    } catch (error) {
                        console.error(error)
                        throw new Error("Could not delete access key")
                    }
                }
            }
        }
    }
}
