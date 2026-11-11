/** `--name value` and bare `--flag` options after the positional args. */
const parseFlags = (args: string[]) => {
    const positional: string[] = [];
    const flags: Record<string, string | true> = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith("--")) {
            positional.push(arg);
            continue;
        }
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
            flags[arg.slice(2)] = next;
            i++;
        } else flags[arg.slice(2)] = true;
    }
    return { positional, flags };
};

export default parseFlags;
