import * as fs from "fs";
import * as path from "path";
import { showInFileExplorer, showInVSCode, openWithApp, isWindows } from "./util";

export class Openable {
    private constructor(
        private url?: string,
        private diskPath?: string,
        private directory?: boolean,
        private line?: number,
        private search?: string,
        private externalApp?: boolean,
    ) {
    }

    private static directoryPattern = new RegExp("^(.*)[/\]+$");
    private static lineNumberPattern = new RegExp("^(.*):([0-9]+)$");
    private static searchPhrasePattern = new RegExp("^(.*)::(.+)$");

    static parse(target: string, baseDirectoryPath?: string, externalAppFilePattern?: RegExp): Openable | undefined {

        target = target.trim();
        
        if (target.match(/^https?:\/\//i)) {
            return new Openable(target);
        }

        let directory: boolean | undefined;
        let line: number | undefined;
        let search: string | undefined;

        const directoryMatch = target.match(this.directoryPattern);
        if (directoryMatch) {
            directory = true;
            target = directoryMatch[1];
        } else {
            const lineNumberMatch = target.match(this.lineNumberPattern);
            if (lineNumberMatch) {
                line = parseInt(lineNumberMatch[2]);
                target = lineNumberMatch[1];
            } else {
                const searchPhraseMatch = target.match(this.searchPhrasePattern);
                if (searchPhraseMatch) {
                    search = searchPhraseMatch[2];
                    target = searchPhraseMatch[1];
                }
            }
        }

        if (baseDirectoryPath && !path.isAbsolute(target)) {
            target = path.resolve(path.join(baseDirectoryPath, target));
        }        

        if (!fs.existsSync(target)) {
            return undefined;
        }

        if (fs.statSync(target).isDirectory()) {
            directory = true;
        }

        target = target.replace(/[/\\]+/g, isWindows() ? "\\" : "/");
        const external: boolean = externalAppFilePattern !== undefined && target.match(externalAppFilePattern!) !== null;
        return new Openable(undefined, target, directory, line, search, external);
    }

    public open() {
        if (this.url) {
            openWithApp(this.url!);
        } else if (this.directory) {
            showInFileExplorer(this.diskPath!);
        } else if (this.externalApp) {
            openWithApp(this.diskPath!);
        } else {
            showInVSCode(this.diskPath!, this.line ?? 1);
        }
    }
}
