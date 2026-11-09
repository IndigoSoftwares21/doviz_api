/**
 * Breet stores our label with a merchant prefix ("Partner_<merchantRef>_<label>"),
 * so match the label exactly or as that suffix — never a partial overlap.
 */
const matchesBreetLabel = ({ breetLabel, label }: { breetLabel: string; label: string }) =>
    breetLabel === label || breetLabel.endsWith(`_${label}`);

export default matchesBreetLabel;
