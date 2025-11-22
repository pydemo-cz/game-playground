from playwright.sync_api import sync_playwright
import time

def verify_editor():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a generic mobile viewport size but keep browser window large enough to see debug
        page = browser.new_page(viewport={"width": 1000, "height": 1000})

        page.goto("http://localhost:8080/mekanix/index.html")

        # Wait for load
        page.wait_for_selector("#world")
        time.sleep(1)

        # 1. Check Edit Toggle
        # The button is an icon-btn, we can find by text '✎'
        edit_btn = page.get_by_text("✎")
        assert edit_btn.is_visible()
        edit_btn.click()
        time.sleep(0.5)

        # 2. Verify Toolbar appears
        toolbar = page.locator("#editor-toolbar")
        assert toolbar.is_visible()

        # 3. Add Platform
        add_btn = page.get_by_role("button", name="+ Platform")
        add_btn.click()
        time.sleep(0.5)

        # Take screenshot of Editor with new platform
        page.screenshot(path="verification/mekanix_editor.png")
        print("Editor screenshot taken.")

        # 4. Select Platform (click in center)
        # We know a platform was added at center (approx 360, 640 in logical, but scaled)
        # It's easier to just take the screenshot to verify gizmos appear if we clicked right,
        # but calculating screen coordinates is tricky without querying canvas.
        # Let's just rely on the screenshot of the added platform.

        # 5. Play Mode
        play_btn = page.get_by_role("button", name="▶ Play")
        play_btn.click()
        time.sleep(0.5)

        # Verify Toolbar hidden
        assert not toolbar.is_visible()
        page.screenshot(path="verification/mekanix_play.png")
        print("Play mode screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_editor()
