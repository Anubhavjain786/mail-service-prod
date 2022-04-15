const aws = require('aws-sdk');
const ses = new aws.SES({ region: 'ap-south-1' });
const middy = require('@middy/core');
const sqsPartialBatchFailureMiddleware = require('@middy/sqs-partial-batch-failure');

async function handler(event) {
    const messageProcessingPromises = event.Records.map(processMessage);
    return Promise.allSettled(messageProcessingPromises);
}

async function processMessage(record) {
    const input = JSON.parse(record.body);
    const { to, from, subject, message } = input;

    const emails = to
        .replace(/\s{2,}/gm, ' ') // Replace multiple whitespaces with one space
        .split(',')
        .filter(e => e.trim()) // Remove empty strings
        .map(e => e.trim())
        .filter(e => e !== "undefined")
        .filter(e => !e.includes('<null>'))
        .map(e => e.replace(/"/g, ""));

    const recipients = [...new Set(emails)];

    const params = {
        Destination: {
            ToAddresses: recipients
        },
        Message: {
            Subject: {
                Charset: "UTF-8",
                Data: subject
            },
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: message
                }
            },
        },
        Source: from
    };

    return new Promise((resolve, reject) => {
        ses.sendEmail(params, function (err, data) {
            if (err) {
                console.error("Error in sending mail: ", { record, err });
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

const middyHandler = middy(handler);
middyHandler
    .use(sqsPartialBatchFailureMiddleware());

module.exports.handler = middyHandler;