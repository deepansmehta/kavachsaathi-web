import { GET as getReferral, POST as postReferral } from "../route";

/** Alias for /api/referral/me → same handlers as /api/referral */
export const dynamic = "force-dynamic";
export { getReferral as GET, postReferral as POST };
