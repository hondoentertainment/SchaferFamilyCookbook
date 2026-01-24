import fs from 'fs';
// Removed uuid dependency

const filePath = 'c:/Users/kyle/Downloads/Schafer_Family_Cookbook_Complete.md';
const outputPath = 'c:/Users/kyle/Downloads/SchaferFamilyCookbook/src/data/recipes.json';

try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const recipes = [];
    let currentRecipe = null;
    let section = null;

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('---')) continue;

        // Detect Header
        if (line.startsWith('### ')) {
            if (currentRecipe) recipes.push(currentRecipe);

            const title = line.replace('### ', '').trim();
            if (['The Oehler Family', 'The Schafer Family'].includes(title)) {
                currentRecipe = null;
                continue;
            }

            currentRecipe = {
                id: 'imported_' + Math.random().toString(36).substr(2, 9),
                title: title,
                contributor: "Family",
                category: "Main",
                ingredients: [],
                instructions: [],
                image: "https://images.unsplash.com/photo-1495195129352-aec325a55b65?auto=format&fit=crop&q=80&w=800",
                notes: ""
            };
            section = null;
            continue;
        }

        if (!currentRecipe) continue;

        if (line.startsWith('**Contributor:**')) {
            currentRecipe.contributor = line.replace('**Contributor:**', '').trim();
            continue;
        }
        if (line.startsWith('**Ingredients:**')) {
            section = 'ingredients';
            continue;
        }
        if (line.startsWith('**Instructions:**')) {
            section = 'instructions';
            continue;
        }
        if (line.startsWith('**Notes:**')) {
            section = 'notes';
            currentRecipe.notes = line.replace('**Notes:**', '').trim();
            continue;
        }

        if (section === 'ingredients' && line.startsWith('- ')) {
            currentRecipe.ingredients.push(line.replace('- ', ''));
        } else if (section === 'instructions') {
            const clean = line.replace(/^\d+\.\s*/, '');
            if (clean) currentRecipe.instructions.push(clean);
        } else if (section === 'notes') {
            currentRecipe.notes += " " + line;
        }
    }

    if (currentRecipe) recipes.push(currentRecipe);

    const validRecipes = recipes.filter(r => r.ingredients.length > 0);

    // Categorize
    validRecipes.forEach(r => {
        const t = r.title.toLowerCase();
        if (t.includes('cookie') || t.includes('bar') || t.includes('cake') || t.includes('brownie') || t.includes('pie') || t.includes('fudge') || t.includes('dessert') || t.includes('chow')) {
            r.category = 'Dessert';
        } else if (t.includes('soup') || t.includes('stew') || t.includes('chili')) {
            r.category = 'Main';
        } else if (t.includes('salad') && !t.includes('chicken')) {
            r.category = 'Side';
        } else if (t.includes('dip') || t.includes('salsa')) {
            r.category = 'Dip/Sauce';
        } else if (t.includes('bread')) {
            r.category = 'Bread';
        } else if (t.includes('breakfast') || t.includes('egg') || t.includes('pancake')) {
            r.category = 'Breakfast';
        } else if (t.includes('snack') || t.includes('popcorn')) {
            r.category = 'Snack';
        }
    });

    fs.writeFileSync(outputPath, JSON.stringify(validRecipes, null, 2));
    console.log(`Successfully converted ${validRecipes.length} recipes.`);

} catch (e) {
    console.error(e);
}
