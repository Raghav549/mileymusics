import { supabaseAdmin } from './supabase.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const subscriptionService = {
  async getSubscription(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data || null;
    } catch (error) {
      logger.error(`Get subscription error: ${error.message}`);
      throw error;
    }
  },

  async createSubscription(userId, tier, stripeCustomerId = null) {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .insert([
          {
            user_id: userId,
            tier,
            status: 'active',
            start_date: new Date(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            auto_renew: true,
            stripe_subscription_id: stripeCustomerId,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Update user subscription tier
      await supabaseAdmin
        .from('users')
        .update({
          subscription_tier: tier,
          subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
        .eq('id', userId);

      logger.info(`Subscription created for ${userId}: ${tier}`);
      return data;
    } catch (error) {
      logger.error(`Create subscription error: ${error.message}`);
      throw error;
    }
  },

  async cancelSubscription(userId) {
    try {
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!subscription) {
        throw new AppError('No active subscription found', 404);
      }

      // Cancel in Stripe if applicable
      if (subscription.stripe_subscription_id) {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      }

      // Update in database
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscription.id)
        .select()
        .single();

      if (error) throw error;

      // Update user tier
      await supabaseAdmin
        .from('users')
        .update({
          subscription_tier: 'free',
          subscription_expiry: null,
        })
        .eq('id', userId);

      logger.info(`Subscription cancelled for ${userId}`);
      return data;
    } catch (error) {
      logger.error(`Cancel subscription error: ${error.message}`);
      throw error;
    }
  },

  async renewSubscription(userId) {
    try {
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!subscription) {
        throw new AppError('No active subscription found', 404);
      }

      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 30);

      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({ end_date: newEndDate })
        .eq('id', subscription.id)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Subscription renewed for ${userId}`);
      return data;
    } catch (error) {
      logger.error(`Renew subscription error: ${error.message}`);
      throw error;
    }
  },

  async createPaymentIntent(userId, amount, currency = 'USD') {
    try {
      // Get or create Stripe customer
      let customer;
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();

      const stripeCustomers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (stripeCustomers.data.length > 0) {
        customer = stripeCustomers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        customer: customer.id,
        metadata: { userId },
      });

      logger.info(`Payment intent created for ${userId}`);
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error(`Create payment intent error: ${error.message}`);
      throw error;
    }
  },

  async recordPayment(userId, amount, paymentMethod, stripePaymentId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .insert([
          {
            user_id: userId,
            amount,
            status: 'completed',
            payment_method: paymentMethod,
            stripe_payment_id: stripePaymentId,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Payment recorded for ${userId}: $${amount}`);
      return data;
    } catch (error) {
      logger.error(`Record payment error: ${error.message}`);
      throw error;
    }
  },

  async handleStripeWebhook(event) {
    try {
      switch (event.type) {
        case 'charge.succeeded':
          const charge = event.data.object;
          const customerId = charge.customer;
          const customer = await stripe.customers.retrieve(customerId);
          const userId = customer.metadata?.userId;

          if (userId) {
            await this.recordPayment(
              userId,
              charge.amount / 100,
              'stripe',
              charge.id
            );
          }
          break;

        case 'customer.subscription.deleted':
          const subscription = event.data.object;
          const subCustomer = await stripe.customers.retrieve(
            subscription.customer
          );
          const subUserId = subCustomer.metadata?.userId;

          if (subUserId) {
            await this.cancelSubscription(subUserId);
          }
          break;

        default:
          logger.info(`Unhandled webhook event: ${event.type}`);
      }

      return { success: true };
    } catch (error) {
      logger.error(`Handle webhook error: ${error.message}`);
      throw error;
    }
  },
};

export default subscriptionService;
