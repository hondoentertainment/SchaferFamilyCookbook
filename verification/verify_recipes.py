from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        print("Navigating to app...")
        page.goto("http://localhost:3000")

        # Login
        print("Logging in...")
        # Check if we are on login screen
        expect(page.get_by_text("Identify Yourself")).to_be_visible()

        # Fill name
        page.get_by_placeholder("e.g. Grandma Joan").fill("Test User")
        page.get_by_role("button", name="Enter The Archive").click()

        # Wait for main content
        print("Waiting for recipes...")
        expect(page.get_by_text("The Schafer Collection")).to_be_visible()

        # Check if recipes are loaded. The code has a specific text if no recipes found, or renders cards.
        # "Recipes Archived" text in hero section.
        expect(page.get_by_text("Recipes Archived")).to_be_visible()

        # Wait a bit for images/animations
        page.wait_for_timeout(2000)

        # Screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/recipes_page.png", full_page=True)

        browser.close()
        print("Done.")

if __name__ == "__main__":
    run()
