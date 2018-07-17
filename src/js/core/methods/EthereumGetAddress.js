/* @flow */
'use strict';

import AbstractMethod from './AbstractMethod';
import { validateParams, validateEthereumPath } from './helpers/paramsValidator';
import { validatePath } from '../../utils/pathUtils';

import * as UI from '../../constants/ui';
import { UiMessage } from '../../message/builder';

import type { EthereumAddress } from '../../types/trezor';
import type { CoreMessage } from '../../types';

type Batch = {
    path: Array<number>;
    showOnTrezor: boolean;
}

type Params = {
    bundle: Array<Batch>;
    bundledResponse: boolean;
}

export default class EthereumGetAddress extends AbstractMethod {

    params: Params;

    constructor(message: CoreMessage) {
        super(message);

        this.requiredPermissions = ['read'];
        this.requiredFirmware = ['1.6.2', '2.0.7'];
        this.info = 'Export Ethereum address';

        const payload: Object = message.payload;
        let bundledResponse: boolean = true;
        // create a bundle with only one batch
        if (!payload.hasOwnProperty('bundle')) {
            payload.bundle = [ ...payload ];
            bundledResponse = false;
        }

        // validate bundle type
        validateParams(payload, [
            { name: 'bundle', type: 'array' },
        ]);

        const bundle = [];
        let shouldUseUi: boolean = false;
        payload.bundle.forEach(batch => {
            // validate incoming parameters for each batch
            validateParams(batch, [
                { name: 'path', obligatory: true },
                { name: 'showOnTrezor', type: 'boolean' },
            ]);

            const path: Array<number> = validatePath(batch.path);
            validateEthereumPath(path);

            let showOnTrezor: boolean = true;
            if (batch.hasOwnProperty('showOnTrezor')){
                showOnTrezor = batch.showOnTrezor;
            }
            if (showOnTrezor) {
                shouldUseUi = true;
            }

            bundle.push({
                path,
                showOnTrezor
            });
        });

        this.useUi = shouldUseUi;

        this.params = {
            bundle,
            bundledResponse
        }
    }

    async run(): Promise<EthereumAddress | Array<EthereumAddress>> {

        const responses: Array<EthereumAddress> = [];
        for (let i = 0; i < this.params.bundle.length; i++) {

            const response = await this.device.getCommands().ethereumGetAddress(
                this.params.bundle[i].path,
                this.params.bundle[i].showOnTrezor
            );
            responses.push(response);

            if (this.params.bundledResponse) {
                // send progress
                this.postMessage(new UiMessage(UI.BUNDLE_PROGRESS, {
                    progress: i,
                    response
                }));
            }
        }
        return this.params.bundledResponse ? responses : responses[0];
    }
}
