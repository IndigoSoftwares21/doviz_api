const getRequiredEnv = ({
    name,
    minLength = 32,
}: {
    name: string;
    minLength?: number;
}) => {
    const value = process.env[name];

    if (!value || value.length < minLength) {
        throw new Error(
            `${name} must be set and at least ${minLength} characters long`,
        );
    }

    return value;
};

export default getRequiredEnv;
