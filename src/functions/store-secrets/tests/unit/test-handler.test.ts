import { lambdaHandler } from "../../app"

import "aws-sdk-client-mock-jest"

import { mockClient } from "aws-sdk-client-mock"

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns"
import {
    SecretsManagerClient,
    GetSecretValueCommand,
    CreateSecretCommand,
    PutResourcePolicyCommand,
    UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager"
import { SQSEvent, Context } from "aws-lambda"

const snsMock = mockClient(SNSClient)
const secretsManagerMock = mockClient(SecretsManagerClient)

describe("store-secrets", function () {
    let event: SQSEvent
    let context: Context
    beforeEach(() => {
        snsMock.reset()
        secretsManagerMock.reset()
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
        context = {
            invokedFunctionArn: "arn:aws:lambda:us-east-2:139480602983:function:MyFunction",
            memoryLimitInMB: "128",
            awsRequestId: "1234567890",
            logGroupName: "myLogGroup",
            logStreamName: "myLogStream",
            functionName: "MyFunction",
            functionVersion: "1",
            getRemainingTimeInMillis: () => 1000,
            callbackWaitsForEmptyEventLoop: true,
            done: () => {
                // do nothing
            },
            fail: () => {
                // do nothing
            },
            succeed: () => {
                // do nothing
            },
        }
    })
    test("can update secret in secrets manager", async () => {
        secretsManagerMock.on(GetSecretValueCommand).resolves({
            SecretString: "test-secret",
        })

        secretsManagerMock.on(UpdateSecretCommand).resolves({})

        snsMock.on(PublishCommand).resolves({})

        await lambdaHandler(event, context)

        expect(secretsManagerMock).toHaveReceivedCommand(GetSecretValueCommand)

        expect(secretsManagerMock).toHaveReceivedCommand(UpdateSecretCommand)
        expect(snsMock).toHaveReceivedCommand(PublishCommand)
    })
    test("can create secret in secrets manager", async () => {
        secretsManagerMock.on(GetSecretValueCommand).rejects()

        secretsManagerMock.on(CreateSecretCommand).resolves({
            ARN: "test-arn",
        })

        secretsManagerMock.on(PutResourcePolicyCommand).resolves({})

        snsMock.on(PublishCommand).resolves({})

        await lambdaHandler(event, context)

        expect(secretsManagerMock).toHaveReceivedCommand(GetSecretValueCommand)
        expect(secretsManagerMock).toHaveReceivedCommand(CreateSecretCommand)
        expect(secretsManagerMock).toHaveReceivedCommand(PutResourcePolicyCommand)
        expect(snsMock).toHaveReceivedCommand(PublishCommand)
    })
})
