import userModel, { IUser } from "../../models/user.model.js";
import { config } from "../../config/config.js";
import jwt from "jsonwebtoken";

export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "user";
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  token: string;
}

class authService {
  private generateToken(userId: string, role: string): string {
    const secret = config.JWT_SECRET;
    const expiresIn = (config.JWT_EXPIRES_IN || "1h") as any;

    return jwt.sign({ id: userId, role }, secret, {
      expiresIn: expiresIn,
    });
  }

  private formatUserResponse(user: IUser): AuthResponse["user"] {
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  async register(data: RegisterDTO): Promise<AuthResponse> {
    const { username, email, password, role } = data;

    // Check if a user with the given email or username already exists
    const existingUser = await userModel.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      throw new Error("User with this email or username already exists.");
    }

    const user = await userModel.create({
      username,
      email,
      password,
      role: role === "admin" ? "admin" : "user",
    });
    const token = this.generateToken(user._id.toString(), user.role);
    return {
      user: this.formatUserResponse(user),
      token,
    };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    const { email, password } = data;

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const user = await userModel
      .findOne({ email: email.toLowerCase() })
      .select("+password");

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password.");
    }

    const token = this.generateToken(user._id.toString(), user.role);

    return {
      user: this.formatUserResponse(user),
      token,
    };
  }
}

export default new authService();
