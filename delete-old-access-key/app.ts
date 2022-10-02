import { Context, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';

const iam = new AWS.IAM();

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    // list access keys of user from Username
    // sort from newest to oldest
    // remove newest from list
    // loop over list and delete access key

    let iterator = 0;
    const end = event.Records.length;

    while (iterator < end) {
        const user = event.Records[0].messageAttributes.UserName.stringValue;

        try {
            const accessKeysForUser = await iam.listAccessKeys({ UserName: user }).promise();

            console.log(JSON.stringify(accessKeysForUser.AccessKeyMetadata));
        } catch (error) {
            console.log(error);
        }
    }
};
