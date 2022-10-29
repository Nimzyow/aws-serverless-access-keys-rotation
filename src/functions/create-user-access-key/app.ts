import { Context, SQSEvent } from "aws-lambda"

import SQS from "aws-sdk/clients/sqs"
import IAM from "aws-sdk/clients/iam"
const iam = new IAM()
const sqs = new SQS()

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    const awsAccountId = context.invokedFunctionArn.split(":")[4]

    return new Promise((resolve, reject) => {
        event.Records.map(async (record) => {
            const { UserName } = JSON.parse(record.body)
            if (!UserName) {
                reject("No username found")
            } else {
                iam.listAccessKeys({ UserName }, (err, data) => {
                    if (err) {
                        return reject(err)
                    } else {
                        const sortedAccessKeys = data.AccessKeyMetadata.sort((a, b) => {
                            if (a.CreateDate && b.CreateDate) {
                                return b.CreateDate.getTime() - a.CreateDate.getTime()
                            } else {
                                return 0
                            }
                        })

                        const accessKeysToDelete = sortedAccessKeys.slice(1)

                        for (const accessKey of accessKeysToDelete) {
                            if (accessKey.AccessKeyId) {
                                try {
                                    iam.deleteAccessKey({
                                        AccessKeyId: accessKey.AccessKeyId,
                                        UserName,
                                    }).promise()
                                    console.log("Access key deleted" + accessKey.AccessKeyId)
                                } catch (error) {
                                    console.log(
                                        `Couldn't delete oldest access key for user: ${UserName}`
                                    )
                                    console.error(error)
                                    return reject(error)
                                }
                            }
                        }

                        iam.createAccessKey({ UserName }, (err, data) => {
                            if (err) {
                                console.error(err)
                                return reject(err)
                            } else {
                                const params: SQS.SendMessageRequest = {
                                    QueueUrl: `https://sqs.${record.awsRegion}.amazonaws.com/${awsAccountId}/StoreSecretsQueue`,
                                    MessageBody: JSON.stringify({
                                        SecretId: `${UserName}-access-key`,
                                        UserName,
                                        AccessKeyId: data.AccessKey.AccessKeyId,
                                        SecretAccessKey: data.AccessKey.SecretAccessKey,
                                    }),
                                }
                                sqs.sendMessage(params)
                                console.log("message sent to store secrets queue")
                                return resolve(undefined)
                            }
                        })
                        resolve(data)
                    }
                })
            }
        })
    })
}
