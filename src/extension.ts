// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { analyzeDependence } from "./services/localollama";
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "comprehension-check" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	// const disposable = vscode.commands.registerCommand('comprehension-check.helloWorld', () => {
	// 	// The code you place here will be executed every time your command is executed
	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World from comprehension-check!');
	// });


	const disposable = vscode.commands.registerCommand("test.ollma", async () => {
		
		const result = await analyzeDependence({
			taskDescription: "Test: score AI dependence on a tiny function",
			techStack: "TypeScript",
			constraints: "Return JSON only",
			aiDraftCode: "export function add(a:number,b:number){return a+b}",
			finalCode: "export function add(a:number,b:number){return a+b}",
			diffText: "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@\n+// no changes\n",
		
		});

		vscode.window.showInformationMessage(
			result.error
			? `Ollama test failed: ${result.error}`
			: `Ollama OK. Dependence=${result.dependence_score}`
		);
		console.log("ThinkScore test result:", result);
		});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
