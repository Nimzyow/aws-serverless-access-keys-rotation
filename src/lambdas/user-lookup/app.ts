import { Context, ScheduledEvent } from "aws-lambda"

import SQS from "aws-sdk/clients/sqs"
import IAM from "aws-sdk/clients/iam"
const iam = new IAM()
const sqs = new SQS()

export const lambdaHandler = async (event: ScheduledEvent, context: Context) => {
    try {
        const listUsers = await iam.listUsers().promise()

        let iterator = 0
        const end = listUsers.Users.length

        while (iterator < end) {
            console.log("Begin to send to SQS")
            const params: SQS.SendMessageRequest = {
                QueueUrl: `https://sqs.${event.region}.amazonaws.com/${
                    context.invokedFunctionArn.split(":")[4]
                }/UserAccessKeyLookupQueue`,
                MessageAttributes: {
                    UserName: {
                        DataType: "String",
                        StringValue: listUsers.Users[iterator].UserName,
                    },
                },
                MessageBody: "user to check",
            }
            const response = await sqs.sendMessage(params).promise()
            console.log("message sent with id of " + response.MessageId)
            iterator++
        }
    } catch (error) {
        console.log(error)
        throw new Error("Couldn't send message to SQS")
    }
}
