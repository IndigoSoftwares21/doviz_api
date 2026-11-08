/**
 * Utility to convert Snake Case types and objects to Camel Case.
 */

// 1. String Transformation Type
export type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
    ? `${T}${Capitalize<SnakeToCamel<U>>}`
    : S;

// 2. Deep camelCase type (objects + arrays)
export type DeepCamelCase<T> = T extends Date
    ? T
    : T extends Array<infer U>
      ? Array<DeepCamelCase<U>>
      : T extends object
        ? {
              [K in keyof T as K extends string
                  ? SnakeToCamel<K>
                  : K]: DeepCamelCase<T[K]>;
          }
        : T;

// Alias for backward compatibility
export type Camelize<T> = DeepCamelCase<T>;

// 3. Runtime Transformation Helper
const isObject = (value: unknown): value is Record<string, unknown> => {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        !(value instanceof RegExp)
    );
};

// 4. Verification of input string format (optimization)
const toCamelCase = (str: string): string =>
    str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const camelizeDeep = <T>(obj: T): unknown => {
    if (Array.isArray(obj)) {
        return obj.map((v) => camelizeDeep(v));
    }

    if (isObject(obj)) {
        const newObj: Record<string, unknown> = {};
        for (const key of Object.keys(obj)) {
            const camelKey = toCamelCase(key);
            newObj[camelKey] = camelizeDeep(obj[key]);
        }
        return newObj;
    }

    return obj;
};

// 5. The Main Utility Function (Runtime conversion + Type cast)
export function camelize<T>(data: T): DeepCamelCase<T> {
    return camelizeDeep(data) as DeepCamelCase<T>;
}

export default camelize;
