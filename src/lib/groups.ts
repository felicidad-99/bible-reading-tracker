import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Group } from "@prisma/client";

export const MAX_GROUP_MEMBERS = 7;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(60),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  durationDays: z.number().int().min(1).max(3650),
  frequency: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  scheduledTimes: z
    .array(z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"))
    .min(1)
    .max(3),
  translation: z.string().trim().min(2).max(12),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1).max(64),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export type JoinDecision = "ok" | "already_member" | "full";

export function evaluateJoin(
  memberCount: number,
  isMember: boolean
): JoinDecision {
  if (isMember) return "already_member";
  if (memberCount >= MAX_GROUP_MEMBERS) return "full";
  return "ok";
}

export const JOIN_DECISION_MESSAGES: Record<JoinDecision, string> = {
  ok: "",
  already_member: "You are already a member of this group.",
  full: `This group is full (${MAX_GROUP_MEMBERS}/${MAX_GROUP_MEMBERS}).`,
};

export function groupPlanInput(group: {
  startDate: string;
  durationDays: number;
  frequency: number;
  scheduledTimes: unknown;
  translation: string;
}) {
  const sessionTimes = Array.isArray(group.scheduledTimes)
    ? group.scheduledTimes.filter((t): t is string => typeof t === "string")
    : [];
  return {
    startDate: group.startDate,
    durationDays: group.durationDays,
    frequency: group.frequency as 1 | 2 | 3,
    translation: group.translation,
    sessionTimes,
  };
}

export function nextOwnerAfterLeave(
  members: Array<{ userId: string; joinedAt: Date }>,
  leavingUserId: string
): string | null {
  const remaining = members
    .filter((m) => m.userId !== leavingUserId)
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  return remaining[0]?.userId ?? null;
}

export function groupHasEnded(group: Pick<Group, "startDate" | "durationDays">, today: Date): boolean {
  const start = new Date(`${group.startDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + group.durationDays - 1);
  const todayStr = today.toISOString().slice(0, 10);
  return end.toISOString().slice(0, 10) < todayStr;
}

export async function requireGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) {
    throw new Response("You are not a member of this group", { status: 403 });
  }
  return member;
}

export async function getGroupById(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new Response("Group not found", { status: 404 });
  }
  return group;
}

export async function countGroupMembers(groupId: string) {
  return prisma.groupMember.count({ where: { groupId } });
}

export async function getGroupMembers(groupId: string) {
  return prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { joinedAt: "asc" },
    select: {
      userId: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}
