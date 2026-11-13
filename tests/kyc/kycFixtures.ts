/** A small but valid-looking JPEG data URI (real JPEG signature, > 2 KB). */
export const selfieDataUri = (fill = 7) => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3000, fill)]).toString("base64")}`;
