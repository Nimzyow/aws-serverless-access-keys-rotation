import { Context, ScheduledEvent } from "aws-lambda"

import SQS from "aws-sdk/clients/sqs"
import IAM from "aws-sdk/clients/iam"
const iam = new IAM({ region: "eu-west-1" })
const sqs = new SQS({ region: "eu-west-1" })

export const lambdaHandler = async (event: ScheduledEvent, context: Context) => {
    return new Promise((resolve, reject) => {
        iam.listUsers({}, (err, data) => {
            if (err) {
                reject(err)
            } else {
                console.log(data)
                data.Users.map((user) => {
                    sqs.sendMessage(
                        {
                            QueueUrl: `https://sqs.${event.region}.amazonaws.com/${event.account}/UserAccessKeyLookupQueue`,
                            MessageBody: JSON.stringify(user),
                        },
                        (err, data) => {
                            if (err) {
                                reject(err)
                            } else {
                                console.log("Message sent to queue")
                                resolve(data)
                            }
                        }
                    )
                })
            }
        })
    })
}
