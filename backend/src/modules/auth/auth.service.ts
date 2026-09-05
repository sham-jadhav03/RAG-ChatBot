import userModel, { IUser } from "../../models/user.model.js";
import { config } from "../../config/config.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { redisPublisher } from "../../redis/publisher.js";

export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RefreshDTO {
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  id: string;
  role: string;
  type: "access" | "refresh";
  jti?: string;
  exp?: number;
}

const REVOCATION_PREFIX = "token:revoked:";

class authService {
  private generateAccessToken(userId: string, role: string): string {
    const secret = config.JWT_SECRET;
    const expiresIn = (config.JWT_EXPIRES_IN || "15m") as any;
    const jti = crypto.randomUUID();

    return jwt.sign({ id: userId, role, type: "access", jti }, secret, {
      expiresIn: expiresIn,
    });
  }

  private generateRefreshToken(userId: string, role: string): string {
    const secret = config.JWT_REFRESH_SECRET;
    const expiresIn = (config.JWT_REFRESH_EXPIRES_IN || "7d") as any;

    return jwt.sign({ id: userId, role, type: "refresh" }, secret, {
      expiresIn: expiresIn,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private async revokeAccessToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as TokenPayload | null;
      if (!decoded?.jti) return;

      const decodedFull = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
      const exp = decodedFull.exp;
      if (!exp) return;

      const ttl = exp - Math.floor(Date.now() / 1000);
      if (ttl <= 0) return;

      const key = `${REVOCATION_PREFIX}${decodedFull.jti}`;
      await redisPublisher.set(key, "1", "EX", ttl);
    } catch {
      // Token already expired or invalid, nothing to revoke
    }
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
    const { username, email, password } = data;

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
      role: "user",
    });

    const accessToken = this.generateAccessToken(user._id.toString(), user.role);
    const refreshToken = this.generateRefreshToken(user._id.toString(), user.role);
    user.refreshTokenHash = this.hashToken(refreshToken);
    await user.save();

    return {
      user: this.formatUserResponse(user),
      accessToken,
      refreshToken,
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

    const accessToken = this.generateAccessToken(user._id.toString(), user.role);
    const refreshToken = this.generateRefreshToken(user._id.toString(), user.role);
    user.refreshTokenHash = this.hashToken(refreshToken);
    await user.save();

    return {
      user: this.formatUserResponse(user),
      accessToken,
      refreshToken,
    };
  }

  async refresh(data: RefreshDTO): Promise<AuthResponse> {
    const { refreshToken } = data;

    if (!refreshToken) {
      throw new Error("Refresh token is required.");
    }

    const hashedToken = this.hashToken(refreshToken);
    const user = await userModel.findOne({ refreshTokenHash: hashedToken }).select("+refreshTokenHash");

    if (!user || !user.refreshTokenHash) {
      throw new Error("Invalid refresh token.");
    }

    // Verify the refresh token
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as TokenPayload;
    } catch {
      throw new Error("Invalid or expired refresh token.");
    }

    if (decoded.type !== "refresh" || decoded.id !== user._id.toString()) {
      throw new Error("Invalid refresh token.");
    }

    // Token rotation: generate new pair
    const newAccessToken = this.generateAccessToken(user._id.toString(), user.role);
    const newRefreshToken = this.generateRefreshToken(user._id.toString(), user.role);
    user.refreshTokenHash = this.hashToken(newRefreshToken);
    await user.save();

    return {
      user: this.formatUserResponse(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string, accessToken?: string): Promise<void> {
    // Revoke access token if provided
    if (accessToken) {
      await this.revokeAccessToken(accessToken);
    }
    // Invalidate refresh token
    await userModel.findByIdAndUpdate(userId, { refreshTokenHash: null });
  }
}

export default new authService();
