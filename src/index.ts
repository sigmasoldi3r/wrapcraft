/**
 * Wrapcraft
 *
 * A minecraft server wrapper library.
 *
 * By sigmasoldi3r
 */
import * as cp from 'child_process';
import * as EventEmitter from 'events';
import * as path from 'path';
import * as rl from 'readline';
import * as chalk from 'chalk';

export class ServerFactoryError extends Error {}

/**
 * A physical block information.
 */
export interface BlockData {}

/**
 * Hexadecimal character.
 */
export type HexChar =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'A'
  | 'a'
  | 'B'
  | 'b'
  | 'C'
  | 'c'
  | 'D'
  | 'd'
  | 'E'
  | 'e'
  | 'F'
  | 'F';

/**
 * Supported literal colors.
 * 32-bit hexadecimal (Eg: #B00BA1) are supported, but cannot be represented by
 * a type due to the complexity.
 */
export type TellColor =
  | 'black'
  | 'dark_blue'
  | 'dark_green'
  | 'dark_aqua'
  | 'dark_red'
  | 'dark_purple'
  | 'gold'
  | 'gray'
  | 'dark_gray'
  | 'blue'
  | 'green'
  | 'aqua'
  | 'red'
  | 'light_purple'
  | 'yellow'
  | 'white'
  | 'reset'
  | `#${HexChar}${HexChar}${HexChar}`;

/**
 * A tellraw command data structure object.
 */
export interface TellDataObject {
  text: string;
  color?: TellColor;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
  insertion?: string;
  font?: string;
  extra?: (TellDataObject | string | boolean | number)[];
  clickEvent?: {
    action:
      | 'open_url'
      | 'open_file'
      | 'run_command'
      | 'suggest_command'
      | 'change_page'
      | 'copy_to_clipboard';
    value: string;
  };
  hoverEvent?: { value: string } & (
    | {
        action: 'show_text';
        contents: TellData;
      }
    | {
        action: 'show_item';
        contents: {
          id: string;
          count?: number;
          tag?: string;
        };
      }
    | {
        action: 'show_entity';
        contents: {
          name?: TellData;
          type: string;
          id: string;
        };
      }
  );
}

/**
 * Expected types for tellraw data command.
 */
export type TellData =
  | TellDataObject
  | TellDataObject[]
  | string
  | boolean
  | number;

/**
 * Supported suffixes for memory size.
 */
export type MemoryUnit = 'M' | 'G';

/**
 * A server builder object, configures the spawning of
 * the process based on the command and extra arguments.
 */
export class ServerFactoryBuilder {
  private _file?: string;
  private _command = 'java';
  private _jarSpec = '-jar';
  private _gui = false;
  private _maxMemory?: [number, MemoryUnit];
  private _minMemory?: [number, MemoryUnit];
  private _printOut = true;
  private _printErr = true;
  private _args: any[] = [];

  /**
   * Jarfile setter.
   */
  file(file: string) {
    this._file = file;
    return this;
  }

  /**
   * Command setter.
   */
  command(command: string) {
    this._command = command;
    return this;
  }

  /**
   * Adds a single argument to the list.
   * @param arg The argument to be added
   */
  arg(arg: any) {
    this._args.push(arg);
    return this;
  }

  /**
   * Adds many arguments to the list.
   * @param args The list of arguments to be appended.
   */
  args(args: any[]) {
    this._args.push(...args);
    return this;
  }

  /**
   * Sets the GUI enabled or disabled.
   */
  gui(enabled: boolean) {
    this._gui = enabled;
    return this;
  }

  /**
   * Enables or disables the output printing via stdout.
   */
  printOutput(enabled: boolean = true) {
    this._printOut = enabled;
    return this;
  }

  /**
   * Enables or disables the error printing via stderr.
   */
  printErrors(enabled: boolean = true) {
    this._printErr = enabled;
    return this;
  }

  /**
   * Sets the maximum memory.
   * @param value The value of the memory.
   * @param unit The unit to use.
   */
  maxMemory(value: number, unit: MemoryUnit = 'M') {
    this._maxMemory = [value, unit];
    return this;
  }

  /**
   * Sets the minimum memory.
   * @param value The value of the memory.
   * @param unit The unit to use.
   */
  minMemory(value: number, unit: MemoryUnit = 'M') {
    this._minMemory = [value, unit];
    return this;
  }

  /**
   * Builds the server instance.
   */
  build() {
    if (this._file == null) {
      throw new ServerFactoryError(
        'Attempting to build a server process without a file!'
      );
    }
    const extra: string[] = [];
    if (!this._gui) {
      extra.push('nogui');
    }
    if (this._maxMemory != null) {
      extra.push(`-Xmx${this._maxMemory.join('')}`);
    }
    if (this._minMemory != null) {
      extra.push(`-Xms${this._minMemory.join('')}`);
    }
    return new ServerFactory(
      this._file,
      this._command,
      this._jarSpec,
      [extra, ...this._args],
      this._printOut,
      this._printErr
    );
  }
}

/**
 * Server descriptor, it does not represent a running server.
 */
export class ServerFactory {
  constructor(
    readonly file: string,
    readonly command: string,
    readonly jarSpec: string,
    readonly args: any[],
    readonly printOutput: boolean,
    readonly printErrors: boolean
  ) {}

  /**
   * @returns The command string.
   */
  private buildCommandString() {
    return `${this.command} ${this.jarSpec} ${this.file} ${this.args.join(
      ' '
    )}`;
  }

  /**
   * Spawns the server instance process.
   */
  spawn(cwd: string = path.dirname(this.file)) {
    return new Server(
      cp.exec(this.buildCommandString(), { cwd }),
      this.printOutput,
      this.printErrors
    );
  }
}

/**
 * Server running instance.
 *
 * Once a server is killed, the instance must be disposed, as will no longer accept
 * incoming messages nor output outcoming ones.
 */
export class Server {
  /**
   * Spawns the server process, without returning the factory.
   * @param file The jar file that contains the server binaries.
   * @param args Extra and optional arguments can be passed.
   * @returns
   */
  static spawn(file: string, ...args: any[]) {
    return this.create(file, ...args).spawn();
  }

  /**
   * Creates a server factory, which can be used to spawn server processes.
   * @param file The jar file that contains the server binaries.
   * @param args Extra and optional arguments can be passed.
   */
  static create(file: string, ...args: any[]) {
    return new ServerFactoryBuilder().file(file).args(args).build();
  }

  constructor(
    private readonly process: cp.ChildProcess,
    stdout: boolean,
    stderr: boolean
  ) {
    this.reader = rl.createInterface({
      input: process.stdout,
      output: process.stdin,
    });
    if (stdout) {
      process.stdout.on('data', data => global.process.stdout.write(chalk.gray(data)));
    }
    if (stderr) {
      process.stderr.on('data', data => global.process.stderr.write(chalk.red(data)));
    }
    process.once('exit', code => this.events.emit('stop', code));
    this.reader.on('line', line => this.events.emit('message', line));
    this.ready = new Promise(async r => {
      await this.when(/Done \(.+?s\)! For help, type "help"/);
      r(this);
    });
  }

  private readonly reader: rl.Interface;
  private readonly events = new EventEmitter();
  stopped = false;
  readonly ready: Promise<Server>;

  /**
   * Subscribes the given listener to any outcoming server messages.
   * @param fn The listener.
   */
  on(event: 'message', fn: (line: string) => void): Server;
  on(event: 'stop', fn: (code: number) => void): Server;
  on(event: 'ready', fn: () => void): Server;
  on(event: string, fn: (...args: any[]) => void) {
    this.events.on(event, fn);
    return this;
  }

  /**
   * Unsubscribes the given listener from any outcoming server messages.
   * @param fn The listener.
   */
  off(event: 'message', fn: (line: string) => void): Server;
  off(event: 'stop', fn: (code: number) => void): Server;
  off(event: 'ready', fn: () => void): Server;
  off(event: string, fn: (...args: any[]) => void) {
    this.events.off(event, fn);
    return this;
  }

  /**
   * Returns a promise that resolves once the given regular expression
   * matches the output, which can potentially never be.
   */
  when(matcher: RegExp) {
    return new Promise<RegExpMatchArray>(r => {
      const listener = (line: string) => {
        const match = line.match(matcher);
        if (match != null) {
          r(match);
          this.off('message', listener);
        }
      };
      this.on('message', listener);
    });
  }

  /**
   * Subscribes to messages that match the matcher regular expression.
   */
  each(matcher: RegExp, listener: (result: RegExpMatchArray) => void) {
    this.on('message', line => {
      const match = line.match(matcher);
      if (match != null) {
        listener(match);
      }
    });
  }

  /**
   * Sends a message to the process.
   * @param message
   */
  send(message: string) {
    this.process.stdin.write(message + '\n');
    return this;
  }

  /**
   * Creates a single promise that resolves on the next line.
   */
  line() {
    return new Promise<string>(r => {
      this.events.once('message', r);
    });
  }

  /**
   * Executes an RPC-like call, sending a message and awaiting the return
   * of the server.
   */
  command(command: string, parse = false) {
    this.send(command);
    return this.line();
  }

  /**
   * Gets the block data at the given point.
   * If there is any problem related to the output, returns null.
   * @see https://minecraft.fandom.com/wiki/Commands/data
   */
  async getBlockData(
    x: number,
    y: number,
    z: number
  ): Promise<BlockData | null> {
    const response = await this.data('get', 'block', x, y, z);
    const match = response.match(/^.+?({.+?})$/);
    if (match == null) return null;
    return eval(`(${match[1]})`);
  }

  /**
   * Performs a data query to the server.
   * @param operation The operation type.
   * @param type Type of data to inspect.
   * @param args Extra arguments based on query parameters.
   * @returns Plain result of the query.
   * @see https://minecraft.fandom.com/wiki/Commands/data
   */
  async data(
    operation: 'get' | 'merge' | 'remove' | 'modify',
    type: 'block' | 'entity' | 'storage',
    ...args: any[]
  ): Promise<string> {
    return this.command(`data ${operation} ${type} ${args.join(' ')}`);
  }

  /**
   * Performs a simple say command on the server.
   * @param message The message to say by the server.
   */
  async say(message: string) {
    return this.command(`say ${message}`);
  }

  /**
   * Tells to the target the given message.
   * @param target Who will receive the message.
   * @param message The message data to be sent.
   */
  async tell(target: string, message: TellData) {
    return this.command(`tellraw ${target} ${JSON.stringify(message)}`);
  }

  /**
   * Emits a stop signal to the process and resolves once done.
   */
  stop() {
    return new Promise(r => {
      this.events.once('stop', r);
      this.send('stop');
    });
  }
}
