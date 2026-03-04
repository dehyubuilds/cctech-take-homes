import { Amplify, Auth } from 'aws-amplify';
import awsExports2FA from '~/aws-exports-2fa';

// Configure Amplify with 2FA settings
Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_ydIfTK3KE',
    userPoolWebClientId: '7imkv9gnn1s0g8ri1dj61lohc0',
    authenticationFlowType: 'USER_PASSWORD_AUTH'
  }
});

export default {
  async signUp(username, password) {
    try {
      console.log('Attempting sign up with Lambda...');
      const response = await $fetch('/api/auth/verify', {
        method: 'POST',
        body: {
          username,
          password,
          action: 'signup'
        }
      });
      console.log('Sign up response:', response);

      if (response.success && response.tokens) {
        // Store the tokens in Amplify
        await Auth.signIn(username, password);
        return response;
      }
      return response;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  },

  async signIn(username, password) {
    try {
      console.log('Attempting sign in with Lambda...');
      const response = await $fetch('/api/auth/verify', {
        method: 'POST',
        body: {
          username,
          password,
          action: 'authenticate'
        }
      });
      console.log('Sign in response:', response);

      if (response.success && response.tokens) {
        // Store the tokens in Amplify
        await Auth.signIn(username, password);
        return response;
      }
      return response;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  },

  async currentAuthenticatedUser() {
    try {
      return await Auth.currentAuthenticatedUser();
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  async signOut() {
    try {
      await Auth.signOut();
      return true;
    } catch (error) {
      console.error('Error signing out:', error);
      return false;
    }
  },

  confirmSignUp: async (username, code) => {
    try {
      await Auth.confirmSignUp(username, code);
      return { success: true };
    } catch (error) {
      console.error('Error confirming sign up:', error);
      throw error;
    }
  },

  verifyUserAttribute: async (user, attributeName, code) => {
    try {
      await Auth.verifyUserAttribute(user, attributeName, code);
      return { success: true };
    } catch (error) {
      console.error('Error verifying attribute:', error);
      throw error;
    }
  },

  initiateAuth: async (params) => {
    try {
      return await Auth.sendCustomChallengeAnswer(params);
    } catch (error) {
      console.error('Error in custom auth:', error);
      throw error;
    }
  }
}; 