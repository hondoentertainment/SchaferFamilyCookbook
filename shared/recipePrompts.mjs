/**
 * Shared recipe-accurate image prompts for Pollinations.
 * Used by: scripts/generate-recipe-images.mjs, scripts/remediate-mismatched-images.mjs
 * Per RECIPE_IMAGE_RULES: no parsley, herbs, garnish, or ingredients not in recipe.
 */
export const RECIPE_PROMPTS_RAW = [
  ["Festive Apple Dip", "creamy peanut butter apple dip with crushed peanuts, served with sliced apples"],
  ["Feyereisen Chocolate Chip Cookies", "homemade golden chocolate chip cookies on cooling rack"],
  ["Mark's Fudge", "rich dark chocolate fudge squares on white plate"],
  ["Quiche", "golden broccoli ham swiss cheese quiche in pie dish"],
  ["Puppy Chow", "powdered sugar coated chex cereal muddy buddies in bowl"],
  ["Hot Chicken Salad", "baked chicken casserole topped with crushed potato chips"],
  ["Wild Rice Hot Dish (Robin's)", "wild rice and hamburger hotdish casserole"],
  ["Mark's Chow Mein", "pork chow mein with celery over rice and noodles"],
  ["Mark's Meatloaf", "sliced meatloaf with ketchup glaze on dinner plate"],
  ["Wren's Bagel Dip", "creamy herb dip with corned beef served with sliced bagels"],
  ["Wren's Cuban Toasties", "golden bubbly ham and swiss baguette appetizers on baking sheet"],
  ["Wren's Salsa", "fresh chunky homemade salsa in bowl with tomatoes and peppers"],
  ["Wren's Taco Dip", "layered taco dip with lettuce cheese and salsa on platter"],
  ["Mark's Monster Bars", "thick peanut butter oat bars with M&Ms and chocolate chips"],
  ["Wren's Fruit Pizza", "colorful fruit pizza with berries and cream cheese on cookie crust"],
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
  ["Skinny Pancakes", "stack of thin golden pancakes on plate"],
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
  ["Cranberry Cake", "cranberry upside down cake on plate"],
  ["Rhubarb Crunch", "baked rhubarb crunch dessert with oat crumble topping"],
  ["Sour Cream Rhubarb Dessert", "rhubarb sour cream dessert with streusel topping"],
  ["Pumpkin Pie", "classic pumpkin pie in pie dish"],
  ["Barb's Wild Rice Hotdish", "wild rice ground beef casserole hotdish"],
  ["Gladys Hotdish", "ground beef noodle hotdish with mixed vegetables"],
  ["Hearty Beef 'N' Potato Casserole", "beef potato casserole with melted cheddar cheese"],
  ["Tator Tot Hotdish", "tater tot hotdish casserole with cheese on top"],
  ["Chicken Spaghetti", "cheesy chicken spaghetti casserole baked golden"],
  ["Easy Stew", "hearty beef stew with potatoes carrots in bowl"],
  ["Mock Chili", "bowl of ground beef chili with kidney beans"],
  ["Jalapeño Popper Dip", "bubbly baked jalapeño popper dip with breadcrumb crust"],
  ["Pizza Dip", "melted pizza dip with pepperoni and mozzarella"],
  ["Shrimp Dip", "creamy shrimp dip with crackers appetizer platter"],
  ["Coleslaw Dressing", "creamy coleslaw with shredded cabbage and carrots"],
  ["Julie Tartar Sauce", "homemade tartar sauce in small bowl with lemon"],
  ["The World's Best Hot Fudge Sauce", "warm chocolate hot fudge sauce dripping over ice cream"],
  ["Glaze for Cinnamon Rolls", "vanilla glaze drizzled over warm cinnamon rolls"],
  ["Refrigerator Pickles", "jar of homemade dill refrigerator pickles"],
  ["Zucchini Jam", "jar of pink zucchini pineapple jam on toast"],
  ['Glazed "Green Chunk" Pickles', "glazed sweet pickles in mason jar"],
  ["Crockpot Apple Butter", "jar of dark cinnamon apple butter with fresh apples"],
  ["Fish Fry (Grandma & Grandpa's)", "golden fried fish fillets on plate"],
  ["Mustard Marinated Steak", "grilled steak with mustard marinade sliced on cutting board"],
  ["Soy Chicken Wings", "glazed soy chicken wings on platter"],
  ["Orange Jello", "bright orange jello dessert in glass dish"],
  ["Jello Salad", "colorful jello salad with fruit and marshmallows"],
  ["Winter Salad", "apple walnut celery salad in serving bowl"],
  ["Chocolate Martini", "chocolate martini cocktail in elegant glass"],
  ["White Russian Pudding Shots", "white russian pudding shots with whipped cream topping"],
];

function normalizeTitle(t) {
  return String(t || "")
    .replace(/\u2019/g, "'")
    .replace(/[\u2018\u201B]/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"');
}

const RECIPE_PROMPTS = Object.fromEntries(RECIPE_PROMPTS_RAW);
const RECIPE_PROMPTS_NORMALIZED = new Map(
  [...Object.entries(RECIPE_PROMPTS)].map(([k, v]) => [normalizeTitle(k), v])
);

/**
 * Get recipe-accurate prompt for image generation, or null if not mapped.
 */
export function getRecipePrompt(title) {
  return RECIPE_PROMPTS[title] || RECIPE_PROMPTS_NORMALIZED.get(normalizeTitle(title));
}
