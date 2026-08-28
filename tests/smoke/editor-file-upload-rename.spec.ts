import fs from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import {
	createFixtureVaultCopy,
	openFixtureVaultTauri,
	removeFixtureVaultCopy,
} from "../helpers/fixtureVault";
import { triggerMenuCommand } from "./testBridge";

const PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAO+yK9sAAAAASUVORK5CYII=";
const TITLE = "Upload Rename Guard";
const FILENAME = "upload-rename-guard.md";
let tempVaultDir: string;

async function delayImageUploads(page: Page): Promise<void> {
	await page.evaluate(() => {
		const handlers = window.__mockHandlers;
		const saveImage = handlers?.save_image;
		if (!handlers || !saveImage)
			throw new Error("Fixture vault is missing save_image");
		handlers.save_image = async (args) => {
			await new Promise((resolve) => window.setTimeout(resolve, 4_000));
			return saveImage(args);
		};
	});
}

async function createUntitledNote(page: Page): Promise<void> {
	await page.locator("body").click();
	await triggerMenuCommand(page, "file-new-note");
	const titleHeading = page
		.locator('.bn-editor [data-content-type="heading"]')
		.first();
	await expect(titleHeading).toBeVisible({ timeout: 5_000 });
	await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
		/untitled-note-/i,
	);
	await titleHeading.click();
	await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }, testInfo) => {
	testInfo.setTimeout(60_000);
	tempVaultDir = createFixtureVaultCopy();
	await openFixtureVaultTauri(page, tempVaultDir);
});

test.afterEach(() => removeFixtureVaultCopy(tempVaultDir));

test("@smoke delayed slash-menu upload survives an untitled-note rename", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await delayImageUploads(page);
	await createUntitledNote(page);

	await page.keyboard.type(TITLE);
	await expect(
		page.locator('.bn-editor [data-content-type="heading"]').first(),
	).toContainText(TITLE);
	await page.keyboard.press("Enter");
	await page.keyboard.type("/image");
	await page.getByRole("option", { name: /Image/i }).click();

	const fileInput = page.locator('input[type="file"]');
	await expect(fileInput).toBeAttached();
	await fileInput.setInputFiles({
		name: "race.png",
		mimeType: "image/png",
		buffer: Buffer.from(PNG_BASE64, "base64"),
	});

	await expect(page.getByTestId("breadcrumb-filename-trigger")).toContainText(
		"upload-rename-guard",
		{
			timeout: 10_000,
		},
	);
	await expect
		.poll(() => fs.existsSync(`${tempVaultDir}/${FILENAME}`))
		.toBe(true);
	await page.waitForTimeout(4_500);

	await page.locator(".bn-editor").click();
	await page.keyboard.type("Editor remains usable.");
	expect(errors).toEqual([]);
});
