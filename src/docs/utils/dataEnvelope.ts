/** The standard { message, code, data } success envelope around an inline data schema. */
const dataEnvelope = ({ message, code, data }: { message: string; code: number; data: object }) => ({
    type: "object",
    required: ["message", "code", "data"],
    properties: {
        message: { type: "string", example: message },
        code: { type: "integer", example: code },
        data,
    },
});

export default dataEnvelope;
