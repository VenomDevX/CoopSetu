import { provisionDemoWorkspace } from './lib/demo/provision-demo-workspace';
import { createAdminClient } from './lib/supabase/admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  try {
    const admin = createAdminClient();
    console.log('Testing demo provisioning...');
    
    // Create a dummy auth user for testing
    const { data: user, error: userError } = await admin.auth.admin.createUser({
      email: `visitor-${Date.now()}@test.local`,
      password: 'Password123!',
      email_confirm: true,
    });
    
    if (userError) throw userError;
    
    const result = await provisionDemoWorkspace(user.user.id, 'TRAINEE');
    console.log('Success:', result);
  } catch (error) {
    console.error('Error during provisioning:', error);
  }
}

run();
