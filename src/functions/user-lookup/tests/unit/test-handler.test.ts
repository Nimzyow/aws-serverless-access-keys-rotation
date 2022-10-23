// import { ScheduledEvent, Context } from "aws-lambda"
import { lambdaHandler } from "../../app"

// mock aws-sdk IAM and SQS
const listUsers = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({
        Users: [
            {
                UserName: "test-user",
            },
        ],
    }),
})
const mockSendMessage = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({
        MessageId: "1234567890",
    }),
})
jest.mock("aws-sdk", () => {
    return {
        IAM: jest.fn(() => ({
            listUsers: jest.fn().mockReturnValue({
                promise: jest.fn().mockResolvedValue({
                    Users: [
                        {
                            UserName: "test-user",
                        },
                    ],
                }),
            }),
        })),
        SQS: jest.fn(() => ({
            sendMessage: mockSendMessage,
            promise: jest.fn(),
        })),
    }
})

// mock AWS.config.update

jest.mock("aws-sdk", () => {
    return {
        config: {
            update: jest.fn(),
        },
    }
})

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
        const context = {
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

        await lambdaHandler(event, context)

        // expect lisUsers to be called
        expect(listUsers).toBeCalled()

        // expect sendMessage to be called
        expect(mockSendMessage).toBeCalled()

        // expect(result.statusCode).toEqual(200)
        // expect(result.body).toEqual(
        //     JSON.stringify({
        //         message: "hello world",
        //     })
        // )
    })
})
