import { Context, SQSEvent } from 'aws-lambda';

import AWS, { IAM } from 'aws-sdk';
const iam = new AWS.IAM();
const sqs = new AWS.SQS();

const checkKey = async ({
    accessKeyId,
    createDate,
    userName,
    accountId,
}: {
    accessKeyId: NonNullable<IAM.AccessKeyMetadata['AccessKeyId']>;
    createDate: NonNullable<IAM.AccessKeyMetadata['CreateDate']>;
    userName: string;
    accountId: string;
}) => {
    const diff = new Date().getTime() - createDate.getTime();
    const diffDays = Math.ceil(diff / (1000 * 3600 * 24));
    const isTimeToRotateAccessKeys = diffDays > 90;

    if (isTimeToRotateAccessKeys) {
        console.log(userName + 's Access key of ' + accessKeyId + ' REQUIRES rotation');
        const params: AWS.SQS.SendMessageRequest = {
            QueueUrl: `https://sqs.eu-west-2.amazonaws.com/${accountId}/UpdateUserAccessKeyQueue`,
            MessageAttributes: {
                accessKeyId: {
                    DataType: 'String',
                    StringValue: accessKeyId,
                },
            },
            MessageBody: `Rotate ${userName}s access key`,
        };
        const response = await sqs.sendMessage(params).promise();
        console.log('message sent with id of ' + response.MessageId);
    } else {
        console.log(userName + 's Access key of ' + accessKeyId + ' DOES NOT require rotation');
    }
};

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    console.log('UserAccessLookUp started');
    AWS.config.update({ region: 'eu-west-2' });

    try {
        let iterator = 0;
        const end = event.Records.length;

        while (iterator < end) {
            const listAccessKeysForUser = await iam
                .listAccessKeys({ UserName: event.Records[iterator].messageAttributes.UserName.stringValue })
                .promise();

            /**
             * {"ResponseMetadata":
             *      {"RequestId":"0ce1f5f1-a9ac-41da-be16-d2aea60769e0"},
             *      "AccessKeyMetadata":[
             *          {"UserName":"nimzy","AccessKeyId":"AKIA3AECSJT4VQKUNXWA","Status":"Active",
             *              "CreateDate":"2021-03-14T09:15:33.000Z"}
             *       ],
             * "IsTruncated":false}
             */

            if (listAccessKeysForUser.AccessKeyMetadata.length > 1) {
                if (
                    listAccessKeysForUser.AccessKeyMetadata[0].CreateDate &&
                    listAccessKeysForUser.AccessKeyMetadata[1].CreateDate &&
                    listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId &&
                    listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId &&
                    new Date(listAccessKeysForUser.AccessKeyMetadata[0].CreateDate) >
                        new Date(listAccessKeysForUser.AccessKeyMetadata[1].CreateDate)
                ) {
                    try {
                        await iam
                            .deleteAccessKey({
                                AccessKeyId: listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId,
                            })
                            .promise();
                        await checkKey({
                            accessKeyId: listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId,
                            createDate: listAccessKeysForUser.AccessKeyMetadata[0].CreateDate,
                            userName: event.Records[iterator].messageAttributes.UserName.stringValue || 'unknown',
                            accountId: context.invokedFunctionArn.split(':')[4],
                        });
                    } catch (error) {
                        console.log(error);
                    }
                } else if (
                    listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId &&
                    listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId &&
                    listAccessKeysForUser.AccessKeyMetadata[1].CreateDate
                ) {
                    try {
                        await iam
                            .deleteAccessKey({
                                AccessKeyId: listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId,
                            })
                            .promise();
                        await checkKey({
                            accessKeyId: listAccessKeysForUser.AccessKeyMetadata[1].AccessKeyId,
                            createDate: listAccessKeysForUser.AccessKeyMetadata[1].CreateDate,
                            userName: event.Records[iterator].messageAttributes.UserName.stringValue || 'unknown',
                            accountId: context.invokedFunctionArn.split(':')[4],
                        });
                    } catch (error) {
                        console.log(error);
                    }
                }
            } else if (
                listAccessKeysForUser.AccessKeyMetadata[0].CreateDate &&
                listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId
            ) {
                await checkKey({
                    accessKeyId: listAccessKeysForUser.AccessKeyMetadata[0].AccessKeyId,
                    createDate: listAccessKeysForUser.AccessKeyMetadata[0].CreateDate,
                    userName: event.Records[iterator].messageAttributes.UserName.stringValue || 'unknown',
                    accountId: context.invokedFunctionArn.split(':')[4],
                });
            }

            // listAccessKeysForUser.AccessKeyMetadata.map((user) => {
            //     user.CreateDate;
            // });

            iterator++;
        }
        console.log('UserAccessLookUp finished');
    } catch (error) {
        console.log(error);
    }
};
