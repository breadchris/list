import { ConsoleEntry } from './JsConsole';

export class JsExecutor {
  private consoleEntries: ConsoleEntry[] = [];
  private onConsoleUpdate: (entries: ConsoleEntry[]) => void;
  private originalConsole: Console;

  constructor(onConsoleUpdate: (entries: ConsoleEntry[]) => void) {
    this.onConsoleUpdate = onConsoleUpdate;
    this.originalConsole = window.console;
  }

  private addConsoleEntry(type: ConsoleEntry['type'], message: string) {
    const entry: ConsoleEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: new Date()
    };
    this.consoleEntries.push(entry);
    this.onConsoleUpdate([...this.consoleEntries]);
  }

  private createMockConsole(): Console {
    return {
      ...this.originalConsole,
      log: (...args: any[]) => {
        const message = args.map(arg => this.formatValue(arg)).join(' ');
        this.addConsoleEntry('log', message);
        this.originalConsole.log(...args);
      },
      error: (...args: any[]) => {
        const message = args.map(arg => this.formatValue(arg)).join(' ');
        this.addConsoleEntry('error', message);
        this.originalConsole.error(...args);
      },
      warn: (...args: any[]) => {
        const message = args.map(arg => this.formatValue(arg)).join(' ');
        this.addConsoleEntry('warn', message);
        this.originalConsole.warn(...args);
      },
      info: (...args: any[]) => {
        const message = args.map(arg => this.formatValue(arg)).join(' ');
        this.addConsoleEntry('info', message);
        this.originalConsole.info(...args);
      }
    } as Console;
  }

  private formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'function') return value.toString();
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return value.toString();
      }
    }
    return String(value);
  }

  async executeCode(code: string): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Clear previous entries
      this.consoleEntries = [];
      this.onConsoleUpdate([]);

      // Create a mock console for capturing output
      const mockConsole = this.createMockConsole();

      // Create an execution context with globals
      const context = {
        console: mockConsole,
        supabase: (window as any).supabase,
        createClient: (window as any).createClient,
        SUPABASE_URL: (window as any).SUPABASE_URL,
        SUPABASE_ANON_KEY: (window as any).SUPABASE_ANON_KEY,
        // Add other safe globals if needed
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        Promise,
        Date,
        JSON,
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean
      };

      // Wrap code in an async function to support await
      const wrappedCode = `
        (async function() {
          ${code}
        })();
      `;

      // Create function with the context
      const func = new Function(...Object.keys(context), `return ${wrappedCode}`);
      
      // Execute with context values
      const result = await func(...Object.values(context));
      
      // If there's a result, log it
      if (result !== undefined) {
        mockConsole.log('Result:', result);
      }

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addConsoleEntry('error', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  clearConsole() {
    this.consoleEntries = [];
    this.onConsoleUpdate([]);
  }

  getConsoleEntries(): ConsoleEntry[] {
    return [...this.consoleEntries];
  }
}