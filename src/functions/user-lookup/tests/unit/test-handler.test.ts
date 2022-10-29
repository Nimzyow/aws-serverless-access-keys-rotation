// import { ScheduledEvent, Context } from "aws-lambda"
import { lambdaHandler } from "../../app"

import { mockClient } from "aws-sdk-client-mock"

import { IAMClient, ListUsersCommand } from "@aws-sdk/client-iam"
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"

const iamMock = mockClient(IAMClient)
const sqsMock = mockClient(SQSClient)

describe("Unit test for app handler", function () {
    test("verifies successful response", async () => {
        const event = {
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
            ],
        })

        sqsMock.on(SendMessageCommand).resolves({
            MessageId: "1234567890",
        })

        //@ts-ignore
        await lambdaHandler(event)

        // expect lisUsers to be called
        // expect(listUsers).toBeCalled()

        // // expect sendMessage to be called
        // expect(mockSendMessage).toBeCalled()

        // expect(result.statusCode).toEqual(200)
        // expect(result.body).toEqual(
        //     JSON.stringify({
        //         message: "hello world",
        //     })
        // )
    })
})
