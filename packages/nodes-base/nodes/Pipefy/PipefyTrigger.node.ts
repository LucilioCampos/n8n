import {
  IHookFunctions,
  IWebhookFunctions,
} from 'n8n-core';

import {
  INodeTypeDescription,
  INodeType,
  IWebhookResponseData,
  IDataObject,
} from 'n8n-workflow';

import {
  pipefyApiRequest,
} from './GenericFunctions';

import * as basicAuth from 'basic-auth';
import { Response } from 'express';


function authorizationError(resp: Response, realm: string, responseCode: number, message?: string) {
  if (message === undefined) {
    message = 'Authorization problem!';
    if (responseCode === 401) {
      message = 'Authorization is required!';
    } else if (responseCode === 403) {
      message = 'Authorization data is wrong!';
    }
  }

  resp.writeHead(responseCode, { 'WWW-Authenticate': `Basic realm="${realm}"` });
  resp.end(message);
  return {
    noWebhookResponse: true,
  };
}

function executeAction(action: string, data: IDataObject): string {
  let query: string

  if (action === 'Deleted') {
    query = `
        mutation{
          deleteWebhook(input:{id: ${data.id}}) {
            success
          }
        }
      `.replace(/\\n/g, '')
  } else if (action === 'Added') {
    query = `mutation{ 
      createWebhook(input: { 
        pipe_id: ${data.pipe_id} 
        name: "${data.webhookName}" 
        email: "${data.email}" 
        url: "${data.postback}" 
        actions: ["card.create", "card.done"] 
      } ) { webhook { id name } }
    }`.replace(/\\n/g, '')
  } else if (action === 'Updated') {
    query = `
      mutation{
        updateWebhook(
          input: {
            id: ${data.id}
            email: ${data.email}
            actions: ${data.actions}
          }
        ) {
          webhook {
            id
            email
            actions
          }
        }
      }
    `.replace(/\\n/g, '')
  } else {
    query = ""
  }

  return query

}

export class PipefyTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Pipefy Trigger',
    name: 'pipefyTrigger',
    icon: 'file:pipefy.png',
    group: ['trigger'],
    version: 1,
    description: 'Starts the workflow when Pipefy events occure.',
    defaults: {
      name: 'PipeFy Trigger',
      color: '#559922',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'pipefyApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Pipe ID',
        name: 'pipe_id',
        type: 'string',
        default: '',
        required: true,
      },
      {
        displayName: 'Action',
        name: 'action',
        type: 'options',
        options: [
          {
						name: 'All',
						value: '*',
						description: 'Any change',
					},
          {
            name: 'Added',
            value: 'added',
            description: 'Data got added'
          },
          {
            name: 'Deleted',
            value: 'deleted',
            description: 'Data got deleted'
          },
          {
            name: 'Updated',
            value: 'updated',
            description: 'Data got updated'
          },
        ],
        default: '*',
        description: 'Type of action to receive notifications about.',
      },
      {
        displayName: 'Resources',
        name: 'resource',
        type: 'options',
        options: [
          {
            name: 'Pipes',
            value: 'pipes',
          }
        ],
        default: 'pipes',
        description: 'Type of object to receive notifications about.',
      },
      {
        displayName: 'Webhook Name',
        name: 'webhookName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            action: [
              'added',
              'updated'
            ],
          },
        },
      },
      {
        displayName: 'E-mail',
        name: 'email',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            action: [
              'added',
              'updated'
            ],
            resource: [
              'pipes'
            ]
          },
        },
      },
    ],

  };

  // @ts-ignore (because of request)
  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        const pipeId = this.getNodeParameter('pipe_id', 0)

        if (webhookData.webhookId === undefined) {
          // No webhook id is set so no webhook can exist
          return false;
        }

        // Webhook got created before so check if it still exists
        const query = `{ pipe(id: ${pipeId}){  
          id, webhooks { 
            id, 
            actions, 
            email, 
            name, 
            url 
          } 
        }}`.replace(/\\n/g, '');

        const responseData = await pipefyApiRequest.call(this, query);

        if (responseData.data === undefined) {
          return false;
        }

        for (const existingData of responseData.data) {
          if (existingData.id === webhookData.webhookId) {
            // The webhook exists already
            return true;
          }
        }

        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default');

        const resource = this.getNodeParameter('resource', 0) as string;
        const pipe_id = this.getNodeParameter('pipe_id', 0) as number
        const webhookName = this.getNodeParameter('webhookName', 0) as string;
        const email = this.getNodeParameter('email', 0) as string;

        console.log("RESOURCES", resource)

        const data = {
          pipe_id,
          resource,
          webhookName,
          email,
          webhookUrl
        }

        const query = executeAction('Added', data);


        const responseData = await pipefyApiRequest.call(this, query);

        console.log("RESPONSE OF CREATE > ", responseData)

        if (responseData.data === undefined || responseData.data.id === undefined) {
          // Required data is missing so was not successful
          return false;
        }

        const webhookData = this.getWorkflowStaticData('node');
        webhookData.webhookId = responseData.data.id as string;

        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');

        if (webhookData.webhookId !== undefined) {
          const endpoint = `/webhooks/${webhookData.webhookId}`;
          const body = {};

          try {
            await pipefyApiRequest.call(this, 'DELETE');
          } catch (e) {
            return false;
          }

          // Remove from the static workflow data so that it is clear
          // that no webhooks are registred anymore
          delete webhookData.webhookId;
          delete webhookData.webhookEvents;
        }

        return true;
      },
    },
  };



  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();
    const resp = this.getResponseObject();


    return {
      workflowData: [
        this.helpers.returnJsonArray(req.body)
      ],
    };
  }
}
