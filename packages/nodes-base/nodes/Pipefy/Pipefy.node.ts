import { IExecuteFunctions } from 'n8n-core';
import {
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { pipefyApiRequest } from './GenericFunctions';

export class Pipefy implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Pipefy',
    name: 'pipefy',
    icon: 'file:pipefy.png',
    group: ['transform'],
    version: 1,
    description: 'integrate with pipefy',
    defaults: {
      name: 'Pipefy',
      color: '#772244',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'pipefyApi',
        required: true,
      }
    ],
    properties: [
      // Node properties which the user gets displayed and
      // can change on the node.
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        options: [
          {
            name: 'WebHook',
            value: 'webhook',
          }
        ],
        default: 'webhook',
        description: 'Config. PipeFy webhook',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: {
            resource: [
              'webhook'
            ],
          },
        },
        options: [
          {
            name: 'Create',
            value: 'create',
            description: 'Create a webhook'
          },
          {
            name: 'Show',
            value: 'show',
            description: 'List webhooks of a pipe'
          },
        ],
        default: 'create',
        description: 'The operation to perform'
      },

      {
        displayName: 'Pipe ID',
        name: 'pipe_id',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: [
              'create',
              'show'
            ],
            resource: [
              'webhook',
            ],
          },
        },
        description: 'The subject of the activity to create',
      },
      {
        displayName: 'Webhook Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: [
              'create',
            ],
            resource: [
              'webhook',
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
            operation: [
              'create',
            ],
            resource: [
              'webhook',
            ],
          },
        },
      },
      {
        displayName: 'Postback Url',
        name: 'url',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: [
              'create',
            ],
            resource: [
              'webhook',
            ],
          },
        },
        description: 'The subject of the activity to create',
      },


    ]
  };


  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {

    const items = this.getInputData();
    const returnData: IDataObject[] = []


    let query: string = '';
    let body: IDataObject;
    let pipeId: string;
    let item: INodeExecutionData;
    let myString: string;

    let responseData;

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    pipeId = this.getNodeParameter('pipe_id', 0) as string;

    for (let i = 0; i < items.length; i++) {

      let url: string;
      let webhookName: string;
      let email: string;

      if (resource === 'webhook') {
        if (operation === 'create') {

          const id = parseInt(pipeId) as number
          url = this.getNodeParameter('url', 0) as string;
          webhookName = this.getNodeParameter('name', 0) as string;
          email = this.getNodeParameter('email', 0) as string;

          query = `mutation{ 
            createWebhook(input: { 
              pipe_id: ${id} 
              name: "${webhookName}" 
              email: "${email}" 
              url: "${url}" 
              actions: ["card.create", "card.done"] 
            } ) { webhook { id name } }
          }`
          
          responseData = await pipefyApiRequest.call(this, query);
          
          const { webhook } = responseData.data.createWebhook
          
          returnData.push(webhook as IDataObject);

        }else if (operation === 'show') {
          query = `{ pipe(id: ${pipeId}){  
            id, webhooks { 
              id, 
              actions, 
              email, 
              name, 
              url 
            } 
          }}`
          responseData = await pipefyApiRequest.call(this, query);
          const  webhooks  = responseData.data.pipe.webhooks
          webhooks.forEach((e: any) => delete e.actions)
          const keys = Object.keys(webhooks[0])
      
          console.log("KEYS >", keys)
          console.log("VALUES > ", webhooks)
      
          returnData.push.apply(keys, webhooks as IDataObject[])
      
      
          if (Array.isArray(responseData)) {
            returnData.push.apply(returnData[0], webhooks as IDataObject[]);
          } else {
            returnData.push(webhooks as IDataObject);
          }
        }
      }
    }

    return [this.helpers.returnJsonArray(returnData[0])];

  }
}
