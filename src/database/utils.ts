/**
 * Gets the first result from a query
 * Similar to the getFirst utility from the MySQL code
 */
export function getFirst<T extends Record<string, any>>(
    query: (...args: any[]) => Promise<T[]>,
    propertyToGet?: string,
    defaultValue: any = null,
) {
    return async (...args: any[]): Promise<any> => {
        const results = await query(...args);
        if (results.length === 0) {
            return defaultValue;
        }

        if (propertyToGet) {
            return results[0][propertyToGet] ?? defaultValue;
        }

        return results[0] ?? defaultValue;
    };
}

/**
 * Gets a specific property from each result
 * Similar to the getProperty utility from the MySQL code
 */
export function getProperty<T extends Record<string, any>>(
    query: (...args: any[]) => Promise<T[]>,
    propertyToGet: string,
    defaultValue: any = null,
) {
    return async (...args: any[]): Promise<any[]> => {
        const results = await query(...args);
        return results.map((result) => result[propertyToGet] ?? defaultValue);
    };
}

/**
 * Gets the ID of the last inserted row
 * Similar to the getInsertId utility from the MySQL code
 */
export function getInsertId<T extends { id: number | string }>(
    query: (...args: any[]) => Promise<T | null>,
) {
    return async (...args: any[]): Promise<number | string | null> => {
        const result = await query(...args);
        return result?.id ?? null;
    };
}

/**
 * Gets the IDs of all inserted rows
 * Similar to the getInsertIds utility from the MySQL code
 */
export function getInsertIds<T extends { id: number | string }>(
    query: (...args: any[]) => Promise<T[]>,
) {
    return async (...args: any[]): Promise<(number | string)[]> => {
        const results = await query(...args);
        return results.map((result) => result.id);
    };
}

export type Result<T> = {
    success: true;
    data: T;
};

export type Error = {
    success: false;
    error: string;
};

export type ResultOrError<T> = Result<T> | Error;

export const resultOrError = <T extends (...args: any[]) => Promise<any>>(
    fn: T
): (
    ...args: Parameters<T>
) => Promise<ResultOrError<Awaited<ReturnType<T>>>> => {
    return async (...args: Parameters<T>) => {
        try {
            const result = await fn(...args);
            // Handle case where result is null/undefined (no results found)
            if (result === null || result === undefined) {
                return {
                    success: false,
                    error: "No results found",
                };
            }
            return {
                success: true,
                data: result,
            };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    };
};