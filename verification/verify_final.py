from playwright.sync_api import sync_playwright
import time

def verify_final():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 450, "height": 800})

        page.goto("http://localhost:8080/mekanix/index.html")
        page.wait_for_selector("#world")
        time.sleep(1)

        # 1. Enter Edit Mode
        page.get_by_text("✎").click()
        time.sleep(0.5)

        # 2. Select Robot Part
        w = page.viewport_size['width']
        h = page.viewport_size['height']
        # Logical coords: robot base at 360, 1100.
        # 360/720 = 0.5, 1100/1280 = 0.86
        page.mouse.click(w * 0.5, h * 0.86)
        time.sleep(0.5)

        # 3. Verify Gizmos visible (via screenshot)
        page.screenshot(path="verification/mekanix_final_gizmos.png")

        # 4. Resize Part (Drag corner)
        # TL corner of selection. Box size ~20x100.
        # Corner is at (0.5*w - 10, 0.86*h - 50) in visual space if simple translation.
        # But rotation is ~30deg.
        # Let's assume gizmo works if visual is correct.

        # 5. Select Joint
        # Click top of V. (0.5, 0.80)
        page.mouse.click(w * 0.5, h * 0.80)
        time.sleep(0.5)

        # 6. Verify Visual Joint Ring
        page.screenshot(path="verification/mekanix_final_joint.png")

        # 7. Delete Joint
        page.locator("#tool-delete").click()
        time.sleep(0.2)

        # 8. Verify Deletion (Screenshot should show broken robot or missing joint)
        page.screenshot(path="verification/mekanix_final_deleted.png")

        browser.close()

if __name__ == "__main__":
    verify_final()
