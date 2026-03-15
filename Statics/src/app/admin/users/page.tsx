"use client";

import { useEffect, useState } from "react";
import { getStoredToken } from "@/components/AuthProvider";
import type { User } from "@/lib/domain";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => setUsers([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Users</h1>
      <p className="mt-1 text-gray-400">Manage users and subscription status.</p>
      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-surface-muted">
            <tr>
              <th className="p-3 font-medium text-white">Email</th>
              <th className="p-3 font-medium text-white">Phone</th>
              <th className="p-3 font-medium text-white">Role</th>
              <th className="p-3 font-medium text-white">SMS status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-white/5">
                <td className="p-3 text-white">{u.email}</td>
                <td className="p-3 text-gray-400">{u.phoneNumber || "—"}</td>
                <td className="p-3 text-gray-400">{u.role}</td>
                <td className="p-3 text-gray-400">{u.smsStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Admin API: GET /api/admin/users, PATCH /api/admin/users/[userId] for manual subscription/smsStatus updates.
      </p>
    </div>
  );
}
