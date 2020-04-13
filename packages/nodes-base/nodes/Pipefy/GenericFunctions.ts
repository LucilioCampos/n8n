import {
	IExecuteFunctions,
	IHookFunctions,
} from 'n8n-core';

import {
	IDataObject,
} from 'n8n-workflow';

import { OptionsWithUri } from 'request';
import { request, GraphQLClient } from 'graphql-request'


export interface ICustomInterface {
	name: string;
	key: string;
	options?: Array<{
		id: number;
		label: string;
	}>;
}

export interface ICustomProperties {
	[key: string]: ICustomInterface;
}


/**
 * Make an API request to Pipedrive
 *
 * @param {IHookFunctions} this
 * @param {string} method
 * @param {string} url
 * @param {object} body
 * @returns {Promise<any>}
 */

export async function graplqlRequest(token: string, query: string): Promise<any> {
	const endpoint = 'https://app.pipefy.com/graphql'
	const graphqlClient = new GraphQLClient(endpoint, {
		headers: {
			Authorization: `Bearer ${token}`
		}
	})

	try {
		const response = await graphqlClient.request(query)
		console.log("RESPONSE QUERY ", response)
		return response
	} catch (err) {
		console.error(err)
		return err
	}
}

export async function pipefyApiRequest(this: IHookFunctions | IExecuteFunctions, body: string): Promise<any> { // tslint:disable-line:no-any
	const credentials = this.getCredentials('pipefyApi');

	if (credentials === undefined) {
		throw new Error('No credentials got returned!');
	}

	console.log(credentials)

	try {
		const responseData = await graplqlRequest(credentials.apiToken.toString(), body);
		console.log(responseData)

		if (responseData.success === false) {
			throw new Error(`Pipefy error response: ${responseData.error} (${responseData.error_info})`);
		}

		return {
			additionalData: responseData,
			data: responseData,
		};
	} catch (error) {
		if (error.statusCode === 401) {
			// Return a clear error
			throw new Error('The Pipefy credentials are not valid!');
		}

		if (error.response && error.response.body && error.response.body.error) {
			// Try to return the error prettier
			let errorMessage = `Pipedrive error response [${error.statusCode}]: ${error.response.body.error}`;
			if (error.response.body.error_info) {
				errorMessage += ` - ${error.response.body.error_info}`;
			}
			throw new Error(errorMessage);
		}

		// If that data does not exist for some reason return the actual error
		throw error;
	}
}





