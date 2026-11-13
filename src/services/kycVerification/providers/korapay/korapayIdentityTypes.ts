export interface KorapayMatch {
    match?: boolean | null;
    confidence_rating?: number | string | null;
}

/** POST /identities/ng/bvn → data (only the fields we read — never stored or logged). */
export interface KorapayBvnRecord {
    reference?: string | null;
    gender?: string | null;
    validation?: {
        first_name?: KorapayMatch | null;
        last_name?: KorapayMatch | null;
        date_of_birth?: KorapayMatch | null;
        selfie?: KorapayMatch | null;
    } | null;
}
