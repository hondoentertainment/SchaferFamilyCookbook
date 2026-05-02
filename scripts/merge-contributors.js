/**
 * Contributor Merge Script for Schafer Family Cookbook
 * 
 * This script merges contributor variants across recipes, gallery, and trivia
 * and removes the duplicate contributor profile.
 * 
 * Run in browser console while logged in as admin at:
 * https://schafer-family-cookbook.vercel.app
 */

// You can copy-paste this into the browser console when logged in

(async function mergeContributors() {
    const FROM_NAME = "Dawn";
    const TO_NAME = "Dawn (Schafer) Tessmer";

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

    const targets = [
        { name: "recipes", field: "contributor", label: "title" },
        { name: "gallery", field: "contributor", label: "caption" },
        { name: "trivia", field: "contributor", label: "question" },
    ];

    for (const target of targets) {
        console.log(`📖 Fetching ${target.name}...`);
        const snapshot = await getDocs(collection(db, target.name));
        let updatedCount = 0;
        for (const itemDoc of snapshot.docs) {
            const item = itemDoc.data();
            if (item[target.field] === FROM_NAME) {
                console.log(`  📝 Updating ${target.name}: "${item[target.label] || itemDoc.id}"`);
                await updateDoc(doc(db, target.name, itemDoc.id), { [target.field]: TO_NAME });
                updatedCount++;
            }
        }
        console.log(`✅ Updated ${updatedCount} ${target.name}`);
    }

    // Find and delete the old contributor profile
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
