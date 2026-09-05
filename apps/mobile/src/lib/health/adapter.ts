import { unavailable, type HealthPort } from './port';

/** Web and anything without a native health store: photo proofs only. */
export const health: HealthPort = unavailable;
