const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

require('dotenv').config();

const Medicine = require('../src/models/medicine');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:8000').replace(/\/$/, '');
const LOGIN_URL = `${FRONTEND_URL}/login`;
const MEDICINE_URL = `${FRONTEND_URL}/admin/medicines`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@healthcare.vn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const MONGO_URI = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/Healthcare';
const EXCEL_FILE = path.resolve(__dirname, 'medicine_data.xlsx');

const SUCCESS_TOAST_TEXTS = [
	'Thêm mới thuốc thành công',
	'Tạo thuốc thành công',
];

function normalizeText(value) {
	return String(value || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeKey(value) {
	return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function fixEncoding(value) {
	if (typeof value !== 'string') {
		return value;
	}

	try {
		const decoded = Buffer.from(value, 'latin1').toString('utf8');
		return decoded.includes('�') ? value : decoded;
	} catch {
		return value;
	}
}

function xpathLiteral(value) {
	const text = String(value);
	if (!text.includes("'")) {
		return `'${text}'`;
	}

	return `concat('${text.replace(/'/g, "',\"'\",'")}')`;
}

function toNumber(value, fieldName) {
	const cleaned = String(value)
		.replace(/,/g, '')
		.replace(/[^0-9.-]/g, '')
		.trim();

	const parsed = Number(cleaned);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Không thể chuyển trường ${fieldName} sang số: ${value}`);
	}

	return parsed;
}

function parseDdMmYyyy(value) {
	const text = String(value || '').trim();
	if (!text) {
		return null;
	}

	const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!match) {
		return null;
	}

	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));

	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return null;
	}

	return date;
}

function formatDateForInput(value) {
	const parsed = parseDdMmYyyy(value);
	if (!parsed) {
		return String(value || '').trim();
	}

	const day = String(parsed.getUTCDate()).padStart(2, '0');
	const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
	const year = parsed.getUTCFullYear();
	return `${day}/${month}/${year}`;
}

function formatDateYyyyMmDdLocal(date) {
	return [
		String(date.getFullYear()),
		String(date.getMonth() + 1).padStart(2, '0'),
		String(date.getDate()).padStart(2, '0'),
	].join('-');
}

function isPastDate(value) {
	const parsed = parseDdMmYyyy(value);
	if (!parsed) {
		return false;
	}

	const today = new Date();
	const currentUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
	return parsed.getTime() < currentUtc;
}

function buildRowStatus(row) {
	const cleanedName = String(row.name || '').trim();
	const quantityText = String(row.quantity ?? '').trim();
	const manufacturerText = String(row.manufacturer || '').trim();
	const unitText = String(row.unit || '').trim();
	const dosageText = String(row.dosageForm || '').trim();
	const priceText = String(row.price ?? '').trim();
	const expiryText = String(row.expiryDate || '').trim();
	const validationErrors = [];

	if (!cleanedName) {
		validationErrors.push('Tên thuốc');
	}

	if (!quantityText) {
		validationErrors.push('Số lượng');
	}

	if (!manufacturerText) {
		validationErrors.push('Nhà sản xuất');
	}

	if (!unitText) {
		validationErrors.push('Đơn vị');
	}

	if (!dosageText) {
		validationErrors.push('Dạng thuốc');
	}

	if (!expiryText) {
		validationErrors.push('Hạn sử dụng');
	}

	if (!priceText) {
		validationErrors.push('Giá');
	}

	if (validationErrors.length > 0) {
		return { mode: 'validation', reason: `Thiếu dữ liệu bắt buộc: ${validationErrors.join(', ')}`, validationErrors };
	}

	const quantity = Number(String(quantityText).replace(/,/g, ''));
	if (!Number.isFinite(quantity)) {
		return { mode: 'skip', reason: `Số lượng không hợp lệ: ${row.quantity}`, validationErrors: [] };
	}

	if (quantity <= 0) {
		return { mode: 'skip', reason: `Số lượng không hợp lệ: ${row.quantity}`, validationErrors: [] };
	}

	if (!Number.isInteger(quantity)) {
		return { mode: 'skip', reason: `Số lượng phải là số nguyên: ${row.quantity}`, validationErrors: [] };
	}

	const price = Number(String(priceText).replace(/,/g, ''));
	if (!Number.isFinite(price)) {
		return { mode: 'skip', reason: `Đơn giá không hợp lệ: ${row.price}`, validationErrors: [] };
	}

	if (price <= 0) {
		return { mode: 'skip', reason: `Đơn giá không hợp lệ: ${row.price}`, validationErrors: [] };
	}

	const expiryDate = parseDdMmYyyy(expiryText);
	if (!expiryDate) {
		return { mode: 'skip', reason: `Ngày hết hạn không đúng định dạng DD/MM/YYYY: ${row.expiryDate}`, validationErrors: [] };
	}

	if (isPastDate(expiryText)) {
		return { mode: 'skip', reason: `Ngày hết hạn nằm trong quá khứ: ${row.expiryDate}`, validationErrors: [] };
	}

	return { mode: 'success', reason: '', validationErrors: [] };
}

function pickFromAliases(normalizedRow, aliases) {
	for (const alias of aliases) {
		const key = normalizeKey(alias);
		if (Object.prototype.hasOwnProperty.call(normalizedRow, key)) {
			return normalizedRow[key];
		}
	}

	return undefined;
}

function readWorkbookRows() {
	if (!fs.existsSync(EXCEL_FILE)) {
		throw new Error(`Không tìm thấy file dữ liệu: ${EXCEL_FILE}`);
	}

	const workbook = xlsx.readFile(EXCEL_FILE, { cellDates: true });
	const sheetName = workbook.SheetNames[0];

	if (!sheetName) {
		throw new Error('Workbook không có worksheet nào');
	}

	const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

	return rows.map((row, index) => {
		const normalized = {};
		for (const [key, value] of Object.entries(row)) {
			normalized[normalizeKey(key)] = value;
		}

		const name = fixEncoding(String(pickFromAliases(normalized, ['name', 'tên', 'ten', 'medicine name']) ?? ''));
		const quantity = pickFromAliases(normalized, ['quantity', 'số lượng', 'soluong']);
		const manufacturer = fixEncoding(String(pickFromAliases(normalized, ['manufacturer', 'nhà cung cấp', 'nhà sản xuất', 'nha cung cap', 'nha san xuat']) ?? ''));
		const unit = fixEncoding(String(pickFromAliases(normalized, ['unit', 'đơn vị', 'donvi']) ?? ''));
		const dosageForm = fixEncoding(String(pickFromAliases(normalized, ['dosageform', 'dạng bào chế', 'dạng thuốc', 'dang bao che', 'dang thuoc']) ?? ''));
		const expiryDate = fixEncoding(String(pickFromAliases(normalized, ['expirydate', 'ngày hết hạn', 'ngay het han']) ?? ''));
		const price = pickFromAliases(normalized, ['price', 'đơn giá', 'dongia', 'gia']);
		const status = buildRowStatus({ name, quantity, manufacturer, unit, dosageForm, expiryDate, price });

		return {
			__rowNumber: index + 2,
			__mode: status.mode,
			__skipReason: status.reason,
			__validationErrors: status.validationErrors,
			name,
			quantity,
			manufacturer,
			unit,
			dosageForm,
			expiryDate,
			price,
		};
	});
}

async function connectMongo() {
	await mongoose.connect(MONGO_URI);
	console.log(`MongoDB connected: ${MONGO_URI}`);
}

async function buildDriver() {
	const options = new chrome.Options();
	const headless = String(process.env.HEADLESS ?? 'false').toLowerCase() === 'true';

	if (headless) {
		options.addArguments('--headless=new');
	}

	options.addArguments('--start-maximized');
	options.addArguments('--disable-gpu');
	options.addArguments('--no-sandbox');

	return new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

async function waitForVisible(driver, locator, timeout = 15000) {
	const element = await driver.wait(until.elementLocated(locator), timeout);
	await driver.wait(until.elementIsVisible(element), timeout);
	return element;
}

async function waitForClickableByText(driver, texts, timeout = 15000) {
	const needles = texts.map((text) => normalizeText(text));

	return driver.wait(async () => {
		const candidates = await driver.findElements(By.css('button, [role="button"]'));

		for (const candidate of candidates) {
			if (!(await candidate.isDisplayed().catch(() => false))) {
				continue;
			}

			const text = normalizeText(await candidate.getText().catch(() => ''));
			const aria = normalizeText(await candidate.getAttribute('aria-label').catch(() => ''));
			const title = normalizeText(await candidate.getAttribute('title').catch(() => ''));
			const haystack = `${text} ${aria} ${title}`;

			if (needles.some((needle) => needle && haystack.includes(needle))) {
				return candidate;
			}
		}

		return false;
	}, timeout, `Không tìm thấy nút phù hợp: ${texts.join(', ')}`);
}

async function clickByText(driver, texts, timeout = 15000) {
	const element = await waitForClickableByText(driver, texts, timeout);
	await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', element);
	await element.click();
}

async function typeIntoField(driver, labelCandidates, value, timeout = 15000) {
	let input = null;

	for (const labelText of labelCandidates) {
		const locator = By.xpath(
			`//label[contains(normalize-space(.), ${xpathLiteral(labelText)})]/following::input[1]`
		);

		const matches = await driver.findElements(locator);
		for (const match of matches) {
			if (await match.isDisplayed().catch(() => false)) {
				input = match;
				break;
			}
		}

		if (input) {
			break;
		}
	}

	if (!input) {
		throw new Error(`Không tìm thấy ô nhập cho các nhãn: ${labelCandidates.join(', ')}`);
	}

	await driver.wait(until.elementIsVisible(input), timeout);
	await driver.executeScript('arguments[0].scrollIntoView({block:"center"});', input);
	await input.click();
	await input.sendKeys(Key.chord(Key.CONTROL, 'a'));
	await input.sendKeys(Key.BACK_SPACE);
	if (value !== undefined && value !== null) {
		await input.sendKeys(String(value));
		const inputType = String(await input.getAttribute('type').catch(() => '')).toLowerCase();
		if (inputType === 'number') {
			await driver.executeScript(
				`const el = arguments[0];
				 const value = arguments[1];
				 const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
				 setter.call(el, String(value));
				 el.dispatchEvent(new Event('input', { bubbles: true }));
				 el.dispatchEvent(new Event('change', { bubbles: true }));`,
				input,
				String(value)
			);
		}
	}
}

async function loginAsAdmin(driver) {
	const credentialCandidates = [
		{ email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
		{ email: 'doctor@123.com', password: '123456' },
		{ email: 'admin@healthcare.vn', password: 'admin123' },
	];

	let lastError = null;

	for (const credential of credentialCandidates) {
		try {
			await driver.get(LOGIN_URL);

			const emailInput = await waitForVisible(driver, By.css('input[type="email"]'));
			const passwordInput = await waitForVisible(driver, By.css('input[type="password"]'));
			const submitButton = await waitForClickableByText(driver, ['Đăng nhập']);

			await emailInput.sendKeys(credential.email);
			await passwordInput.sendKeys(credential.password);
			await submitButton.click();

			await driver.wait(async () => (await driver.getCurrentUrl()).includes('/admin'), 12000);
			console.log(`Đăng nhập Admin thành công bằng tài khoản: ${credential.email}`);
			return;
		} catch (error) {
			lastError = error;
		}
	}

	throw new Error(`Không đăng nhập được vào khu vực Admin. Thử các tài khoản cấu hình nhưng đều thất bại. Lỗi cuối: ${lastError?.message || lastError}`);
}

async function openMedicineManagement(driver) {
	await driver.get(MEDICINE_URL);
	await waitForVisible(driver, By.xpath(`//h1[contains(normalize-space(), 'Quản lý kho thuốc')]`), 20000);
}

async function waitForToast(driver, expectedTexts, timeout = 12000) {
	return driver.wait(async () => {
		const noticeSelectors = [
			'.ant-message-notice-content',
			'.ant-message-notice',
			'.ant-notification-notice-message',
		];

		for (const selector of noticeSelectors) {
			const notices = await driver.findElements(By.css(selector));
			for (const notice of notices) {
				if (!(await notice.isDisplayed().catch(() => false))) {
					continue;
				}

				const text = await notice.getText().catch(() => '');
				const matched = expectedTexts.find((expected) => text.includes(expected));
				if (matched) {
					return matched;
				}
			}
		}

		const bodyText = await driver.findElement(By.css('body')).getText();
		return expectedTexts.find((expected) => bodyText.includes(expected)) || false;
	}, timeout, `Không thấy toast phù hợp: ${expectedTexts.join(', ')}`);
}

async function addMedicineRow(driver, row) {
	await clickByText(driver, ['Thêm mới', 'Thêm thuốc']);
	await waitForVisible(driver, By.xpath(`//div[contains(@class,'ant-modal-title') and contains(normalize-space(), 'Thêm thuốc mới')]`), 15000);

	await typeIntoField(driver, ['Tên thuốc', 'Tên'], row.name);
	await typeIntoField(driver, ['Số lượng'], row.quantity);
	await typeIntoField(driver, ['Nhà sản xuất', 'Nhà cung cấp'], row.manufacturer);
	await typeIntoField(driver, ['Đơn vị'], row.unit);
	await typeIntoField(driver, ['Dạng thuốc', 'Dạng bào chế'], row.dosageForm);
	await typeIntoField(driver, ['Hạn sử dụng', 'Ngày hết hạn'], formatDateForInput(row.expiryDate));
	await typeIntoField(driver, ['Giá', 'Đơn giá'], row.price);

	await clickByText(driver, ['Lưu', 'Tạo']);
}

async function assertMedicineInDb(row) {
	const created = await Medicine.findOne({ name: row.name });
	assert.ok(created, `Không tìm thấy bản ghi Medicine trong MongoDB với name = ${row.name}`);

	assert.equal(String(created.name), String(row.name));
	assert.ok(Number.isFinite(Number(created.quantity)), `quantity không hợp lệ trong DB: ${created.quantity}`);
	assert.ok(Number.isFinite(Number(created.price)), `price không hợp lệ trong DB: ${created.price}`);
	assert.equal(String(created.manufacturer || '').trim(), String(row.manufacturer).trim());
	assert.equal(String(created.unit || '').trim(), String(row.unit).trim());
	assert.equal(String(created.dosageForm || '').trim(), String(row.dosageForm).trim());

	if (row.expiryDate) {
		const expectedDate = parseDdMmYyyy(row.expiryDate);
		assert.ok(expectedDate, `Ngày hết hạn không hợp lệ: ${row.expiryDate}`);
		const createdDate = new Date(created.expiryDate);
		assert.equal(formatDateYyyyMmDdLocal(createdDate), formatDateYyyyMmDdLocal(expectedDate));
	}

	return created;
}

function shouldSkipRow(row) {
	return row.__mode === 'skip';
}

function shouldValidateRow(row) {
	return row.__mode === 'validation';
}

function getExpectedValidationMessages(row) {
	const mapping = {
		'Tên thuốc': 'Vui lòng nhập tên thuốc',
		'Số lượng': 'Vui lòng nhập số lượng',
		'Nhà sản xuất': 'Vui lòng nhập nhà sản xuất',
		'Đơn vị': 'Vui lòng nhập đơn vị',
		'Dạng thuốc': 'Vui lòng nhập dạng thuốc',
		'Hạn sử dụng': 'Vui lòng chọn hạn sử dụng',
		'Giá': 'Vui lòng nhập giá',
	};

	return (row.__validationErrors || [])
		.map((label) => mapping[label])
		.filter(Boolean);
}

async function waitForValidationErrors(driver, expectedMessages, timeout = 12000) {
	return driver.wait(async () => {
		const errorElements = await driver.findElements(By.css('.ant-form-item-explain-error'));
		const visibleTexts = [];

		for (const element of errorElements) {
			if (await element.isDisplayed().catch(() => false)) {
				const text = normalizeText(await element.getText().catch(() => ''));
				if (text) {
					visibleTexts.push(text);
				}
			}
		}

		const normalizedExpected = expectedMessages.map(normalizeText);
		const matched = normalizedExpected.every((expected) =>
			visibleTexts.some((actual) => actual.includes(expected))
		);

		return matched ? visibleTexts : false;
	}, timeout, `Không thấy validation errors phù hợp: ${expectedMessages.join(', ')}`);
}

async function rollbackMedicine(row) {
	await Medicine.deleteOne({ name: row.name });
}

async function runRow(driver, row, index) {
	if (shouldSkipRow(row)) {
		console.log(`[SKIP] Row ${index + 1} - ${row.name || 'unknown'} (${row.__skipReason || 'invalid data'})`);
		return 'skipped';
	}

	await openMedicineManagement(driver);

	let created = null;
	try {
		await addMedicineRow(driver, row);
		if (shouldValidateRow(row)) {
			const expectedValidationMessages = getExpectedValidationMessages(row);
			const visibleErrors = await waitForValidationErrors(driver, expectedValidationMessages);

			console.log(`[PASS] Row ${index + 1} - ${row.name} (validation)`);
			console.log(`       Errors: ${visibleErrors.join(' | ')}`);
			return 'passed';
		}

		const toastText = await waitForToast(driver, SUCCESS_TOAST_TEXTS);
		created = await assertMedicineInDb(row);

		console.log(`[PASS] Row ${index + 1} - ${row.name}`);
		console.log(`       Toast: ${toastText}`);
		console.log(`       DB: ${created._id}`);

		return 'passed';
	} catch (error) {
		console.error(`[FAIL] Row ${index + 1} - ${row.name || 'unknown'}`);
		console.error(error);
		return 'failed';
	} finally {
		try {
			if (!shouldSkipRow(row) && !shouldValidateRow(row)) {
				await rollbackMedicine(row);
				console.log(`       Rollback: deleted Medicine with name = ${row.name}`);
			}
		} catch (rollbackError) {
			console.error(`Rollback error for row ${index + 1} - ${row.name}:`, rollbackError);
		}
	}
}

async function main() {
	const driver = await buildDriver();
	let passed = 0;
	let skipped = 0;
	let failed = 0;

	try {
		await connectMongo();
		const rows = readWorkbookRows();

		console.log(`Loaded ${rows.length} medicine rows from Excel`);
		await loginAsAdmin(driver);

		for (const [index, row] of rows.entries()) {
			const result = await runRow(driver, row, index);
			if (result === 'passed') {
				passed += 1;
			} else if (result === 'skipped') {
				skipped += 1;
			} else {
				failed += 1;
			}
		}

		console.log(`Summary: passed=${passed}, skipped=${skipped}, failed=${failed}`);
		if (failed > 0) {
			process.exitCode = 1;
		}
	} finally {
		await driver.quit().catch(() => undefined);
		await mongoose.disconnect().catch(() => undefined);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
