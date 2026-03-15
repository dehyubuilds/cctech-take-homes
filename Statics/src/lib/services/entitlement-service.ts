import { getSubscriptionRepository } from "@/lib/repositories";
import type { SessionUser } from "./auth-service";

const subRepo = getSubscriptionRepository();

export function getEntitlementService() {
  return {
    async hasSubscription(session: SessionUser | null, appId: string): Promise<boolean> {
      if (!session) return false;
      const sub = await subRepo.getByUserAndApp(session.userId, appId);
      return sub?.status === "active";
    },
  };
}
