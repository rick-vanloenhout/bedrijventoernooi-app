const urlParams = new URLSearchParams(window.location.search);
const tournamentId = urlParams.get("tournament");
let allRounds = [];
let currentPhase = "group"; // Will be determined dynamically

document.addEventListener("DOMContentLoaded", () => {
    // Check auth
    if (!isLoggedIn()) {
        alert("Je moet ingelogd zijn om scores in te voeren.");
        window.location.href = "login.html";
        return;
    }

    if (!tournamentId) {
        document.body.innerHTML = `
            <h1>Geen toernooi geselecteerd</h1>
            <p><a href="index.html">← Terug</a></p>
        `;
        return;
    }

    const backLink = document.getElementById("back-link");
    backLink.href = `schedule.html?tournament=${tournamentId}`;

    // Setup phase filter
    const phaseFilter = document.getElementById("phase-filter");
    const showAllCheckbox = document.getElementById("show-all-phases");
    
    phaseFilter.addEventListener("change", () => {
        if (showAllCheckbox.checked) {
            showAllCheckbox.checked = false;
        }
        loadMatches();
    });
    
    showAllCheckbox.addEventListener("change", () => {
        if (showAllCheckbox.checked) {
            phaseFilter.value = "all";
        } else {
            phaseFilter.value = "current";
        }
        loadMatches();
    });

    loadMatches();
});

function determineCurrentPhase(rounds) {
    // Find the first incomplete phase
    for (const rnd of rounds) {
        const incompleteMatches = rnd.matches.filter(m => {
            return !(m.home_set1_score != null && m.away_set1_score != null &&
                     m.home_set2_score != null && m.away_set2_score != null &&
                     !(m.home_set1_score == 0 && m.away_set1_score == 0) &&
                     !(m.home_set2_score == 0 && m.away_set2_score == 0));
        });
        
        if (incompleteMatches.length > 0) {
            return rnd.type;
        }
    }
    // If all matches complete, return the last phase
    return rounds.length > 0 ? rounds[rounds.length - 1].type : "group";
}

async function loadMatches() {
    const container = document.getElementById("matches-container");
    container.innerHTML = "";

    try {
        const rounds = await apiGet(`/tournaments/${tournamentId}/rounds`);

        if (!rounds || rounds.length === 0) {
            container.textContent = "Geen wedstrijden gevonden.";
            return;
        }

        allRounds = rounds;
        currentPhase = determineCurrentPhase(rounds);
        
        // Get filter selection
        const phaseFilter = document.getElementById("phase-filter");
        const showAllCheckbox = document.getElementById("show-all-phases");
        
        // Determine which phase to show
        let selectedPhase = showAllCheckbox.checked ? "all" : phaseFilter.value;
        
        // If "current" is selected, map to actual phase type
        if (selectedPhase === "current") {
            selectedPhase = currentPhase;
        }
        
        // Filter rounds based on selection
        let roundsToShow = rounds;
        if (selectedPhase !== "all") {
            roundsToShow = rounds.filter(rnd => rnd.type === selectedPhase);
        }

        if (roundsToShow.length === 0) {
            const phaseNames = {
                "group": "groepsfase",
                "knockout": "knockout fase",
                "final": "finale",
                "all": "alle fases"
            };
            container.textContent = `Geen wedstrijden gevonden voor ${phaseNames[selectedPhase] || selectedPhase}.`;
            return;
        }

    roundsToShow.forEach(rnd => {
        const roundDiv = document.createElement("div");
        roundDiv.className = "round";
        roundDiv.setAttribute("data-phase", rnd.type);

        roundDiv.innerHTML = `<h3>Ronde ${rnd.round_number} (${rnd.type})</h3>`;
        const ul = document.createElement("ul");

        rnd.matches.forEach(m => {
            const home =
                m.home_team?.name ??
                (m.home_rank_position ? `#${m.home_rank_position}` : "—");

            const away =
                m.away_team?.name ??
                (m.away_rank_position ? `#${m.away_rank_position}` : "—");

                const homeSet1 = m.home_set1_score ?? "";
                const awaySet1 = m.away_set1_score ?? "";
                const homeSet2 = m.home_set2_score ?? "";
                const awaySet2 = m.away_set2_score ?? "";

            const li = document.createElement("li");
            li.style.marginBottom = "16px";
            li.style.padding = "12px";
            li.style.border = "1px solid #ddd";
            li.style.borderRadius = "4px";

            li.innerHTML = `
                <div style="margin-bottom: 8px;"><strong>Veld ${m.field_number}: ${home} vs ${away}</strong></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <div>
                        <label style="display: block; font-size: 0.85rem; margin-bottom: 4px;">Set 1 - ${home}:</label>
                        <input type="number" min="0" id="home1-${m.id}" value="${homeSet1}" style="width: 100%; padding: 6px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; margin-bottom: 4px;">Set 1 - ${away}:</label>
                        <input type="number" min="0" id="away1-${m.id}" value="${awaySet1}" style="width: 100%; padding: 6px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; margin-bottom: 4px;">Set 2 - ${home}:</label>
                        <input type="number" min="0" id="home2-${m.id}" value="${homeSet2}" style="width: 100%; padding: 6px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; margin-bottom: 4px;">Set 2 - ${away}:</label>
                        <input type="number" min="0" id="away2-${m.id}" value="${awaySet2}" style="width: 100%; padding: 6px;">
                    </div>
                </div>
                <button onclick="submitScore(${m.id})">Opslaan</button>
            `;
            ul.appendChild(li);
        });

        roundDiv.appendChild(ul);
        container.appendChild(roundDiv);
    });
    } catch (err) {
        container.innerHTML = `<p style="color: #cc3333;">Fout bij laden wedstrijden: ${err.message}</p>`;
    }
}

async function submitScore(matchId) {
    const homeSet1 = parseInt(document.getElementById(`home1-${matchId}`).value) || 0;
    const awaySet1 = parseInt(document.getElementById(`away1-${matchId}`).value) || 0;
    const homeSet2 = parseInt(document.getElementById(`home2-${matchId}`).value) || 0;
    const awaySet2 = parseInt(document.getElementById(`away2-${matchId}`).value) || 0;

    try {
        await apiPost(`/matches/${matchId}/score`, {
            home_set1_score: isNaN(homeSet1) ? null : homeSet1,
            away_set1_score: isNaN(awaySet1) ? null : awaySet1,
            home_set2_score: isNaN(homeSet2) ? null : homeSet2,
            away_set2_score: isNaN(awaySet2) ? null : awaySet2
        });
        alert("Score opgeslagen!");
        loadMatches(); // refresh
    } catch (err) {
        alert("Fout bij opslaan score: " + err.message);
    }
}
