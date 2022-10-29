import { SQSEvent } from "aws-lambda/trigger/sqs"

import SES from "aws-sdk/clients/ses"
import DynamoDB from "aws-sdk/clients/dynamodb"

const ses = new SES()
const dynamoDb = new DynamoDB.DocumentClient()

export const lambdaHandler = async (event: SQSEvent) => {
    return new Promise((resolve, reject) => {
        event.Records.map(async (record) => {
            const { UserName, Email } = JSON.parse(record.body)
            if (!UserName || !Email) {
                reject("No username or email found")
            } else {
                const params = {
                    TableName: "User",
                    Key: {
                        name: UserName,
                    },
                }
                dynamoDb.get(params, (err, data) => {
                    if (err) {
                        reject(err)
                    } else {
                        const { Item } = data
                        if (!Item) {
                            reject("No item found")
                        } else {
                            const { accessKeyId, secretAccessKey } = Item
                            const emailParams = {
                                Destination: {
                                    ToAddresses: [Email],
                                },
                                Message: {
                                    Body: {
                                        Text: {
                                            Charset: "UTF-8",
                                            Data: `Your access key id is ${accessKeyId} and your secret access key is ${secretAccessKey}`,
                                        },
                                    },
                                    Subject: {
                                        Charset: "UTF-8",
                                        Data: "Your access key",
                                    },
                                },
                                Source: "",
                            }
                            ses.sendEmail(emailParams, (err, data) => {
                                if (err) {
                                    console.log("Couldn't send email")
                                    console.error(err)
                                    reject(err)
                                } else {
                                    resolve(data)
                                }
                            })
                        }
                    }
                })
            }
        })
    })
}
