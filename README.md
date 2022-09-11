# README

## What is this repository for?

It is security best practice to rotate aws access keys and to get used to rotating aws access keys.

This shortens the period the access keys are active and will reduce business impact if the access keys ever become compromised.

### How do I get set up?

- Install SAM CLI

### Who do I talk to?

- Nima Soufiani

### How to start a SAM project

1. sam init
2. choose AWS Quick start templates
3. choose hello world example
4. select n for popular runtime package (python and zip)
5. choose node 16
6. choose zip
7. choose hello world example typescript
8. choose n for xray tracing
9. name the app

### FAQ

1. How do I validate my SAM template?<br/><br/>

   `sam validate`

2. How do I generate an eventbridge scheduled test event to simulate lambda invocation?

`sam local generate-event cloudwatch scheduled-event`

Note: The CloudWatch Events service has been re-launched as Amazon EventBridge with full backwards compatibility.

The CLI will generate a scheduled event which you can copy paste into events/event.json

3. How do I test the lambda function locally?

from the same directory as template.yml

`sam local invoke "NameOfYourFunctionInTemplateFile" -e events/event.json`

Note: You will need to run `sam build` to test the lambda function with the most up to date code.<br/>
Note: use the -e with the path to the event file if you need it.

### bootstrap pipeline

sam pipeline init --bootstrap

### task

1. Cloudwatch event triggers lambda every day
2. lambda function checks users and decides if their access keys are too old
