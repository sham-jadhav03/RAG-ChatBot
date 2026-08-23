import bcrypt from "bcryptjs";
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  role: "admin" | "user";
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Username is required."],
      trim: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
  },
  { timestamps: true },
);

userSchema.pre<IUser>("save", async function () {
  if (!this.isModified("password")) return;

  const password = this.password;

  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password is required.");
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(password, salt);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  // If password was omitted due to select: false, ensure it is fetched in controller using .select('+password')
  if (!this.password) {
    throw new Error(
      "Password field is missing. Make sure to use .select('+password') when querying for auth.",
    );
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// 5. Model Export
const userModel: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export default userModel;
