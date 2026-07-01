// Toggle the `unlockAllTracks` flag for a specific user — used to bypass
// roadmap gating on a test account so all tracks (DSA / Project / Resume /
// Interview) are immediately accessible without grinding Basics first.
//
// Usage from the backend/ folder:
//   node scripts/unlockTracks.js <email>            → unlocks
//   node scripts/unlockTracks.js <email> --lock     → re-locks (back to default)
//
// Requires the same .env file your server uses (MONGODB_URI).

import dns from 'dns';
// Force Google DNS so MongoDB Atlas SRV records resolve on networks where
// the default resolver refuses (mirrors the workaround in backend/index.js).
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const [, , emailArg, ...rest] = process.argv;
const lock = rest.includes('--lock');

if (!emailArg) {
    console.error('❌ Usage: node scripts/unlockTracks.js <email> [--lock]');
    process.exit(1);
}

if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in backend/.env');
    process.exit(1);
}

try {
    await mongoose.connect(process.env.MONGODB_URI);
    const email = emailArg.toLowerCase().trim();

    const user = await User.findOneAndUpdate(
        { email },
        { $set: { unlockAllTracks: !lock } },
        { new: true }
    );

    if (!user) {
        console.error(`❌ No user found with email "${email}"`);
        process.exit(1);
    }

    console.log(
        `${lock ? '🔒 Re-locked' : '🔓 Unlocked'} all tracks for ${user.name} <${user.email}>`
    );
    console.log(`   unlockAllTracks = ${user.unlockAllTracks}`);
    process.exit(0);
} catch (err) {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
} finally {
    await mongoose.disconnect().catch(() => {});
}
