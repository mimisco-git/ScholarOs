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
    
    // TRY INFRASTRUCTURE PROJECT
    const infraProject = 'ais-europe-west2-c6efa8bb2a2d4';
    
    console.log('Testing INFRA project:', infraProject);
    console.log('Database ID:', firebaseConfig.firestoreDatabaseId);

    if (getApps().length === 0) {
      initializeApp({
        projectId: infraProject
      });
    }

    const db = getFirestore(firebaseConfig.firestoreDatabaseId);
    
    const docRef = db.collection('test_admin').doc('infra-check');
    console.log('Trying to write...');
    await docRef.set({ timestamp: new Date().toISOString() });
    console.log('Write SUCCESS');
    
    process.exit(0);
  } catch (err: any) {
    console.error('FAILED:', err.message);
    process.exit(1);
  }
}

test();
