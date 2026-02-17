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
    let resizeTimeout;
    window.addEventListener("resize", () => {
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
});

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

    const standings = await apiGet(`/tournaments/${tournamentId}/overall-standings`);

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
            if (row.progression_level === 1) {
                if (row.final_position === 1) {
                    progressionBadge = " 🏆";
                } else if (row.final_position === 2) {
                    progressionBadge = " 🥈";
                } else {
                    progressionBadge = " (Posities 1-4)";
                }
            } else if (row.progression_level === 2) {
                progressionBadge = " (Posities 5-8)";
            } else if (row.progression_level === 3) {
                progressionBadge = " (Posities 9-12)";
            } else if (row.progression_level === 4) {
                progressionBadge = " (Posities 13-16)";
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

