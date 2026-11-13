import { ActionFailure } from "@/constants/actionFailure";

/** Thrown inside the submission transaction so a refusal rolls back everything — nothing half-saved. */
class KycRefusal extends Error {
    constructor(
        readonly failure: ActionFailure,
        readonly fieldKey: string | null = null,
    ) {
        super(failure);
    }
}

export default KycRefusal;
