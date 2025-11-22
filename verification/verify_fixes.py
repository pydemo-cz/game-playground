from playwright.sync_api import sync_playwright
import time

def verify_fixes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1000, "height": 1000})

        page.goto("http://localhost:8080/mekanix/index.html")
        page.wait_for_selector("#world")
        time.sleep(1)

        # 1. Enter Edit Mode
        page.get_by_text("✎").click()
        time.sleep(0.5)

        # 2. Take screenshot to verify Goal visibility (Level 1 has a goal)
        # Goal should be visible now that rendering uses correct transform
        page.screenshot(path="verification/mekanix_goal_visible.png")
        print("Screenshot taken for goal visibility check.")

        # 3. Add Platform and select it
        page.get_by_role("button", name="+ Plat").click()
        time.sleep(0.2)

        # 4. Take screenshot to verify Gizmo alignment
        # We expect the selection box to be perfectly around the platform in the center
        page.screenshot(path="verification/mekanix_gizmo_align.png")
        print("Screenshot taken for gizmo alignment check.")

        browser.close()

if __name__ == "__main__":
    verify_fixes()
