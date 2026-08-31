import mongoose from "mongoose";
import { config } from "../config/config.js";
import userModel from "../models/user.model.js";

async function seedAdmin(): Promise<void> {
  const email = config.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = config.INITIAL_ADMIN_PASSWORD;
  const username = config.INITIAL_ADMIN_USERNAME?.trim() || "admin";

  if (!email || !password) {
    throw new Error(
      "INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required.",
    );
  }

  if (password.length < 6) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD must be at least 6 characters long.",
    );
  }

  await mongoose.connect(config.MONGO_URI);

  try {
    const existingUser = await userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email && existingUser.role === "admin") {
        console.log(`Admin already exists: ${email}`);
        return;
      }

      if (existingUser.email === email) {
        throw new Error(
          `A user already exists with email ${email}. Refusing to promote automatically.`,
        );
      }

      if (existingUser.username === username) {
        throw new Error(
          `Username "${username}" is already taken. Use INITIAL_ADMIN_USERNAME with another value.`,
        );
      }
    }

    const admin = await userModel.create({
      username,
      email,
      password,
      role: "admin",
    });

    console.log(`Admin created successfully: ${admin.email}`);
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin().catch((error) => {
  console.error(
    "Admin seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
