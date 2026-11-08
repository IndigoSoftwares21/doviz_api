// src/utils/monitoring/index.ts

/**
 * A utility module for logging and monitoring application events.
 */

/**
 * Logs an error message with additional error details.
 * @param message - The error message to log
 * @param error - The error object containing details (e.g., stack trace)
 */
export function error(message: string, error: Error): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`, {
        error: {
            message: error?.message,
            stack: error?.stack
        }
    });
    // Optionally, integrate with an external monitoring service (e.g., Sentry, Loggly)
    // Example: sentry.captureException(error, { extra: { message } });
}

/**
 * Logs an informational message.
 * @param message - The message to log
 * @param data - Optional additional data to include in the log
 */
export function info(message: string, data?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    if (data) {
        console.info(`[${timestamp}] [INFO] ${message}`, data);
    } else {
        console.info(`[${timestamp}] [INFO] ${message}`);
    }
}

/**
 * Logs a warning message.
 * @param message - The warning message to log
 * @param data - Optional additional data to include in the log
 */
export function warn(message: string, data?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    if (data) {
        console.warn(`[${timestamp}] [WARN] ${message}`, data);
    } else {
        console.warn(`[${timestamp}] [WARN] ${message}`);
    }
}

/**
 * Logs a debug message, only if debugging is enabled.
 * @param message - The debug message to log
 * @param data - Optional additional data to include in the log
 * @param isDebugEnabled - Flag to enable/disable debug logging (default: false)
 */
export function debug(
    message: string,
    data?: Record<string, any>,
    isDebugEnabled: boolean = false
): void {
    if (!isDebugEnabled) return;
    const timestamp = new Date().toISOString();
    if (data) {
        console.debug(`[${timestamp}] [DEBUG] ${message}`, data);
    } else {
        console.debug(`[${timestamp}] [DEBUG] ${message}`);
    }
}

// Optional: Export a default object if you prefer that style
export default {
    error,
    info,
    warn,
    debug
};