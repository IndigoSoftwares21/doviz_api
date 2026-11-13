const DATA_URI = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;
const MIN_BYTES = 2_000;

/**
 * A JPEG or PNG sent as a base64 data URI, checked by its actual bytes (the
 * file signature), not just its label. null when it isn't one, or its size is
 * outside [2 KB, maxBytes].
 */
const parseImageDataUri = ({ value, maxBytes }: { value: string; maxBytes: number }) => {
    const match = DATA_URI.exec(value);
    if (!match) return null;
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length < MIN_BYTES || bytes.length > maxBytes) return null;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if ((match[1] === "jpeg" && !isJpeg) || (match[1] === "png" && !isPng)) return null;
    return { mimeType: `image/${match[1]}`, bytes };
};

export default parseImageDataUri;
