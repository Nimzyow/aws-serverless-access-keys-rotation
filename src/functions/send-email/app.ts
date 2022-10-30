import { SQSEvent } from "aws-lambda/trigger/sqs"

import { SESClient, SendEmailCommand, SendEmailCommandInput } from "@aws-sdk/client-ses"
import { DynamoDBClient, GetItemCommand, GetItemInput } from "@aws-sdk/client-dynamodb"

export const lambdaHandler = async (event: SQSEvent) => {
    for (const record of event.Records) {
        const sesClient = new SESClient({ region: record.awsRegion })
        const dynamoDbClient = new DynamoDBClient({ region: record.awsRegion })

        const { UserName }: { UserName: unknown } = JSON.parse(record.body)

        if (typeof UserName !== "string") {
            throw new Error("Invalid message")
        }

        const params: GetItemInput = {
            TableName: "User",
            Key: {
                NAME: { N: UserName },
            },
        }

        const getItemCommand = new GetItemCommand(params)

        const response = await dynamoDbClient.send(getItemCommand)

        if (!response?.Item?.Email.S) {
            throw new Error("User email address not found in DynamoDB User table")
        }

        const emailParams: SendEmailCommandInput = {
            Destination: {
                ToAddresses: [response.Item.Email.S],
            },
            Message: {
                Body: {
                    Text: {
                        Charset: "UTF-8",
                        Data: `Your access key id is stored in Secrets Manager. Please use the following link to retrieve it: https://console.aws.amazon.com/secretsmanager/home?region=${record.awsRegion}#/secret?name=${UserName}-access-key`,
                    },
                },
                Subject: {
                    Charset: "UTF-8",
                    Data: "Your access key",
                },
            },
            Source: "",
        }

        const sendEmailCommand = new SendEmailCommand(emailParams)

        try {
            await sesClient.send(sendEmailCommand)
        } catch (err) {
            console.log("Couldn't send email")
            console.error(err)
            throw new Error("Couldn't send email")
        }
    }
}
