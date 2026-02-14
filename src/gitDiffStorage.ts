import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const GIT_DIFF_FILENAME = 'git-diff.txt';

/**
 * Stores the git diff (vs HEAD) to a file in context.storageUri.
 * Returns the diff string, or undefined on failure.
 * There is a vscode git extension api but it appears to be a trap
 * https://stackoverflow.com/questions/59442180/vs-code-git-extension-api
 */
export async function storeGitDiff(context: vscode.ExtensionContext): Promise<string | undefined> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		vscode.window.showInformationMessage('No workspace folder open.');
		return undefined;
	}

	const cwd = workspaceFolder.uri.fsPath;
	try {
		const { stdout } = await execAsync('git diff HEAD', { cwd, maxBuffer: 10 * 1024 * 1024 });
		const diff = stdout;
		await writeDiffToFile(context, diff);
		return diff;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		vscode.window.showInformationMessage(`Error: ${message}`);
		return undefined;
	}
}

/**
 * Returns a string of the stored git diff from the storageUri file or undefined on failure.
 * Use this to get the context for the api call.
 */
export async function getStoredGitDiff(context: vscode.ExtensionContext): Promise<string | undefined> {
	if (!context.storageUri) {
		return undefined;
	}

	const fileUri = vscode.Uri.joinPath(context.storageUri, GIT_DIFF_FILENAME);
	try {
		const data = await vscode.workspace.fs.readFile(fileUri);
		return new TextDecoder().decode(data);
	} catch {
		return undefined;
	}
}

async function writeDiffToFile(context: vscode.ExtensionContext, diff: string): Promise<void> {
	// I'm pretty sure this should always exist with how we are using it, 
	// but we have to guard because of typescript
	if (!context.storageUri) {
		vscode.window.showErrorMessage('Workspace storage is not available.');
		return;
	}

	try {
		await vscode.workspace.fs.stat(context.storageUri);
	} catch {
		await vscode.workspace.fs.createDirectory(context.storageUri);
	}

	const fileUri = vscode.Uri.joinPath(context.storageUri, GIT_DIFF_FILENAME);
	const writeData = new TextEncoder().encode(diff);
	await vscode.workspace.fs.writeFile(fileUri, writeData);
}
