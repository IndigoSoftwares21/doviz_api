/** `content` for an application/json request or response, with an optional example. */
const jsonContent = ({ schema, example }: { schema: object; example?: object }) => ({
    "application/json": example ? { schema, example } : { schema },
});

export default jsonContent;
