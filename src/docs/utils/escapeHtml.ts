const escapeHtml = ({ value }: { value: string }) => {
    const escaped = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    return escaped;
};

export default escapeHtml;
