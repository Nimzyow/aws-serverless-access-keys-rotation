import { Context, SNSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';

const iam = new AWS.IAM();

export const lambdaHandler = async (event: SNSEvent, context: Context) => {
    let iterator = 0;
    const end = event.Records.length;

    while (iterator < end) {
        const userName = event.Records[0].Sns.MessageAttributes.UserName.Value;

        try {
            const accessKeysForUser = await iam.listAccessKeys({ UserName: userName }).promise();

            if (accessKeysForUser.AccessKeyMetadata.length > 0) {
                const sortedAccessKeys = accessKeysForUser.AccessKeyMetadata.sort((a, b) => {
                    if (a.CreateDate && b.CreateDate) {
                        return b.CreateDate.getTime() - a.CreateDate.getTime();
                    } else {
                        return 0;
                    }
                });

                const accessKeysToDelete = sortedAccessKeys.slice(1);

                for (const accessKey of accessKeysToDelete) {
                    if (accessKey.AccessKeyId) {
                        await iam.deleteAccessKey({ AccessKeyId: accessKey.AccessKeyId, UserName: userName }).promise();
                    }
                }
            }
        } catch (error) {
            console.log(error);
            throw new Error("Couldn't delete old access keys");
        }
        iterator++;
    }
};
