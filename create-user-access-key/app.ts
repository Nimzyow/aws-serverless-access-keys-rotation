import { Context, SQSEvent } from 'aws-lambda';

import AWS, { IAM } from 'aws-sdk';
const iam = new AWS.IAM();

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    console.log(JSON.stringify(event.Records[0].messageAttributes));
};
