import type { Context } from '@deepseek-ai/cordis'

export declare const name = 'todo-reminder'

export interface Config {
  /** Non-todo_write tool-call counts that trigger a reminder; ascending unique integers. */
  thresholds?: number[]
}

export declare function apply(ctx: Context, config: Config): void
