// import * as vscode from 'vscode';

// // Порядок должен строго совпадать с package.json
// const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant', 'fsmState'];
// const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// // Расширенный список стандартных функций
// const stdFunctions: Set<string> = new Set([
// 	'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
// 	'resize', 'std_match', 'abs', 'now', 'write', 'hwrite', 'read', 'hread',
// 	'writeline', 'readline', 'unsigned', 'signed', 'shift_left', 'shift_right',
// 	'rotate_left', 'rotate_right', 'to_stdlogicvector'
// ]);

// export function activate(context: vscode.ExtensionContext) {

// 	const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideDocumentSemanticTokens(document: vscode.TextDocument) {
// 				const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
// 				const text = document.getText();

// 				// 1. ОПРЕДЕЛЕНИЕ ЗОН ИГНОРИРОВАНИЯ (ФУНКЦИИ И ПРОЦЕДУРЫ)
// 				const ignoreZones: { start: number, end: number }[] = [];
// 				const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
// 				let m: RegExpExecArray | null;

// 				while ((m = subProgramRegex.exec(text)) !== null) {
// 					ignoreZones.push({ start: m.index, end: m.index + m[0].length });
// 				}

// 				const isInsideIgnoreZone = (offset: number) =>
// 					ignoreZones.some(z => offset >= z.start && offset <= z.end);

// 				// Хранилища имен (используем Set для быстрого поиска)
// 				const inPorts = new Set<string>();
// 				const outPorts = new Set<string>();
// 				const functions = new Set<string>();
// 				const vhdlTypes = new Set<string>();
// 				const vhdlVariables = new Set<string>();
// 				const vhdlSignals = new Set<string>();
// 				const vhdlConstants = new Set<string>();
// 				const fsmStates = new Set<string>();

// 				// Добавляем системные объекты TextIO
// 				['output', 'input', 'line', 'text', 'true', 'false'].forEach(i => vhdlConstants.add(i));

// 				// 2. СБОР ОБЪЯВЛЕНИЙ
// 				const patterns = {
// 					in: /\b([a-z0-9_]+)\s*:\s*in\b/gi,
// 					out: /\b([a-z0-9_]+)\s*:\s*out\b/gi,
// 					func: /\bfunction\s+([a-z0-9_]+)\b/gi,
// 					type: /\btype\s+([a-z0-9_]+)\b/gi,
// 					var: /\bvariable\s+([a-z0-9_]+)\b/gi,
// 					sig: /\bsignal\s+([a-z0-9_]+)\b/gi,
// 					const: /\bconstant\s+([a-z0-9_]+)\b/gi,
// 					fsm: /type\s+[a-z0-9_]+\s+is\s*\(([^)]+)\)/gi
// 				};

// 				// Парсим FSM состояния
// 				while ((m = patterns.fsm.exec(text)) !== null) {
// 					m[1].split(',').forEach(s => {
// 						const state = s.replace(/--.*$/gm, '').trim().split(/\s+/)[0].toLowerCase();
// 						if (state) fsmStates.add(state);
// 					});
// 				}

// 				// Парсим всё остальное
// 				while ((m = patterns.in.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) inPorts.add(m[1].toLowerCase());
// 				while ((m = patterns.out.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) outPorts.add(m[1].toLowerCase());
// 				while ((m = patterns.func.exec(text)) !== null) functions.add(m[1].toLowerCase());
// 				while ((m = patterns.type.exec(text)) !== null) vhdlTypes.add(m[1].toLowerCase());
// 				while ((m = patterns.var.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) vhdlVariables.add(m[1].toLowerCase());
// 				while ((m = patterns.sig.exec(text)) !== null) vhdlSignals.add(m[1].toLowerCase());
// 				while ((m = patterns.const.exec(text)) !== null) vhdlConstants.add(m[1].toLowerCase());

// 				// 3. ПРОХОД ПО ДОКУМЕНТУ И РАСКРАСКА
// 				for (let i = 0; i < document.lineCount; i++) {
// 					const line = document.lineAt(i);
// 					const lineText = line.text;
// 					const wordsRegex = /\b([a-z0-9_]+)\b/gi;

// 					while ((m = wordsRegex.exec(lineText)) !== null) {
// 						const word = m[1].toLowerCase();
// 						const wordStart = m.index;
// 						const globalOffset = document.offsetAt(new vscode.Position(i, wordStart));

// 						// Пропуск numeric констант
// 						const charAfter = lineText[wordStart + word.length];
// 						if ((word === 'x' || word === 'b' || word === 'o') && charAfter === '"') continue;

// 						// Пропуск комментариев
// 						const commentIdx = lineText.indexOf('--');
// 						if (commentIdx !== -1 && commentIdx < wordStart) continue;

// 						// Пропуск строк (простая проверка на четность кавычек)
// 						const textBefore = lineText.substring(0, wordStart);
// 						if ((textBefore.split('"').length - 1) % 2 !== 0) continue;

// 						const inside = isInsideIgnoreZone(globalOffset);

// 						// Приоритет раскраски
// 						if (functions.has(word) || stdFunctions.has(word)) {
// 							tokensBuilder.push(i, wordStart, word.length, 2, 0);
// 						} else if (fsmStates.has(word)) {
// 							tokensBuilder.push(i, wordStart, word.length, 7, 0);
// 						} else if (vhdlTypes.has(word)) {
// 							tokensBuilder.push(i, wordStart, word.length, 3, 0);
// 						} else if (vhdlConstants.has(word)) {
// 							tokensBuilder.push(i, wordStart, word.length, 6, 0);
// 						} else if (!inside) {
// 							if (inPorts.has(word)) tokensBuilder.push(i, wordStart, word.length, 0, 0);
// 							else if (outPorts.has(word)) tokensBuilder.push(i, wordStart, word.length, 1, 0);
// 							else if (vhdlVariables.has(word)) tokensBuilder.push(i, wordStart, word.length, 4, 0);
// 							else if (vhdlSignals.has(word)) tokensBuilder.push(i, wordStart, word.length, 5, 0);
// 						}
// 					}
// 				}
// 				return tokensBuilder.build();
// 			}
// 		},
// 		legend
// 	);

// 	// ПРОВАЙДЕР АВТОДОПОЛНЕНИЯ АТРИБУТОВ
// 	const attrProvider = vscode.languages.registerCompletionItemProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
// 				const linePrefix = document.lineAt(position).text.substr(0, position.character);
// 				if (!linePrefix.endsWith("'")) return undefined;

// 				const attributes = [
// 					{ label: 'event', desc: 'True if an event occurred in the current delta cycle' },
// 					{ label: 'range', desc: 'Returns the range of the signal/type' },
// 					{ label: 'length', desc: 'Returns the length of the array' },
// 					{ label: 'left', desc: 'Returns the left bound' },
// 					{ label: 'right', desc: 'Returns the right bound' },
// 					{ label: 'high', desc: 'Returns the upper bound' },
// 					{ label: 'low', desc: 'Returns the lower bound' },
// 					{ label: 'image', desc: 'Converts value to string' },
// 					{ label: 'active', desc: 'True if the signal is being driven' }
// 				];

// 				return attributes.map(attr => {
// 					const item = new vscode.CompletionItem(attr.label, vscode.CompletionItemKind.Property);
// 					item.detail = "VHDL Attribute";
// 					item.documentation = attr.desc;
// 					return item;
// 				});
// 			}
// 		},
// 		"'"
// 	);

// 	// ПРОВАЙДЕР ПЕРЕХОДА К ОПРЕДЕЛЕНИЮ (В ПРЕДЕЛАХ ФАЙЛА)
// 	const definitionProvider = vscode.languages.registerDefinitionProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
// 				const range = document.getWordRangeAtPosition(position);
// 				if (!range) return null;
// 				const word = document.getText(range).toLowerCase();

// 				const text = document.getText();
// 				const lines = text.split(/\r?\n/);

// 				// Регулярные выражения для поиска места, где слово ОБЪЯВЛЯЕТСЯ
// 				// Мы ищем шаблоны: "word :", "signal word", "component word" и т.д.
// 				const declarationPatterns = [
// 					new RegExp(`\\b${word}\\s*:\\s*(in|out|buffer|inout|signal|variable|constant)\\b`, 'i'), // Порты и параметры
// 					new RegExp(`\\b(signal|variable|constant|type|subtype|component|function|procedure|entity|architecture)\\s+${word}\\b`, 'i'), // Сигналы, типы, компоненты
// 					new RegExp(`\\b${word}\\s*:\\s*(entity|component|configuration)\\b`, 'i') // Инстансы
// 				];

// 				for (let i = 0; i < lines.length; i++) {
// 					const lineText = lines[i];

// 					// Пропускаем комментарии
// 					const commentIdx = lineText.indexOf('--');
// 					if (commentIdx !== -1 && commentIdx < lineText.toLowerCase().indexOf(word)) {
// 						continue;
// 					}

// 					for (const pattern of declarationPatterns) {
// 						if (pattern.test(lineText)) {
// 							// Нашли строку, где это слово объявляется!
// 							const wordIdx = lineText.toLowerCase().indexOf(word);
// 							return new vscode.Location(
// 								document.uri,
// 								new vscode.Position(i, wordIdx)
// 							);
// 						}
// 					}
// 				}

// 				return null;
// 			}
// 		}
// 	);

// 	context.subscriptions.push(semanticProvider, attrProvider);
// }

// export function deactivate() { }

// import * as vscode from 'vscode';

// // 1. Настройка легенды для семантической подсветки
// const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant', 'fsmState'];
// const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// // Список стандартных функций IEEE
// const stdFunctions: Set<string> = new Set([
// 	'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
// 	'resize', 'std_match', 'abs', 'now', 'write', 'hwrite', 'read', 'hread',
// 	'writeline', 'readline', 'unsigned', 'signed', 'shift_left', 'shift_right'
// ]);

// export function activate(context: vscode.ExtensionContext) {

// 	// --- ФУНКЦИЯ 1: СЕМАНТИЧЕСКАЯ ПОДСВЕТКА (ДВИЖОК) ---
// 	const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideDocumentSemanticTokens(document: vscode.TextDocument) {
// 				const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
// 				const text = document.getText();

// 				// Зоны игнорирования (подпрограммы)
// 				const ignoreZones: { start: number, end: number }[] = [];
// 				const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
// 				let m;
// 				while ((m = subProgramRegex.exec(text)) !== null) {
// 					ignoreZones.push({ start: m.index, end: m.index + m[0].length });
// 				}
// 				const isInsideIgnoreZone = (offset: number) => ignoreZones.some(z => offset >= z.start && offset <= z.end);

// 				const inPorts = new Set<string>();
// 				const outPorts = new Set<string>();
// 				const functions = new Set<string>();
// 				const vhdlTypes = new Set<string>();
// 				const vhdlVariables = new Set<string>();
// 				const vhdlSignals = new Set<string>();
// 				const vhdlConstants = new Set<string>();
// 				const fsmStates = new Set<string>();

// 				['output', 'input', 'line', 'text', 'true', 'false'].forEach(i => vhdlConstants.add(i));

// 				// Сбор объявлений (FSM, Порты, Сигналы и т.д.)
// 				const fsmRegex = /type\s+[a-z0-9_]+\s+is\s*\(([^)]+)\)/gi;
// 				while ((m = fsmRegex.exec(text)) !== null) {
// 					m[1].split(',').forEach(s => {
// 						const state = s.replace(/--.*$/gm, '').trim().split(/\s+/)[0].toLowerCase();
// 						if (state) fsmStates.add(state);
// 					});
// 				}

// 				const patterns = {
// 					in: /\b([a-z0-9_]+)\s*:\s*in\b/gi,
// 					out: /\b([a-z0-9_]+)\s*:\s*out\b/gi,
// 					func: /\bfunction\s+([a-z0-9_]+)\b/gi,
// 					type: /\btype\s+([a-z0-9_]+)\b/gi,
// 					var: /\bvariable\s+([a-z0-9_]+)\b/gi,
// 					sig: /\bsignal\s+([a-z0-9_]+)\b/gi,
// 					const: /\bconstant\s+([a-z0-9_]+)\b/gi
// 				};

// 				while ((m = patterns.in.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) inPorts.add(m[1].toLowerCase());
// 				while ((m = patterns.out.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) outPorts.add(m[1].toLowerCase());
// 				while ((m = patterns.func.exec(text)) !== null) functions.add(m[1].toLowerCase());
// 				while ((m = patterns.type.exec(text)) !== null) vhdlTypes.add(m[1].toLowerCase());
// 				while ((m = patterns.var.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) vhdlVariables.add(m[1].toLowerCase());
// 				while ((m = patterns.sig.exec(text)) !== null) vhdlSignals.add(m[1].toLowerCase());
// 				while ((m = patterns.const.exec(text)) !== null) vhdlConstants.add(m[1].toLowerCase());

// 				// Раскраска использований
// 				for (let i = 0; i < document.lineCount; i++) {
// 					const lineText = document.lineAt(i).text;
// 					const wordsRegex = /\b([a-z0-9_]+)\b/gi;
// 					while ((m = wordsRegex.exec(lineText)) !== null) {
// 						const word = m[1].toLowerCase();
// 						const wordStart = m.index;

// 						// Пропускаем префиксы x, b, o перед кавычкой
// 						const charAfter = lineText[wordStart + word.length];
// 						if ((word === 'x' || word === 'b' || word === 'o') && charAfter === '"') continue;

// 						const globalOffset = document.offsetAt(new vscode.Position(i, wordStart));
// 						const commentIdx = lineText.indexOf('--');
// 						if (commentIdx !== -1 && commentIdx < wordStart) continue;
// 						const textBefore = lineText.substring(0, wordStart);
// 						if ((textBefore.split('"').length - 1) % 2 !== 0) continue;

// 						const inside = isInsideIgnoreZone(globalOffset);

// 						if (functions.has(word) || stdFunctions.has(word)) tokensBuilder.push(i, wordStart, word.length, 2, 0);
// 						else if (fsmStates.has(word)) tokensBuilder.push(i, wordStart, word.length, 7, 0);
// 						else if (vhdlTypes.has(word)) tokensBuilder.push(i, wordStart, word.length, 3, 0);
// 						else if (vhdlConstants.has(word)) tokensBuilder.push(i, wordStart, word.length, 6, 0);
// 						else if (!inside) {
// 							if (inPorts.has(word)) tokensBuilder.push(i, wordStart, word.length, 0, 0);
// 							else if (outPorts.has(word)) tokensBuilder.push(i, wordStart, word.length, 1, 0);
// 							else if (vhdlVariables.has(word)) tokensBuilder.push(i, wordStart, word.length, 4, 0);
// 							else if (vhdlSignals.has(word)) tokensBuilder.push(i, wordStart, word.length, 5, 0);
// 						}
// 					}
// 				}
// 				return tokensBuilder.build();
// 			}
// 		},
// 		legend
// 	);

// 	// --- ФУНКЦИЯ 2: ПЕРЕХОД К ОПРЕДЕЛЕНИЮ (ПКМ -> Go to Def) ---
// 	const defProvider = vscode.languages.registerDefinitionProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideDefinition(document, position) {
// 				const range = document.getWordRangeAtPosition(position);
// 				if (!range) return null;
// 				const word = document.getText(range).toLowerCase();
// 				const text = document.getText();
// 				const lines = text.split(/\r?\n/);

// 				const decPatterns = [
// 					new RegExp(`\\b${word}\\s*:\\s*(in|out|buffer|inout|signal|variable|constant)\\b`, 'i'),
// 					new RegExp(`\\b(signal|variable|constant|type|subtype|component|function|procedure|entity|architecture)\\s+${word}\\b`, 'i'),
// 					new RegExp(`\\b${word}\\s*:\\s*(entity|component|configuration)\\b`, 'i')
// 				];

// 				for (let i = 0; i < lines.length; i++) {
// 					const lineText = lines[i];
// 					if (lineText.indexOf('--') !== -1 && lineText.indexOf('--') < lineText.toLowerCase().indexOf(word)) continue;
// 					for (const p of decPatterns) {
// 						if (p.test(lineText)) {
// 							return new vscode.Location(document.uri, new vscode.Position(i, lineText.toLowerCase().indexOf(word)));
// 						}
// 					}
// 				}
// 				return null;
// 			}
// 		}
// 	);

// 	// --- ФУНКЦИЯ 3: КОНВЕРТЕР ЧИСЕЛ (HOVER) ---
// 	const hoverProvider = vscode.languages.registerHoverProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideHover(document, position) {
// 				const range = document.getWordRangeAtPosition(position, /([xXbBoO]"[0-9a-fA-F_]+"|[0-9]+#[0-9a-fA-F_]+#|\b[0-9_]+\b)/);
// 				if (!range) return undefined;

// 				let raw = document.getText(range).toLowerCase().replace(/_/g, '');
// 				let dec: bigint | undefined; // Используем BigInt вместо number

// 				try {
// 					if (raw.startsWith('x"')) dec = BigInt("0x" + raw.slice(2, -1));
// 					else if (raw.startsWith('b"')) dec = BigInt("0b" + raw.slice(2, -1));
// 					else if (raw.startsWith('o"')) dec = BigInt("0o" + raw.slice(2, -1));
// 					else if (raw.includes('#')) {
// 						const parts = raw.split('#');
// 						const base = parts[0];
// 						const val = parts[1];
// 						if (base === '16') dec = BigInt("0x" + val);
// 						else if (base === '2') dec = BigInt("0b" + val);
// 						else if (base === '8') dec = BigInt("0o" + val);
// 						else dec = BigInt(parseInt(val, parseInt(base)));
// 					} else if (/^\d+$/.test(raw)) {
// 						dec = BigInt(raw);
// 					}
// 				} catch (e) {
// 					return undefined; // Если число слишком кривое для BigInt
// 				}

// 				if (dec === undefined) return undefined;

// 				const numColor = "#B5CEA8";
// 				// BigInt.toString() никогда не использует экспоненциальную форму
// 				const hexVal = dec.toString(16).toUpperCase();
// 				const decVal = dec.toString(10);
// 				const octVal = dec.toString(8);
// 				const binVal = dec.toString(2);

// 				const md = new vscode.MarkdownString();
// 				md.isTrusted = true;
// 				md.supportHtml = true;

// 				md.appendMarkdown(`
// <div style="margin-top: 0; margin-bottom: 0; padding: 0;">
//     <span style="font-weight: bold;">🔢 Number Converter</span>
// </div>
// <div style="border-top: 1px solid #555; margin-top: 4px; margin-bottom: 4px;"></div>
// \n`);

// 				md.appendMarkdown(`| | |\n`);
// 				md.appendMarkdown(`| :--- | :--- |\n`);
// 				md.appendMarkdown(`| <code>Hex</code> | <span style="color:${numColor};"><code>x"${hexVal}"</code></span> |\n`);
// 				md.appendMarkdown(`| <code>Dec</code> | <span style="color:${numColor};"><code>${decVal}</code></span> |\n`);
// 				md.appendMarkdown(`| <code>Oct</code> | <span style="color:${numColor};"><code>o"${octVal}"</code></span> |\n`);
// 				md.appendMarkdown(`| <code>Bin</code> | <span style="color:${numColor};"><code>b"${binVal}"</code></span> |\n`);

// 				return new vscode.Hover(md);
// 			}
// 		}
// 	);

// 	// --- ФУНКЦИЯ 4: АТРИБУТЫ (CLK'event) ---
// 	const attrProvider = vscode.languages.registerCompletionItemProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideCompletionItems(document, position) {
// 				const line = document.lineAt(position).text.substr(0, position.character);
// 				if (!line.endsWith("'")) return undefined;
// 				return ['event', 'range', 'length', 'left', 'right', 'high', 'low', 'image', 'active'].map(a => {
// 					const item = new vscode.CompletionItem(a, vscode.CompletionItemKind.Property);
// 					item.detail = "VHDL Attribute";
// 					return item;
// 				});
// 			}
// 		},
// 		"'"
// 	);

// 	context.subscriptions.push(semanticProvider, defProvider, hoverProvider, attrProvider);
// }

// export function deactivate() { }

// import * as vscode from 'vscode';

// /** 
//  * ПОРЯДОК ВАЖЕН! Должен строго совпадать с массивом в package.json 
//  * 0:portIn, 1:portOut, 2:functionName, 3:vhdlType, 4:vhdlVariable, 5:vhdlSignal, 6:vhdlConstant, 7:fsmState
//  */
// const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant', 'fsmState'];
// const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// /** Список стандартных функций библиотек IEEE/STD */
// const stdFunctions = new Set([
// 	'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
// 	'resize', 'std_match', 'abs', 'now', 'write', 'hwrite', 'read', 'hread',
// 	'writeline', 'readline', 'unsigned', 'signed', 'shift_left', 'shift_right',
// 	'rotate_left', 'rotate_right', 'to_stdlogicvector'
// ]);

// export function activate(context: vscode.ExtensionContext) {

// 	// --- ФУНКЦИЯ 1: СЕМАНТИЧЕСКАЯ ПОДСВЕТКА ---
// 	const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideDocumentSemanticTokens(document: vscode.TextDocument) {
// 				const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
// 				const text = document.getText();

// 				// 1. Поиск зон игнорирования (тела функций и процедур)
// 				const ignoreZones: { start: number, end: number }[] = [];
// 				const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
// 				let m: RegExpExecArray | null;

// 				while ((m = subProgramRegex.exec(text)) !== null) {
// 					ignoreZones.push({ start: m.index, end: m.index + m[0].length });
// 				}

// 				const isInsideIgnoreZone = (offset: number) =>
// 					ignoreZones.some(z => offset >= z.start && offset <= z.end);

// 				// Хранилища найденных имен
// 				const inPorts = new Set<string>();
// 				const outPorts = new Set<string>();
// 				const functions = new Set<string>();
// 				const vhdlTypes = new Set<string>();
// 				const vhdlVariables = new Set<string>();
// 				const vhdlSignals = new Set<string>();
// 				const vhdlConstants = new Set<string>();
// 				const fsmStates = new Set<string>();

// 				// Предопределенные константы
// 				['output', 'input', 'line', 'text', 'true', 'false'].forEach(c => vhdlConstants.add(c));

// 				// 2. Сбор объявлений через регулярные выражения
// 				const fsmRegex = /type\s+[a-z0-9_]+\s+is\s*\(([^)]+)\)/gi;
// 				while ((m = fsmRegex.exec(text)) !== null) {
// 					m[1].split(',').forEach(s => {
// 						const state = s.replace(/--.*$/gm, '').trim().split(/\s+/)[0].toLowerCase();
// 						if (state) fsmStates.add(state);
// 					});
// 				}

// 				const patterns = {
// 					in: /\b([a-z0-9_]+)\s*:\s*in\b/gi,
// 					out: /\b([a-z0-9_]+)\s*:\s*out\b/gi,
// 					func: /\bfunction\s+([a-z0-9_]+)\b/gi,
// 					type: /\btype\s+([a-z0-9_]+)\b/gi,
// 					var: /\bvariable\s+([a-z0-9_]+)\b/gi,
// 					sig: /\bsignal\s+([a-z0-9_]+)\b/gi,
// 					const: /\bconstant\s+([a-z0-9_]+)\b/gi
// 				};

// 				while ((m = patterns.in.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) inPorts.add(m[1].toLowerCase());
// 				while ((m = patterns.out.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) outPorts.add(m[1].toLowerCase());
// 				while ((m = patterns.func.exec(text)) !== null) functions.add(m[1].toLowerCase());
// 				while ((m = patterns.type.exec(text)) !== null) vhdlTypes.add(m[1].toLowerCase());
// 				while ((m = patterns.var.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) vhdlVariables.add(m[1].toLowerCase());
// 				while ((m = patterns.sig.exec(text)) !== null) vhdlSignals.add(m[1].toLowerCase());
// 				while ((m = patterns.const.exec(text)) !== null) vhdlConstants.add(m[1].toLowerCase());

// 				// 3. Построчная раскраска
// 				for (let i = 0; i < document.lineCount; i++) {
// 					const lineText = document.lineAt(i).text;
// 					const wordsRegex = /\b([a-z0-9_]+)\b/gi;

// 					while ((m = wordsRegex.exec(lineText)) !== null) {
// 						const word = m[1].toLowerCase();
// 						const wordStart = m.index;
// 						const globalOffset = document.offsetAt(new vscode.Position(i, wordStart));

// 						// Защита от окрашивания префиксов битовых строк (x, b, o)
// 						const charAfter = lineText[wordStart + word.length];
// 						if ((word === 'x' || word === 'b' || word === 'o') && charAfter === '"') continue;

// 						// Пропуск комментариев и строк
// 						const commentIdx = lineText.indexOf('--');
// 						if (commentIdx !== -1 && commentIdx < wordStart) continue;
// 						if ((lineText.substring(0, wordStart).split('"').length - 1) % 2 !== 0) continue;

// 						const inside = isInsideIgnoreZone(globalOffset);

// 						// Применение токенов по приоритету
// 						if (functions.has(word) || stdFunctions.has(word)) tokensBuilder.push(i, wordStart, word.length, 2, 0);
// 						else if (fsmStates.has(word)) tokensBuilder.push(i, wordStart, word.length, 7, 0);
// 						else if (vhdlTypes.has(word)) tokensBuilder.push(i, wordStart, word.length, 3, 0);
// 						else if (vhdlConstants.has(word)) tokensBuilder.push(i, wordStart, word.length, 6, 0);
// 						else if (!inside) {
// 							if (inPorts.has(word)) tokensBuilder.push(i, wordStart, word.length, 0, 0);
// 							else if (outPorts.has(word)) tokensBuilder.push(i, wordStart, word.length, 1, 0);
// 							else if (vhdlVariables.has(word)) tokensBuilder.push(i, wordStart, word.length, 4, 0);
// 							else if (vhdlSignals.has(word)) tokensBuilder.push(i, wordStart, word.length, 5, 0);
// 						}
// 					}
// 				}
// 				return tokensBuilder.build();
// 			}
// 		},
// 		legend
// 	);

// 	// --- ФУНКЦИЯ 2: ПЕРЕХОД К ОПРЕДЕЛЕНИЮ ---
// 	const defProvider = vscode.languages.registerDefinitionProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideDefinition(document, position) {
// 				const range = document.getWordRangeAtPosition(position);
// 				if (!range) return null;
// 				const word = document.getText(range).toLowerCase();
// 				const text = document.getText();
// 				const lines = text.split(/\r?\n/);

// 				const decPatterns = [
// 					new RegExp(`\\b${word}\\s*:\\s*(in|out|buffer|inout|signal|variable|constant)\\b`, 'i'),
// 					new RegExp(`\\b(signal|variable|constant|type|subtype|component|function|procedure|entity|architecture)\\s+${word}\\b`, 'i'),
// 					new RegExp(`\\b${word}\\s*:\\s*(entity|component|configuration)\\b`, 'i')
// 				];

// 				for (let i = 0; i < lines.length; i++) {
// 					const lineText = lines[i];
// 					if (lineText.indexOf('--') !== -1 && lineText.indexOf('--') < lineText.toLowerCase().indexOf(word)) continue;
// 					for (const p of decPatterns) {
// 						if (p.test(lineText)) {
// 							return new vscode.Location(document.uri, new vscode.Position(i, lineText.toLowerCase().indexOf(word)));
// 						}
// 					}
// 				}
// 				return null;
// 			}
// 		}
// 	);

// 	// --- ФУНКЦИЯ 3: КОНВЕРТЕР ЧИСЕЛ (HOVER) ---
// 	const hoverProvider = vscode.languages.registerHoverProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideHover(document, position) {
// 				const range = document.getWordRangeAtPosition(position, /([xXbBoO]"[0-9a-fA-F_]+"|[0-9]+#[0-9a-fA-F_]+#|\b[0-9_]+\b)/);
// 				if (!range) return undefined;

// 				let raw = document.getText(range).toLowerCase().replace(/_/g, '');
// 				let dec: bigint | undefined; // Используем BigInt вместо number

// 				try {
// 					if (raw.startsWith('x"')) dec = BigInt("0x" + raw.slice(2, -1));
// 					else if (raw.startsWith('b"')) dec = BigInt("0b" + raw.slice(2, -1));
// 					else if (raw.startsWith('o"')) dec = BigInt("0o" + raw.slice(2, -1));
// 					else if (raw.includes('#')) {
// 						const parts = raw.split('#');
// 						const base = parts[0];
// 						const val = parts[1];
// 						if (base === '16') dec = BigInt("0x" + val);
// 						else if (base === '2') dec = BigInt("0b" + val);
// 						else if (base === '8') dec = BigInt("0o" + val);
// 						else dec = BigInt(parseInt(val, parseInt(base)));
// 					} else if (/^\d+$/.test(raw)) {
// 						dec = BigInt(raw);
// 					}
// 				} catch (e) {
// 					return undefined; // Если число слишком кривое для BigInt
// 				}

// 				if (dec === undefined) return undefined;

// 				const numColor = "#B5CEA8";
// 				// BigInt.toString() никогда не использует экспоненциальную форму
// 				const hexVal = dec.toString(16).toUpperCase();
// 				const decVal = dec.toString(10);
// 				const octVal = dec.toString(8);
// 				const binVal = dec.toString(2);

// 				const md = new vscode.MarkdownString();
// 				md.isTrusted = true;
// 				md.supportHtml = true;

// 				md.appendMarkdown(`
// <div style="margin-top: 0; margin-bottom: 0; padding: 0;">
//     <span style="font-weight: bold;">🔢 Number Converter</span>
// </div>
// <div style="border-top: 1px solid #555; margin-top: 4px; margin-bottom: 4px;"></div>
// \n`);

// 				md.appendMarkdown(`| | |\n`);
// 				md.appendMarkdown(`| :--- | :--- |\n`);
// 				md.appendMarkdown(`| <code>Hex</code> | <span style="color:${numColor};"><code>x"${hexVal}"</code></span> |\n`);
// 				md.appendMarkdown(`| <code>Dec</code> | <span style="color:${numColor};"><code>${decVal}</code></span> |\n`);
// 				md.appendMarkdown(`| <code>Oct</code> | <span style="color:${numColor};"><code>o"${octVal}"</code></span> |\n`);
// 				md.appendMarkdown(`| <code>Bin</code> | <span style="color:${numColor};"><code>b"${binVal}"</code></span> |\n`);

// 				return new vscode.Hover(md);
// 			}
// 		}
// 	);

// 	// --- ФУНКЦИЯ 4: АТРИБУТЫ ---
// 	const attrProvider = vscode.languages.registerCompletionItemProvider(
// 		{ language: 'vhdl' },
// 		{
// 			provideCompletionItems(document, position) {
// 				const linePrefix = document.lineAt(position).text.substr(0, position.character);
// 				if (!linePrefix.endsWith("'")) return undefined;
// 				const attrs = ['event', 'range', 'length', 'left', 'right', 'high', 'low', 'image', 'active'];
// 				return attrs.map(a => {
// 					const item = new vscode.CompletionItem(a, vscode.CompletionItemKind.Property);
// 					item.detail = "VHDL Attribute";
// 					return item;
// 				});
// 			}
// 		},
// 		"'"
// 	);

// 	context.subscriptions.push(semanticProvider, defProvider, hoverProvider, attrProvider);
// }

// export function deactivate() { }



import * as vscode from 'vscode';

/** 
 * Порядок токенов (должен строго совпадать с package.json)
 */
const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant', 'fsmState'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

/** Стандартные функции библиотек IEEE */
const stdFunctions = new Set([
	'rising_edge', 'falling_edge', 'to_integer', 'to_unsigned', 'to_signed',
	'resize', 'std_match', 'abs', 'now', 'write', 'hwrite', 'read', 'hread',
	'writeline', 'readline', 'unsigned', 'signed', 'shift_left', 'shift_right',
	'rotate_left', 'rotate_right', 'to_stdlogicvector'
]);

export function activate(context: vscode.ExtensionContext) {

	// --- ФУНКЦИЯ 1: СЕМАНТИЧЕСКАЯ ПОДСВЕТКА ---
	const semanticProvider = vscode.languages.registerDocumentSemanticTokensProvider(
		{ language: 'vhdl' },
		{
			provideDocumentSemanticTokens(document: vscode.TextDocument) {
				const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
				const text = document.getText();

				// 1. Поиск зон игнорирования (тела функций и процедур)
				const ignoreZones: { start: number, end: number }[] = [];
				const subProgramRegex = /\b(function|procedure)\b[\s\S]*?\bend\s+\1\b/gi;
				let m: RegExpExecArray | null;
				while ((m = subProgramRegex.exec(text)) !== null) {
					ignoreZones.push({ start: m.index, end: m.index + m[0].length });
				}
				const isInsideIgnoreZone = (offset: number) => ignoreZones.some(z => offset >= z.start && offset <= z.end);

				// Хранилища имен
				const inPorts = new Set<string>();
				const outPorts = new Set<string>();
				const functions = new Set<string>();
				const vhdlTypes = new Set<string>();
				const vhdlVariables = new Set<string>();
				const vhdlSignals = new Set<string>();
				const vhdlConstants = new Set<string>();
				const fsmStates = new Set<string>();

				// Предопределенные константы
				['output', 'input', 'line', 'text', 'true', 'false'].forEach(c => vhdlConstants.add(c));

				// 2. Сбор объявлений
				const patterns = {
					fsm: /type\s+[a-z0-9_]+\s+is\s*\(([^)]+)\)/gi,
					in: /\b([a-z0-9_]+)\s*:\s*in\b/gi,
					out: /\b([a-z0-9_]+)\s*:\s*out\b/gi,
					func: /\bfunction\s+([a-z0-9_]+)\b/gi,
					type: /\btype\s+([a-z0-9_]+)\b/gi,
					var: /\bvariable\s+([a-z0-9_]+)\b/gi,
					sig: /\bsignal\s+([a-z0-9_]+)\b/gi,
					const: /\bconstant\s+([a-z0-9_]+)\b/gi
				};

				// Парсим FSM (с очисткой комментариев внутри скобок)
				while ((m = patterns.fsm.exec(text)) !== null) {
					m[1].split(',').forEach(s => {
						const state = s.replace(/--.*$/gm, '').trim().split(/\s+/)[0].toLowerCase();
						if (state) fsmStates.add(state);
					});
				}

				// Остальные объявления
				while ((m = patterns.in.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) inPorts.add(m[1].toLowerCase());
				while ((m = patterns.out.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) outPorts.add(m[1].toLowerCase());
				while ((m = patterns.func.exec(text)) !== null) functions.add(m[1].toLowerCase());
				while ((m = patterns.type.exec(text)) !== null) vhdlTypes.add(m[1].toLowerCase());
				while ((m = patterns.var.exec(text)) !== null) if (!isInsideIgnoreZone(m.index)) vhdlVariables.add(m[1].toLowerCase());
				while ((m = patterns.sig.exec(text)) !== null) vhdlSignals.add(m[1].toLowerCase());
				while ((m = patterns.const.exec(text)) !== null) vhdlConstants.add(m[1].toLowerCase());

				// 3. Раскраска использований
				for (let i = 0; i < document.lineCount; i++) {
					const lineText = document.lineAt(i).text;
					const wordsRegex = /\b([a-z0-9_]+)\b/gi;

					while ((m = wordsRegex.exec(lineText)) !== null) {
						const word = m[1].toLowerCase();
						const wordStart = m.index;
						const charAfter = lineText[wordStart + word.length];

						// Пропускаем префиксы литералов
						if ((word === 'x' || word === 'b' || word === 'o') && charAfter === '"') continue;

						const globalOffset = document.offsetAt(new vscode.Position(i, wordStart));
						if (lineText.indexOf('--') !== -1 && lineText.indexOf('--') < wordStart) continue;
						if ((lineText.substring(0, wordStart).split('"').length - 1) % 2 !== 0) continue;

						const inside = isInsideIgnoreZone(globalOffset);

						if (functions.has(word) || stdFunctions.has(word)) tokensBuilder.push(i, wordStart, word.length, 2, 0);
						else if (fsmStates.has(word)) tokensBuilder.push(i, wordStart, word.length, 7, 0);
						else if (vhdlTypes.has(word)) tokensBuilder.push(i, wordStart, word.length, 3, 0);
						else if (vhdlConstants.has(word)) tokensBuilder.push(i, wordStart, word.length, 6, 0);
						else if (!inside) {
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

	// --- ФУНКЦИЯ 2: ПЕРЕХОД К ОПРЕДЕЛЕНИЮ ---
	const defProvider = vscode.languages.registerDefinitionProvider(
		{ language: 'vhdl' },
		{
			provideDefinition(document, position) {
				const range = document.getWordRangeAtPosition(position);
				if (!range) return null;
				const word = document.getText(range).toLowerCase();
				const text = document.getText();
				const lines = text.split(/\r?\n/);

				const decPatterns = [
					new RegExp(`\\b${word}\\s*:\\s*(in|out|buffer|inout|signal|variable|constant)\\b`, 'i'),
					new RegExp(`\\b(signal|variable|constant|type|subtype|component|function|procedure|entity|architecture)\\s+${word}\\b`, 'i'),
					new RegExp(`\\b${word}\\s*:\\s*(entity|component|configuration)\\b`, 'i')
				];

				for (let i = 0; i < lines.length; i++) {
					const lineText = lines[i];
					if (lineText.indexOf('--') !== -1 && lineText.indexOf('--') < lineText.toLowerCase().indexOf(word)) continue;
					for (const p of decPatterns) {
						if (p.test(lineText)) return new vscode.Location(document.uri, new vscode.Position(i, lineText.toLowerCase().indexOf(word)));
					}
				}
				return null;
			}
		}
	);

	// --- ФУНКЦИЯ 3: АТРИБУТЫ ---
	const attrProvider = vscode.languages.registerCompletionItemProvider(
		{ language: 'vhdl' },
		{
			provideCompletionItems(document, position) {
				const line = document.lineAt(position).text.substr(0, position.character);
				if (!line.endsWith("'")) return undefined;
				return ['event', 'range', 'length', 'left', 'right', 'high', 'low', 'image', 'active'].map(a => {
					const item = new vscode.CompletionItem(a, vscode.CompletionItemKind.Property);
					item.detail = "VHDL Attribute";
					return item;
				});
			}
		},
		"'"
	);

	// --- ФУНКЦИЯ 4: КОНВЕРТЕР ЧИСЕЛ (HOVER) ---
	const hoverProvider = vscode.languages.registerHoverProvider(
		{ language: 'vhdl' },
		{
			provideHover(document, position) {
				const range = document.getWordRangeAtPosition(position, /([xXbBoO]"[0-9a-fA-F_]+"|[0-9]+#[0-9a-fA-F_]+#|\b[0-9_]+\b)/);
				if (!range) return undefined;

				const raw = document.getText(range).toLowerCase().replace(/_/g, '');
				let dec: bigint | undefined;

				try {
					if (raw.startsWith('x"')) dec = BigInt("0x" + raw.slice(2, -1));
					else if (raw.startsWith('b"')) dec = BigInt("0b" + raw.slice(2, -1));
					else if (raw.startsWith('o"')) dec = BigInt("0o" + raw.slice(2, -1));
					else if (raw.includes('#')) {
						const [base, val] = raw.split('#');
						if (base === '16') dec = BigInt("0x" + val);
						else if (base === '2') dec = BigInt("0b" + val);
						else if (base === '8') dec = BigInt("0o" + val);
						else dec = BigInt(val);
					} else if (/^\d+$/.test(raw)) dec = BigInt(raw);
				} catch { return undefined; }

				if (dec === undefined) return undefined;

				const numColor = "#B5CEA8";
				const md = new vscode.MarkdownString();
				md.isTrusted = true;
				md.supportHtml = true;

				md.appendMarkdown
					(`
<div style="margin-top:0;margin-bottom:0;padding:0;"><span style="font-weight:bold;">🔢 Number Converter</span></div>
<div style="border-top:1px solid #555;margin-top:4px;margin-bottom:8px;"></div>
<table style="border-collapse: collapse;">
<tr><td style="padding-right:10px;"><code>Hex</code></td><td><span style="color:${numColor};"><code>x"${dec.toString(16).toUpperCase()}"</code></span></td></tr>
<tr><td style="padding-right:10px;"><code>Dec</code></td><td><span style="color:${numColor};"><code>${dec.toString(10)}</code></span></td></tr>
<tr><td style="padding-right:10px;"><code>Oct</code></td><td><span style="color:${numColor};"><code>o"${dec.toString(8)}"</code></span></td></tr>
<tr><td style="padding-right:10px;"><code>Bin</code></td><td><span style="color:${numColor};"><code>b"${dec.toString(2)}"</code></span></td></tr>
</table>`
					);

				return new vscode.Hover(md);
			}
		}
	);

	context.subscriptions.push(semanticProvider, defProvider, hoverProvider, attrProvider);
}

export function deactivate() { }