import { lambdaHandler } from "../../app"

import "aws-sdk-client-mock-jest"

import { mockClient } from "aws-sdk-client-mock"

import { IAMClient, ListUsersCommand } from "@aws-sdk/client-iam"
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { ScheduledEvent } from "aws-lambda"

const iamMock = mockClient(IAMClient)
const sqsMock = mockClient(SQSClient)

describe("user-lookup", function () {
    beforeEach(() => {
        iamMock.reset()
        sqsMock.reset()
    })
    test("can list users and send message", async () => {
        const event: ScheduledEvent = {
            id: "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
            "detail-type": "Scheduled Event",
            source: "aws.events",
            account: "123456789012",
            time: "1970-01-01T00:00:00Z",
            region: "us-east-2",
            resources: ["arn:aws:events:us-east-1:123456789012:rule/ExampleRule"],
            detail: {},
            version: "1",
        }
        iamMock.on(ListUsersCommand).resolves({
            Users: [
                {
                    UserName: "test-user",
                    Arn: "arn:aws:iam::123456789012:user/test-user",
                    CreateDate: new Date("2019-01-01T00:00:00.000Z"),
                    Path: "/",
                    UserId: "AIDAJDPLRKLG7UEXAMPLE",
                },
                {
                    UserName: "test-user2",
                    Arn: "arn:aws:iam::123456789012:user/test-user2",
                    CreateDate: new Date("2019-01-01T00:00:00.000Z"),
                    Path: "/",
                    UserId: "AIDAJDPLRKLG7UEXAMPL2",
                },
            ],
        })

        sqsMock.on(SendMessageCommand).resolves({
            MessageId: "1234567890",
        })

        await lambdaHandler(event)

        expect(iamMock).toHaveReceivedCommand(ListUsersCommand)
        expect(iamMock).toHaveReceivedCommandTimes(ListUsersCommand, 1)

        expect(sqsMock).toHaveReceivedCommand(SendMessageCommand)
        expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 2)
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
            MessageBody: JSON.stringify({
                UserName: "test-user",
                Arn: "arn:aws:iam::123456789012:user/test-user",
                CreateDate: new Date("2019-01-01T00:00:00.000Z"),
                Path: "/",
                UserId: "AIDAJDPLRKLG7UEXAMPLE",
            }),
        })
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
            MessageBody: JSON.stringify({
                UserName: "test-user2",
                Arn: "arn:aws:iam::123456789012:user/test-user2",
                CreateDate: new Date("2019-01-01T00:00:00.000Z"),
                Path: "/",
                UserId: "AIDAJDPLRKLG7UEXAMPL2",
            }),
        })
    })
    test("returns nothing if no users are found", async () => {
        const event: ScheduledEvent = {
            id: "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
            "detail-type": "Scheduled Event",
            source: "aws.events",
            account: "123456789012",
            time: "1970-01-01T00:00:00Z",
            region: "us-east-2",
            resources: ["arn:aws:events:us-east-1:123456789012:rule/ExampleRule"],
            detail: {},
            version: "1",
        }
        iamMock.on(ListUsersCommand).resolves({
            Users: undefined,
        })

        const response = await lambdaHandler(event)

        expect(response).toBeUndefined()
    })
    test("throws error if sdk calls fails", async () => {
        const event: ScheduledEvent = {
            id: "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
            "detail-type": "Scheduled Event",
            source: "aws.events",
            account: "123456789012",
            time: "1970-01-01T00:00:00Z",
            region: "us-east-2",
            resources: ["arn:aws:events:us-east-1:123456789012:rule/ExampleRule"],
            detail: {},
            version: "1",
        }
        iamMock.on(ListUsersCommand).rejects({
            message: "error",
        })

        console.error = jest.fn()

        expect(() => lambdaHandler(event)).rejects.toThrow()
    })
})
