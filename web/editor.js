import * as monaco from 'monaco-editor/editor/editor.api.js';
import { conf, language } from 'monaco-editor/languages/definitions/cpp/cpp.js';
import 'monaco-editor/editor/browser/coreCommands.js';
import '../node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/editor/contrib/comment/browser/comment.js';
import 'monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import 'monaco-editor/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/editor/contrib/fontZoom/browser/fontZoom.js';
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/editor/contrib/indentation/browser/indentation.js';
import 'monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/editor/contrib/readOnlyMessage/browser/contribution.js';
import 'monaco-editor/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/editor/contrib/tokenization/browser/tokenization.js';
import 'monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/editor/contrib/wordHighlighter/browser/wordHighlighter.js';
import 'monaco-editor/editor/contrib/wordPartOperations/browser/wordPartOperations.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';

self.MonacoEnvironment = {
  getWorker: (_, label) => new Worker('/assets/editor/editor.worker.js', { name: label }),
};
monaco.languages.register({ id: 'c', extensions: ['.c', '.h'], aliases: ['C'] });
monaco.languages.setMonarchTokensProvider('c', language);
monaco.languages.setLanguageConfiguration('c', {
  ...conf,
  autoClosingPairs: conf.autoClosingPairs.map(pair => ({ ...pair, notIn: ['string', 'comment'] })),
  indentationRules: {
    increaseIndentPattern: /^((?!\/\/).)*(\{[^}"']*|\([^)"']*)$/,
    decreaseIndentPattern: /^\s*[})]/,
  },
});

const snippets = [
  ['for', 'for (${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {\n\t$0\n}', 'for 迴圈（請先宣告迴圈變數）'],
  ['if', 'if (${1:condition}) {\n\t$0\n}', 'if 條件'],
  ['ifelse', 'if (${1:condition}) {\n\t${2}\n} else {\n\t$0\n}', 'if / else 條件'],
  ['while', 'while (${1:condition}) {\n\t$0\n}', 'while 迴圈'],
  ['switch', 'switch (${1:value}) {\n\tcase ${2:1}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\t$0\n\t\tbreak;\n}', 'switch 條件'],
];
const functions = [
  ['SYS_Init', 'SYS_Init();', '初始化課堂開發板的時脈與周邊。'],
  ['GPIO_SetMode', 'GPIO_SetMode(${1:PC}, ${2:BIT12}, ${3:GPIO_MODE_OUTPUT});', '設定 GPIO 模式，例如 PC12 輸出。'],
  ['CLK_SysTickDelay', 'CLK_SysTickDelay(${1:1000});', '延遲指定微秒；真板 50MHz 單次上限約 335544μs。'],
  ['CLK_SysTickLongDelay', 'CLK_SysTickLongDelay(${1:1000000});', '分段執行較長的微秒延遲。'],
  ['OpenKeyPad', 'OpenKeyPad();', '初始化九宮格按鍵的 GPIO。'],
  ['ScanKey', 'ScanKey()', '取得按鍵 1～9，沒有按鍵時為 0。'],
  ['ShowSevenSegment', 'ShowSevenSegment(${1:0}, ${2:0});', '顯示一個七段數字。參數為位數與數值。'],
  ['CloseSevenSegment', 'CloseSevenSegment();', '關閉七段顯示器，通常在換位掃描前呼叫。'],
];
monaco.languages.registerCompletionItemProvider('c', {
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    return { suggestions: [...snippets, ...functions].map(([label, insertText, detail], index) => ({
      label, insertText, detail, range,
      kind: index < snippets.length ? monaco.languages.CompletionItemKind.Snippet : monaco.languages.CompletionItemKind.Function,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      sortText: String(index).padStart(2, '0'),
    })) };
  },
});

function defineTheme(theme) {
  const light = theme === 'light';
  const css = getComputedStyle(document.documentElement);
  const color = name => {
    const value = css.getPropertyValue(name).trim();
    // Monaco's token theme requires six-digit colors, including the background.
    return /^#[\da-f]{3}$/i.test(value) ? '#' + [...value.slice(1)].map(char => char + char).join('') : value;
  };
  const token = name => color(name).replace('#', '');
  monaco.editor.defineTheme('arena-' + theme, {
    base: light ? 'vs' : 'vs-dark', inherit: true,
    rules: [
      { token: 'comment', foreground: token('--code-comment') },
      { token: 'keyword', foreground: token('--code-keyword') },
      { token: 'string', foreground: token('--code-string') },
      { token: 'number', foreground: token('--code-number') },
    ],
    colors: {
      'editor.background': color('--editor'),
      'editor.foreground': color('--text'),
      'editorLineNumber.foreground': color('--subtle'),
      'editorLineNumber.activeForeground': color('--text'),
      'editorIndentGuide.background1': color('--border'),
      'editorIndentGuide.activeBackground1': color('--muted'),
      'editor.lineHighlightBackground': color('--card'),
      'editor.selectionBackground': light ? '#caddf5' : '#28466a',
      'editor.inactiveSelectionBackground': light ? '#e0e8f1' : '#283544',
      'editorCursor.foreground': color('--text'),
      'editorWidget.background': color('--card'),
      'editorWidget.border': color('--border'),
    },
  });
  monaco.editor.setTheme('arena-' + theme);
}

export function createWorkbench(host, callbacks) {
  defineTheme(document.documentElement.dataset.theme || 'dark');
  const editor = monaco.editor.create(host, {
    model: null, theme: 'arena-' + document.documentElement.dataset.theme,
    ariaLabel: 'C 程式編輯器', accessibilitySupport: 'on', editContext: false,
    automaticLayout: true, fontFamily: 'Consolas, "Microsoft JhengHei", monospace',
    fontSize: 13, lineHeight: 22, tabSize: 4, insertSpaces: true, detectIndentation: false,
    autoIndent: 'full', autoClosingBrackets: 'languageDefined', autoClosingQuotes: 'languageDefined',
    autoSurround: 'languageDefined', autoClosingDelete: 'auto', autoClosingOvertype: 'auto',
    bracketPairColorization: { enabled: true },
    guides: { indentation: true, bracketPairs: true, highlightActiveIndentation: true },
    folding: true, showFoldingControls: 'always', matchBrackets: 'always',
    minimap: { enabled: false }, scrollBeyondLastLine: false,
    padding: { top: 10, bottom: 10 }, lineNumbersMinChars: 3, glyphMargin: false,
    wordWrap: 'off', roundedSelection: false, occurrencesHighlight: 'singleFile',
    quickSuggestions: { other: true, comments: false, strings: false },
    suggest: { showWords: true, preview: false }, snippetSuggestions: 'top',
    acceptSuggestionOnEnter: 'off', tabCompletion: 'on',
    unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
    readOnlyMessage: { value: 'lab_config.h 由右上角「練習設定」管理。' },
  });
  const models = new Map(), viewStates = new Map();
  let activeKey = '', loading = false;
  function modelFor(labId, name, value) {
    const key = labId + '/' + name;
    if (!models.has(key)) {
      const model = monaco.editor.createModel(value, 'c', monaco.Uri.parse('file:///NUC140/' + key));
      model.updateOptions({ tabSize: 4, insertSpaces: true });
      models.set(key, model);
    }
    return models.get(key);
  }
  function clearDiagnostics() {
    for (const model of models.values()) monaco.editor.setModelMarkers(model, 'gcc', []);
  }
  editor.onDidChangeModelContent(() => {
    if (loading) return;
    clearDiagnostics();
    callbacks.onChange();
  });
  editor.onDidChangeCursorPosition(() => callbacks.onCursor());
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => callbacks.onSave());
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => callbacks.onRun());
  editor.addAction({ id: 'arena.toggleWrap', label: '切換自動換行',
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
    run: () => editor.updateOptions({ wordWrap: editor.getOption(monaco.editor.EditorOption.wordWrap) === 'off' ? 'on' : 'off' }),
  });
  return {
    getValue: () => editor.getValue(),
    getPosition: () => editor.getPosition(),
    setTheme: defineTheme,
    async reindent() {
      if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
      await editor.getAction('editor.action.reindentlines')?.run();
      editor.focus();
    },
    open(labId, name, value, readOnly) {
      loading = true;
      try {
        if (activeKey) viewStates.set(activeKey, editor.saveViewState());
        const model = modelFor(labId, name, value);
        if (model.getValue() !== value) {
          clearDiagnostics();
          model.pushStackElement();
          model.pushEditOperations([], [{ range: model.getFullModelRange(), text: value }], () => null);
          model.pushStackElement();
        }
        activeKey = labId + '/' + name;
        editor.setModel(model);
        editor.updateOptions({ readOnly, domReadOnly: readOnly });
        if (viewStates.has(activeKey)) editor.restoreViewState(viewStates.get(activeKey));
      } finally { loading = false; }
      callbacks.onCursor();
    },
    setDiagnostics(text, labId, files) {
      clearDiagnostics();
      const markers = new Map();
      const pattern = /(?:^|\n)(?:[^\n]*[\\/])?(main\.c|MCU_init\.h|Scankey\.c|Seven_Segment\.c|lab_config\.h):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*([^\n]+)/g;
      for (const match of String(text || '').matchAll(pattern)) {
        const [, name, line, column, level, message] = match;
        if (!markers.has(name)) markers.set(name, []);
        markers.get(name).push({ message, startLineNumber: +line, endLineNumber: +line,
          startColumn: +column, endColumn: +column + 1,
          severity: level === 'warning' ? monaco.MarkerSeverity.Warning : level === 'note' ? monaco.MarkerSeverity.Info : monaco.MarkerSeverity.Error,
        });
      }
      for (const [name, items] of markers) monaco.editor.setModelMarkers(modelFor(labId, name, files[name] || ''), 'gcc', items);
    },
  };
}
