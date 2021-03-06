/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { ChimeClient, CreateSipMediaApplicationCallCommand } from "@aws-sdk/client-chime";
import { SecretValue } from "aws-cdk-lib";
import { Interface } from "readline";
import 'source-map-support/register';

const wavFileBucket = process.env['WAVFILE_BUCKET'];
const chimeClient = new ChimeClient({ region:  process.env['AWS_REGION'] || 'REGION' });

let generalResponse: smaResponse = {
  SchemaVersion: '1.0',
  Actions: [],
}

exports.handler = async (event: any, context: any, callback: any) => {
  console.log('Lambda is invoked with calldetails:' + JSON.stringify(event));
  let response = generalResponse;

  switch (event.InvocationEventType) {

    case "NEW_INBOUND_CALL":
      response.Actions = newCall(event);
      response.TransactionAttributes = { "state": "new" };
      break;
    case "ACTION_SUCCESSFUL":
      console.log("ACTION_SUCCESSFUL");
      if (event.CallDetails.TransactionAttributes.state == "new") {
        response.TransactionAttributes = { "state": "beeping" };
        response.Actions = beepCall(event);
      }
      if (event.CallDetails.TransactionAttributes.state == "beeping") {
        response.TransactionAttributes = { "state": "recording" };
        response.Actions = recordCall(event);
      }
      if (event.CallDetails.TransactionAttributes.state == "recording") {
        response.TransactionAttributes = { "state": "playing" };
        response.Actions = playbackRecording(event);
      }
      if (event.CallDetails.TransactionAttributes.state == "playing") {
        response.TransactionAttributes = { "state": "finishing" };
        response.Actions = endCall(event);
      }
      break;

    case 'ACTION_FAILED':
      console.log('ACTION_FAILED');
      break;

    case 'HANGUP':
      console.log('HANGUP');
      break;

    default:
      console.log('default case');
      console.log(JSON.stringify(event));
  }
  console.log('Sending response:' + JSON.stringify(response));
  callback(null, response);
};


function newCall(event: any) {
  speakAction.Parameters.Text = "<speak>Hello!  Please record a message after the tone, and press pound when you are done.</speak>";
  return [pauseAction, speakAction];
}

function beepCall(event: any) {
  playAudioAction.Parameters.AudioSource.Key = "500hz-beep.wav";
  return [pauseAction, playAudioAction,];
}

function recordCall(event: any) {
  console.log("wavFileBucket: ", wavFileBucket);
  if (wavFileBucket) {
    recordAudioAction.Parameters.RecordingDestination.BucketName = wavFileBucket;
  }
  recordAudioAction.Parameters.CallId = event.CallDetails.Participants[0].CallId;
  recordAudioAction.Parameters.RecordingDestination.Prefix = event.CallDetails.Participants[0].CallId + "-";
  return [recordAudioAction,];
}

function playbackRecording(event: any) {
  speakAction.Parameters.Text = "<speak>Your message said</speak>";
  playAudioAction.Parameters.AudioSource.Key = event.ActionData.RecordingDestination.Key;
  return [pauseAction, speakAction, playAudioAction];
}

function endCall(event: any) {
  speakAction.Parameters.Text = "<speak>Thank you!  Goodbye!</speak>";
  
  return [pauseAction, speakAction, hangupAction];
}

interface smaAction {
  Type: string;
  Parameters: {};
};
interface smaActions extends Array<smaAction> { };

interface smaResponse {
  SchemaVersion: string;
  Actions: smaActions;
  TransactionAttributes?: Object;
}

const response: smaResponse = {
  SchemaVersion: '1.0',
  Actions: [],
};

const speakAction = {
  Type: "Speak",
  Parameters: {
    Engine: "neural", // Required. Either standard or neural
    LanguageCode: "en-US", // Optional
    Text: "", // Required
    TextType: "ssml", // Optional. Defaults to text
    VoiceId: "Matthew" // Required
  }
}

const playAudioAction = {
  Type: "PlayAudio",
  Parameters: {
    Repeat: "1",
    AudioSource: {
      Type: "S3",
      BucketName: wavFileBucket,
      Key: "",
    },
  },
};


const recordAudioAction = {
  Type: "RecordAudio",
  Parameters: {
    CallId: "call-id-1",
    DurationInSeconds: "30",
    SilenceDurationInSeconds: 3,
    SilenceThreshold: 100,
    RecordingTerminators: [
      "#"
    ],
    RecordingDestination: {
      Type: "S3",
      BucketName: "valid-bucket-name",
      Prefix: "valid-prefix-name"
    }
  }
}

const pauseAction = {
  Type: "Pause",
  Parameters: {
    DurationInMilliseconds: "1000",
  },
};

const hangupAction = {
  Type: "Hangup",
  Parameters: {
    SipResponseCode: "0",
    ParticipantTag: "",
  },
};
