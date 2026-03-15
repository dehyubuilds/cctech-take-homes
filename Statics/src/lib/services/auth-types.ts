import type { User } from "@/lib/domain";

export interface SessionUser {
  userId: string;
  email: string;
  role: User["role"];
  user: User;
}
