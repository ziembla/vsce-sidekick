import * as vscode from "vscode";
import { execFile } from "child_process";
import * as fs from "fs";

var loggingChannel: vscode.OutputChannel;

export function initializeLog(name: string): void  {
    loggingChannel = vscode.window.createOutputChannel(name);
}

export const logMessage = (message: string, reveal = false): void => {
	if (!loggingChannel) {
        return;
	}
	loggingChannel.appendLine(message);
	if (reveal) {
		loggingChannel.show(true);
	}
};

export function isLinux(): boolean {
    return vscode.env.appRoot.startsWith("/");
}

export function isWindows(): boolean {
    return vscode.env.appRoot.length > 1 && vscode.env.appRoot[1] === ":";
}

export function showInFileExplorer(diskPath: string) {
    logMessage(`showing in file explorer: "${diskPath}"`, !isWindows());
    if (fs.existsSync(diskPath)) {
        if (isWindows() && fs.statSync(diskPath).isDirectory()) {
            execFile("explorer.exe", [diskPath]).unref();
        } else {
            vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(diskPath));
        }
    }
}

export function showInVSCode(diskPath: string) {
    logMessage(`showing in vscode: "${diskPath}"`);
    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
        vscode.commands.executeCommand("vscode.open", vscode.Uri.file(diskPath));
    }
}

export enum CollapseExpand {
    collapse,
    expand
}

export function collapseExpandPath(diskPath: string, variables: string[], mode: CollapseExpand) {
    // logMessage(`${mode === CollapseExpand.collapse ? "collapsing" : "expanding "} "${diskPath}"...`);
    variables.forEach(name => {
        const value = process.env[name]!;
        if (value) {
            // logMessage(`           [${name}][${value}]`);
            diskPath = mode === CollapseExpand.collapse
                ? diskPath.replace(value, `%${name}%`)
                : diskPath.replace(`%${name}%`, value);
        }
    });
    // logMessage(`       ... "${diskPath}"`);
    return diskPath;
}

