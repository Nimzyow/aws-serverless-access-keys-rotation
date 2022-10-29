import { Context, SQSEvent } from "aws-lambda"

import SQS from "aws-sdk/clients/sqs"
import IAM from "aws-sdk/clients/iam"
const iam = new IAM()
const sqs = new SQS()

const isKeyOutOfDate = ({
    createDate,
}: {
    createDate?: NonNullable<IAM.AccessKeyMetadata["CreateDate"]>
}) => {
    if (!createDate) {
        return false
    }
    const diff = new Date().getTime() - createDate.getTime()
    const diffDays = Math.ceil(diff / (1000 * 3600 * 24))
    return diffDays > 90
}

const sendMessage = async ({
    accessKeyId,
    userName,
    region,
    awsAccountId,
}: {
    accessKeyId: NonNullable<IAM.AccessKeyMetadata["AccessKeyId"]>
    userName: string
    region: string
    awsAccountId: string
}) => {
    const params: SQS.SendMessageRequest = {
        QueueUrl: `https://sqs.${region}.amazonaws.com/${awsAccountId}/CreateUserAccessKeyQueue`,
        MessageAttributes: {
            AccessKeyId: {
                DataType: "String",
                StringValue: accessKeyId,
            },
            UserName: {
                DataType: "String",
                StringValue: userName,
            },
        },
        MessageBody: `Rotate ${userName}s access key`,
    }
    try {
        sqs.sendMessage(params)
        console.log("message sent")
        return Promise.resolve(undefined)
    } catch (error) {
        console.error(error)
        return Promise.reject(error)
    }
}

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    console.log("UserAccessLookUp started")
    return new Promise((resolve, reject) => {
        event.Records.map(async (record) => {
            const { UserName } = JSON.parse(record.body)
            if (!UserName) {
                reject("No username found")
            } else {
                iam.listAccessKeys({ UserName }, (err, data) => {
                    if (err) {
                        reject(err)
                    } else {
                        data.AccessKeyMetadata.map((accessKey) => {
                            if (isKeyOutOfDate({ createDate: accessKey.CreateDate })) {
                                sendMessage({
                                    accessKeyId: accessKey.AccessKeyId || "",
                                    userName: UserName,
                                    region: record.awsRegion,
                                    awsAccountId: context.invokedFunctionArn.split(":")[4],
                                })
                            }
                        })
                        resolve(data)
                    }
                })
            }
        })
    })
}
