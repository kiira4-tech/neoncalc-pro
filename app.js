document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // =========================================================
    // NEONCALC PRO - FINAL CORRECTED APP.JS
    // =========================================================

    // ---------------------------------------------------------
    // GLOBAL STATE
    // ---------------------------------------------------------
    let currentExpression = "";
    let justCalculated = false;
    let angleMode = "DEG";

    const HISTORY_KEY = "neoncalc_history";
    const THEME_KEY = "neoncalc_theme";

    // ---------------------------------------------------------
    // DOM HELPERS
    // ---------------------------------------------------------
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // ---------------------------------------------------------
    // BASIC CALCULATOR
    // ---------------------------------------------------------

    function updateCalculatorDisplay() {
        const expressionEl = $("#expression");
        const resultEl = $("#result");
        const displayEl = $("#display");

        if (expressionEl) {
            expressionEl.textContent = currentExpression || "0";
        }

        if (displayEl) {
            displayEl.value = currentExpression || "";
        }

        if (resultEl && !justCalculated) {
            resultEl.textContent = "0";
        }
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) {
            return "Error";
        }

        if (Math.abs(value) < 1e-12) {
            value = 0;
        }

        if (Number.isInteger(value)) {
            return value.toLocaleString("en-IN");
        }

        return Number(value.toPrecision(12)).toLocaleString("en-IN", {
            maximumFractionDigits: 10
        });
    }

    function cleanNumberString(value) {
        return String(value).replace(/,/g, "");
    }

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function isOperator(char) {
        return ["+", "-", "*", "/", "^"].includes(char);
    }

    function isValueEndingExpression(expr) {
        if (!expr) return false;

        const last = expr.slice(-1);

        return (
            /[0-9)]/.test(last) ||
            expr.endsWith("π") ||
            expr.endsWith("pi") ||
            expr.endsWith("e") ||
            last === "!"
        );
    }

    function isValueStartingExpression(value) {
        return (
            /^[0-9.]/.test(value) ||
            value === "(" ||
            value === "π" ||
            value === "pi" ||
            value === "e" ||
            value.includes("(")
        );
    }

    // ---------------------------------------------------------
    // FACTORIAL
    // ---------------------------------------------------------

    function factorial(n) {
        if (!Number.isFinite(n)) {
            throw new Error("Invalid factorial");
        }

        if (n < 0 || !Number.isInteger(n)) {
            throw new Error("Factorial requires a non-negative integer");
        }

        if (n > 170) {
            throw new Error("Number too large");
        }

        let result = 1;

        for (let i = 2; i <= n; i++) {
            result *= i;
        }

        return result;
    }

    function replaceFactorials(expression) {
        let exp = expression;

        // Handle simple numbers: 5!, 10!, 3.0!
        exp = exp.replace(
            /(\d+(?:\.\d+)?)!/g,
            "fact($1)"
        );

        // Handle closing parenthesis:
        // (5)!  -> fact((5))
        // (2+3)! -> fact((2+3))
        let safety = 0;

        while (/\([^()]*\)!/.test(exp) && safety < 100) {
            exp = exp.replace(
                /(\([^()]*\))!/g,
                "fact($1)"
            );

            safety++;
        }

        return exp;
    }

    // ---------------------------------------------------------
    // SCIENTIFIC MATH
    // ---------------------------------------------------------

    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    function sin(value) {
        return angleMode === "DEG"
            ? Math.sin(toRadians(value))
            : Math.sin(value);
    }

    function cos(value) {
        return angleMode === "DEG"
            ? Math.cos(toRadians(value))
            : Math.cos(value);
    }

    function tan(value) {
        const angle = angleMode === "DEG"
            ? toRadians(value)
            : value;

        // Prevent obvious undefined tangent values.
        const cosValue = Math.cos(angle);

        if (Math.abs(cosValue) < 1e-12) {
            throw new Error("Undefined");
        }

        return Math.tan(angle);
    }

    function sqrt(value) {
        if (value < 0) {
            throw new Error("Invalid sqrt");
        }

        return Math.sqrt(value);
    }

    function log10(value) {
        if (value <= 0) {
            throw new Error("Invalid log");
        }

        return Math.log10(value);
    }

    function ln(value) {
        if (value <= 0) {
            throw new Error("Invalid ln");
        }

        return Math.log(value);
    }

    // ---------------------------------------------------------
    // EXPRESSION NORMALIZATION
    // ---------------------------------------------------------

    function normalizeExpression(expression) {
        let exp = cleanNumberString(expression);

        exp = exp
            .replace(/×/g, "*")
            .replace(/÷/g, "/")
            .replace(/−/g, "-")
            .replace(/π/g, "pi");

        // Convert x² to x^2
        exp = exp.replace(/²/g, "^2");

        // Remove spaces
        exp = exp.replace(/\s+/g, "");

        return exp;
    }

    function addImplicitMultiplication(expression) {
        let exp = expression;

        // 2pi -> 2*pi
        exp = exp.replace(
            /(\d|\)|!)(pi|e)/g,
            "$1*$2"
        );

        // pi2 -> pi*2
        exp = exp.replace(
            /(pi|e)(\d|\()/g,
            "$1*$2"
        );

        // 2( -> 2*(
        exp = exp.replace(
            /(\d|\)|!)(\()/g,
            "$1*$2"
        );

        // )( -> )*(
        exp = exp.replace(
            /(\))(\()/g,
            "$1*$2"
        );

        // 2sin(30), 3sqrt(9), pi sin(...)
        exp = exp.replace(
            /(\d|\)|!|pi|e)(?=(sin|cos|tan|sqrt|log|ln)\()/g,
            "$1*"
        );

        return exp;
    }

    // ---------------------------------------------------------
    // SAFE EXPRESSION CALCULATOR
    // ---------------------------------------------------------

    function calculateExpression(expression) {
        let exp = normalizeExpression(expression);

        if (!exp) {
            throw new Error("Empty expression");
        }

        exp = addImplicitMultiplication(exp);

        // Basic validation.
        if (!/^[0-9+\-*/().^%!a-zA-Z_]+$/.test(exp)) {
            throw new Error("Invalid characters");
        }

        // Only allow our supported functions/constants.
        const allowedNames = [
            "sin",
            "cos",
            "tan",
            "sqrt",
            "log",
            "ln",
            "fact",
            "pi",
            "e"
        ];

        const names = exp.match(/[a-zA-Z_]+/g) || [];

        for (const name of names) {
            if (!allowedNames.includes(name)) {
                throw new Error("Invalid function");
            }
        }

        // Parentheses balance.
        let balance = 0;

        for (const char of exp) {
            if (char === "(") balance++;
            if (char === ")") balance--;

            if (balance < 0) {
                throw new Error("Invalid parentheses");
            }
        }

        if (balance !== 0) {
            throw new Error("Missing parentheses");
        }

        // Replace factorial.
        exp = replaceFactorials(exp);

        // Convert percentage to decimal.
        exp = exp.replace(
            /(\d+(?:\.\d+)?)%/g,
            "($1/100)"
        );

        // Power operator.
        exp = exp.replace(/\^/g, "**");

        // Evaluate only with explicitly provided functions.
        const evaluator = new Function(
            "sin",
            "cos",
            "tan",
            "sqrt",
            "log",
            "ln",
            "fact",
            "pi",
            "e",
            `"use strict"; return (${exp});`
        );

        const result = evaluator(
            sin,
            cos,
            tan,
            sqrt,
            log10,
            ln,
            factorial,
            Math.PI,
            Math.E
        );

        if (typeof result !== "number" || !Number.isFinite(result)) {
            throw new Error("Invalid result");
        }

        return result;
    }

    // ---------------------------------------------------------
    // CALCULATOR INPUT
    // ---------------------------------------------------------

    function shouldInsertMultiplicationBefore(value) {
        if (!currentExpression) return false;

        const last = currentExpression.slice(-1);

        const previousIsValue =
            /[0-9)]/.test(last) ||
            last === "!" ||
            currentExpression.endsWith("π") ||
            currentExpression.endsWith("pi") ||
            currentExpression.endsWith("e");

        const incomingIsValue =
            value === "(" ||
            value === "π" ||
            value === "pi" ||
            value === "e" ||
            /^[0-9.]/.test(value) ||
            value.endsWith("(");

        return previousIsValue && incomingIsValue;
    }

    function addCalculatorValue(value) {
        if (value === undefined || value === null) return;

        value = String(value);

        // After result, entering a number starts a new calculation.
        if (justCalculated) {
            if (
                /^[0-9.]$/.test(value) ||
                value === "(" ||
                value === "π" ||
                value === "pi" ||
                value === "e"
            ) {
                currentExpression = "";
            }

            justCalculated = false;
        }

        // -----------------------------------------------------
        // Decimal handling
        // -----------------------------------------------------
        if (value === ".") {
            const lastNumber = currentExpression.split(/[+\-*/^()]/).pop();

            if (lastNumber.includes(".")) {
                return;
            }

            if (
                !currentExpression ||
                isOperator(currentExpression.slice(-1)) ||
                currentExpression.slice(-1) === "("
            ) {
                currentExpression += "0.";
            } else {
                currentExpression += ".";
            }

            updateCalculatorDisplay();
            return;
        }

        // -----------------------------------------------------
        // Unary minus handling
        // -----------------------------------------------------
        if (value === "-") {
            const last = currentExpression.slice(-1);

            if (
                !currentExpression ||
                last === "(" ||
                isOperator(last)
            ) {
                // Prevent duplicate unary minus.
                if (last === "-") {
                    return;
                }

                currentExpression += "-";
                updateCalculatorDisplay();
                return;
            }

            currentExpression += "-";
            updateCalculatorDisplay();
            return;
        }

        // -----------------------------------------------------
        // Other operators
        // -----------------------------------------------------
        if (["+", "*", "/", "^"].includes(value)) {
            if (!currentExpression) {
                if (value === "^" || value === "*" || value === "/") {
                    return;
                }
            }

            const last = currentExpression.slice(-1);

            if (isOperator(last)) {
                // If last is unary minus, don't overwrite it.
                if (
                    last === "-" &&
                    (
                        currentExpression.length === 1 ||
                        isOperator(
                            currentExpression.slice(-2, -1)
                        ) ||
                        currentExpression.slice(-2, -1) === "("
                    )
                ) {
                    return;
                }

                currentExpression =
                    currentExpression.slice(0, -1) + value;
            } else {
                currentExpression += value;
            }

            justCalculated = false;
            updateCalculatorDisplay();
            return;
        }

        // -----------------------------------------------------
        // Function insertion
        // -----------------------------------------------------
        if (
            value.endsWith("(") &&
            (
                value.startsWith("sin") ||
                value.startsWith("cos") ||
                value.startsWith("tan") ||
                value.startsWith("sqrt") ||
                value.startsWith("log") ||
                value.startsWith("ln")
            )
        ) {
            if (shouldInsertMultiplicationBefore(value)) {
                currentExpression += "*";
            }

            currentExpression += value;
            updateCalculatorDisplay();
            return;
        }

        // -----------------------------------------------------
        // Constants
        // -----------------------------------------------------
        if (value === "π" || value === "pi" || value === "e") {
            if (shouldInsertMultiplicationBefore(value)) {
                currentExpression += "*";
            }

            currentExpression += value;
            updateCalculatorDisplay();
            return;
        }

        // -----------------------------------------------------
        // Opening bracket
        // -----------------------------------------------------
        if (value === "(") {
            if (shouldInsertMultiplicationBefore(value)) {
                currentExpression += "*";
            }

            currentExpression += "(";
            updateCalculatorDisplay();
            return;
        }

        // -----------------------------------------------------
        // Factorial
        // -----------------------------------------------------
        if (value === "!") {
            if (isValueEndingExpression(currentExpression)) {
                currentExpression += "!";
            }

            updateCalculatorDisplay();
            return;
        }

        // -----------------------------------------------------
        // Square
        // -----------------------------------------------------
        if (value === "^2") {
            if (isValueEndingExpression(currentExpression)) {
                currentExpression += "^2";
            }

            updateCalculatorDisplay();
            return;
        }

        // -----------------------------------------------------
        // Normal value
        // -----------------------------------------------------
        if (shouldInsertMultiplicationBefore(value)) {
            currentExpression += "*";
        }

        currentExpression += value;

        updateCalculatorDisplay();
    }

    // ---------------------------------------------------------
    // CALCULATE RESULT
    // ---------------------------------------------------------

    function performCalculation() {
        if (!currentExpression) return;

        try {
            const expressionForHistory = currentExpression;
            const result = calculateExpression(currentExpression);

            const formattedResult = formatNumber(result);

            const resultEl = $("#result");

            if (resultEl) {
                resultEl.textContent = formattedResult;
            }

            justCalculated = true;

            saveToHistory(
                expressionForHistory,
                result
            );

        } catch (error) {
            console.error("Calculation error:", error);

            const resultEl = $("#result");

            if (resultEl) {
                resultEl.textContent = "Error";
            }

            justCalculated = false;
        }
    }

    // ---------------------------------------------------------
    // CLEAR
    // ---------------------------------------------------------

    function clearCalculator() {
        currentExpression = "";
        justCalculated = false;

        const resultEl = $("#result");

        if (resultEl) {
            resultEl.textContent = "0";
        }

        updateCalculatorDisplay();
    }

    // ---------------------------------------------------------
    // BACKSPACE
    // ---------------------------------------------------------

    function deleteLast() {
        if (justCalculated) {
            clearCalculator();
            return;
        }

        if (!currentExpression) return;

        const functionNames = [
            "sqrt(",
            "sin(",
            "cos(",
            "tan(",
            "log(",
            "ln("
        ];

        for (const fn of functionNames) {
            if (currentExpression.endsWith(fn)) {
                currentExpression = currentExpression.slice(
                    0,
                    -fn.length
                );

                updateCalculatorDisplay();
                return;
            }
        }

        if (currentExpression.endsWith("pi")) {
            currentExpression = currentExpression.slice(0, -2);
        } else {
            currentExpression = currentExpression.slice(0, -1);
        }

        updateCalculatorDisplay();
    }

    // ---------------------------------------------------------
    // COPY RESULT
    // ---------------------------------------------------------

    async function copyResult() {
        const resultEl = $("#result");

        if (!resultEl) return;

        const text = resultEl.textContent.trim();

        if (!text || text === "0" || text === "Error") {
            return;
        }

        const cleanText = text.replace(/,/g, "");

        try {
            await navigator.clipboard.writeText(cleanText);

            const button = $("#copyResult");

            if (button) {
                const original = button.innerHTML;

                button.innerHTML = "✓ Copied";

                setTimeout(() => {
                    button.innerHTML = original;
                }, 1200);
            }
        } catch (error) {
            console.error("Copy failed:", error);
        }
    }

    // ---------------------------------------------------------
    // SCIENTIFIC CALCULATOR
    // ---------------------------------------------------------

    function toggleScientificCalculator() {
        const keypad = $("#scientificKeypad");
        const button = $("#toggleScientific");

        if (!keypad) return;

        const isHidden =
            keypad.style.display === "none" ||
            getComputedStyle(keypad).display === "none";

        keypad.style.display = isHidden ? "grid" : "none";

        if (button) {
            button.textContent = isHidden
                ? "Basic"
                : "Scientific";
        }
    }

    function toggleAngleMode() {
        angleMode =
            angleMode === "DEG"
                ? "RAD"
                : "DEG";

        const buttons = $$(".mode-btn");

        buttons.forEach((button) => {
            button.textContent = angleMode;
        });
    }

    // ---------------------------------------------------------
    // HISTORY
    // ---------------------------------------------------------

    function getHistory() {
        try {
            const data = localStorage.getItem(HISTORY_KEY);

            if (!data) return [];

            const parsed = JSON.parse(data);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {
            console.error("History read error:", error);
            return [];
        }
    }

    function saveToHistory(expression, result) {
        try {
            const history = getHistory();

            history.unshift({
                expression: String(expression),
                result: Number(result),
                time: new Date().toISOString()
            });

            const limitedHistory = history.slice(0, 50);

            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(limitedHistory)
            );

            renderHistory();

        } catch (error) {
            console.error("History save error:", error);
        }
    }

    function renderHistory() {
        const list = $("#historyList");
        const empty = $("#historyEmpty");

        if (!list) return;

        const history = getHistory();

        if (!history.length) {
            list.innerHTML = "";

            if (empty) {
                empty.style.display = "block";
            }

            return;
        }

        if (empty) {
            empty.style.display = "none";
        }

        list.innerHTML = history.map((item, index) => {
            const result = formatNumber(Number(item.result));

            return `
                <div class="history-item">
                    <div class="history-expression">
                        ${escapeHTML(item.expression)}
                    </div>

                    <div class="history-result">
                        = ${escapeHTML(result)}
                    </div>

                    <div class="history-actions">
                        <button
                            type="button"
                            class="secondary-btn history-use"
                            data-history-index="${index}"
                        >
                            Use
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }

    function clearHistory() {
        try {
            localStorage.removeItem(HISTORY_KEY);
        } catch (error) {
            console.error("History clear error:", error);
        }

        renderHistory();
    }

    function useHistory(index) {
        const history = getHistory();

        if (!history[index]) return;

        currentExpression =
            String(history[index].expression);

        justCalculated = false;

        updateCalculatorDisplay();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    // ---------------------------------------------------------
    // NAVIGATION
    // ---------------------------------------------------------

    const navigationMap = {
        openEMI: "emiCalculator",
        openAge: "ageCalculator",
        openGST: "gst",
        openBMI: "bmi",
        openCurrency: "currency",
        openUnit: "unit",
        openVoice: "voice",
        openFoodCost: "food-cost"
    };

    function openTool(sectionId) {
        const section = document.getElementById(sectionId);

        if (!section) return;

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    Object.entries(navigationMap).forEach(
        ([buttonId, sectionId]) => {
            const button = document.getElementById(buttonId);

            if (button) {
                button.addEventListener("click", () => {
                    openTool(sectionId);
                });
            }
        }
    );

    // ---------------------------------------------------------
    // EMI CALCULATOR
    // ---------------------------------------------------------

    function calculateEMI() {
        const principal = Number($("#loanAmount")?.value);
        const annualRate = Number($("#interestRate")?.value);
        const years = Number($("#loanTenure")?.value);

        if (
            !Number.isFinite(principal) ||
            !Number.isFinite(annualRate) ||
            !Number.isFinite(years) ||
            principal <= 0 ||
            years <= 0
        ) {
            return;
        }

        const months = years * 12;
        const monthlyRate = annualRate / 12 / 100;

        let emi;

        if (monthlyRate === 0) {
            emi = principal / months;
        } else {
            emi =
                principal *
                monthlyRate *
                Math.pow(
                    1 + monthlyRate,
                    months
                ) /
                (
                    Math.pow(
                        1 + monthlyRate,
                        months
                    ) - 1
                );
        }

        const totalPayment = emi * months;
        const totalInterest = totalPayment - principal;

        if ($("#monthlyEMI")) {
            $("#monthlyEMI").textContent =
                `₹${formatNumber(emi)}`;
        }

        if ($("#totalInterest")) {
            $("#totalInterest").textContent =
                `₹${formatNumber(totalInterest)}`;
        }

        if ($("#totalPayment")) {
            $("#totalPayment").textContent =
                `₹${formatNumber(totalPayment)}`;
        }
    }

    // ---------------------------------------------------------
    // AGE CALCULATOR
    // ---------------------------------------------------------

    function calculateAge() {
        const input = $("#dateOfBirth");

        if (!input || !input.value) return;

        const birthDate = new Date(
            `${input.value}T00:00:00`
        );

        const today = new Date();

        if (birthDate > today) {
            if ($("#ageResult")) {
                $("#ageResult").textContent =
                    "Invalid date";
            }

            return;
        }

        let years =
            today.getFullYear() -
            birthDate.getFullYear();

        let months =
            today.getMonth() -
            birthDate.getMonth();

        let days =
            today.getDate() -
            birthDate.getDate();

        if (days < 0) {
            months--;

            const previousMonth =
                new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    0
                );

            days += previousMonth.getDate();
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        const totalDays = Math.floor(
            (
                today.getTime() -
                birthDate.getTime()
            ) /
            (1000 * 60 * 60 * 24)
        );

        const nextBirthday =
            new Date(
                today.getFullYear(),
                birthDate.getMonth(),
                birthDate.getDate()
            );

        if (nextBirthday < today) {
            nextBirthday.setFullYear(
                today.getFullYear() + 1
            );
        }

        const daysToBirthday = Math.ceil(
            (
                nextBirthday.getTime() -
                today.getTime()
            ) /
            (1000 * 60 * 60 * 24)
        );

        if ($("#ageResult")) {
            $("#ageResult").textContent =
                `${years} years, ${months} months, ${days} days`;
        }

        if ($("#nextBirthday")) {
            $("#nextBirthday").textContent =
                `${daysToBirthday} days`;
        }

        if ($("#totalDays")) {
            $("#totalDays").textContent =
                formatNumber(totalDays);
        }
    }

    // ---------------------------------------------------------
    // GST CALCULATOR
    // ---------------------------------------------------------

    function calculateGST() {
        const amount = Number($("#gstAmount")?.value);
        const rate = Number($("#gstRate")?.value);
        const type = $("#gstType")?.value;

        if (
            !Number.isFinite(amount) ||
            !Number.isFinite(rate) ||
            amount < 0 ||
            rate < 0
        ) {
            return;
        }

        let base;
        let gst;
        let finalAmount;

        if (type === "inclusive") {
            finalAmount = amount;
            base = amount / (1 + rate / 100);
            gst = finalAmount - base;
        } else {
            base = amount;
            gst = amount * rate / 100;
            finalAmount = base + gst;
        }

        const cgst = gst / 2;
        const sgst = gst / 2;

        if ($("#gstBase")) {
            $("#gstBase").textContent =
                `₹${formatNumber(base)}`;
        }

        if ($("#gstAmountResult")) {
            $("#gstAmountResult").textContent =
                `₹${formatNumber(gst)}`;
        }

        if ($("#cgstAmount")) {
            $("#cgstAmount").textContent =
                `₹${formatNumber(cgst)}`;
        }

        if ($("#sgstAmount")) {
            $("#sgstAmount").textContent =
                `₹${formatNumber(sgst)}`;
        }

        if ($("#gstFinal")) {
            $("#gstFinal").textContent =
                `₹${formatNumber(finalAmount)}`;
        }
    }

    // ---------------------------------------------------------
    // BMI CALCULATOR
    // ---------------------------------------------------------

    function calculateBMI() {
        const weight = Number($("#bmiWeight")?.value);
        const heightCm = Number($("#bmiHeight")?.value);

        if (
            !Number.isFinite(weight) ||
            !Number.isFinite(heightCm) ||
            weight <= 0 ||
            heightCm <= 0
        ) {
            return;
        }

        const heightMeters =
            heightCm / 100;

        const bmi =
            weight /
            Math.pow(heightMeters, 2);

        let category;

        if (bmi < 18.5) {
            category = "Underweight";
        } else if (bmi < 25) {
            category = "Normal";
        } else if (bmi < 30) {
            category = "Overweight";
        } else {
            category = "Obese";
        }

        if ($("#bmiValue")) {
            $("#bmiValue").textContent =
                bmi.toFixed(1);
        }

        if ($("#bmiCategory")) {
            $("#bmiCategory").textContent =
                category;
        }
    }

    // ---------------------------------------------------------
    // CURRENCY CALCULATOR
    // ---------------------------------------------------------

    /*
     * Approximate offline rates.
     * Values represent INR per 1 unit of currency.
     *
     * These are NOT live exchange rates.
     */
    const currencyRates = {
        INR: 1,
        USD: 83.5,
        EUR: 90.5,
        GBP: 106.5,
        JPY: 0.56,
        AED: 22.75,
        CAD: 61.5,
        AUD: 55
    };

    function convertCurrency() {
        const amount = Number(
            $("#currencyAmount")?.value
        );

        const from =
            $("#currencyFrom")?.value;

        const to =
            $("#currencyTo")?.value;

        if (
            !Number.isFinite(amount) ||
            amount < 0 ||
            !currencyRates[from] ||
            !currencyRates[to]
        ) {
            return;
        }

        const inINR =
            amount * currencyRates[from];

        const result =
            inINR / currencyRates[to];

        if ($("#currencyResult")) {
            $("#currencyResult").textContent =
                formatNumber(result);
        }

        if ($("#currencyResultText")) {
            $("#currencyResultText").textContent =
                `${amount} ${from} = ${formatNumber(result)} ${to}`;
        }
    }

    function swapCurrencies() {
        const from = $("#currencyFrom");
        const to = $("#currencyTo");

        if (!from || !to) return;

        const temp = from.value;

        from.value = to.value;
        to.value = temp;

        convertCurrency();
    }

    // ---------------------------------------------------------
    // UNIT CONVERTER
    // ---------------------------------------------------------

    const unitDefinitions = {
        length: {
            meter: 1,
            kilometer: 1000,
            centimeter: 0.01,
            millimeter: 0.001,
            mile: 1609.344,
            yard: 0.9144,
            foot: 0.3048,
            inch: 0.0254
        },

        weight: {
            kilogram: 1,
            gram: 0.001,
            milligram: 0.000001,
            pound: 0.45359237,
            ounce: 0.028349523125
        },

        area: {
            "square-meter": 1,
            "square-kilometer": 1000000,
            "square-foot": 0.09290304,
            "square-yard": 0.83612736,
            acre: 4046.8564224,
            hectare: 10000
        },

        volume: {
            liter: 1,
            milliliter: 0.001,
            "cubic-meter": 1000,
            "cubic-foot": 28.316846592,
            gallon: 3.785411784
        }
    };

    function populateUnitOptions() {
        const category =
            $("#unitCategory");

        const from =
            $("#unitFrom");

        const to =
            $("#unitTo");

        if (!category || !from || !to) {
            return;
        }

        const type = category.value;

        from.innerHTML = "";
        to.innerHTML = "";

        if (type === "temperature") {
            const options = [
                ["celsius", "Celsius"],
                ["fahrenheit", "Fahrenheit"],
                ["kelvin", "Kelvin"]
            ];

            options.forEach(([value, label]) => {
                from.add(
                    new Option(label, value)
                );

                to.add(
                    new Option(label, value)
                );
            });

            return;
        }

        const units =
            unitDefinitions[type];

        if (!units) return;

        Object.keys(units).forEach((unit) => {
            const label =
                unit
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, c =>
                        c.toUpperCase()
                    );

            from.add(
                new Option(label, unit)
            );

            to.add(
                new Option(label, unit)
            );
        });
    }

    function convertTemperature(value, from, to) {
        let celsius;

        if (from === "celsius") {
            celsius = value;
        } else if (from === "fahrenheit") {
            celsius =
                (value - 32) * 5 / 9;
        } else {
            celsius =
                value - 273.15;
        }

        if (to === "celsius") {
            return celsius;
        }

        if (to === "fahrenheit") {
            return celsius * 9 / 5 + 32;
        }

        return celsius + 273.15;
    }

    function convertUnits() {
        const value =
            Number($("#unitValue")?.value);

        const category =
            $("#unitCategory")?.value;

        const from =
            $("#unitFrom")?.value;

        const to =
            $("#unitTo")?.value;

        if (
            !Number.isFinite(value) ||
            !category ||
            !from ||
            !to
        ) {
            return;
        }

        let result;

        if (category === "temperature") {
            result =
                convertTemperature(
                    value,
                    from,
                    to
                );
        } else {
            const units =
                unitDefinitions[category];

            if (!units[from] || !units[to]) {
                return;
            }

            result =
                value *
                units[from] /
                units[to];
        }

        if ($("#unitResult")) {
            $("#unitResult").textContent =
                formatNumber(result);
        }
    }

    // ---------------------------------------------------------
    // VOICE CALCULATOR
    // ---------------------------------------------------------

    let recognition = null;

    function initializeVoiceCalculator() {
        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            return;
        }

        recognition =
            new SpeechRecognition();

        recognition.lang = "en-IN";
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            if ($("#voiceStatus")) {
                $("#voiceStatus").textContent =
                    "Listening...";
            }
        };

        recognition.onresult = (event) => {
            const transcript =
                event.results[0][0].transcript;

            if ($("#voiceText")) {
                $("#voiceText").textContent =
                    transcript;
            }

            const expression =
                voiceTextToExpression(
                    transcript
                );

            if (!expression) {
                if ($("#voiceResult")) {
                    $("#voiceResult").textContent =
                        "Could not understand";
                }

                return;
            }

            try {
                const result =
                    calculateExpression(
                        expression
                    );

                if ($("#voiceResult")) {
                    $("#voiceResult").textContent =
                        formatNumber(result);
                }

            } catch (error) {
                if ($("#voiceResult")) {
                    $("#voiceResult").textContent =
                        "Error";
                }
            }
        };

        recognition.onerror = (event) => {
            console.error(
                "Voice error:",
                event.error
            );

            if ($("#voiceStatus")) {
                $("#voiceStatus").textContent =
                    "Voice error";
            }
        };

        recognition.onend = () => {
            if ($("#voiceStatus")) {
                $("#voiceStatus").textContent =
                    "Ready";
            }
        };
    }

    function voiceTextToExpression(text) {
        let result =
            String(text)
                .toLowerCase()
                .trim();

        const replacements = [
            [/\bmultiplied by\b/g, "*"],
            [/\btimes\b/g, "*"],
            [/\bdivided by\b/g, "/"],
            [/\bdivide\b/g, "/"],
            [/\bplus\b/g, "+"],
            [/\bminus\b/g, "-"],
            [/\bsubtract\b/g, "-"],
            [/\badd\b/g, "+"],
            [/\bequals?\b/g, ""],
            [/\bequal to\b/g, ""],
            [/\bpoint\b/g, "."],
            [/\bdecimal\b/g, "."],
            [/\bpercent\b/g, "%"],
            [/\bpercentage\b/g, "%"],
            [/\bopen bracket\b/g, "("],
            [/\bclose bracket\b/g, ")"]
        ];

        replacements.forEach(
            ([pattern, replacement]) => {
                result =
                    result.replace(
                        pattern,
                        replacement
                    );
            }
        );

        const numberWords = {
            zero: "0",
            one: "1",
            two: "2",
            three: "3",
            four: "4",
            five: "5",
            six: "6",
            seven: "7",
            eight: "8",
            nine: "9",
            ten: "10",
            eleven: "11",
            twelve: "12",
            thirteen: "13",
            fourteen: "14",
            fifteen: "15",
            sixteen: "16",
            seventeen: "17",
            eighteen: "18",
            nineteen: "19",
            twenty: "20",
            thirty: "30",
            forty: "40",
            fifty: "50",
            sixty: "60",
            seventy: "70",
            eighty: "80",
            ninety: "90",
            hundred: "100",
            thousand: "1000"
        };

        Object.entries(numberWords)
            .sort(
                (a, b) =>
                    b[0].length -
                    a[0].length
            )
            .forEach(([word, number]) => {
                result =
                    result.replace(
                        new RegExp(
                            `\\b${word}\\b`,
                            "g"
                        ),
                        number
                    );
            });

        result =
            result.replace(
                /[^0-9+\-*/().%^]/g,
                ""
            );

        return result;
    }

    function startVoiceCalculator() {
        if (!recognition) {
            initializeVoiceCalculator();
        }

        if (!recognition) {
            if ($("#voiceStatus")) {
                $("#voiceStatus").textContent =
                    "Speech recognition is not supported in this browser.";
            }

            return;
        }

        try {
            recognition.start();
        } catch (error) {
            console.error(error);
        }
    }

    // ---------------------------------------------------------
    // FOOD COST CALCULATOR
    // ---------------------------------------------------------

    function calculateFoodCost() {
        const ingredient =
            Number($("#ingredientCost")?.value) || 0;

        const labor =
            Number($("#laborCost")?.value) || 0;

        const other =
            Number($("#otherCost")?.value) || 0;

        const sellingPrice =
            Number($("#sellingPrice")?.value) || 0;

        const totalCost =
            ingredient +
            labor +
            other;

        const profit =
            sellingPrice -
            totalCost;

        const foodCostPercentage =
            sellingPrice > 0
                ? (ingredient / sellingPrice) * 100
                : 0;

        const profitMargin =
            sellingPrice > 0
                ? (profit / sellingPrice) * 100
                : 0;

        if ($("#totalFoodCost")) {
            $("#totalFoodCost").textContent =
                `₹${formatNumber(totalCost)}`;
        }

        if ($("#foodProfit")) {
            $("#foodProfit").textContent =
                `₹${formatNumber(profit)}`;
        }

        if ($("#foodCostPercentage")) {
            $("#foodCostPercentage").textContent =
                `${formatNumber(foodCostPercentage)}%`;
        }

        if ($("#profitMargin")) {
            $("#profitMargin").textContent =
                `${formatNumber(profitMargin)}%`;
        }
    }

    // ---------------------------------------------------------
    // THEME
    // ---------------------------------------------------------

    function initializeTheme() {
        const savedTheme =
            localStorage.getItem(THEME_KEY);

        if (savedTheme === "light") {
            document.body.classList.add(
                "light-mode"
            );
        }
    }

    function toggleTheme() {
        document.body.classList.toggle(
            "light-mode"
        );

        const isLight =
            document.body.classList.contains(
                "light-mode"
            );

        localStorage.setItem(
            THEME_KEY,
            isLight ? "light" : "dark"
        );
    }

    // ---------------------------------------------------------
    // EVENT LISTENERS
    // ---------------------------------------------------------

    // Basic keypad
    $$("[data-value]").forEach((button) => {
        button.addEventListener("click", () => {
            addCalculatorValue(
                button.dataset.value
            );
        });
    });

    // Scientific keypad
    $$("[data-sci]").forEach((button) => {
        button.addEventListener("click", () => {
            const action =
                button.dataset.sci;

            if (action === "toggleMode") {
                toggleAngleMode();
                return;
            }

            addCalculatorValue(action);
        });
    });

    // Clear
    const clearButton =
        document.querySelector(
            '[onclick="clearCalculator()"]'
        );

    if (clearButton) {
        clearButton.removeAttribute("onclick");
        clearButton.addEventListener(
            "click",
            clearCalculator
        );
    }

    // Delete
    const deleteButton =
        document.querySelector(
            '[onclick="deleteLast()"]'
        );

    if (deleteButton) {
        deleteButton.removeAttribute("onclick");
        deleteButton.addEventListener(
            "click",
            deleteLast
        );
    }

    // Calculate
    const calculateButton =
        document.querySelector(
            '[onclick="calculateResult()"]'
        );

    if (calculateButton) {
        calculateButton.removeAttribute(
            "onclick"
        );

        calculateButton.addEventListener(
            "click",
            performCalculation
        );
    }

    // Copy
    const copyButton =
        $("#copyResult");

    if (copyButton) {
        copyButton.addEventListener(
            "click",
            copyResult
        );
    }

    // Scientific toggle
    const scientificToggle =
        $("#toggleScientific");

    if (scientificToggle) {
        scientificToggle.addEventListener(
            "click",
            toggleScientificCalculator
        );
    }

    // History clear
    const historyClear =
        $("#clearHistory");

    if (historyClear) {
        historyClear.addEventListener(
            "click",
            clearHistory
        );
    }

    // History use buttons
    document.addEventListener(
        "click",
        (event) => {
            const button =
                event.target.closest(
                    ".history-use"
                );

            if (!button) return;

            const index =
                Number(
                    button.dataset.historyIndex
                );

            useHistory(index);
        }
    );

    // EMI
    const emiButton =
        $("#calculateEMI");

    if (emiButton) {
        emiButton.addEventListener(
            "click",
            calculateEMI
        );
    }

    // Age
    const ageButton =
        $("#calculateAge");

    if (ageButton) {
        ageButton.addEventListener(
            "click",
            calculateAge
        );
    }

    // GST
    const gstButton =
        $("#calculateGST");

    if (gstButton) {
        gstButton.addEventListener(
            "click",
            calculateGST
        );
    }

    // BMI
    const bmiButton =
        $("#calculateBMI");

    if (bmiButton) {
        bmiButton.addEventListener(
            "click",
            calculateBMI
        );
    }

    // Currency
    const currencyButton =
        $("#convertCurrency");

    if (currencyButton) {
        currencyButton.addEventListener(
            "click",
            convertCurrency
        );
    }

    const swapButton =
        $("#swapCurrencies");

    if (swapButton) {
        swapButton.addEventListener(
            "click",
            swapCurrencies
        );
    }

    // Unit
    const unitCategory =
        $("#unitCategory");

    if (unitCategory) {
        unitCategory.addEventListener(
            "change",
            () => {
                populateUnitOptions();
                convertUnits();
            }
        );
    }

    const unitButton =
        $("#convertUnits");

    if (unitButton) {
        unitButton.addEventListener(
            "click",
            convertUnits
        );
    }

    // Voice
    const voiceButton =
        $("#startVoiceCalculator");

    if (voiceButton) {
        voiceButton.addEventListener(
            "click",
            startVoiceCalculator
        );
    }

    // Food Cost
    const foodButton =
        $("#calculateFoodCost");

    if (foodButton) {
        foodButton.addEventListener(
            "click",
            calculateFoodCost
        );
    }

    // ---------------------------------------------------------
    // THEME BUTTON SUPPORT
    // ---------------------------------------------------------

    const themeButtons =
        $$(
            '[data-theme-toggle], #themeToggle, .theme-toggle'
        );

    themeButtons.forEach((button) => {
        button.addEventListener(
            "click",
            toggleTheme
        );
    });

    // ---------------------------------------------------------
    // KEYBOARD SUPPORT
    // ---------------------------------------------------------

    document.addEventListener(
        "keydown",
        (event) => {
            const active =
                document.activeElement;

            const isInput =
                active &&
                (
                    active.tagName === "INPUT" ||
                    active.tagName === "TEXTAREA" ||
                    active.tagName === "SELECT"
                );

            if (isInput) {
                return;
            }

            const key = event.key;

            if (
                /^[0-9]$/.test(key) ||
                ["+", "-", "*", "/", ".", "(", ")"].includes(key)
            ) {
                event.preventDefault();

                addCalculatorValue(key);
                return;
            }

            if (key === "^") {
                event.preventDefault();

                addCalculatorValue("^");
                return;
            }

            if (key === "!") {
                event.preventDefault();

                addCalculatorValue("!");
                return;
            }

            if (key === "%") {
                event.preventDefault();

                addCalculatorValue("%");
                return;
            }

            if (key === "Enter" || key === "=") {
                event.preventDefault();

                performCalculation();
                return;
            }

            if (
                key === "Backspace" ||
                key === "Delete"
            ) {
                event.preventDefault();

                deleteLast();
                return;
            }

            if (key === "Escape") {
                event.preventDefault();

                clearCalculator();
            }
        }
    );

    // ---------------------------------------------------------
    // INITIALIZATION
    // ---------------------------------------------------------

    initializeTheme();
    initializeVoiceCalculator();
    populateUnitOptions();
    renderHistory();
    updateCalculatorDisplay();

    // ---------------------------------------------------------
    // GLOBAL COMPATIBILITY FUNCTIONS
    // ---------------------------------------------------------
    // These keep compatibility with inline onclick handlers
    // if any exist in the HTML.

    window.clearCalculator =
        clearCalculator;

    window.deleteLast =
        deleteLast;

    window.calculateResult =
        performCalculation;

    window.calculateEMI =
        calculateEMI;

    window.calculateAge =
        calculateAge;

    window.calculateGST =
        calculateGST;

    window.calculateBMI =
        calculateBMI;

    window.convertCurrency =
        convertCurrency;

    window.swapCurrencies =
        swapCurrencies;

    window.convertUnits =
        convertUnits;

    window.startVoiceCalculator =
        startVoiceCalculator;

    window.calculateFoodCost =
        calculateFoodCost;

    window.toggleScientificCalculator =
        toggleScientificCalculator;

    window.toggleAngleMode =
        toggleAngleMode;

    window.toggleTheme =
        toggleTheme;

    console.log(
        "NeonCalc Pro - JavaScript Loaded Successfully 🚀"
    );
});// =========================================================
// NEONCALC PRO - BASIC CALCULATOR FIX
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    const expression = document.getElementById("expression");
    const result = document.getElementById("result");

    let calcValue = "";
    let calculated = false;

    function updateDisplay() {
        if (expression) {
            expression.textContent = calcValue || "0";
        }

        const hiddenDisplay =
            document.getElementById("display");

        if (hiddenDisplay) {
            hiddenDisplay.value = calcValue;
        }
    }

    function addValue(value) {
        if (!value) return;

        // After result, typing a number starts new calculation
        if (calculated) {
            if (/^[0-9.]$/.test(value)) {
                calcValue = "";
            }

            calculated = false;
        }

        // Decimal
        if (value === ".") {
            const parts =
                calcValue.split(/[+\-*/%()]/);

            const lastNumber =
                parts[parts.length - 1];

            if (lastNumber.includes(".")) {
                return;
            }

            if (
                !calcValue ||
                /[+\-*/(]$/.test(calcValue)
            ) {
                calcValue += "0.";
            } else {
                calcValue += ".";
            }

            updateDisplay();
            return;
        }

        // Operators
        if (["+", "-", "*", "/"].includes(value)) {

            // First character can only be minus
            if (!calcValue) {
                if (value === "-") {
                    calcValue = "-";
                } else {
                    return;
                }

                updateDisplay();
                return;
            }

            const last =
                calcValue.slice(-1);

            // Don't allow duplicate operators
            if (["+", "*", "/"].includes(last)) {
                calcValue =
                    calcValue.slice(0, -1) + value;

                updateDisplay();
                return;
            }

            // Allow negative number after operator
            if (
                value === "-" &&
                ["+", "-", "*", "/"].includes(last)
            ) {
                calcValue += "-";
                updateDisplay();
                return;
            }

            // Don't add another minus
            if (
                value === "-" &&
                last === "-"
            ) {
                return;
            }

            calcValue += value;
            updateDisplay();
            return;
        }

        // Normal numbers / brackets / %
        calcValue += value;
        updateDisplay();
    }

    function clearCalc() {
        calcValue = "";
        calculated = false;

        updateDisplay();

        if (result) {
            result.textContent = "0";
        }
    }

    function deleteCalc() {
        if (calculated) {
            calcValue = "";
            calculated = false;
        } else {
            calcValue =
                calcValue.slice(0, -1);
        }

        updateDisplay();
    }

    function calculateCalc() {
        if (!calcValue) return;

        try {
            let expressionValue =
                calcValue
                    .replace(/×/g, "*")
                    .replace(/÷/g, "/")
                    .replace(/−/g, "-");

            // Percentage
            expressionValue =
                expressionValue.replace(
                    /(\d+(?:\.\d+)?)%/g,
                    "($1/100)"
                );

            // Basic safety validation
            if (
                !/^[0-9+\-*/%.() ]+$/.test(
                    expressionValue
                )
            ) {
                throw new Error("Invalid");
            }

            // Check brackets
            let balance = 0;

            for (const char of expressionValue) {
                if (char === "(") balance++;
                if (char === ")") balance--;

                if (balance < 0) {
                    throw new Error("Invalid brackets");
                }
            }

            if (balance !== 0) {
                throw new Error("Invalid brackets");
            }

            const answer =
                Function(
                    '"use strict"; return (' +
                    expressionValue +
                    ")"
                )();

            if (
                typeof answer !== "number" ||
                !Number.isFinite(answer)
            ) {
                throw new Error("Invalid result");
            }

            const formatted =
                Number(
                    answer.toFixed(10)
                ).toLocaleString("en-IN", {
                    maximumFractionDigits: 10
                });

            if (result) {
                result.textContent =
                    formatted;
            }

            calculated = true;

        } catch (error) {

            console.error(
                "Calculator error:",
                error
            );

            if (result) {
                result.textContent =
                    "Error";
            }
        }
    }

    // ---------------------------------------------------------
    // IMPORTANT:
    // Remove old calculator click handlers by cloning buttons.
    // This prevents the old JS and new JS from fighting.
    // ---------------------------------------------------------

    document
        .querySelectorAll(
            ".calculator-keypad [data-value]"
        )
        .forEach((oldButton) => {

            const button =
                oldButton.cloneNode(true);

            oldButton.replaceWith(button);

            button.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    addValue(
                        button.getAttribute(
                            "data-value"
                        )
                    );
                }
            );
        });

    // AC
    const oldClear =
        document.getElementById(
            "clearCalculator"
        );

    if (oldClear) {

        const clearButton =
            oldClear.cloneNode(true);

        oldClear.replaceWith(clearButton);

        clearButton.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                clearCalc();
            }
        );
    }

    // Backspace
    const oldDelete =
        document.getElementById(
            "deleteLast"
        );

    if (oldDelete) {

        const deleteButton =
            oldDelete.cloneNode(true);

        oldDelete.replaceWith(deleteButton);

        deleteButton.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                deleteCalc();
            }
        );
    }

    // EQUAL BUTTON
    const oldEqual =
        document.getElementById(
            "calculateResult"
        );

    if (oldEqual) {

        const equalButton =
            oldEqual.cloneNode(true);

        oldEqual.replaceWith(equalButton);

        equalButton.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();

                calculateCalc();
            }
        );
    }

    // Keyboard
    document.addEventListener(
        "keydown",
        (event) => {

            // Ignore when typing in another input
            const tag =
                document.activeElement?.tagName;

            if (
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT"
            ) {
                return;
            }

            const key = event.key;

            if (
                /^[0-9.]$/.test(key) ||
                ["+", "-", "*", "/", "%", "(", ")"].includes(key)
            ) {
                event.preventDefault();
                addValue(key);
                return;
            }

            if (
                key === "Enter" ||
                key === "="
            ) {
                event.preventDefault();
                calculateCalc();
                return;
            }

            if (key === "Backspace") {
                event.preventDefault();
                deleteCalc();
                return;
            }

            if (key === "Escape") {
                event.preventDefault();
                clearCalc();
            }
        }
    );

    updateDisplay();

    console.log(
        "Basic Calculator Fix Loaded ✅"
    );
});