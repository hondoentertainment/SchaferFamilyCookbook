import re
import json
import uuid

def parse_recipe_markdown(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    recipes = []
    current_recipe = None
    section = None
    
    # Simple state machine
    for line in lines:
        line = line.strip()
        if not line or line.startswith('---'):
            continue
            
        # Detect Header (Recipe Title)
        if line.startswith('### '):
            if current_recipe:
                recipes.append(current_recipe)
            
            title = line.replace('### ', '').strip()
            # Skip non-recipe headers
            if title in ['The Oehler Family', 'The Schafer Family', 'Festive Apple Dip']: 
                # Festive Apple Dip IS a recipe, but 'The Oehler Family' isn't
                pass
            
            current_recipe = {
                "id": str(uuid.uuid4())[:8],
                "title": title,
                "contributor": "Family",
                "category": "Main", # Default, will map later if possible or just manual
                "ingredients": [],
                "instructions": [],
                "image": "https://images.unsplash.com/photo-1495195129352-aec325a55b65?auto=format&fit=crop&q=80&w=800", # Generic
                "notes": ""
            }
            section = None
            continue

        if not current_recipe:
            continue

        # Detect Metadata
        if line.startswith('**Contributor:**'):
            current_recipe['contributor'] = line.replace('**Contributor:**', '').strip()
            continue

        if line.startswith('**Ingredients:**'):
            section = 'ingredients'
            continue

        if line.startswith('**Instructions:**'):
            section = 'instructions'
            continue

        if line.startswith('**Notes:**'):
            section = 'notes'
            current_recipe['notes'] = line.replace('**Notes:**', '').strip()
            continue

        # Content Parsing
        if section == 'ingredients':
            if line.startswith('- '):
                current_recipe['ingredients'].append(line.replace('- ', ''))
        
        elif section == 'instructions':
            # Remove "1. ", "2. ", etc
            clean = re.sub(r'^\d+\.\s*', '', line)
            if clean:
                current_recipe['instructions'].append(clean)
                
        elif section == 'notes':
            current_recipe['notes'] += " " + line

    if current_recipe:
        recipes.append(current_recipe)

    # Filter out non-recipes (heuristics)
    valid_recipes = [r for r in recipes if r['ingredients']]
    
    # Categorize (Basic Heuristic)
    for r in valid_recipes:
        t = r['title'].lower()
        if 'cookie' in t or 'bar' in t or 'cake' in t or 'brownie' in t or 'pie' in t or 'fudge' in t or 'dessert' in t or 'chow' in t:
             r['category'] = 'Dessert'
        elif 'soup' in t or 'stew' in t or 'chili' in t:
             r['category'] = 'Main' # technically soup/appetizer, but Main is safe
        elif 'salad' in t and 'chicken' not in t:
             r['category'] = 'Side'
        elif 'dip' in t or 'salsa' in t:
             r['category'] = 'Dip/Sauce'
        elif 'bread' in t:
             r['category'] = 'Bread'
        elif 'breakfast' in t or 'egg' in t or 'pancake' in t:
             r['category'] = 'Breakfast'
        elif 'snack' in t or 'popcorn' in t:
             r['category'] = 'Snack'

    return valid_recipes

recipes = parse_recipe_markdown('c:/Users/kyle/Downloads/Schafer_Family_Cookbook_Complete.md')
with open('c:/Users/kyle/Downloads/SchaferFamilyCookbook/src/data/recipes.json', 'w', encoding='utf-8') as f:
    json.dump(recipes, f, indent=2)

print(f"Successfully converted {len(recipes)} recipes to JSON.")
