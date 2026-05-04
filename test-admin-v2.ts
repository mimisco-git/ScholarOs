import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function test() {
  try {
    const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    
    console.log('Project ID:', firebaseConfig.projectId);
    console.log('Database ID:', firebaseConfig.firestoreDatabaseId);

    if (getApps().length === 0) {
      initializeApp({
        projectId: firebaseConfig.projectId
      });
    }

    const db = getFirestore(firebaseConfig.firestoreDatabaseId);
    
    console.log('Using Project:', firebaseConfig.projectId);
    console.log('Using Database:', firebaseConfig.firestoreDatabaseId);
    console.log('Service Account:', process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL);

    const docRef = db.collection('users').doc('admin_test_write');
    console.log('Trying to write to /users/admin_test_write...');
    await docRef.set({ 
      username: 'admin_test',
      email: 'admin_test@example.com',
      phone: '1234567890',
      examCategory: 'JAMB UTME',
      payment_status: 'active',
      createdAt: new Date().toISOString()
    });
    console.log('Write SUCCESS');
    
    const doc = await docRef.get();
    console.log('Read SUCCESS:', doc.data());
    
    process.exit(0);
  } catch (err: any) {
    console.error('FAILED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

test();
