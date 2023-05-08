import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Openable } from "./openable";
import { initializeLog, logMessage, collapseExpandPath, CollapseExpand, showInFileExplorer, showInVSCode, openWithApp } from "./util";

export function activate(context: vscode.ExtensionContext) {

	initializeLog("Sidekick");

	context.subscriptions.push(vscode.commands.registerCommand("sidekick.showInFileExplorer", async (uri: vscode.Uri | undefined) => {
		if (!uri) {
			logMessage(`Nothing to "showInFileExplorer"`);
			return;
		}
		if (!uri.fsPath || !fs.existsSync(uri.fsPath)) {
			logMessage(`Can't "showInFileExplorer" path "${uri.fsPath}"`);
			return;
		}
		
		// vscode.window.showInformationMessage(`sife "${uri.fsPath}"`);
		showInFileExplorer(uri.fsPath);
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sidekick.showInVSCode", async (uri: vscode.Uri | undefined) => {
		if (!uri || !uri.fsPath) {
			logMessage(`Nothing to "showInVSCode"`);
			return;
		}
		if (!uri.fsPath || !fs.existsSync(uri.fsPath) || !fs.statSync(uri.fsPath).isFile()) {
			logMessage(`Can't "showInVSCode" path "${uri.fsPath}"`);
			return;
		}

		// vscode.window.showInformationMessage(`sic "${uri.fsPath}"`);
		showInVSCode(uri.fsPath);
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sidekick.openWithApp", async (uri: vscode.Uri | undefined) => {
		if (!uri || !uri.fsPath) {
			logMessage(`Nothing to "openWithApp"`);
			return;
		}
		if (!uri.fsPath || !fs.existsSync(uri.fsPath) || !fs.statSync(uri.fsPath).isFile()) {
			logMessage(`Can't "openWithApp" path "${uri.fsPath}"`);
			return;
		}

		// vscode.window.showInformationMessage(`open "${uri.fsPath}"`);
		openWithApp(uri.fsPath);
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sidekick.openSelectionWithApp", async () => {

		const selectedText = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection).trim();
		
		if (!selectedText) {
			logMessage(`Nothing to "openSelectionWithApp"`);
			return;
		}
		
		// vscode.window.showInformationMessage(`open "${selectedText}"`);
		openWithApp(selectedText);
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sidekick.open", async () => {

		const openable = detectOpenableAtCurrentPosition();
		if (openable) {
			openable.open();
		} else {
			logMessage(`Nothing to "open" at current position`);
		}
	}));

}

export function deactivate() {}

function detectOpenableAtCurrentPosition(): Openable | undefined {

	const selection = vscode.window.activeTextEditor?.selection;
	if (!selection) {
		return undefined;
	}

	let expandableVariables: string[] = [];
	const configuredVariables = vscode.workspace.getConfiguration("sidekick").get("pathVariables") as string[];
	if (configuredVariables && configuredVariables.length) {
		expandableVariables = configuredVariables;
	}

	let externalAppFilePattern: RegExp | undefined;
	try {
		let configuredPattern = vscode.workspace.getConfiguration("sidekick").get("externalFilePattern") as string;
		if (configuredPattern) {
			externalAppFilePattern = new RegExp(configuredPattern, "i");
		}
	} catch (e: any) {
		logMessage(`Problem reading configured pattern for files to be opened in external application: ${e}`, true);
	} finally {
		logMessage(`Pattern used for files to be opened in external application is: "${externalAppFilePattern}"`);
	}

	const editor = vscode.window.activeTextEditor!;
	const baseDirectory = path.dirname(editor.document.uri.fsPath);
	
	const collapseExpandReplaceParseOpenable = (pathCandidate: string, editionRange: vscode.Range) : Openable | undefined => {
		const expendedPath = collapseExpandPath(pathCandidate, expandableVariables, CollapseExpand.expand);
		const openable = Openable.parse(expendedPath, baseDirectory, externalAppFilePattern);
		if (openable) {
			const collapsedPath = collapseExpandPath(expendedPath, expandableVariables, CollapseExpand.collapse);
			if (collapsedPath !== pathCandidate) {
				editor.edit(edit => edit.replace(editionRange, collapsedPath));
			}
			return openable;
		}
		return undefined;
	};

	if (!selection.isEmpty && selection.start.line === selection.end.line) {
		const selectionRange = new vscode.Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
		const selectedText = editor.document.getText(selectionRange);
		const selectionOpenable = collapseExpandReplaceParseOpenable(selectedText, selectionRange);
		if (selectionOpenable) {
			return selectionOpenable;
		}
	}

	const currentLineRange = editor.document.lineAt(selection.active.line).range;
	const currentLineText = editor.document.getText(currentLineRange);
	const lineOpenable = collapseExpandReplaceParseOpenable(currentLineText, currentLineRange);
	if (lineOpenable) {
		return lineOpenable;
	}

	let pathPattern: RegExp | undefined;
	try {
		const configuredPattern = vscode.workspace.getConfiguration("sidekick").get("pathPattern") as string;
		if (configuredPattern) {
			pathPattern = new RegExp(configuredPattern, "i");
		}
	} catch (e: any) {
		logMessage(`Problem reading configured pattern for path detection: ${e}`, true);
	} finally {
		logMessage(`Pattern used for path detection is: "${pathPattern}"`);
	}

	if (pathPattern) {
		const match = currentLineText.match(pathPattern);
		if (match) {
			const matchedText = currentLineText.slice(match.index!, match.index! + match[0].length);

			editor.selection = new vscode.Selection(currentLineRange.start.line, match.index!, currentLineRange.start.line, match.index! + match[0].length);

			const patternOpenable = collapseExpandReplaceParseOpenable(matchedText, editor.selection);
			if (patternOpenable) {
				return patternOpenable;
			}
		}
	}

	return undefined;
}
