// Contributor merge script - Node.js version
// Run with: node scripts/merge-contributors-node.mjs "Old Name" "New Name"
// Defaults normalize the historical Dawn variants used by the cookbook.

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const FROM_NAME = process.argv[2] || "Dawn";
const TO_NAME = process.argv[3] || "Dawn (Schafer) Tessmer";

const firebaseConfig = {
    apiKey: "AIzaSyDZYjGjQZvjMDQPuCjA1-3k5-HN3P5ddiI",
    authDomain: "schafer-cookbook.firebaseapp.com",
    projectId: "schafer-cookbook",
    storageBucket: "schafer-cookbook.appspot.com",
    messagingSenderId: "852757582729",
    appId: "1:852757582729:web:93ce1cdf0be7352cf09a3a"
};

async function mergeContributors() {
    console.log(`🔄 Starting merge: "${FROM_NAME}" → "${TO_NAME}"`);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const collections = [
        { name: "recipes", field: "contributor", label: "title" },
        { name: "gallery", field: "contributor", label: "caption" },
        { name: "trivia", field: "contributor", label: "question" },
    ];

    for (const target of collections) {
        console.log(`📦 Fetching ${target.name}...`);
        const snapshot = await getDocs(collection(db, target.name));
        let updatedCount = 0;
        for (const itemDoc of snapshot.docs) {
            const item = itemDoc.data();
            if (item[target.field] === FROM_NAME) {
                console.log(`  📝 Updating: "${item[target.label] || itemDoc.id}"`);
                await updateDoc(doc(db, target.name, itemDoc.id), { [target.field]: TO_NAME });
                updatedCount++;
            }
        }
        console.log(`✅ Updated ${updatedCount} ${target.name}`);
    }

    // Remove old contributor profile
    console.log("👤 Checking contributors...");
    const contributorsSnapshot = await getDocs(collection(db, "contributors"));

    for (const contribDoc of contributorsSnapshot.docs) {
        const contrib = contribDoc.data();
        if (contrib.name === FROM_NAME) {
            console.log(`  🗑️ Removing profile: "${contrib.name}"`);
            await deleteDoc(doc(db, "contributors", contribDoc.id));
        }
    }

    console.log("🎉 Merge complete!");
    process.exit(0);
}

mergeContributors().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
