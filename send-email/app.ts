import { Context, SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';

export const lambdaHandler = async (event: SQSEvent, context: Context) => {
    console.log(JSON.stringify(event));
};
