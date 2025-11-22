from playwright.sync_api import sync_playwright
import time

def verify_mekanix():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the game
        page.goto("http://localhost:8080/mekanix/index.html")

        # Wait for canvas to load and physics to settle slightly
        page.wait_for_selector("#world")
        time.sleep(1)

        # Verify UI elements exist
        assert page.is_visible("#level-info")
        assert page.is_visible("#reset-btn")

        # Take initial screenshot (Start of Level 1)
        page.screenshot(path="verification/mekanix_start.png")
        print("Initial screenshot taken.")

        # Simulate interaction (Click/Touch) to contract the player
        # Click in the center of screen
        page.mouse.down(button="left")
        time.sleep(0.5) # Hold for 0.5s
        page.screenshot(path="verification/mekanix_contracted.png")
        print("Contracted screenshot taken.")

        page.mouse.up(button="left")
        time.sleep(1.0) # Wait for relax/move
        page.screenshot(path="verification/mekanix_relaxed.png")
        print("Relaxed screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_mekanix()
