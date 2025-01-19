import * as vscode from "vscode";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

export function activate(context: vscode.ExtensionContext) {
  console.log("Aiyo is running!");

  const disposable = vscode.commands.registerCommand(
    "extension.addFunctionComment",
    async () => {
      console.log("Running command extension.addFunctionComment...");
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor!");
        return;
      }

      try {
        // Get the current function at the cursor.
        const functionText = await getCurrentSymbol(editor);
        if (!functionText) {
          vscode.window.showErrorMessage(
            "No function, class, method, or variable found at cursor position"
          );
          return;
        }

        // Initialize ChatOpenAI from the @langchain/openai package.
        const apiKey = vscode.workspace
          .getConfiguration("aiyo")
          .get("openaiApiKey");
        if (!apiKey) {
          vscode.window.showErrorMessage(
            "Please set your OpenAI API key in settings (aiyo.openaiApiKey)"
          );
          return;
        }

        const model = new ChatOpenAI({
          openAIApiKey: apiKey as string,
          modelName: "gpt-4o",
          temperature: 0.2,
        });

        // Generate comment
        const response = await model.invoke(
          `You are a typical Singaporean auntie who is very funny and sarcastic
and knows a lot about programming. You are about to write documentation comments
for code.

Use common documentation conventions for the language, with paragraphs and 
notations common to the language. Wrap line at 80 characters, and add 
paragraph breaks when necessary.

In addition, add explanations for the inputs and outputs of the function, 
with the intuition behind the code choices. The caveat is that everything must 
be in Singlish and speak from the perspective of a Singaporean auntie. Include
references to yourself as "Auntie" and "Auntie Aiyo" if applicable.

Include constructive criticism for the developer's code choices when such 
criticisms are warranted. However, in such cases, make it very funny and 
mocking, and very singlish if possible.

Keep it short and concise. 

Return only the comment, including the comment prefixes.

${functionText}`
        );

        // Clean up the response by removing code block markers if present
        let cleanedContent = response.content.toString().trim();
        cleanedContent = cleanedContent.replace(/^```[\w]*\n?/, ""); // Remove opening ```{lang}
        cleanedContent = cleanedContent.replace(/\n?```$/, ""); // Remove closing ```

        const document = editor.document;

        // Insert the generated comment just above the function.
        const functionSymbol = await findSymbol(editor, document);
        if (!functionSymbol) {
          vscode.window.showErrorMessage(
            "Couldn't locate function symbol to place comment."
          );
          return;
        }

        // Attempt to insert the comment at the line above the function.
        // If the function starts on the first line, insert at the start of that line.
        const functionStartLine = functionSymbol.range.start.line;
        const insertionLine = functionStartLine;
        const newPosition = new vscode.Position(insertionLine, 0);

        await editor.edit((editBuilder) => {
          editBuilder.insert(newPosition, cleanedContent + "\n");
        });
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
  console.log("Aiyo extension is active!");
}

export function deactivate() {
  console.log("Aiyo extension is deactivated!");
}

/**
 * Finds the function symbol at the current cursor position.
 */
async function getCurrentSymbol(
  editor: vscode.TextEditor
): Promise<string | null> {
  const document = editor.document;
  const position = editor.selection.active;

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    document.uri
  );
  if (!symbols) return null;

  const findSymbol = (
    docSymbols: vscode.DocumentSymbol[]
  ): vscode.DocumentSymbol | null => {
    for (const symbol of docSymbols) {
      // Support multiple symbol types
      if (
        (symbol.kind === vscode.SymbolKind.Function ||
          symbol.kind === vscode.SymbolKind.Class ||
          symbol.kind === vscode.SymbolKind.Method ||
          symbol.kind === vscode.SymbolKind.Variable ||
          symbol.kind === vscode.SymbolKind.Interface ||
          symbol.kind === vscode.SymbolKind.Enum) &&
        symbol.range.contains(position)
      ) {
        return symbol;
      }
      if (symbol.children?.length) {
        const childResult = findSymbol(symbol.children);
        if (childResult) return childResult;
      }
    }
    return null;
  };

  const foundSymbol = findSymbol(symbols);
  if (!foundSymbol) return null;

  return document.getText(foundSymbol.range);
}

/**
 * Returns the VSCode DocumentSymbol for the function at the current cursor, if any.
 */
async function findSymbol(
  editor: vscode.TextEditor,
  document: vscode.TextDocument
): Promise<vscode.DocumentSymbol | null> {
  const position = editor.selection.active;
  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    document.uri
  );

  if (!symbols) return null;

  const findSymbol = (
    docSymbols: vscode.DocumentSymbol[]
  ): vscode.DocumentSymbol | null => {
    for (const symbol of docSymbols) {
      if (
        (symbol.kind === vscode.SymbolKind.Function ||
          symbol.kind === vscode.SymbolKind.Class ||
          symbol.kind === vscode.SymbolKind.Method ||
          symbol.kind === vscode.SymbolKind.Variable ||
          symbol.kind === vscode.SymbolKind.Interface ||
          symbol.kind === vscode.SymbolKind.Enum) &&
        symbol.range.contains(position)
      ) {
        return symbol;
      }
      if (symbol.children?.length) {
        const childResult = findSymbol(symbol.children);
        if (childResult) return childResult;
      }
    }
    return null;
  };

  return findSymbol(symbols);
}
