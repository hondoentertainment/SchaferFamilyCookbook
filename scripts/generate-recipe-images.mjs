#!/usr/bin/env node
/**
 * Generate unique Pollinations AI image URLs for all recipes in recipes.json.
 * Uses the same approach as AdminView's "Bulk Visual Sourcing" feature.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const recipesPath = resolve(__dirname, '../src/data/recipes.json');

// Short, descriptive prompts for each recipe to feed to the AI image generator
// Build prompt map - handle both straight and curly quotes for matching
const RECIPE_PROMPTS_RAW = [
    ["Festive Apple Dip", "creamy peanut butter apple dip with crushed peanuts, served with sliced apples"],
    ["Feyereisen Chocolate Chip Cookies", "homemade golden chocolate chip cookies on cooling rack"],
    ["Mark\u2019s Fudge", "rich dark chocolate fudge squares on white plate"],
    ["Quiche", "golden broccoli ham swiss cheese quiche in pie dish"],
    ["Puppy Chow", "powdered sugar coated chex cereal muddy buddies in bowl"],
    ["Hot Chicken Salad", "baked chicken casserole topped with crushed potato chips"],
    ["Wild Rice Hot Dish (Robin\u2019s)", "wild rice and hamburger hotdish casserole"],
    ["Mark\u2019s Chow Mein", "pork chow mein with celery over rice and noodles"],
    ["Mark\u2019s Meatloaf", "sliced meatloaf with ketchup glaze on dinner plate"],
    ["Wren\u2019s Bagel Dip", "creamy herb dip with corned beef served with sliced bagels"],
    ["Wren\u2019s Cuban Toasties", "golden bubbly ham and swiss baguette appetizers on baking sheet"],
    ["Wren\u2019s Salsa", "fresh chunky homemade salsa in bowl with tomatoes and peppers"],
    ["Wren\u2019s Taco Dip", "layered taco dip with lettuce cheese and salsa on platter"],
    ["Mark\u2019s Monster Bars", "thick peanut butter oat bars with M&Ms and chocolate chips"],
    ["Wren\u2019s Fruit Pizza", "colorful fruit pizza with berries and cream cheese on cookie crust"],
    ["Quick & Easy Fudgy Brownies", "fudgy dark chocolate brownies stacked on plate"],
    ["Raisin Cookies", "soft golden raisin cookies on baking sheet"],
    ["Chicken Wild Rice Soup", "creamy chicken wild rice soup in ceramic bowl"],
    ["Sausage Skillet Supper", "sausage potatoes and peppers in cast iron skillet"],
    ["Savory Chicken Squares", "golden chicken crescent roll squares on baking dish"],
    ["Stuffed Pepper Soup", "hearty stuffed pepper soup with ground beef and rice"],
    ["Spinach Dip", "creamy spinach dip with bread cubes and vegetables"],
    ["Broccoli Salad", "fresh broccoli salad with bacon and cheddar dressing"],
    ["Cowboy Caviar", "colorful cowboy caviar with black beans corn and peppers"],
    ["Pretzel Salad", "layered pretzel strawberry dessert salad with cream"],
    ["Biscuits & Gravy", "fluffy biscuits smothered in sausage gravy on plate"],
    ["Skinny Pancakes", "stack of thin golden pancakes with syrup and fruit"],
    ["Egg Kaka", "fluffy scrambled eggs in cast iron skillet breakfast"],
    ["Sausage Egg & Cheese Breakfast Bake", "cheesy sausage egg breakfast casserole in baking dish"],
    ["Cinnamon Rolls", "warm frosted cinnamon rolls in baking pan"],
    ["Poppy Seed Bread", "sliced poppy seed bread loaf on cutting board"],
    ["Banana Nut Bread", "sliced banana nut bread with golden crust"],
    ["Popovers", "puffy golden popovers in popover pan"],
    ["Chocolate Chip Cookies", "classic golden chocolate chip cookies on plate"],
    ["Congo Bars", "chocolate chip congo bars cut into squares"],
    ["Monster Cookies", "colorful monster cookies with M&Ms oats and peanut butter"],
    ["Peanut Butter Cookies", "classic peanut butter cookies with fork crosshatch pattern"],
    ["Cranberry Cake", "cranberry upside down cake with whipped cream"],
    ["Rhubarb Crunch", "baked rhubarb crunch dessert with oat crumble topping"],
    ["Sour Cream Rhubarb Dessert", "rhubarb sour cream dessert with streusel topping"],
    ["Pumpkin Pie", "classic pumpkin pie with whipped cream on holiday table"],
    ["Barb\u2019s Wild Rice Hotdish", "wild rice ground beef casserole hotdish"],
    ["Gladys Hotdish", "ground beef noodle hotdish with mixed vegetables"],
    ["Hearty Beef \u2019N\u2019 Potato Casserole", "beef potato casserole with melted cheddar cheese"],
    ["Tator Tot Hotdish", "tater tot hotdish casserole with cheese on top"],
    ["Chicken Spaghetti", "cheesy chicken spaghetti casserole baked golden"],
    ["Easy Stew", "hearty beef stew with potatoes carrots in bowl"],
    ["Mock Chili", "bowl of ground beef chili with kidney beans"],
    ["Jalape\u00f1o Popper Dip", "bubbly baked jalapeño popper dip with breadcrumb crust"],
    ["Pizza Dip", "melted pizza dip with pepperoni and mozzarella"],
    ["Shrimp Dip", "creamy shrimp dip with crackers appetizer platter"],
    ["Coleslaw Dressing", "creamy coleslaw with shredded cabbage and carrots"],
    ["Julie Tartar Sauce", "homemade tartar sauce in small bowl with lemon"],
    ["The World\u2019s Best Hot Fudge Sauce", "warm chocolate hot fudge sauce dripping over ice cream"],
    ["Glaze for Cinnamon Rolls", "vanilla glaze drizzled over warm cinnamon rolls"],
    ["Refrigerator Pickles", "jar of homemade dill refrigerator pickles"],
    ["Zucchini Jam", "jar of pink zucchini pineapple jam on toast"],
    ["Glazed \u201cGreen Chunk\u201d Pickles", "glazed sweet pickles in mason jar"],
    ["Crockpot Apple Butter", "jar of dark cinnamon apple butter with fresh apples"],
    ["Fish Fry (Grandma & Grandpa\u2019s)", "golden fried fish fillets on plate with lemon"],
    ["Mustard Marinated Steak", "grilled steak with mustard marinade sliced on cutting board"],
    ["Soy Chicken Wings", "glazed soy chicken wings with sesame seeds"],
    ["Orange Jello", "bright orange jello dessert in glass dish"],
    ["Jello Salad", "colorful jello salad with fruit and marshmallows"],
    ["Winter Salad", "apple walnut celery salad in serving bowl"],
    ["Chocolate Martini", "chocolate martini cocktail in elegant glass"],
    ["White Russian Pudding Shots", "white russian pudding shots with whipped cream topping"],
];
const RECIPE_PROMPTS = Object.fromEntries(RECIPE_PROMPTS_RAW);

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

let updated = 0;
for (const recipe of recipes) {
    const prompt = RECIPE_PROMPTS[recipe.title];
    if (!prompt) {
        console.log(`  SKIP: No prompt mapped for "${recipe.title}"`);
        continue;
    }

    const seed = Math.abs(hashCode(recipe.id));
    const encodedPrompt = encodeURIComponent(
        `Professional food photography of ${prompt}, warm lighting, appetizing, top-down angle, rustic kitchen background`
    );
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=800&height=600&nologo=true`;

    recipe.image = url;
    updated++;
    console.log(`  [${updated}/${recipes.length}] ${recipe.title}`);
}

writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');
console.log(`\nDone! Updated ${updated}/${recipes.length} recipes with unique AI image URLs.`);

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
}
