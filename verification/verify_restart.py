from playwright.sync_api import Page, expect, sync_playwright
import os

def verify_restart_logic(page: Page):
    cwd = os.getcwd()
    url = f"file://{cwd}/slice/index.html"

    print(f"Navigating to {url}")
    page.goto(url)

    # Start game
    page.get_by_role("button", name="START").click()
    page.wait_for_timeout(500)

    # Simulate filling some area (modify grid directly)
    print("Simulating filled area...")
    page.evaluate("""
        const r = 10, c = 10;
        if (gameState.grid[r] && gameState.grid[r][c] !== undefined) {
            gameState.grid[r][c] = 1; // CELL_FILLED
            gameState.score = 100;
        }
    """)

    # Verify score updated
    score_text = page.locator("#score").inner_text()
    print(f"Score before death: {score_text}")

    # Trigger Game Over
    print("Triggering Game Over...")
    page.evaluate("gameState.lives = 0; handleGameOver();")

    # Click Retry
    print("Clicking Retry...")
    retry_btn = page.get_by_role("button", name="RETRY")
    expect(retry_btn).to_be_visible()
    retry_btn.click()

    # Check Score Reset
    expect(page.locator("#score")).to_have_text("Score: 0")
    print("Score reset confirmed")

    # Check Grid Reset
    # We check the cell at (10, 10) which we manually filled. It should be 0 (EMPTY) now.
    cell_value = page.evaluate("gameState.grid[10][10]")
    if cell_value == 0:
        print("Grid reset confirmed (Cell 10,10 is EMPTY)")
    else:
        print(f"Grid reset FAILED (Cell 10,10 is {cell_value})")
        exit(1)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 375, 'height': 667})
        try:
            verify_restart_logic(page)
        finally:
            browser.close()
