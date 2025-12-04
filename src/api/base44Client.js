import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "6913bf72ba782aee2b62c54b", 
  requiresAuth: true // Ensure authentication is required for all operations
});
