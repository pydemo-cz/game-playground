from playwright.sync_api import Page, expect, sync_playwright
import os
import re

def verify_slice_game(page: Page):
    # Get the absolute path to the file
    cwd = os.getcwd()
    url = f"file://{cwd}/slice/index.html"

    print(f"Navigating to {url}")
    page.goto(url)

    # Wait for the start button to be visible
    start_btn = page.get_by_role("button", name="START")
    expect(start_btn).to_be_visible()

    # Take a screenshot of the start screen
    page.screenshot(path="verification/slice_start_screen.png")
    print("Start screen captured")

    # Click start
    start_btn.click()

    # Wait for UI to disappear (start screen hidden)
    # Checking if class list contains "hidden" using regex
    expect(page.locator("#start-screen")).to_have_class(re.compile(r"hidden"))

    # Wait a bit for the game to run (enemies to spawn, etc.)
    page.wait_for_timeout(1000)

    # Simulate a mouse down to speed up time (TimeScale = 1.0)
    # We need to simulate mouse input on the canvas
    canvas = page.locator("#gameCanvas")
    box = canvas.bounding_box()
    if box:
        center_x = box['x'] + box['width'] / 2
        center_y = box['y'] + box['height'] / 2

        # Start interaction
        page.mouse.move(center_x, center_y)
        page.mouse.down()

        # Move slightly to trigger direction change?
        page.mouse.move(center_x + 50, center_y) # Right
        page.wait_for_timeout(500)

        page.mouse.move(center_x + 50, center_y + 50) # Down
        page.wait_for_timeout(500)

        page.mouse.up()

    # Capture gameplay
    page.screenshot(path="verification/slice_gameplay.png")
    print("Gameplay captured")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 375, 'height': 667}) # Mobile viewport
        try:
            verify_slice_game(page)
        finally:
            browser.close()
