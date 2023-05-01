import * as vscode from "vscode";
import * as fs from "fs";
import { initializeLog, logMessage, collapseExpandPath, CollapseExpand, showInFileExplorer, showInVSCode } from "./util";

export function activate(context: vscode.ExtensionContext) {

	initializeLog("Sidekick");

	context.subscriptions.push(vscode.commands.registerCommand("sidekick.showInFileExplorer", async () => {
		const diskPath = detectPathAtCurrentPosition();
		if (diskPath && fs.existsSync(diskPath)) {
			showInFileExplorer(diskPath);
		} else {
			logMessage("No path detected at current position");
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand("sidekick.showInVSCode", async () => {
		const diskPath = detectPathAtCurrentPosition();
		if (diskPath && fs.existsSync(diskPath)) {
			showInVSCode(diskPath);
		} else {
			logMessage("No path detected at current position");
		}
	}));
}

export function deactivate() {}

function detectPathAtCurrentPosition(): string {

	let expandableVariables: string[] = [];

	const configuredVariables = vscode.workspace.getConfiguration("sidekick").get("pathVariables") as string[];
	if (configuredVariables && configuredVariables.length) {
		expandableVariables = configuredVariables;
	}

	const selection = vscode.window.activeTextEditor?.selection;
	if (!selection) {
		return "";
	}

	const editor = vscode.window.activeTextEditor!;

	const collapseExpandReplace = (pathCandidate: string, editionRange: vscode.Range) : string => {
		const expendedPath = collapseExpandPath(pathCandidate, expandableVariables, CollapseExpand.expand);
		if (fs.existsSync(expendedPath)) {
			const collapsedPath = collapseExpandPath(expendedPath, expandableVariables, CollapseExpand.collapse);
			if (collapsedPath !== pathCandidate) {
				editor.edit(edit => edit.replace(editionRange, collapsedPath));
			}
			return expendedPath;
		}
		return "";
	};

	if (!selection.isEmpty && selection.start.line === selection.end.line) {
		const selectionRange = new vscode.Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
		const selectedText = editor.document.getText(selectionRange);
		const selectionCandidate = collapseExpandReplace(selectedText, selectionRange);
		if (selectionCandidate) {
			return selectionCandidate;
		}
	}

	const currentLineRange = editor.document.lineAt(selection.active.line).range;
	const currentLineText = editor.document.getText(currentLineRange);
	const lineCandidate = collapseExpandReplace(currentLineText, currentLineRange);
	if (lineCandidate) {
		return lineCandidate;
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

			const patternCandidate = collapseExpandReplace(matchedText, editor.selection);
			if (patternCandidate) {
				return patternCandidate;
			}
		}
	}

	return "";
}
