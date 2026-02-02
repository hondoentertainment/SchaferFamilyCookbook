// Contributor merge script - Node.js version
// Run with: node scripts/merge-contributors-node.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const FROM_NAME = "Dawn Schafer Tessmer";
const TO_NAME = "Dawn";

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

    // Update recipes
    console.log("📖 Fetching recipes...");
    const recipesSnapshot = await getDocs(collection(db, "recipes"));

    let updatedCount = 0;
    for (const recipeDoc of recipesSnapshot.docs) {
        const recipe = recipeDoc.data();
        if (recipe.contributor === FROM_NAME) {
            console.log(`  📝 Updating: "${recipe.title}"`);
            await updateDoc(doc(db, "recipes", recipeDoc.id), { contributor: TO_NAME });
            updatedCount++;
        }
    }
    console.log(`✅ Updated ${updatedCount} recipes`);

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
