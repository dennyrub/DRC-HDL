import * as vscode from 'vscode';

// Порядок токенов (должен строго совпадать с package.json)
const tokenTypes = ['portIn', 'portOut', 'functionName', 'vhdlType', 'vhdlVariable', 'vhdlSignal', 'vhdlConstant', 'fsmState'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

// Стандартные функции библиотек IEEE
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

	// --- ФУНКЦИЯ 5: АВТОЗАМЕНА СИМВОЛОВ (<<, >>, ;;) ---
	const autoReplace = vscode.workspace.onDidChangeTextDocument(event => {
		// Берем последнее изменение
		const change = event.contentChanges[0];
		if (!change) return;

		// Проверяем, что это был ввод текста (а не удаление или замена блока)
		if (change.text.length !== 1) return;

		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = event.document;
		const position = change.range.start.translate(0, 1); // Позиция сразу после ввода

		// Нам нужно посмотреть 2 символа: тот, что только что ввели, и предыдущий
		if (position.character < 2) return;

		const rangeBefore = new vscode.Range(position.translate(0, -2), position);
		const lastTwoChars = document.getText(rangeBefore);

		// Карта замен
		const replacements: { [key: string]: string } = {
			',,': ' <= ',
			'..': ' => ',
			';;': ' := '
		};

		if (replacements[lastTwoChars]) {
			const newText = replacements[lastTwoChars];

			// Применяем замену
			editor.edit(editBuilder => {
				editBuilder.replace(rangeBefore, newText);
			}, { undoStopBefore: false, undoStopAfter: false });
		}
	});

	context.subscriptions.push(autoReplace);

	context.subscriptions.push(semanticProvider, defProvider, hoverProvider, attrProvider);
}

export function deactivate() { }