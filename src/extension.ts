// // import * as vscode from 'vscode';

// // const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable'];
// // const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// // export function activate(context: vscode.ExtensionContext) {
// //     const provider = vscode.languages.registerDocumentSemanticTokensProvider(
// //         { language: 'vhdl' },
// //         {
// //             provideDocumentSemanticTokens(document: vscode.TextDocument) {
// //                 const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
// //                 const text = document.getText();
// //                 const inPorts: Set<string> = new Set();
// //                 const outPorts: Set<string> = new Set();
// //                 const functions: Set<string> = new Set();
// //                 const vhdlTypes: Set<string> = new Set();
// //                 const vhdlVariables: Set<string> = new Set(); // Новый сет для переменных

// //                 // 1. Поиск объявлений
// //                 const inRegex = /\b([a-z0-9_]+)\s*:\s*in\b/gi;
// //                 const outRegex = /\b([a-z0-9_]+)\s*:\s*out\b/gi;
// //                 const funcRegex = /\bfunction\s+([a-z0-9_]+)\b/gi;
// //                 const typeRegex = /\btype\s+([a-z0-9_]+)\b/gi;
// //                 const varRegex = /\bvariable\s+([a-z0-9_]+)\b/gi;

// //                 let match;
// //                 while ((match = inRegex.exec(text)) !== null) inPorts.add(match[1].toLowerCase());
// //                 while ((match = outRegex.exec(text)) !== null) outPorts.add(match[1].toLowerCase());
// //                 while ((match = funcRegex.exec(text)) !== null) functions.add(match[1].toLowerCase());
// //                 while ((match = typeRegex.exec(text)) !== null) vhdlTypes.add(match[1].toLowerCase());
// //                 while ((match = varRegex.exec(text)) !== null) vhdlVariables.add(match[1].toLowerCase());

// //                 // 2. Раскраска использований по строкам
// //                 for (let i = 0; i < document.lineCount; i++) {
// //                     const lineText = document.lineAt(i).text;
// //                     const wordsRegex = /\b([a-z0-9_]+)\b/gi;

// //                     while ((match = wordsRegex.exec(lineText)) !== null) {
// //                         const word = match[1].toLowerCase();
// //                         const startPos = match.index;

// //                         // Игнорируем комментарии и строки
// //                         const commentIdx = lineText.indexOf('--');
// //                         if (commentIdx !== -1 && commentIdx < startPos) continue;
// //                         const textBefore = lineText.substring(0, startPos);
// //                         if (((textBefore.match(/"/g) || []).length % 2) !== 0) continue;

// //                         if (inPorts.has(word)) tokensBuilder.push(i, startPos, word.length, 0, 0);
// //                         else if (outPorts.has(word)) tokensBuilder.push(i, startPos, word.length, 1, 0);
// //                         else if (functions.has(word)) tokensBuilder.push(i, startPos, word.length, 2, 0);
// //                         else if (vhdlTypes.has(word)) tokensBuilder.push(i, startPos, word.length, 3, 0);
// //                         else if (vhdlVariables.has(word)) tokensBuilder.push(i, startPos, word.length, 4, 0);
// //                     }
// //                 }
// //                 return tokensBuilder.build();
// //             }
// //         },
// //         legend
// //     );
// //     context.subscriptions.push(provider);
// // }

// import * as vscode from 'vscode';

// const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable'];
// const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// export function activate(context: vscode.ExtensionContext) {
//     const provider = vscode.languages.registerDocumentSemanticTokensProvider(
//         { language: 'vhdl' },
//         {
//             provideDocumentSemanticTokens(document: vscode.TextDocument) {
//                 const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
//                 const text = document.getText();

//                 // Зоны игнорирования (функции и процедуры)
//                 const ignoreZones: { start: number, end: number }[] = [];
//                 const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
//                 let zoneMatch;
//                 while ((zoneMatch = subProgramRegex.exec(text)) !== null) {
//                     ignoreZones.push({ start: zoneMatch.index, end: zoneMatch.index + zoneMatch[0].length });
//                 }

//                 // Функция проверки: находится ли позиция в "зоне игнорирования"
//                 const isInsideIgnoreZone = (offset: number) => {
//                     return ignoreZones.some(zone => offset > zone.start && offset < zone.end);
//                 };

//                 const inPorts: Set<string> = new Set();
//                 const outPorts: Set<string> = new Set();
//                 const functions: Set<string> = new Set();
//                 const vhdlTypes: Set<string> = new Set();
//                 const vhdlVariables: Set<string> = new Set();

//                 // 1. СБОР ОБЪЯВЛЕНИЙ
//                 const inRegex = /\b([a-z0-9_]+)\s*:\s*in\b/gi;
//                 const outRegex = /\b([a-z0-9_]+)\s*:\s*out\b/gi;
//                 const funcRegex = /\bfunction\s+([a-z0-9_]+)\b/gi;
//                 const typeRegex = /\btype\s+([a-z0-9_]+)\b/gi;
//                 const varRegex = /\b(variable|signal)\s+([a-z0-9_]+)\b/gi;

//                 let match;
//                 // При сборе портов и переменных проверяем, не внутри ли они функции
//                 while ((match = inRegex.exec(text)) !== null) {
//                     if (!isInsideIgnoreZone(match.index)) inPorts.add(match[1].toLowerCase());
//                 }
//                 while ((match = outRegex.exec(text)) !== null) {
//                     if (!isInsideIgnoreZone(match.index)) outPorts.add(match[1].toLowerCase());
//                 }
//                 while ((match = funcRegex.exec(text)) !== null) {
//                     functions.add(match[1].toLowerCase()); // Функции собираем всегда
//                 }
//                 while ((match = typeRegex.exec(text)) !== null) {
//                     vhdlTypes.add(match[1].toLowerCase());
//                 }
//                 while ((match = varRegex.exec(text)) !== null) {
//                     // Собираем переменные/сигналы только если они ВНЕ функций
//                     if (!isInsideIgnoreZone(match.index)) vhdlVariables.add(match[2].toLowerCase());
//                 }

//                 // 2. РАСКРАСКА
//                 for (let i = 0; i < document.lineCount; i++) {
//                     const line = document.lineAt(i);
//                     const lineText = line.text;
//                     const wordsRegex = /\b([a-z0-9_]+)\b/gi;

//                     while ((match = wordsRegex.exec(lineText)) !== null) {
//                         const word = match[1].toLowerCase();
//                         const startOffset = document.offsetAt(new vscode.Position(i, match.index));

//                         // Пропускаем комментарии и строки
//                         const commentIdx = lineText.indexOf('--');
//                         if (commentIdx !== -1 && commentIdx < match.index) continue;
//                         const textBefore = lineText.substring(0, match.index);
//                         if (((textBefore.match(/"/g) || []).length % 2) !== 0) continue;

//                         // Если мы внутри функции, мы красим ТОЛЬКО само имя функции и типы
//                         // Порты и переменные архитектуры внутри функций обычно не красят (или по желанию)
//                         const inside = isInsideIgnoreZone(startOffset);

//                         if (functions.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 2, 0);
//                         } else if (vhdlTypes.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 3, 0);
//                         } else if (!inside) { 
//                             // Красим порты и переменные только если мы ВНЕ функций
//                             if (inPorts.has(word)) tokensBuilder.push(i, match.index, word.length, 0, 0);
//                             else if (outPorts.has(word)) tokensBuilder.push(i, match.index, word.length, 1, 0);
//                             else if (vhdlVariables.has(word)) tokensBuilder.push(i, match.index, word.length, 4, 0);
//                         }
//                     }
//                 }
//                 return tokensBuilder.build();
//             }
//         },
//         legend
//     );
//     context.subscriptions.push(provider);
// }

// import * as vscode from 'vscode';

// // Обновленная легенда (индексы: 0-portIn, 1-portOut, 2-func, 3-type, 4-var, 5-sig, 6-const)
// const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant'];
// const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// export function activate(context: vscode.ExtensionContext) {
//     const provider = vscode.languages.registerDocumentSemanticTokensProvider(
//         { language: 'vhdl' },
//         {
//             provideDocumentSemanticTokens(document: vscode.TextDocument) {
//                 const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
//                 const text = document.getText();

//                 // Зоны игнорирования (функции и процедуры)
//                 const ignoreZones: { start: number, end: number }[] = [];
//                 const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
//                 let zoneMatch;
//                 while ((zoneMatch = subProgramRegex.exec(text)) !== null) {
//                     ignoreZones.push({ start: zoneMatch.index, end: zoneMatch.index + zoneMatch[0].length });
//                 }

//                 const isInsideIgnoreZone = (offset: number) => {
//                     return ignoreZones.some(zone => offset > zone.start && offset < zone.end);
//                 };

//                 const inPorts: Set<string> = new Set();
//                 const outPorts: Set<string> = new Set();
//                 const functions: Set<string> = new Set();
//                 const vhdlTypes: Set<string> = new Set();
//                 const vhdlVariables: Set<string> = new Set();
//                 const vhdlSignals: Set<string> = new Set();
//                 const vhdlConstants: Set<string> = new Set();
//                 const stdFunctions: Set<string> = new Set([
//                     'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
//                     'resize', 'std_match', 'abs', 'now', 'write', 'hwrite', 'read', 'writeline',
//                     'readline', 'unsigned', 'signed', 'shift_left', 'shift_right',
//                     'rotate_left', 'rotate_right' // , 'std_logic_vector' иногда его используют как функцию приведения
//                 ]);

//                 // 1. Сбор объявлений
//                 const inRegex = /\b([a-z0-9_]+)\s*:\s*in\b/gi;
//                 const outRegex = /\b([a-z0-9_]+)\s*:\s*out\b/gi;
//                 const funcRegex = /\bfunction\s+([a-z0-9_]+)\b/gi;
//                 const typeRegex = /\btype\s+([a-z0-9_]+)\b/gi;
//                 const varRegex = /\bvariable\s+([a-z0-9_]+)\b/gi;
//                 const sigRegex = /\bsignal\s+([a-z0-9_]+)\b/gi;
//                 const constRegex = /\bconstant\s+([a-z0-9_]+)\b/gi;

//                 let match;
//                 while ((match = inRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(match.index)) inPorts.add(match[1].toLowerCase()); }
//                 while ((match = outRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(match.index)) outPorts.add(match[1].toLowerCase()); }
//                 while ((match = funcRegex.exec(text)) !== null) functions.add(match[1].toLowerCase());
//                 while ((match = typeRegex.exec(text)) !== null) vhdlTypes.add(match[1].toLowerCase());

//                 // Переменные (только вне функций)
//                 while ((match = varRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(match.index)) vhdlVariables.add(match[1].toLowerCase()); }
//                 // Сигналы (всегда вне функций в VHDL)
//                 while ((match = sigRegex.exec(text)) !== null) vhdlSignals.add(match[1].toLowerCase());
//                 // Константы (собираем отовсюду)
//                 while ((match = constRegex.exec(text)) !== null) vhdlConstants.add(match[1].toLowerCase());

//                 // 2. Раскраска
//                 for (let i = 0; i < document.lineCount; i++) {
//                     const line = document.lineAt(i);
//                     const lineText = line.text;
//                     const wordsRegex = /\b([a-z0-9_]+)\b/gi;

//                     while ((match = wordsRegex.exec(lineText)) !== null) {
//                         const word = match[1].toLowerCase();
//                         const startOffset = document.offsetAt(new vscode.Position(i, match.index));

//                         // Пропуск комментариев и строк
//                         const commentIdx = lineText.indexOf('--');
//                         if (commentIdx !== -1 && commentIdx < match.index) continue;
//                         const textBefore = lineText.substring(0, match.index);
//                         if (((textBefore.match(/"/g) || []).length % 2) !== 0) continue;

//                         const inside = isInsideIgnoreZone(startOffset);
//                         if (functions.has(word) || stdFunctions.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 2, 0); // Индекс 2 - желтый functionName
//                         }
//                         else if (vhdlTypes.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 3, 0);
//                         }

//                         if (functions.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 2, 0);
//                         } else if (vhdlTypes.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 3, 0);
//                         } else if (vhdlConstants.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 6, 0); // Константы красим всегда
//                         } else if (!inside) {
//                             if (inPorts.has(word)) tokensBuilder.push(i, match.index, word.length, 0, 0);
//                             else if (outPorts.has(word)) tokensBuilder.push(i, match.index, word.length, 1, 0);
//                             else if (vhdlVariables.has(word)) tokensBuilder.push(i, match.index, word.length, 4, 0);
//                             else if (vhdlSignals.has(word)) tokensBuilder.push(i, match.index, word.length, 5, 0);
//                         }
//                     }
//                 }
//                 return tokensBuilder.build();
//             }


//         },
//         legend
//     );
//     context.subscriptions.push(provider);
// }







// import * as vscode from 'vscode';

// // 1. Настройка легенды для нашей умной подсветки
// const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant'];
// const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// // Список стандартных функций из библиотек
// const stdFunctions: Set<string> = new Set([
//     // 'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
//     // 'resize', 'std_match', 'abs', 'now', 'write', 'read', 'writeline',
//     // 'readline', 'unsigned', 'signed', 'shift_left', 'shift_right',
//     // 'rotate_left', 'rotate_right'
//     'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
//     'resize', 'std_match', 'abs', 'now', 'write', 'hwrite', 'read', 'writeline',
//     'readline', 'unsigned', 'signed', 'shift_left', 'shift_right',
//     'rotate_left', 'rotate_right' // , 'std_logic_vector' иногда его используют как функцию приведения
// ]);

// export function activate(context: vscode.ExtensionContext) {

//     // --- БЛОК 1: УМНАЯ ПОДСВЕТКА (Semantic Tokens) ---
//     const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
//         { language: 'vhdl' },
//         {
//             provideDocumentSemanticTokens(document: vscode.TextDocument) {
//                 const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
//                 const text = document.getText();

//                 // Зоны игнорирования (функции и процедуры)
//                 const ignoreZones: { start: number, end: number }[] = [];
//                 const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
//                 let zoneMatch;
//                 while ((zoneMatch = subProgramRegex.exec(text)) !== null) {
//                     ignoreZones.push({ start: zoneMatch.index, end: zoneMatch.index + zoneMatch[0].length });
//                 }

//                 const isInsideIgnoreZone = (offset: number) => {
//                     return ignoreZones.some(zone => offset > zone.start && offset < zone.end);
//                 };

//                 const inPorts: Set<string> = new Set();
//                 const outPorts: Set<string> = new Set();
//                 const functions: Set<string> = new Set();
//                 const vhdlTypes: Set<string> = new Set();
//                 const vhdlVariables: Set<string> = new Set();
//                 const vhdlSignals: Set<string> = new Set();
//                 const vhdlConstants: Set<string> = new Set();

//                 // Сбор объявлений
//                 const inRegex = /\b([a-z0-9_]+)\s*:\s*in\b/gi;
//                 const outRegex = /\b([a-z0-9_]+)\s*:\s*out\b/gi;
//                 const funcRegex = /\bfunction\s+([a-z0-9_]+)\b/gi;
//                 const typeRegex = /\btype\s+([a-z0-9_]+)\b/gi;
//                 const varRegex = /\bvariable\s+([a-z0-9_]+)\b/gi;
//                 const sigRegex = /\bsignal\s+([a-z0-9_]+)\b/gi;
//                 const constRegex = /\bconstant\s+([a-z0-9_]+)\b/gi;

//                 let match;
//                 while ((match = inRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(match.index)) inPorts.add(match[1].toLowerCase()); }
//                 while ((match = outRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(match.index)) outPorts.add(match[1].toLowerCase()); }
//                 while ((match = funcRegex.exec(text)) !== null) functions.add(match[1].toLowerCase());
//                 while ((match = typeRegex.exec(text)) !== null) vhdlTypes.add(match[1].toLowerCase());
//                 while ((match = varRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(match.index)) vhdlVariables.add(match[1].toLowerCase()); }
//                 while ((match = sigRegex.exec(text)) !== null) vhdlSignals.add(match[1].toLowerCase());
//                 while ((match = constRegex.exec(text)) !== null) vhdlConstants.add(match[1].toLowerCase());

//                 // Проход по словам и раскраска
//                 for (let i = 0; i < document.lineCount; i++) {
//                     const lineText = document.lineAt(i).text;
//                     const wordsRegex = /\b([a-z0-9_]+)\b/gi;
//                     while ((match = wordsRegex.exec(lineText)) !== null) {
//                         const word = match[1].toLowerCase();
//                         const startOffset = document.offsetAt(new vscode.Position(i, match.index));
//                         const commentIdx = lineText.indexOf('--');
//                         if (commentIdx !== -1 && commentIdx < match.index) continue;
//                         const textBefore = lineText.substring(0, match.index);
//                         if (((textBefore.match(/"/g) || []).length % 2) !== 0) continue;

//                         const inside = isInsideIgnoreZone(startOffset);

//                         if (functions.has(word) || stdFunctions.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 2, 0);
//                         } else if (vhdlTypes.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 3, 0);
//                         } else if (vhdlConstants.has(word)) {
//                             tokensBuilder.push(i, match.index, word.length, 6, 0);
//                         } else if (!inside) {
//                             if (inPorts.has(word)) tokensBuilder.push(i, match.index, word.length, 0, 0);
//                             else if (outPorts.has(word)) tokensBuilder.push(i, match.index, word.length, 1, 0);
//                             else if (vhdlVariables.has(word)) tokensBuilder.push(i, match.index, word.length, 4, 0);
//                             else if (vhdlSignals.has(word)) tokensBuilder.push(i, match.index, word.length, 5, 0);
//                         }
//                     }
//                 }
//                 return tokensBuilder.build();
//             }
//         },
//         legend
//     );

//     // --- БЛОК 2: АВТОДОПОЛНЕНИЕ АТРИБУТОВ (CLK'event) ---
//     const attrProvider = vscode.languages.registerCompletionItemProvider(
//         { language: 'vhdl' },
//         {
//             provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
//                 const linePrefix = document.lineAt(position).text.substr(0, position.character);
//                 if (!linePrefix.endsWith("'")) return undefined;

//                 const attributes = [
//                     'event', 'range', 'length', 'left', 'right', 'high', 'low',
//                     'ascending', 'image', 'value', 'pos', 'val', 'active', 'last_event'
//                 ];

//                 return attributes.map(attr => {
//                     const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
//                     item.detail = "VHDL Attribute";
//                     return item;
//                 });
//             }
//         },
//         "'" // Триггер - символ одиночной кавычки
//     );

//     // Добавляем наши провайдеры в подписки расширения
//     context.subscriptions.push(semanticProvider, attrProvider);
// }

// export function deactivate() { }






import * as vscode from 'vscode';

// ПОРЯДОК ВАЖЕН! Он должен совпадать с package.json
const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant', 'fsmState'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

const stdFunctions: Set<string> = new Set([
    'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
    'resize', 'std_match', 'abs', 'now', 'write', 'hwrite', 'read', 'writeline',
    'readline', 'unsigned', 'signed', 'shift_left', 'shift_right', 'rotate_left', 'rotate_right'
]);

export function activate(context: vscode.ExtensionContext) {

    const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
        { language: 'vhdl' },
        {
            provideDocumentSemanticTokens(document: vscode.TextDocument) {
                const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
                const text = document.getText();

                // 1. Ищем зоны функций/процедур (чтобы игнорировать там порты/сигналы)
                const ignoreZones: { start: number, end: number }[] = [];
                const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
                let m;
                while ((m = subProgramRegex.exec(text)) !== null) {
                    ignoreZones.push({ start: m.index, end: m.index + m[0].length });
                }
                const isInsideIgnoreZone = (offset: number) => ignoreZones.some(z => offset > z.start && offset < z.end);

                // Хранилища имен
                const inPorts = new Set<string>();
                const outPorts = new Set<string>();
                const functions = new Set<string>();
                const vhdlTypes = new Set<string>();
                const vhdlVariables = new Set<string>();
                const vhdlSignals = new Set<string>();
                const vhdlConstants = new Set<string>();
                const fsmStates = new Set<string>();

                // 2. СБОР ОБЪЯВЛЕНИЙ (Regex)
                const inRegex = /\b([a-z0-9_]+)\s*:\s*in\b/gi;
                const outRegex = /\b([a-z0-9_]+)\s*:\s*out\b/gi;
                const funcRegex = /\bfunction\s+([a-z0-9_]+)\b/gi;
                const typeRegex = /\btype\s+([a-z0-9_]+)\b/gi;
                const varRegex = /\bvariable\s+([a-z0-9_]+)\b/gi;
                const sigRegex = /\bsignal\s+([a-z0-9_]+)\b/gi;
                const constRegex = /\bconstant\s+([a-z0-9_]+)\b/gi;
                // Регулярка для FSM: ищем всё внутри ( ) после "type ... is"
                const fsmRegex = /type\s+[a-z0-9_]+\s+is\s*\(([^)]+)\)/gi;

                while ((m = fsmRegex.exec(text)) !== null) {
                    m[1].split(',').forEach(s => {
                        const state = s.trim().split(/\s+/)[0].toLowerCase();
                        if (state) fsmStates.add(state);
                    });
                }
                while ((m = inRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(m.index)) inPorts.add(m[1].toLowerCase()); }
                while ((m = outRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(m.index)) outPorts.add(m[1].toLowerCase()); }
                while ((m = funcRegex.exec(text)) !== null) functions.add(m[1].toLowerCase());
                while ((m = typeRegex.exec(text)) !== null) vhdlTypes.add(m[1].toLowerCase());
                while ((m = varRegex.exec(text)) !== null) { if (!isInsideIgnoreZone(m.index)) vhdlVariables.add(m[1].toLowerCase()); }
                while ((m = sigRegex.exec(text)) !== null) vhdlSignals.add(m[1].toLowerCase());
                while ((m = constRegex.exec(text)) !== null) vhdlConstants.add(m[1].toLowerCase());

                // 3. РАСКРАСКА ПО СТРОКАМ
                for (let i = 0; i < document.lineCount; i++) {
                    const lineText = document.lineAt(i).text;
                    const wordsRegex = /\b([a-z0-9_]+)\b/gi;
                    while ((m = wordsRegex.exec(lineText)) !== null) {
                        const word = m[1].toLowerCase();
                        const startOffset = document.offsetAt(new vscode.Position(i, m.index));
                        const commentIdx = lineText.indexOf('--');
                        if (commentIdx !== -1 && commentIdx < m.index) continue;
                        const textBefore = lineText.substring(0, m.index);
                        if (((textBefore.match(/"/g) || []).length % 2) !== 0) continue;

                        const inside = isInsideIgnoreZone(startOffset);

                        if (functions.has(word) || stdFunctions.has(word)) {
                            tokensBuilder.push(i, m.index, word.length, 2, 0); // function
                        } else if (fsmStates.has(word)) {
                            tokensBuilder.push(i, m.index, word.length, 7, 0); // FSM STATE
                        } else if (vhdlTypes.has(word)) {
                            tokensBuilder.push(i, m.index, word.length, 3, 0); // type
                        } else if (vhdlConstants.has(word)) {
                            tokensBuilder.push(i, m.index, word.length, 6, 0); // constant
                        } else if (!inside) {
                            if (inPorts.has(word)) tokensBuilder.push(i, m.index, word.length, 0, 0);
                            else if (outPorts.has(word)) tokensBuilder.push(i, m.index, word.length, 1, 0);
                            // else if (vhdlVariables.has(word)) tokensBuilder.push(i, matchToCorrectIndex(m, 4, word, tokensBuilder, i)); // исправлено ниже
                            else if (vhdlVariables.has(word)) tokensBuilder.push(i, m.index, word.length, 4, 0);
                            else if (vhdlSignals.has(word)) tokensBuilder.push(i, m.index, word.length, 5, 0);
                        }
                    }
                }
                return tokensBuilder.build();
            }
        },
        legend
    );

    // Автодополнение атрибутов
    const attrProvider = vscode.languages.registerCompletionItemProvider(
        { language: 'vhdl' },
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                if (!linePrefix.endsWith("'")) return undefined;
                const attributes = ['event', 'range', 'length', 'left', 'right', 'high', 'low', 'active', 'last_event'];
                return attributes.map(attr => new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property));
            }
        },
        "'"
    );

    context.subscriptions.push(semanticProvider, attrProvider);
}

export function deactivate() { }