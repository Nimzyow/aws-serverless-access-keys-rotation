import { lambdaHandler } from "../../app"

import "aws-sdk-client-mock-jest"

import { mockClient } from "aws-sdk-client-mock"

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb"
import { SQSEvent, Context } from "aws-lambda"

const sesMock = mockClient(SESClient)
const dynamoDBMock = mockClient(DynamoDBClient)

describe("store-secrets", function () {
    let event: SQSEvent
    let context: Context
    beforeEach(() => {
        sesMock.reset()
        dynamoDBMock.reset()
        event = {
            Records: [
                {
                    messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
                    receiptHandle: "MessageReceiptHandle",
                    body: JSON.stringify({ UserName: "test-user", SecretId: "test-secret" }),
                    attributes: {
                        ApproximateReceiveCount: "1",
                        SentTimestamp: "1523232000000",
                        SenderId: "123456789012",
                        ApproximateFirstReceiveTimestamp: "1523232000001",
                    },
                    messageAttributes: {},
                    md5OfBody: "7b270e59b47ff90a553787216d55d91d",
                    eventSource: "aws:sqs",
                    eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:MyQueue",
                    awsRegion: "eu-west-2",
                },
            ],
        }
    })
    test("can update secret in secrets manager", async () => {
        dynamoDBMock.on(GetItemCommand).resolves({
            Item: {
                Email: { S: "test@example.com" },
            },
        })

        sesMock.on(SendEmailCommand).resolves({})

        await lambdaHandler(event)

        expect(dynamoDBMock).toHaveReceivedCommand(GetItemCommand)

        expect(sesMock).toHaveReceivedCommand(SendEmailCommand)
    })
})
