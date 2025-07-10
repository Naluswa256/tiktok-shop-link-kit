export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose'
}

export interface ILogContext {
  requestId?: string;
  userId?: string;
  videoId?: string;
  jobId?: string;
  service?: string;
  method?: string;
  [key: string]: any;
}

export interface ILogger {
  error(message: string, context?: ILogContext, error?: Error): void;
  warn(message: string, context?: ILogContext): void;
  info(message: string, context?: ILogContext): void;
  debug(message: string, context?: ILogContext): void;
  verbose(message: string, context?: ILogContext): void;
}

export class Logger implements ILogger {
  private context: ILogContext = {};
  private level: LogLevel = LogLevel.INFO;

  constructor(defaultContext?: ILogContext, level?: LogLevel) {
    if (defaultContext) {
      this.context = { ...defaultContext };
    }
    if (level) {
      this.level = level;
    }
  }

  setContext(context: ILogContext): void {
    this.context = { ...this.context, ...context };
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string, context?: ILogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: ILogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: ILogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: ILogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  verbose(message: string, context?: ILogContext): void {
    this.log(LogLevel.VERBOSE, message, context);
  }

  private log(level: LogLevel, message: string, context?: ILogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    };

    // In production, this would integrate with CloudWatch, ELK, etc.
    console.log(JSON.stringify(logEntry));
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.VERBOSE];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }
}

// Factory function for creating loggers
export function createLogger(service: string, context?: ILogContext): Logger {
  return new Logger({ service, ...context }, getLogLevelFromEnv());
}

function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  switch (envLevel) {
    case 'error':
      return LogLevel.ERROR;
    case 'warn':
      return LogLevel.WARN;
    case 'info':
      return LogLevel.INFO;
    case 'debug':
      return LogLevel.DEBUG;
    case 'verbose':
      return LogLevel.VERBOSE;
    default:
      return LogLevel.INFO;
  }
}
