import {
	ICredentialType,
	NodePropertyTypes,
} from 'n8n-workflow';


export class PipefyApi implements ICredentialType {
	name = 'pipefyApi';
	displayName = 'Pipefy API';
	properties = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string' as NodePropertyTypes,
			default: '',
		},
	];
}
