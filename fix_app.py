import re

file_path = r'c:\Users\kyle\Downloads\SchaferFamilyCookbook\src\App.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace <Header ... /> with <Header ... onLogout={handleLogout} />
# But only if it doesn't already have it
new_content = re.sub(
    r'<Header(.*?)\s?/>',
    lambda m: f'<Header{m.group(1)} onLogout={{handleLogout}} />' if 'onLogout' not in m.group(0) else m.group(0),
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully updated Header tags in App.tsx")
