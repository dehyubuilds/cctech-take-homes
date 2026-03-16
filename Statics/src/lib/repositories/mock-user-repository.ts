import type { User } from "@/lib/domain";
import { seedUsers } from "@/lib/seed-data";

const users = new Map<string, User>(
  seedUsers.map((u) => [u.userId, { ...u }])
);
const byEmail = new Map<string, User>(
  seedUsers.map((u) => [u.email.toLowerCase(), u])
);

export function getMockUserRepository() {
  return {
    async getById(userId: string): Promise<User | null> {
      return users.get(userId) ?? null;
    },
    async getByEmail(email: string): Promise<User | null> {
      return byEmail.get(email.toLowerCase()) ?? null;
    },
    async getByPhone(phone: string): Promise<User | null> {
      const normalized = phone.replace(/\D/g, "");
      return Array.from(users.values()).find(
        (u) => u.phoneNumber && u.phoneNumber.replace(/\D/g, "") === normalized
      ) ?? null;
    },
    async listByPhone(phone: string): Promise<User[]> {
      const normalized = phone.replace(/\D/g, "");
      return Array.from(users.values()).filter(
        (u) => u.phoneNumber && u.phoneNumber.replace(/\D/g, "") === normalized
      );
    },
    async list(): Promise<User[]> {
      return Array.from(users.values());
    },
    async update(userId: string, patch: Partial<User>): Promise<User | null> {
      const u = users.get(userId);
      if (!u) return null;
      const updated = { ...u, ...patch, updatedAt: new Date().toISOString() };
      users.set(userId, updated);
      byEmail.set(u.email.toLowerCase(), updated);
      return updated;
    },
    async create(user: User): Promise<User> {
      users.set(user.userId, user);
      byEmail.set(user.email.toLowerCase(), user);
      return user;
    },
  };
}
