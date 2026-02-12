(async function () {

    const loader = document.getElementById("loader");
    const resultDiv = document.getElementById("result");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getLeaveTime
    });

    setTimeout(() => {

        loader.classList.add("hidden");

        const leaveData = res[0].result;

        if (!leaveData) {
            resultDiv.innerHTML = '<div class="line"><span class="line-icon">😅</span> डेटा नहीं मिला — पहले attendance पेज खोलो!</div>';
            resultDiv.classList.remove("hidden");
            return;
        }

        resultDiv.classList.remove("hidden");

        startCountdown(leaveData);

    }, 1500);

})();


// =====================================================
// Countdown UI
// =====================================================

function startCountdown(leaveData) {

    const resultDiv = document.getElementById("result");
    const targetSeconds = leaveData.leaveSeconds;
    const THIRTY_MIN = 30 * 60;

    function formatClock(sec) {
        sec = sec % (24 * 3600);
        let h = Math.floor(sec / 3600);
        let m = Math.floor((sec % 3600) / 60);
        let s = sec % 60;
        let ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`;
    }

    function formatDuration(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    const LATE_AFTER_SEC = 10 * 3600 + 15 * 60; // 10:15 AM
    function parseFirstInToSec(str) {
        if (!str) return 0;
        const parts = str.trim().split(/\s+/);
        const [h, m, s = 0] = (parts[0] || "0:0").split(":").map(Number);
        const meridian = (parts[1] || "").toUpperCase();
        let hour = h;
        if (meridian === "PM" && h !== 12) hour = h + 12;
        if (meridian === "AM" && h === 12) hour = 0;
        return hour * 3600 + (m || 0) * 60 + (s || 0);
    }
    const firstInSec = parseFirstInToSec(leaveData.firstInStr);
    const line1Msg = firstInSec >= LATE_AFTER_SEC
        ? `${leaveData.firstInStr} बजे आए — आज थोड़ा लेट हो गया!`
        : `${leaveData.firstInStr} बजे आए थे — अच्छा टाइमिंग!`;

    const breakSec = leaveData.breakSeconds;
    let line2Icon, breakMsg;
    if (breakSec === 0) {
        line2Icon = "☕";
        breakMsg = `${formatDuration(breakSec)} ब्रेक नहीं लिया — आज robot mode on है क्या?`;
    } else if (breakSec > THIRTY_MIN) {
        line2Icon = "😏";
        breakMsg = `${formatDuration(breakSec)} ज्यादा ब्रेक लिया — बॉस को मत बताना`;
    } else {
        line2Icon = "👍";
        breakMsg = `${formatDuration(breakSec)} सही ब्रेक लिया — balance बना लिया`;
    }

    function update() {
        const now = new Date();
        const nowSeconds =
            now.getHours() * 3600 +
            now.getMinutes() * 60 +
            now.getSeconds();

        let remaining = targetSeconds - nowSeconds;
        if (remaining < 0) remaining = 0;

        const h = Math.floor(remaining / 3600);
        const m = Math.floor((remaining % 3600) / 60);
        const s = remaining % 60;

        resultDiv.innerHTML = `
            <div class="line"><span class="line-icon">⏰</span> ${line1Msg}</div>
            <div class="line"><span class="line-icon">${line2Icon}</span> ${breakMsg}</div>
            <div class="line leave-time"><span class="line-icon">🚀</span> ${formatClock(targetSeconds)} बजे निकल सकते हो — बस इतना और!</div>
            <div class="remaining"><span class="line-icon">⏳</span> बाकी: ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}</div>
        `;
    }

    update();
    setInterval(update, 1000);
}


// =====================================================
// Runs inside webpage
// =====================================================

function getLeaveTime() {

    const TARGET_SECONDS = 8 * 3600;

    function parseClock(str) {
        if (!str) return 0;

        let [time, meridian] = str.trim().split(" ");
        let [h, m, s = 0] = time.split(":").map(Number);

        if (meridian === "PM" && h !== 12) h += 12;
        if (meridian === "AM" && h === 12) h = 0;

        return h * 3600 + m * 60 + s;
    }

    // ===== CARD FORMAT =====

    const dtFields = [...document.querySelectorAll(".inout-tims dt")];

    if (dtFields.length) {

        function getValue(label) {
            const dt = dtFields.find(el => el.innerText.includes(label));
            if (!dt) return null;

            const parts = dt.innerText.split("\n").map(v => v.trim());
            return parts[1];
        }

        const firstIn = getValue("First In");
        const breakHrs = getValue("Break Hours");

        if (!firstIn || !breakHrs) return null;

        const firstInSec = parseClock(firstIn);
        const breakSec = parseClock(breakHrs);
        const completion = firstInSec + breakSec + TARGET_SECONDS;

        return {
            firstInStr: firstIn,
            breakSeconds: breakSec,
            leaveSeconds: completion
        };
    }

    // ===== TABLE FORMAT (e.g. Date | Employee Code | First Punch | Break Hours | Working Hour) =====

    const table = document.querySelector("table");
    if (!table) return null;

    const headers = [...table.querySelectorAll("thead th")].map(th => th.innerText.trim());

    const findIndex = text =>
        headers.findIndex(h => h.includes(text));

    const firstIdx = findIndex("First Punch") !== -1 ? findIndex("First Punch") : findIndex("First In");
    const breakIdx = findIndex("Break Hours");

    if (firstIdx === -1 || breakIdx === -1) return null;

    const row = table.querySelector("tbody tr");
    if (!row) return null;

    const cells = row.querySelectorAll("td");
    if (cells.length <= Math.max(firstIdx, breakIdx)) return null;

    const firstInStr = cells[firstIdx].innerText.trim();
    const breakHrsStr = cells[breakIdx].innerText.trim();
    const firstInSec = parseClock(firstInStr);
    const breakSec = parseClock(breakHrsStr);
    const completion = firstInSec + breakSec + TARGET_SECONDS;

    return {
        firstInStr,
        breakSeconds: breakSec,
        leaveSeconds: completion
    };
}
