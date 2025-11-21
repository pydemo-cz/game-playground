from playwright.sync_api import Page, expect, sync_playwright
import os
import re

def verify_slice_game_updates(page: Page):
    # Get the absolute path to the file
    cwd = os.getcwd()
    url = f"file://{cwd}/slice/index.html"

    print(f"Navigating to {url}")
    page.goto(url)

    # Check High Score element exists
    expect(page.locator("#high-score")).to_be_visible()
    print("High Score element found")

    # Start game
    start_btn = page.get_by_role("button", name="START")
    start_btn.click()

    page.wait_for_timeout(500)

    # Simulate Death (Game Over) to check screen clearing
    # We can manipulate the game state via evaluate for testing
    page.evaluate("gameState.lives = 1; handleGameOver();")

    # Check Game Over Screen
    expect(page.locator("#game-over-screen")).to_be_visible()

    # Take screenshot to verify "cleared" background
    page.screenshot(path="verification/slice_gameover_cleared.png")
    print("Game Over screenshot captured")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 375, 'height': 667})
        try:
            verify_slice_game_updates(page)
        finally:
            browser.close()
