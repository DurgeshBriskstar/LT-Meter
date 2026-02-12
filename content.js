(function () {

    const TARGET_SECONDS = 8 * 3600;

    function parseClock(str) {
        if (!str) return 0;

        let [time, meridian] = str.trim().split(" ");
        let [h, m, s = 0] = time.split(":").map(Number);

        if (meridian === "PM" && h !== 12) h += 12;
        if (meridian === "AM" && h === 12) h = 0;

        return h * 3600 + m * 60 + s;
    }

    function formatClock(sec) {
        sec = sec % (24 * 3600);

        let h = Math.floor(sec / 3600);
        let m = Math.floor((sec % 3600) / 60);
        let s = sec % 60;

        let ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;

        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`;
    }

    // ===== Prevent duplicate insertion =====
    if (document.querySelector(".leave-time-added")) return;

    // ================= DT Layout =================
    const dtFields = [...document.querySelectorAll(".inout-tims dt")];

    if (dtFields.length) {

        function getValue(label) {
            const dt = dtFields.find(el => el.innerText.includes(label));
            if (!dt) return null;

            const parts = dt.innerText.split("\n").map(v => v.trim());
            return { value: parts[1], node: dt };
        }

        const firstIn = getValue("First In");
        const breakHrs = getValue("Break Hours");
        const working = getValue("Working Hour");

        if (firstIn && breakHrs && working) {

            const completion =
                parseClock(firstIn.value) +
                parseClock(breakHrs.value) +
                TARGET_SECONDS;

            const newDt = working.node.cloneNode(true);
            newDt.innerHTML = `You Can Leave At<br>${formatClock(completion)}`;
            newDt.classList.add("leave-time-added");

            working.node.parentElement.appendChild(newDt);
        }

        return;
    }

    // ================= Table Layout =================
    const table = document.querySelector("table");
    if (!table) return;

    const headers = [...table.querySelectorAll("thead th")];

    const findIndex = (text) =>
        headers.findIndex(th => th.innerText.trim() === text);

    const firstIdx = findIndex("First Punch");
    const breakIdx = findIndex("Break Hours");
    const workingIdx = findIndex("Working Hour");

    if (firstIdx === -1 || breakIdx === -1 || workingIdx === -1) return;

    const headerRow = headers[0].parentElement;

    if ([...headerRow.children].some(th => th.innerText === "You Can Leave At")) return;

    // Add header
    const newTh = document.createElement("th");
    newTh.innerText = "You Can Leave At";
    newTh.classList.add("leave-time-added");
    headerRow.appendChild(newTh);

    // Add row value
    const row = table.querySelector("tbody tr");
    const cells = row.querySelectorAll("td");

    const completion =
        parseClock(cells[firstIdx].innerText) +
        parseClock(cells[breakIdx].innerText) +
        TARGET_SECONDS;

    const newTd = document.createElement("td");
    newTd.innerText = formatClock(completion);
    newTd.classList.add("leave-time-added");

    row.appendChild(newTd);

})();
