import { ScheduledEvent } from "aws-lambda"

import { ListUsersCommand, IAMClient } from "@aws-sdk/client-iam"
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs"

export const lambdaHandler = async (event: ScheduledEvent) => {
    const iamClient = new IAMClient({ region: event.region })
    const sqsClient = new SQSClient({ region: event.region })
    console.log("Starting user-lookup function")

    try {
        const command = new ListUsersCommand({})
        const response = await iamClient.send(command)

        if (!response.Users) {
            console.log("No users found")
            return
        }

        for (const user of response.Users) {
            const message = {
                MessageBody: JSON.stringify(user),
                QueueUrl: `https://sqs.${event.region}.amazonaws.com/${event.account}/UserAccessKeyLookupQueue`,
            }
            const sqsCommand = new SendMessageCommand(message)
            await sqsClient.send(sqsCommand)
            console.log(`Sent message to queue for user ${user.UserName}`)
        }
    } catch (error) {
        console.error(error)
        throw new Error("Error thrown")
    }
}
