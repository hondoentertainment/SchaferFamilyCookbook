/**
 * Contributor Merge Script for Schafer Family Cookbook
 * 
 * This script merges "Dawn Schafer Tessmer" recipes into "Dawn"
 * and removes the duplicate contributor profile.
 * 
 * Run in browser console while logged in as admin at:
 * https://schafer-family-cookbook.vercel.app
 */

// You can copy-paste this into the browser console when logged in

(async function mergeContributors() {
    const FROM_NAME = "Dawn Schafer Tessmer";
    const TO_NAME = "Dawn";

    console.log(`🔄 Starting merge: "${FROM_NAME}" → "${TO_NAME}"`);

    // Access Firebase through the app's exposed functions
    const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
    const { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, query } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

    // Firebase config (same as app)
    const firebaseConfig = {
        apiKey: "AIzaSyDZYjGjQZvjMDQPuCjA1-3k5-HN3P5ddiI",
        authDomain: "schafer-cookbook.firebaseapp.com",
        projectId: "schafer-cookbook",
        storageBucket: "schafer-cookbook.appspot.com",
        messagingSenderId: "852757582729",
        appId: "1:852757582729:web:93ce1cdf0be7352cf09a3a"
    };

    // Initialize Firebase
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // 1. Update all recipes with the old contributor name
    console.log("📖 Fetching recipes...");
    const recipesRef = collection(db, "recipes");
    const recipesSnapshot = await getDocs(recipesRef);

    let updatedCount = 0;
    for (const recipeDoc of recipesSnapshot.docs) {
        const recipe = recipeDoc.data();
        if (recipe.contributor === FROM_NAME) {
            console.log(`  📝 Updating recipe: "${recipe.title}"`);
            await updateDoc(doc(db, "recipes", recipeDoc.id), { contributor: TO_NAME });
            updatedCount++;
        }
    }
    console.log(`✅ Updated ${updatedCount} recipes`);

    // 2. Find and delete the old contributor profile
    console.log("👤 Checking contributors...");
    const contributorsRef = collection(db, "contributors");
    const contributorsSnapshot = await getDocs(contributorsRef);

    let deletedProfile = false;
    for (const contribDoc of contributorsSnapshot.docs) {
        const contrib = contribDoc.data();
        if (contrib.name === FROM_NAME) {
            console.log(`  🗑️ Removing contributor profile: "${contrib.name}"`);
            await deleteDoc(doc(db, "contributors", contribDoc.id));
            deletedProfile = true;
        }
    }

    if (deletedProfile) {
        console.log("✅ Removed duplicate contributor profile");
    } else {
        console.log("ℹ️ No separate contributor profile found for:", FROM_NAME);
    }

    console.log("🎉 Merge complete! Refresh the page to see changes.");
})();
