import os
from playwright.sync_api import sync_playwright

def verify_visuals():
    file_path = os.path.abspath("jumpina/index.html")
    url = f"file://{file_path}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url)

        # Select Controls tool
        page.click("button[data-tool=\"controls\"]")
        page.wait_for_timeout(500)

        # Take screenshot
        page.screenshot(path="verification/controls_overlay.png")
        print("Screenshot saved to verification/controls_overlay.png")
        browser.close()

if __name__ == "__main__":
    verify_visuals()
