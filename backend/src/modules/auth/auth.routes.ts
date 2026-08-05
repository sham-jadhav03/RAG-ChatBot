import express from 'express';
import * as authController from './auth.controllers';
import { AuthValidator } from './auth.validators';

const router = express.Router();

router.post('/register', AuthValidator.validateRegister, authController.register);
router.post('/login', AuthValidator.validateLogin, authController.login);

export default router;