import { SQSEvent } from 'aws-lambda';

import AWS from 'aws-sdk';
const iam = new AWS.IAM();
const sqs = new AWS.SQS();

export const lambdaHandler = async (event: SQSEvent) => {
    AWS.config.update({ region: 'eu-west-2' });

    try {
        console.log(JSON.stringify(event.Records));
        // const listUsers = await iam.listUsers().promise();

        let iterator = 0;
        const end = event.Records.length;

        while (iterator < end) {
            const listAccessKeysForUser = await iam
                .listAccessKeys({ UserName: event.Records[iterator].messageAttributes.UserName.stringValue })
                .promise();

            iterator++;
        }

        // while (iterator < end) {
        //     const params: AWS.SQS.SendMessageRequest = {
        //         QueueUrl: 'https://sqs.eu-west-2.amazonaws.com/756188073209/CheckAccessKeyAgeOfUserQueue',
        //         MessageAttributes: {
        //             UserName: {
        //                 DataType: 'String',
        //                 StringValue: listUsers.Users[iterator].UserName,
        //             },
        //         },
        //         MessageBody: 'user to check',
        //     };
        //     console.log('Begin to send to SQS');
        //     const response = await sqs.sendMessage(params).promise();
        //     console.log('message sent with id of ' + response.MessageId);
        //     iterator++;
        // }

        // listUsers.Users.map(async (user) => {
        //     const userName = user.UserName;

        //     const params: AWS.SQS.SendMessageRequest = {
        //         QueueUrl: 'https://sqs.eu-west-2.amazonaws.com/756188073209/CheckAccessKeyAgeOfUserQueue',
        //         MessageAttributes: {
        //             UserName: {
        //                 DataType: 'String',
        //                 StringValue: userName,
        //             },
        //         },
        //         MessageBody: 'user to check',
        //     };
        //     console.log('Do I get up to this point?');
        //     try {
        //         await sqs
        //             .sendMessage(params, (err, data) => {
        //                 console.log(err);
        //                 console.log(data);
        //             })
        //             .promise();
        //         console.log('HELLO?');
        //     } catch (error) {
        //         console.log(error);
        //     }
        //     // console.log('message sent with ID of ' + response.MessageId);
        // });

        // axios.post()

        // listUsers.Users.map(async (user) => {
        //     console.log(user.UserName);
        //     try {
        //         console.log('do i even get here?');
        //         const accessKeys = await iam.listAccessKeys({ UserName: user.UserName }).promise();
        //         console.log('do i even get there?');

        //         console.log(JSON.stringify(accessKeys));
        //         accessKeys.AccessKeyMetadata.map((accessKey) => {
        //             console.log(user.UserName + accessKey.CreateDate);
        //             if (!accessKey.CreateDate) {
        //                 return;
        //             } else {
        //                 const diff = Math.abs(accessKey.CreateDate.getTime() - new Date().getTime());
        //                 const diffDays = Math.ceil(diff / (1000 * 3600 * 24));

        //                 const isTimeToRotateAccessKeys = diffDays > 90;
        //                 if (isTimeToRotateAccessKeys) {
        //                     console.log(
        //                         user.UserName + 's Access key of ' + accessKey.AccessKeyId + ' REQUIRES rotation',
        //                     );
        //                 } else {
        //                     console.log(
        //                         user.UserName +
        //                             's Access key of ' +
        //                             accessKey.AccessKeyId +
        //                             ' DOES NOT require rotation',
        //                     );
        //                 }
        //             }
        //         });
        //     } catch (error) {
        //         console.log(error);
        //     }
        // });

        // const listAccessKeys = await iam.listAccessKeys({ UserName: 'nimzy' }).promise();
        // console.log(JSON.stringify(listAccessKeys.AccessKeyMetadata));
        // console.log('List Access keys Success');
    } catch (error) {
        console.log(error);
    }
};
