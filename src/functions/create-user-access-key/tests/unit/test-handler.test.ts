import { lambdaHandler } from "../../app"

import "aws-sdk-client-mock-jest"

import { mockClient } from "aws-sdk-client-mock"

import {
    IAMClient,
    ListAccessKeysCommand,
    DeleteAccessKeyCommand,
    CreateAccessKeyCommand,
} from "@aws-sdk/client-iam"
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { Context, SQSEvent } from "aws-lambda"

const iamMock = mockClient(IAMClient)
const sqsMock = mockClient(SQSClient)

describe("create-user-access-key", function () {
    let event: SQSEvent
    let context: Context
    beforeEach(() => {
        iamMock.reset()
        sqsMock.reset()
        event = {
            Records: [
                {
                    messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
                    receiptHandle: "MessageReceiptHandle",
                    body: JSON.stringify({ UserName: "test-user" }),
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
    test("can create access keys and send message", async () => {
        iamMock.on(ListAccessKeysCommand).resolves({
            AccessKeyMetadata: [
                {
                    AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
                    Status: "Active",
                    UserName: "test-user",
                    CreateDate: new Date("2019-01-01T00:00:00.000Z"),
                },
                {
                    AccessKeyId: "AKIAIOSFODNN7EXAMPL2",
                    Status: "Active",
                    UserName: "test-user",
                    CreateDate: new Date("2019-01-03T00:00:00.000Z"),
                },
            ],
        })

        iamMock.on(DeleteAccessKeyCommand).resolves({})

        iamMock.on(CreateAccessKeyCommand).resolves({
            AccessKey: {
                AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
                SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                Status: "Active",
                UserName: "test-user",
                CreateDate: new Date("2019-01-01T00:00:00.000Z"),
            },
        })

        sqsMock.on(SendMessageCommand).resolves({
            MessageId: "1234567890",
        })

        jest.useFakeTimers().setSystemTime(new Date("2020-01-01"))

        await lambdaHandler(event, context)

        expect(iamMock).toHaveReceivedCommand(ListAccessKeysCommand)
        expect(iamMock).toHaveReceivedCommandTimes(ListAccessKeysCommand, 1)

        expect(sqsMock).toHaveReceivedCommand(SendMessageCommand)
        expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1)
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
            MessageBody: JSON.stringify({
                UserName: "test-user",
                AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
                SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                SecretId: "test-user-access-key",
            }),
        })
    })
    test("can list access keys and delete oldest access key only", async () => {
        iamMock
            .on(ListAccessKeysCommand)
            .resolves({
                AccessKeyMetadata: [
                    {
                        AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
                        Status: "Active",
                        UserName: "test-user",
                        CreateDate: new Date("2019-01-01T00:00:00.000Z"),
                    },
                    {
                        AccessKeyId: "AKIAIOSFODNN7EXAMPL2",
                        Status: "Active",
                        UserName: "test-user",
                        CreateDate: new Date("2020-01-02T00:00:00.000Z"),
                    },
                ],
            })
            .on(DeleteAccessKeyCommand)
            .resolves({})
            .on(CreateAccessKeyCommand)
            .resolves({
                AccessKey: {
                    AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
                    SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                    Status: "Active",
                    UserName: "test-user",
                },
            })

        sqsMock.on(SendMessageCommand).resolves({
            MessageId: "1234567890",
        })

        await lambdaHandler(event, context)

        expect(iamMock).toHaveReceivedCommand(DeleteAccessKeyCommand)
        expect(iamMock).toHaveReceivedCommandTimes(DeleteAccessKeyCommand, 1)

        expect(iamMock).toHaveReceivedCommandWith(DeleteAccessKeyCommand, {
            AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
            UserName: "test-user",
        })
        expect(iamMock).not.toHaveReceivedCommandWith(DeleteAccessKeyCommand, {
            AccessKeyId: "AKIAIOSFODNN7EXAMPL2",
            UserName: "test-user",
        })
    })
    test("throws error if send message command fails fails", async () => {
        iamMock.on(SendMessageCommand).rejects({
            message: "error",
        })

        console.error = jest.fn()
        event.Records[0].body = JSON.stringify({})
        expect(() => lambdaHandler(event, context)).rejects.toThrow()
    })
})
