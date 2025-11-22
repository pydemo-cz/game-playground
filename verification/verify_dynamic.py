from playwright.sync_api import sync_playwright
import time

def verify_dynamic_edit():
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
        page.mouse.click(w * 0.5, h * 0.86)
        time.sleep(0.5)

        # 3. Verify Gizmos Visible (Properties panel is side effect, but gizmos are drawn on canvas)
        # We take a screenshot to visually confirm Gizmo box around the diagonal part
        page.screenshot(path="verification/mekanix_part_gizmo.png")

        # 4. Verify Joint Selection
        # The pivot joint is roughly at center of V.
        # The V is at (360, 1100) approx. The pivot is at the top vertex.
        # Since parts are angled 30deg, the pivot is higher than center of mass.
        # Let's click slightly above the clicked part center.
        # Part center ~ (360+offset, 1100).
        # Pivot is at (360, 1100 - length/2 * cos(30))?
        # Actually pivot is at top.

        # Let's blindly click where the joint should be: (0.5, 0.80) ?
        page.mouse.click(w * 0.5, h * 0.80)
        time.sleep(0.5)

        # Screenshot joint selection
        page.screenshot(path="verification/mekanix_joint_select.png")

        browser.close()

if __name__ == "__main__":
    verify_dynamic_edit()
