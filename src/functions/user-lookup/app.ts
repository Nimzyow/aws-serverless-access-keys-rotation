import { ScheduledEvent } from "aws-lambda"

import { IAM } from "@aws-sdk/client-iam"
import { SQS } from "@aws-sdk/client-sqs"

export const lambdaHandler = async (event: ScheduledEvent) => {
    const iam = new IAM({ region: event.region })
    const sqs = new SQS({ region: event.region })
    console.log("Starting user-lookup function")

    try {
        const response = await iam.listUsers({})

        if (!response.Users) {
            console.log("No users found")
            return
        }

        for (const user of response.Users) {
            const message = {
                MessageBody: JSON.stringify(user),
                QueueUrl: `https://sqs.${event.region}.amazonaws.com/${event.account}/UserAccessKeyLookupQueue`,
            }

            await sqs.sendMessage(message)
            console.log(`Sent message to queue for user ${user.UserName}`)
        }
    } catch (error) {
        console.error(error)
        throw new Error("Error thrown")
    }
}
