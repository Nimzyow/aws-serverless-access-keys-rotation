import { Context, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';

const iam = new AWS.IAM();

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    let iterator = 0;
    const end = event.Records.length;

    while (iterator < end) {
        const user = event.Records[0].messageAttributes.UserName.stringValue;

        try {
            const accessKeysForUser = await iam.listAccessKeys({ UserName: user }).promise();

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
                        await iam.deleteAccessKey({ AccessKeyId: accessKey.AccessKeyId, UserName: user }).promise();
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
        iterator++;
    }
};
