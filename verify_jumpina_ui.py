from playwright.sync_api import sync_playwright

def verify_ui_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 720})

        # Load Editor
        page.goto("http://localhost:8080/jumpina/index.html")
        page.wait_for_selector("#game-canvas")

        # 1. Check if Context Controls Container exists
        # It is created dynamically in updateContextControls(activeTool)
        # Initially init calls updateContextControls('move') or 'platform'

        # Wait a bit for init
        page.wait_for_timeout(1000)

        # 2. Click on Platform Tool
        page.click('button[data-tool="platform"]')
        page.wait_for_timeout(500)

        # Expect "Upload Platform" button in #context-controls
        upload_btn = page.locator("#context-controls button").first
        if upload_btn.count() > 0 and "Upload Platform" in upload_btn.inner_text():
            print("Platform upload button visible.")
        else:
             print(f"Platform upload button missing.")

        # 3. Click on Player Tool
        page.click('button[data-tool="player"]')
        page.wait_for_timeout(500)

        # Expect "Upload Idle" and "Upload Jump"
        btns = page.locator("#context-controls button")
        texts = [btns.nth(i).inner_text() for i in range(btns.count())]
        if "Upload Idle" in texts and "Upload Jump" in texts:
             print("Player upload buttons visible.")
        else:
             print(f"Player buttons missing. Found: {texts}")

        # 4. Click on Controls Tool
        page.click('button[data-tool="controls"]')
        page.wait_for_timeout(500)

        btns = page.locator("#context-controls button")
        texts = [btns.nth(i).inner_text() for i in range(btns.count())]
        if "Upload Left" in texts and "Upload Jump" in texts:
             print("Controls upload buttons visible.")
        else:
             print(f"Controls buttons missing. Found: {texts}")

        page.screenshot(path="verification_ui_final.png")
        browser.close()

if __name__ == "__main__":
    verify_ui_changes()
