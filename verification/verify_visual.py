from playwright.sync_api import sync_playwright
import time

def verify_visual_editor():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 450, "height": 800})

        page.goto("http://localhost:8080/mekanix/index.html")
        page.wait_for_selector("#world")
        time.sleep(1)

        # 1. Enter Edit Mode
        page.get_by_text("✎").click()
        time.sleep(0.5)

        # 2. Verify Properties Panel is GONE
        assert page.locator("#properties-panel").count() == 0
        print("Properties Panel is removed correctly.")

        # 3. Verify Delete Button Exists
        assert page.locator("#tool-delete").is_visible()
        print("Delete button is visible.")

        # 4. Select Joint
        w = page.viewport_size['width']
        h = page.viewport_size['height']
        # Click joint logic (top of V, ~0.80 Y)
        page.mouse.click(w * 0.5, h * 0.80)
        time.sleep(0.5)

        # Screenshot to see Visual Ring
        page.screenshot(path="verification/mekanix_visual_joint.png")
        print("Visual joint screenshot taken.")

        # 5. Select Robot Part
        page.mouse.click(w * 0.5, h * 0.86)
        time.sleep(0.5)

        # Screenshot for Gizmos
        page.screenshot(path="verification/mekanix_visual_gizmos.png")
        print("Visual gizmos screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_visual_editor()
