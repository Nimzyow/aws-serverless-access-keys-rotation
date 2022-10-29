import { SNSEvent } from "aws-lambda"

import IAM from "aws-sdk/clients/iam"

const iam = new IAM()

export const lambdaHandler = async (event: SNSEvent) => {
    return new Promise((resolve, reject) => {
        event.Records.map(async (record) => {
            const { UserName }: { UserName: string } = JSON.parse(record.Sns.Message)
            iam.listAccessKeys({ UserName }, (err, data) => {
                if (err) {
                    reject(err)
                } else if (data.AccessKeyMetadata.length > 0) {
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
                            iam.deleteAccessKey(
                                {
                                    AccessKeyId: accessKey.AccessKeyId,
                                    UserName,
                                },
                                (err, data) => {
                                    if (err) {
                                        console.error(err)
                                        reject(err)
                                    } else {
                                        console.log("Access key deleted" + accessKey.AccessKeyId)
                                        resolve("Access keys deleted")
                                    }
                                }
                            )
                        }
                    }
                }
            })
        })
    })
}
