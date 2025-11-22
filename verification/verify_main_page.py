from playwright.sync_api import sync_playwright
import time

def verify_main_page_order():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto("http://localhost:8080/index.html")

        # Wait for game tiles
        page.wait_for_selector(".game-tile")

        # Get all game titles
        titles = page.locator(".game-tile h2").all_inner_texts()
        print(f"Game titles found: {titles}")

        # Check if Mekanix is first (assuming it's the last one in games.json)
        # Based on previous steps, we added Mekanix last.
        if titles and titles[0] == "Mekanix":
            print("SUCCESS: Mekanix is first!")
        else:
            print(f"FAILURE: First game is {titles[0] if titles else 'None'}")

        page.screenshot(path="verification/main_page_order.png")

        browser.close()

if __name__ == "__main__":
    verify_main_page_order()
