declare module 'better-sqlite3' {
  export interface Options {
    readonly?: boolean;
    fileMustExist?: boolean;
  }

  interface Statement {
    all(...params: unknown[]): any[];
    get(...params: unknown[]): any;
    run(...params: unknown[]): any;
  }

  interface Database {
    prepare(sql: string): Statement;
    pragma(sql: string, options?: { simple?: boolean }): any;
    backup(destination: string, options?: unknown): Promise<{ totalPages: number; remainingPages: number }>;
    close(): void;
  }

  interface DatabaseConstructor {
    new (filename: string, options?: Options): Database;
  }

  const Database: DatabaseConstructor;
  export default Database;
}
