import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
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
    
    console.log('Testing with CLIENT SDK');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    
    const docRef = doc(db, 'users', 'client_test_write');
    console.log('Trying to write...');
    await setDoc(docRef, { 
      username: 'client_test',
      email: 'client_test@example.com',
      createdAt: new Date().toISOString()
    });
    console.log('Write SUCCESS');
    
    process.exit(0);
  } catch (err: any) {
    console.error('FAILED:', err.message);
    process.exit(1);
  }
}

test();
