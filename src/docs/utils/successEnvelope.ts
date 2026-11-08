// Wraps a data schema in the standard handleSuccess envelope.
const successEnvelope = ({
    message,
    code,
    dataRef,
}: {
    message: string;
    code: number;
    dataRef: string;
}) => {
    const schema = {
        type: "object",
        required: ["message", "code", "data"],
        properties: {
            message: { type: "string", example: message },
            code: { type: "integer", example: code },
            data: { $ref: dataRef },
        },
    };

    return schema;
};

export default successEnvelope;
