/*!
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as nls from 'vscode-nls'
const localize = nls.loadMessageBundle()
import * as vscode from 'vscode'
import { getLogger, Logger } from '../../../shared/logger'
import { StateMachineGraphCache } from '../../utils'
import { AslVisualization } from './aslVisualization'

export class AslVisualizationManager {
    protected readonly managedVisualizations: Map<string, AslVisualization> = new Map<string, AslVisualization>()
    private readonly extensionContext: vscode.ExtensionContext

    public constructor(extensionContext: vscode.ExtensionContext) {
        this.extensionContext = extensionContext
    }

    public getManagedVisualizations(): Map<string, AslVisualization> {
        return this.managedVisualizations
    }

    public async visualizeStateMachine(globalStorage: vscode.Memento): Promise<vscode.WebviewPanel | undefined> {
        const logger: Logger = getLogger()
        console.log('* get cache')
        const cache = new StateMachineGraphCache()

        /* TODO: Determine behaviour when command is run against bad input, or
         * non-json files. Determine if we want to limit the command to only a
         * specifc subset of file types ( .json only, custom .states extension, etc...)
         * Ensure tests are written for this use case as well.
         */
        const activeTextEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor

        if (!activeTextEditor) {
            console.log('* no active text editor')
            logger.error('Could not get active text editor for state machine render.')
            throw new Error('Could not get active text editor for state machine render.')
        }

        console.log('* have active text editor')
        const textDocument: vscode.TextDocument = activeTextEditor.document

        // Attempt to retrieve existing visualization if it exists.
        console.log('* get existing visualization')
        const existingVisualization = this.getExistingVisualization(textDocument.uri)
        if (existingVisualization) {
            console.log('* existing visualization exists')
            existingVisualization.showPanel()

            console.log('* show panel')
            return existingVisualization.getPanel()
        }

        // Existing visualization does not exist, construct new visualization
        try {
            console.log('* update cache')
            await cache.updateCache(globalStorage)

            console.log('* make visualization')
            const newVisualization = new AslVisualization(textDocument)
            console.log('* handle visualization')
            this.handleNewVisualization(newVisualization)

            console.log('* get panel')
            return newVisualization.getPanel()
        } catch (err) {
            console.log('* error')
            console.log(err)
            vscode.window.showInformationMessage(
                localize(
                    'AWS.stepfunctions.visualisation.errors.rendering',
                    'There was an error rendering State Machine Graph, check logs for details.'
                )
            )

            logger.debug('Unable to setup webview panel.')
            logger.error(err as Error)
        }

        return
    }

    private deleteVisualization(visualizationToDelete: AslVisualization): void {
        this.managedVisualizations.delete(visualizationToDelete.documentUri.path)
    }

    private handleNewVisualization(newVisualization: AslVisualization): void {
        this.managedVisualizations.set(newVisualization.documentUri.path, newVisualization)

        const visualizationDisposable = newVisualization.onVisualizationDisposeEvent(() => {
            this.deleteVisualization(newVisualization)
        })
        this.extensionContext.subscriptions.push(visualizationDisposable)
    }

    private getExistingVisualization(uriToFind: vscode.Uri): AslVisualization | undefined {
        return this.managedVisualizations.get(uriToFind.path)
    }
}
