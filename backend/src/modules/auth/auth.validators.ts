import { Request, Response, NextFunction } from "express";

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;

function validatePassword(password: string, fieldName: string = "Password"): string | null {
  if (!password || typeof password !== "string") {
    return `${fieldName} is required.`;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `${fieldName} must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return `${fieldName} must contain at least one uppercase letter, one lowercase letter, one number, and one special character.`;
  }
  return null;
}

export class AuthValidator {
  /**
   * Middleware to validate POST /api/auth/register payload
   */
  static validateRegister(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const { username, email, password, role } = req.body;
    const errors: string[] = [];

    // 1. Username validation
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      errors.push("Username is required and must be at least 3 characters long.");
    }

    // 2. Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
      errors.push("A valid email address is required.");
    }

    // 3. Password validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      errors.push(passwordError);
    }

    // 4. Role rejection: public registration cannot specify role
    if (role !== undefined) {
      errors.push("Role cannot be set during registration.");
    }

    // If validation errors exist, short-circuit request
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Validation Error",
        errors,
      });
      return;
    }

    // Sanitize email and username for consistency
    req.body.email = email.trim().toLowerCase();
    req.body.username = username.trim();
    delete req.body.role;

    next();
  }

  /**
   * Middleware to validate POST /api/auth/login payload
   */
  static validateLogin(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const { email, password } = req.body;
    const errors: string[] = [];

    // 1. Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
      errors.push("A valid email address is required.");
    }

    // 2. Password validation (basic presence check for login)
    if (!password || typeof password !== "string" || password.trim().length === 0) {
      errors.push("Password is required.");
    }

    // If validation errors exist, short-circuit request
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Validation Error",
        errors,
      });
      return;
    }

    // Sanitize email
    req.body.email = email.trim().toLowerCase();

    next();
  }
}

export { validatePassword };