from playwright.sync_api import sync_playwright
import time

def verify_mekanix_advanced_editor():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a portrait viewport to match game aspect ratio logic better
        page = browser.new_page(viewport={"width": 450, "height": 800})

        page.goto("http://localhost:8080/mekanix/index.html")
        page.wait_for_selector("#world")
        time.sleep(1)

        # 1. Enter Edit Mode
        page.get_by_text("✎").click()
        time.sleep(0.5)

        # 2. Select Robot Part (Click near bottom center)
        # Canvas takes full window.
        # Physics scale factor needs to be considered.
        # Robot is at logical (360, ~1100) in 720x1280.
        # 360/720 = 0.5 (X)
        # 1100/1280 = 0.86 (Y)

        w = page.viewport_size['width']
        h = page.viewport_size['height']
        page.mouse.click(w * 0.5, h * 0.86)
        time.sleep(0.5)

        # 3. Check Properties Panel Visibility
        if page.locator("#properties-panel").is_visible():
            print("Properties panel visible.")

            # 4. Modify Property (Width)
            width_input = page.locator("#prop-width")
            width_input.fill("40")
            width_input.press("Enter")
            time.sleep(0.2)

            # 5. Add Tail
            page.locator("#prop-add-end").click()
            time.sleep(0.2)

            page.screenshot(path="verification/mekanix_advanced_edit.png")

            # 6. Delete
            page.locator("#prop-delete").click()
            time.sleep(0.2)
            page.screenshot(path="verification/mekanix_delete.png")

        else:
            print("Could not select robot part with blind click.")
            page.screenshot(path="verification/mekanix_no_select.png")

        browser.close()

if __name__ == "__main__":
    verify_mekanix_advanced_editor()
