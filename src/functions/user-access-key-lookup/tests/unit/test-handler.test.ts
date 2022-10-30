import { lambdaHandler } from "../../app"

import "aws-sdk-client-mock-jest"

import { mockClient } from "aws-sdk-client-mock"

import { IAMClient, ListAccessKeysCommand } from "@aws-sdk/client-iam"
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { SQSEvent } from "aws-lambda"

const iamMock = mockClient(IAMClient)
const sqsMock = mockClient(SQSClient)

describe("user-lookup", function () {
    let event: SQSEvent
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
                    messageAttributes: {
                        UserName: {
                            stringValue: "nimzy",
                            stringListValues: [],
                            binaryListValues: [],
                            dataType: "String",
                        },
                    },
                    md5OfBody: "7b270e59b47ff90a553787216d55d91d",
                    eventSource: "aws:sqs",
                    eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:MyQueue",
                    awsRegion: "eu-west-2",
                },
            ],
        }
    })
    test("can list access keys and send message", async () => {
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
                    CreateDate: new Date("2019-01-01T00:00:00.000Z"),
                },
            ],
        })

        sqsMock.on(SendMessageCommand).resolves({
            MessageId: "1234567890",
        })

        jest.useFakeTimers().setSystemTime(new Date("2020-01-01"))

        await lambdaHandler(event)

        expect(iamMock).toHaveReceivedCommand(ListAccessKeysCommand)
        expect(iamMock).toHaveReceivedCommandTimes(ListAccessKeysCommand, 1)

        expect(sqsMock).toHaveReceivedCommand(SendMessageCommand)
        expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 2)
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
            MessageBody: JSON.stringify({
                UserName: "test-user",
                AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
            }),
        })
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
            MessageBody: JSON.stringify({
                UserName: "test-user",
                AccessKeyId: "AKIAIOSFODNN7EXAMPL2",
            }),
        })
    })
    test("can list access keys and send message for oldest access key only", async () => {
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
                    CreateDate: new Date("2020-01-02T00:00:00.000Z"),
                },
            ],
        })

        sqsMock.on(SendMessageCommand).resolves({
            MessageId: "1234567890",
        })

        jest.useFakeTimers().setSystemTime(new Date("2020-01-05"))

        await lambdaHandler(event)

        expect(iamMock).toHaveReceivedCommand(ListAccessKeysCommand)
        expect(iamMock).toHaveReceivedCommandTimes(ListAccessKeysCommand, 1)

        expect(sqsMock).toHaveReceivedCommand(SendMessageCommand)
        expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1)
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
            MessageBody: JSON.stringify({
                UserName: "test-user",
                AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
            }),
        })
        expect(sqsMock).not.toHaveReceivedCommandWith(SendMessageCommand, {
            MessageBody: JSON.stringify({
                UserName: "test-user",
                AccessKeyId: "AKIAIOSFODNN7EXAMPL2",
            }),
        })
    })
    test("returns nothing if no access keys are found", async () => {
        iamMock.on(ListAccessKeysCommand).resolves({
            AccessKeyMetadata: undefined,
        })

        const response = await lambdaHandler(event)

        expect(response).toBeUndefined()
    })
    test("throws error if sdk calls fails", async () => {
        iamMock.on(SendMessageCommand).rejects({
            message: "error",
        })

        console.error = jest.fn()

        expect(() => lambdaHandler(event)).rejects.toThrow()
    })
})
