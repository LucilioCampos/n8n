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
        ],
        default: 'create',
        description: 'The operation to perform'
      },

      {
        displayName: 'Subject',
        name: 'subject',
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


    let query: string;
    let subject: string;
    let item: INodeExecutionData;
    let myString: string;

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;



    if (['create'].includes(operation) && ['webhook'].includes(resource)) {
      subject = this.getNodeParameter('subject', 0) as string;
      const id = parseInt(subject) as number

      query = `mutation{ createWebhook(input: { pipe_id: ${id} name: "New Webhook" email: "lucilio@codeby.com.br" url: "https://codeby-loyalty-back-end.nanoapp.io/web-hook-orders" actions: ["card.create", "card.done"] } ) {webhook { id name }}}
      `
      // query = `mutation{ createWebhook(input: { pipe_id: ${id} name: "New Webhook teste" email: "lucilio@codeby.com.br" url: "https://codeby-loyalty-back-end.nanoapp.io/web-hook-orders" actions: ["card.create", "card.done"] } ) { webhook { id name } } }`
      console.log("CREATE WEBHOOK QUERY: ", query.replace(/\n/g, ''))


    } else {
      throw new Error(`The resource "${resource}" is not known!`);
    }

    let responseData;

    responseData = await pipefyApiRequest.call(this, query.replace(/\n/g, ''));
    console.log("RESPONSE DATA", responseData)
    returnData.push.apply(returnData, responseData.data as IDataObject[])


    // Itterates over all input items and add the key "myString" with the
    // value the parameter "myString" resolves to.
    // (This could be a different value for each item in case it contains an expression)
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      myString = this.getNodeParameter('resource', 0) as string;
      item = items[itemIndex];

      const { id, name } = responseData.data.createWebhook.webhook

      item.json['id'] = id;
      item.json['name'] = name
    }

    return this.prepareOutputData(items);

  }
}
