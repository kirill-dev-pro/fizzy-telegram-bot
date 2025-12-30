import { Axiom } from "@axiomhq/js";

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  constructor() {
    this.axiom = null;
    this.dataset = process.env.AXIOM_DATASET || "fizzy-telegram-bot";
    this.minLevel = LOG_LEVELS[process.env.LOG_LEVEL || "info"];
    this.initializeAxiom();
  }

  initializeAxiom() {
    const token = process.env.AXIOM_API_TOKEN;
    const orgId = process.env.AXIOM_ORG_ID;

    if (!token) {
      this.logToConsole(
        "warn",
        "AXIOM_API_TOKEN not set - logs will only go to stdout",
        {}
      );
      return;
    }

    try {
      const config = { token };
      if (orgId) {
        config.orgId = orgId;
      }

      this.axiom = new Axiom(config);
      this.logToConsole("info", "Axiom client initialized", {
        dataset: this.dataset,
      });
    } catch (error) {
      this.logToConsole("error", "Failed to initialize Axiom client", {
        error: error.message,
      });
    }
  }

  logToConsole(level, message, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };
    console.log(JSON.stringify(logEntry));
  }

  async log(level, message, context = {}) {
    if (LOG_LEVELS[level] < this.minLevel) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: "fizzy-telegram-bot",
      ...context,
    };

    // Always log to stdout
    console.log(JSON.stringify(logEntry));

    // Send to Axiom if available
    if (this.axiom) {
      try {
        await this.axiom.ingest(this.dataset, [logEntry]);
      } catch (error) {
        // Log Axiom ingestion errors to stdout only (avoid infinite loop)
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            message: "Failed to ingest log to Axiom",
            error: error.message,
            originalLog: logEntry,
          })
        );
      }
    }
  }

  debug(message, context = {}) {
    return this.log("debug", message, context);
  }

  info(message, context = {}) {
    return this.log("info", message, context);
  }

  warn(message, context = {}) {
    return this.log("warn", message, context);
  }

  error(message, context = {}) {
    return this.log("error", message, context);
  }

  command(command, status, details = "", sender = null) {
    const context = {
      command,
      status,
      component: "bot",
    };

    if (details) {
      context.details = details;
    }

    if (sender) {
      context.sender = sender;
    }

    // Map command status to appropriate log level
    let level;
    if (status === "error" || status === "failed") {
      level = "error";
    } else if (status === "warning") {
      level = "warn";
    } else if (status === "validation") {
      level = "info";
    } else {
      level = "info";
    }

    const message = `Command ${command} ${status}`;

    return this.log(level, message, context);
  }

  // Flush any pending logs (useful for graceful shutdown)
  async flush() {
    if (this.axiom) {
      try {
        await this.axiom.flush();
      } catch (error) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            message: "Failed to flush Axiom logs",
            error: error.message,
          })
        );
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger();
