import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { supabaseAdmin, supabase } from './supabase.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export const authService = {
  async signupWithEmail(email, password, username, fullName) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        throw new AppError('Email already registered', 400);
      }

      // Create auth user via Supabase
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

      if (error) {
        throw new AppError(error.message, 400);
      }

      // Create user profile
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            id: data.user.id,
            email,
            username,
            full_name: fullName,
          },
        ])
        .select()
        .single();

      if (userError) {
        throw new AppError(userError.message, 400);
      }

      logger.info(`User registered: ${email}`);

      return {
        user,
        message: 'Sign up successful. Please check your email to verify your account.',
      };
    } catch (error) {
      logger.error(`Sign up error: ${error.message}`);
      throw error;
    }
  },

  async loginWithEmail(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new AppError('Invalid email or password', 401);
      }

      const { data: user } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      // Update last login
      await supabaseAdmin
        .from('users')
        .update({ last_login: new Date() })
        .eq('id', data.user.id);

      logger.info(`User logged in: ${email}`);

      return {
        user,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      };
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      throw error;
    }
  },

  async loginWithGoogle(googleToken) {
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleToken,
      });

      if (error) {
        throw new AppError('Google authentication failed', 401);
      }

      let user = await this.getUserById(data.user.id);

      if (!user) {
        // Create new user from Google profile
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: data.user.email,
              username: data.user.email.split('@')[0],
              full_name: data.user.user_metadata?.full_name || '',
              avatar_url: data.user.user_metadata?.avatar_url,
            },
          ])
          .select()
          .single();

        if (createError) {
          throw new AppError('Failed to create user profile', 400);
        }

        user = newUser;
      }

      logger.info(`User logged in with Google: ${data.user.email}`);

      return {
        user,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      };
    } catch (error) {
      logger.error(`Google login error: ${error.message}`);
      throw error;
    }
  },

  async refreshToken(refreshToken) {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        throw new AppError('Invalid refresh token', 401);
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      };
    } catch (error) {
      logger.error(`Refresh token error: ${error.message}`);
      throw error;
    }
  },

  async logout(userId) {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        logger.warn(`Logout warning for user ${userId}: ${error.message}`);
      }

      logger.info(`User logged out: ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Logout error: ${error.message}`);
      throw error;
    }
  },

  async requestPasswordReset(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`,
      });

      if (error) {
        throw new AppError('Failed to send reset email', 400);
      }

      logger.info(`Password reset requested for: ${email}`);
      return { message: 'Password reset email sent' };
    } catch (error) {
      logger.error(`Password reset error: ${error.message}`);
      throw error;
    }
  },

  async updatePassword(userId, newPassword) {
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) {
        throw new AppError(error.message, 400);
      }

      logger.info(`Password updated for user: ${userId}`);
      return { message: 'Password updated successfully' };
    } catch (error) {
      logger.error(`Password update error: ${error.message}`);
      throw error;
    }
  },

  async verifyEmail(email) {
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        (
          await supabaseAdmin.auth.admin.getUserByEmail(email)
        ).data.user.id,
        { email_confirm: true }
      );

      if (error) {
        throw new AppError(error.message, 400);
      }

      logger.info(`Email verified: ${email}`);
      return { message: 'Email verified successfully' };
    } catch (error) {
      logger.error(`Email verification error: ${error.message}`);
      throw error;
    }
  },

  async getUserById(userId) {
    try {
      const { data } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      return data;
    } catch (error) {
      logger.error(`Get user error: ${error.message}`);
      return null;
    }
  },

  generateToken(userId, expiresIn = '7d') {
    return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn });
  },

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new AppError('Invalid token', 401);
    }
  },
};

export default authService;
