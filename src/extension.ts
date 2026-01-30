import * as vscode from 'vscode';

// Порядок должен строго совпадать с package.json
const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant', 'fsmState'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// Расширенный список стандартных функций
const stdFunctions: Set<string> = new Set([
    'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
    'resize', 'std_match', 'abs', 'now', 'write', 'hwrite', 'read', 'hread',
    'writeline', 'readline', 'unsigned', 'signed', 'shift_left', 'shift_right',
    'rotate_left', 'rotate_right', 'to_stdlogicvector'
]);

export function activate(context: vscode.ExtensionContext) {

    const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
        { language: 'vhdl' },
        {
            provideDocumentSemanticTokens(document: vscode.TextDocument) {
                const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
                const text = document.getText();

                // 1. ОПРЕДЕЛЕНИЕ ЗОН ИГНОРИРОВАНИЯ (ФУНКЦИИ И ПРОЦЕДУРЫ)
                const ignoreZones: { start: number, end: number }[] = [];
                const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
                let m: RegExpExecArray | null;

                while ((m = subProgramRegex.exec(text)) !== null) {
                    ignoreZones.push({ start: m.index, end: m.index + m[0].length });
                }

                const isInsideIgnoreZone = (offset: number) =>
                    ignoreZones.some(z => offset >= z.start && offset <= z.end);

                // Хранилища имен (используем Set для быстрого поиска)
                const inPorts = new Set<string>();
                const outPorts = new Set<string>();
                const functions = new Set<string>();
                const vhdlTypes = new Set<string>();
                const vhdlVariables = new Set<string>();
                const vhdlSignals = new Set<string>();
                const vhdlConstants = new Set<string>();
                const fsmStates = new Set<string>();

                // Добавляем системные объекты TextIO
                ['output', 'input', 'line', 'text', 'true', 'false'].forEach(i => vhdlConstants.add(i));

                // 2. СБОР ОБЪЯВЛЕНИЙ
                const patterns = {
                    in: /\b([a-z0-9_]+)\s*:\s*in\b/gi,
                    out: /\b([a-z0-9_]+)\s*:\s*out\b/gi,
                    func: /\bfunction\s+([a-z0-9_]+)\b/gi,
                    type: /\btype\s+([a-z0-9_]+)\b/gi,
                    var: /\bvariable\s+([a-z0-9_]+)\b/gi,
                    sig: /\bsignal\s+([a-z0-9_]+)\b/gi,
                    const: /\bconstant\s+([a-z0-9_]+)\b/gi,
                    fsm: /type\s+[a-z0-9_]+\s+is\s*\(([^)]+)\)/gi
                };

                // Парсим FSM состояния
                while ((m = patterns.fsm.exec(text)) !== null) {
                    m[1].split(',').forEach(s => {
                        const state = s.replace(/--.*$/gm, '').trim().split(/\s+/)[0].toLowerCase();
                        if (state) fsmStates.add(state);
                    });
                }

                // Парсим всё остальное
                while ((m = patterns.in.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) inPorts.add(m[1].toLowerCase());
                while ((m = patterns.out.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) outPorts.add(m[1].toLowerCase());
                while ((m = patterns.func.exec(text)) !== null) functions.add(m[1].toLowerCase());
                while ((m = patterns.type.exec(text)) !== null) vhdlTypes.add(m[1].toLowerCase());
                while ((m = patterns.var.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) vhdlVariables.add(m[1].toLowerCase());
                while ((m = patterns.sig.exec(text)) !== null) vhdlSignals.add(m[1].toLowerCase());
                while ((m = patterns.const.exec(text)) !== null) vhdlConstants.add(m[1].toLowerCase());

                // 3. ПРОХОД ПО ДОКУМЕНТУ И РАСКРАСКА
                for (let i = 0; i < document.lineCount; i++) {
                    const line = document.lineAt(i);
                    const lineText = line.text;
                    const wordsRegex = /\b([a-z0-9_]+)\b/gi;

                    while ((m = wordsRegex.exec(lineText)) !== null) {
                        const word = m[1].toLowerCase();
                        const wordStart = m.index;
                        const globalOffset = document.offsetAt(new vscode.Position(i, wordStart));

                        // Пропуск numeric констант
                        const charAfter = lineText[wordStart + word.length];
                        if ((word === 'x' || word === 'b' || word === 'o') && charAfter === '"') continue;

                        // Пропуск комментариев
                        const commentIdx = lineText.indexOf('--');
                        if (commentIdx !== -1 && commentIdx < wordStart) continue;

                        // Пропуск строк (простая проверка на четность кавычек)
                        const textBefore = lineText.substring(0, wordStart);
                        if ((textBefore.split('"').length - 1) % 2 !== 0) continue;

                        const inside = isInsideIgnoreZone(globalOffset);

                        // Приоритет раскраски
                        if (functions.has(word) || stdFunctions.has(word)) {
                            tokensBuilder.push(i, wordStart, word.length, 2, 0);
                        } else if (fsmStates.has(word)) {
                            tokensBuilder.push(i, wordStart, word.length, 7, 0);
                        } else if (vhdlTypes.has(word)) {
                            tokensBuilder.push(i, wordStart, word.length, 3, 0);
                        } else if (vhdlConstants.has(word)) {
                            tokensBuilder.push(i, wordStart, word.length, 6, 0);
                        } else if (!inside) {
                            if (inPorts.has(word)) tokensBuilder.push(i, wordStart, word.length, 0, 0);
                            else if (outPorts.has(word)) tokensBuilder.push(i, wordStart, word.length, 1, 0);
                            else if (vhdlVariables.has(word)) tokensBuilder.push(i, wordStart, word.length, 4, 0);
                            else if (vhdlSignals.has(word)) tokensBuilder.push(i, wordStart, word.length, 5, 0);
                        }
                    }
                }
                return tokensBuilder.build();
            }
        },
        legend
    );

    // ПРОВАЙДЕР АВТОДОПОЛНЕНИЯ АТРИБУТОВ
    const attrProvider = vscode.languages.registerCompletionItemProvider(
        { language: 'vhdl' },
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                if (!linePrefix.endsWith("'")) return undefined;

                const attributes = [
                    { label: 'event', desc: 'True if an event occurred in the current delta cycle' },
                    { label: 'range', desc: 'Returns the range of the signal/type' },
                    { label: 'length', desc: 'Returns the length of the array' },
                    { label: 'left', desc: 'Returns the left bound' },
                    { label: 'right', desc: 'Returns the right bound' },
                    { label: 'high', desc: 'Returns the upper bound' },
                    { label: 'low', desc: 'Returns the lower bound' },
                    { label: 'image', desc: 'Converts value to string' },
                    { label: 'active', desc: 'True if the signal is being driven' }
                ];

                return attributes.map(attr => {
                    const item = new vscode.CompletionItem(attr.label, vscode.CompletionItemKind.Property);
                    item.detail = "VHDL Attribute";
                    item.documentation = attr.desc;
                    return item;
                });
            }
        },
        "'"
    );

    context.subscriptions.push(semanticProvider, attrProvider);
}

export function deactivate() { }