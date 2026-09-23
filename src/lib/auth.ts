import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function createUser(input: {
  email: string;
  name?: string;
  password: string;
}) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with this email already exists");
  }
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash,
    },
  });
}

function getMailer() {
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  if (!server || !from) {
    throw new Error("Email is not configured. Set EMAIL_SERVER and EMAIL_FROM.");
  }
  return nodemailer.createTransport(server);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const normalized = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
  await prisma.passwordReset.create({
    data: { userId: user.id, token, expires },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const transporter = getMailer();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "Reset your Bible Reading Tracker password",
    text: `Reset your password: ${resetUrl}\nThis link expires in 1 hour.`,
    html: `
      <p>Reset your Bible Reading Tracker password:</p>
      <p><a href="${resetUrl}">Reset password</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `,
  });
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const record = await prisma.passwordReset.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expires < new Date()) {
    throw new Error("This reset link is invalid or has expired");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  });
  await prisma.passwordReset.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
}
