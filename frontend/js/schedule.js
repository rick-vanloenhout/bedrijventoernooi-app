const urlParams = new URLSearchParams(window.location.search);
const tournamentId = urlParams.get("tournament");

document.addEventListener("DOMContentLoaded", () => {
    const backLink = document.getElementById("back-link");
    const adminActions = document.getElementById("admin-actions");
    const scoreEntryLink = document.getElementById("score-entry-link");

    // Show admin actions if logged in
    if (isLoggedIn() && tournamentId) {
        adminActions.style.display = "block";
        scoreEntryLink.href = `score-entry.html?tournament=${tournamentId}`;
        backLink.href = `manage.html?tournament=${tournamentId}`;
    } else if (tournamentId) {
        backLink.href = `index.html`;
    } else {
        backLink.style.display = "none";
    }

    // Tab switching
    const tabSchedule = document.getElementById("tab-schedule");
    const tabStandings = document.getElementById("tab-standings");
    const tabOverall = document.getElementById("tab-overall");
    const scheduleContainer = document.getElementById("schedule-container");
    const standingsContainer = document.getElementById("standings-container");
    const overallContainer = document.getElementById("overall-container");

    tabSchedule.addEventListener("click", () => {
        tabSchedule.classList.add("active");
        tabStandings.classList.remove("active");
        tabOverall.classList.remove("active");
        scheduleContainer.classList.remove("hidden");
        standingsContainer.classList.add("hidden");
        overallContainer.classList.add("hidden");
    });

    tabStandings.addEventListener("click", () => {
        tabStandings.classList.add("active");
        tabSchedule.classList.remove("active");
        tabOverall.classList.remove("active");
        scheduleContainer.classList.add("hidden");
        standingsContainer.classList.remove("hidden");
        overallContainer.classList.add("hidden");
        loadStandings();
    });

    tabOverall.addEventListener("click", () => {
        tabOverall.classList.add("active");
        tabSchedule.classList.remove("active");
        tabStandings.classList.remove("active");
        scheduleContainer.classList.add("hidden");
        standingsContainer.classList.add("hidden");
        overallContainer.classList.remove("hidden");
        loadOverallStandings();
    });
    
    // Handle window resize to toggle between table/card views
    // Only trigger on width changes, not height (to avoid iOS Safari address bar issues)
    let resizeTimeout;
    let lastWidth = window.innerWidth;
    let isScrolling = false;
    let scrollTimeout;
    
    // Track scrolling state to prevent reloads during scroll
    window.addEventListener("scroll", () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 150);
    }, { passive: true });
    
    window.addEventListener("resize", () => {
        // Don't reload if user is actively scrolling
        if (isScrolling) {
            return;
        }
        
        const currentWidth = window.innerWidth;
        // Only reload if width actually changed significantly (ignore height-only changes from iOS Safari)
        if (Math.abs(currentWidth - lastWidth) < 10) {
            return; // Height-only change, ignore it
        }
        lastWidth = currentWidth;
        
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (!scheduleContainer.classList.contains("hidden")) {
                loadSchedule();
            }
            if (!standingsContainer.classList.contains("hidden")) {
                loadStandings();
            }
            if (!overallContainer.classList.contains("hidden")) {
                loadOverallStandings();
            }
        }, 250);
    });

    loadSchedule();
    loadSponsors();
});

async function loadSponsors() {
    const carousel = document.getElementById("sponsor-carousel");
    if (!tournamentId || !carousel) return;

    try {
        const sponsors = await apiGet(`/tournaments/${tournamentId}/sponsors`);
        if (!sponsors || sponsors.length === 0) return;

        // Preload all images before rendering so layout is stable from the start
        await Promise.all(sponsors.map(s => new Promise(resolve => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = s.logo_url;
        })));

        if (window.innerWidth <= 1024) {
            buildSponsorGrid(carousel, sponsors);
        } else {
            buildSponsorScroll(carousel, sponsors);
        }

        carousel.style.display = "block";
    } catch (err) {
        console.error("Error loading sponsors:", err);
    }
}

function buildSponsorScroll(carousel, sponsors) {
    function buildItems() {
        return sponsors.map(s => {
            const img = `<img src="${s.logo_url}" alt="${s.name || 'sponsor'}" />`;
            return s.url
                ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${img}</a>`
                : img;
        }).join("");
    }

    const track = document.createElement("div");
    track.className = "sponsor-track";
    track.innerHTML = buildItems() + buildItems();
    carousel.innerHTML = "";
    carousel.appendChild(track);

    // Drag to scroll manually
    let isDragging = false;
    let startX = 0;
    let dragOffset = 0;
    let baseOffset = 0;

    track.addEventListener("mousedown", e => {
        isDragging = true;
        startX = e.clientX;
        // Read current translate from the animation
        const style = window.getComputedStyle(track);
        const matrix = new DOMMatrix(style.transform);
        baseOffset = matrix.m41;
        track.style.animationPlayState = "paused";
        track.style.transform = `translateX(${baseOffset}px)`;
        track.style.cursor = "grabbing";
        e.preventDefault();
    });

    window.addEventListener("mousemove", e => {
        if (!isDragging) return;
        dragOffset = e.clientX - startX;
        track.style.transform = `translateX(${baseOffset + dragOffset}px)`;
    });

    window.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        track.style.cursor = "grab";
        // Resume animation from current visual position
        const currentX = baseOffset + dragOffset;
        const halfWidth = track.scrollWidth / 2;
        // Normalise into the 0 → -halfWidth range so the loop stays correct
        const normalised = ((currentX % halfWidth) - halfWidth) % halfWidth;
        track.style.animation = "none";
        track.style.transform = `translateX(${normalised}px)`;
        // Force reflow then re-apply animation offset via a custom property
        track.getBoundingClientRect();
        track.style.setProperty("--drag-start", `${normalised}px`);
        track.style.animation = "";
        track.style.animationPlayState = "running";
        dragOffset = 0;
    });
}

function buildSponsorGrid(carousel, sponsors) {
    const pages = [];
    for (let i = 0; i < sponsors.length; i += 2) {
        const pair = sponsors.slice(i, i + 2);
        if (pair.length === 1) pair.push(sponsors[0]); // odd count: pair last with first
        pages.push(pair);
    }

    if (pages.length === 0) return;

    let current = 0;
    let timer;

    const gridWrap = document.createElement("div");
    const dotsWrap = document.createElement("div");
    dotsWrap.className = "sponsor-dots";
    pages.forEach((_, i) => {
        const dot = document.createElement("span");
        dot.className = "sponsor-dot" + (i === 0 ? " active" : "");
        dotsWrap.appendChild(dot);
    });

    function showPage(index) {
        current = ((index % pages.length) + pages.length) % pages.length;
        const page = pages[current];

        const grid = document.createElement("div");
        grid.className = "sponsor-page";
        page.forEach(s => {
            const img = document.createElement("img");
            img.src = s.logo_url;
            img.alt = s.name || "sponsor";
            if (s.url) {
                const a = document.createElement("a");
                a.href = s.url;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.appendChild(img);
                grid.appendChild(a);
            } else {
                grid.appendChild(img);
            }
        });

        gridWrap.innerHTML = "";
        gridWrap.appendChild(grid);

        dotsWrap.querySelectorAll(".sponsor-dot").forEach((dot, i) => {
            dot.classList.toggle("active", i === current);
        });
    }

    function startTimer() {
        clearInterval(timer);
        if (pages.length > 1) {
            timer = setInterval(() => showPage(current + 1), 15000);
        }
    }

    // Swipe detection
    let touchStartX = 0;
    carousel.addEventListener("touchstart", e => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    carousel.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) {
            showPage(dx < 0 ? current + 1 : current - 1);
            startTimer();
        }
    }, { passive: true });

    carousel.innerHTML = "";
    carousel.appendChild(gridWrap);
    if (pages.length > 1) carousel.appendChild(dotsWrap);

    showPage(0);
    startTimer();
}

async function loadSchedule() {
    const container = document.getElementById("schedule-container");
    container.innerHTML = "";

    if (!tournamentId) {
        container.textContent = "Geen toernooi geselecteerd.";
        return;
    }

    const rounds = await apiGet(`/tournaments/${tournamentId}/rounds`);

    if (!rounds || rounds.length === 0) {
        container.textContent = "Geen schema beschikbaar.";
        return;
    }

    rounds.forEach(rnd => {
        const roundDiv = document.createElement("div");
        roundDiv.className = "round";

        roundDiv.innerHTML = `
            <h3>
                Ronde ${rnd.round_number} (${rnd.type})
                – start ${rnd.start_time}
            </h3>
        `;

        const table = document.createElement("table");
        table.className = "schedule-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Veld</th>
                    <th>Team 1</th>
                    <th>Set 1</th>
                    <th>Set 2</th>
                    <th>Team 2</th>
                    <th>Teller</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");

        rnd.matches.forEach(m => {
            const home =
                m.home_team?.name ??
                (m.home_rank_position && m.home_rank_poule
                    ? `#${m.home_rank_position} poule ${m.home_rank_poule.name}`
                    : "Finalist 1");

            const away =
                m.away_team?.name ??
                (m.away_rank_position && m.away_rank_poule
                    ? `#${m.away_rank_position} poule ${m.away_rank_poule.name}`
                    : "Finalist 2");


            const referee =
                m.referee_team?.name ?? "Geen scoreteam toegewezen";

            // Format set scores with highlighting for winners
            function formatSetScore(homeScore, awayScore) {
                if (homeScore == null || awayScore == null) {
                    return { html: "-", homeClass: "", awayClass: "" };
                }
                
                const homeWins = homeScore > awayScore;
                const awayWins = awayScore > homeScore;
                
                const homeClass = homeWins ? "score-winner" : "";
                const awayClass = awayWins ? "score-winner" : "";
                
                return {
                    html: `<span class="${homeClass}">${homeScore}</span>-<span class="${awayClass}">${awayScore}</span>`,
                    homeClass,
                    awayClass
                };
            }
            
            const set1Data = formatSetScore(m.home_set1_score, m.away_set1_score);
            const set2Data = formatSetScore(m.home_set2_score, m.away_set2_score);

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${m.field_number}</td>
                <td>${home}</td>
                <td class="score-cell">${set1Data.html}</td>
                <td class="score-cell">${set2Data.html}</td>
                <td>${away}</td>
                <td>${referee}</td>
            `;
            tbody.appendChild(tr);
        });

        roundDiv.appendChild(table);
        container.appendChild(roundDiv);
    });
}

async function loadStandings() {
    const container = document.getElementById("standings-container");
    container.innerHTML = "";

    if (!tournamentId) {
        container.textContent = "Geen toernooi geselecteerd.";
        return;
    }

    const standings = await apiGet(`/tournaments/${tournamentId}/standings`);

    if (!standings || standings.length === 0) {
        container.textContent = "Geen standen beschikbaar.";
        return;
    }

    standings.forEach(poule => {
        const pouleDiv = document.createElement("div");
        pouleDiv.className = "round";
        pouleDiv.innerHTML = `<h3>Poule ${poule.name}</h3>`;

        // Always use table view for standings
        const table = document.createElement("table");
        table.className = "keep-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Positie</th>
                    <th>Team</th>
                    <th>Punten</th>
                    <th>Gespeeld</th>
                    <th>Saldo</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");
        poule.teams.forEach((team, index) => {
            const tr = document.createElement("tr");
            const balance = team.balance != null ? team.balance : 0;
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${team.name}</td>
                <td>${team.points}</td>
                <td>${team.played}</td>
                <td>${balance >= 0 ? "+" : ""}${balance}</td>
            `;
            tbody.appendChild(tr);
        });

        pouleDiv.appendChild(table);
        container.appendChild(pouleDiv);
    });
}

async function loadOverallStandings() {
    const container = document.getElementById("overall-container");
    container.innerHTML = "";

    if (!tournamentId) {
        container.textContent = "Geen toernooi geselecteerd.";
        return;
    }

    const data = await apiGet(`/tournaments/${tournamentId}/overall-standings`);
    const standings = data.teams;

    if (!standings || standings.length === 0) {
        container.textContent = "Geen algemeen klassement beschikbaar.";
        return;
    }

    const wrap = document.createElement("div");
    wrap.className = "round";
    wrap.innerHTML = "<h3>Algemeen klassement</h3>";

    const loggedIn = isLoggedIn();
    
    // Always use table view for overall standings
    let headerHTML = `
        <thead>
            <tr>
                <th>Rang</th>
                <th>Team</th>`;
    
    if (loggedIn) {
        headerHTML += `
                <th>Punten</th>`;
    }
    
    headerHTML += `
                <th>Gespeeld</th>
                <th>Saldo</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const table = document.createElement("table");
    table.className = "schedule-table keep-table";
    table.innerHTML = headerHTML;

    const tbody = table.querySelector("tbody");
    standings.forEach(row => {
        const tr = document.createElement("tr");
        const balance = row.balance != null ? row.balance : 0;
        
        let progressionBadge = "";
        if (loggedIn) {
            const level = row.progression_level;
            if (level === 1) {
                if (row.final_position === 1) {
                    progressionBadge = " 🏆";
                } else if (row.final_position === 2) {
                    progressionBadge = " 🥈";
                }
            }
        }
        
        let rowHTML = `
            <td>${row.rank}</td>
            <td>${row.name}${progressionBadge}</td>`;
        
        if (loggedIn) {
            rowHTML += `
            <td>${row.points}</td>`;
        }
        
        rowHTML += `
            <td>${row.played}</td>
            <td>${balance >= 0 ? "+" : ""}${balance}</td>
        `;
        
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });

    wrap.appendChild(table);

    container.appendChild(wrap);
}

