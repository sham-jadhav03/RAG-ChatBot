import express from 'express';
import * as authController from './auth.controllers.js';
import { AuthValidator } from './auth.validators.js';
import {
  registerRateLimiter,
  loginRateLimiter,
} from '../../middleware/rateLimiter.middleware.js';

const router = express.Router();

router.post(
  '/register',
  registerRateLimiter,
  AuthValidator.validateRegister,
  authController.register,
);

router.post(
  '/login',
  loginRateLimiter,
  AuthValidator.validateLogin,
  authController.login,
);

export default router;