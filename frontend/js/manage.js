document.addEventListener("DOMContentLoaded", async () => {
    // Check auth
    if (!isLoggedIn()) {
        alert("Je moet ingelogd zijn om deze pagina te bekijken.");
        window.location.href = "login.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const tournamentId = params.get("tournament");

    if (!tournamentId) {
        document.body.innerHTML = `
            <h1>Geen toernooi geselecteerd</h1>
            <p>Selecteer eerst een toernooi vanaf de <a href="index.html">hoofdpagina</a>.</p>
        `;
        return;
    }

    // ----------------- Tournament Info -----------------
    async function loadTournament() {
        try {
            const tournaments = await apiGet(`/tournaments/`);
            const tournament = tournaments.find(t => t.id == tournamentId);
            if (tournament) {
                document.getElementById("title").innerText = tournament.name;
            } else {
                alert("Toernooi niet gevonden.");
                window.location.href = "index.html";
            }
        } catch (err) {
            alert("Fout bij laden toernooi: " + err.message);
            window.location.href = "index.html";
        }
    }

    // ----------------- Schedule -----------------
    document.getElementById("generate-schedule-btn").onclick = async () => {
        const confirmGenerate = confirm("Weet je zeker dat je het schema wilt genereren?");
        if (!confirmGenerate) return;

        try {
            const response = await apiPost(`/tournaments/${tournamentId}/generate-group-phase`, {});
            alert(response.message || "Schema succesvol aangemaakt!");
            updatePhaseButtons();
            loadSetupSuggestions(); // refresh to disable auto-distribute
        } catch (err) {
            console.error(err);
            alert(err.message || "Er is een fout opgetreden bij het genereren van het schema.");
        }
    };

    const generateKnockoutBtn = document.getElementById("generate-knockout-btn");
    if (generateKnockoutBtn) {
        generateKnockoutBtn.onclick = async () => {
            const confirmGenerate = confirm("Weet je zeker dat je de knockout fase wilt genereren?");
            if (!confirmGenerate) return;

            try {
                const response = await apiPost(`/tournaments/${tournamentId}/generate-knockout-phase`, {});
                alert(response.message || "Knockout fase succesvol ingevuld!");
                updatePhaseButtons();
            } catch (err) {
                console.error(err);
                alert(err.message || "Fout bij genereren knockout fase.");
            }
        };
    }

    const generateFinalBtn = document.getElementById("generate-final-btn");
    if (generateFinalBtn) {
        generateFinalBtn.onclick = async () => {
            const confirmGenerate = confirm("Weet je zeker dat je de finale wilt genereren?");
            if (!confirmGenerate) return;

            try {
                const response = await apiPost(`/tournaments/${tournamentId}/generate-final`, {});
                alert(response.message || "Finale succesvol ingevuld!");
                updatePhaseButtons();
            } catch (err) {
                console.error(err);
                alert(err.message || "Fout bij genereren finale.");
            }
        };
    }

    document.getElementById("view-schedule-btn").onclick = () => {
        window.location.href = `schedule.html?tournament=${tournamentId}`;
    };

    const enterScoresBtn = document.getElementById("enter-scores-btn");
    if (enterScoresBtn) {
        enterScoresBtn.onclick = () => {
            window.location.href = `score-entry.html?tournament=${tournamentId}`;
        };
    }


    // ----------------- Poule Setup (Suggest & Auto-distribute) -----------------
    async function loadSetupSuggestions() {
        try {
            const [suggestions, teams, status] = await Promise.all([
                apiGet(`/tournaments/${tournamentId}/suggest-setup`),
                apiGet(`/tournaments/${tournamentId}/teams/`),
                apiGet(`/tournaments/${tournamentId}/phase-status`),
            ]);

            const teamCountInfo = document.getElementById("team-count-info");
            const container = document.getElementById("suggestions-container");
            const distributeBtn = document.getElementById("auto-distribute-btn");
            const warningEl = document.getElementById("setup-warning");

            teamCountInfo.textContent = `${teams.length} team${teams.length !== 1 ? "s" : ""} geregistreerd`;

            container.innerHTML = "";
            warningEl.style.display = "none";

            const groupPhaseExists = status.group_matches_total > 0;
            const allTeamsDistributed = teams.length > 0 && teams.every(t => t.poule_id !== null);

            const setupSection = document.getElementById("poule-setup-section");
            if (groupPhaseExists || allTeamsDistributed) {
                setupSection.style.display = "none";
            } else {
                setupSection.style.display = "";
            }

            if (groupPhaseExists) {
                distributeBtn.disabled = true;
                distributeBtn.title = "Groepsfase is al gegenereerd";
            } else {
                distributeBtn.disabled = false;
                distributeBtn.title = "";
            }

            if (!suggestions || suggestions.length === 0) {
                container.textContent = teams.length < 4
                    ? "Voeg minimaal 4 teams toe om aanbevelingen te zien."
                    : "Geen aanbevelingen beschikbaar.";
                return;
            }

            suggestions.forEach((s, idx) => {
                const sizeSummary = s.poule_sizes
                    .reduce((acc, size) => {
                        const existing = acc.find(x => x.size === size);
                        if (existing) existing.count++;
                        else acc.push({ size, count: 1 });
                        return acc;
                    }, [])
                    .map(x => `${x.count}×${x.size}`)
                    .join(", ");

                const label = document.createElement("label");
                label.style.display = "block";
                label.style.marginBottom = "6px";
                label.style.cursor = groupPhaseExists ? "default" : "pointer";

                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "poule-setup";
                radio.value = s.num_poules;
                radio.disabled = groupPhaseExists;
                if (idx === 0) radio.checked = true;

                radio.addEventListener("change", () => {
                    if (s.warning) {
                        warningEl.textContent = s.warning;
                        warningEl.style.display = "block";
                    } else {
                        warningEl.style.display = "none";
                    }
                });

                label.appendChild(radio);
                label.appendChild(document.createTextNode(
                    ` ${s.num_poules} poules (${sizeSummary}) — ${s.total_rounds} rondes, ~${s.estimated_end_time}`
                ));
                container.appendChild(label);

                // Show warning for initially selected option
                if (idx === 0 && s.warning) {
                    warningEl.textContent = s.warning;
                    warningEl.style.display = "block";
                }
            });
        } catch (err) {
            console.error("Error loading setup suggestions:", err);
        }
    }

    document.getElementById("auto-distribute-btn").onclick = async () => {
        const selected = document.querySelector('input[name="poule-setup"]:checked');
        if (!selected) return alert("Selecteer een optie");
        const num_poules = parseInt(selected.value);
        if (!confirm(`Weet je zeker? Dit verdeelt alle teams willekeurig over ${num_poules} poules.`)) return;

        try {
            const result = await apiPost(`/tournaments/${tournamentId}/auto-distribute`, { num_poules });
            if (result.warning) {
                document.getElementById("setup-warning").textContent = result.warning;
                document.getElementById("setup-warning").style.display = "block";
            }
            await loadPoules();
            await loadTeams();
            await loadSetupSuggestions();
        } catch (err) {
            alert("Fout bij verdelen teams: " + err.message);
        }
    };


    // ----------------- Poules -----------------
    async function loadPoules() {
        try {
            const poules = await apiGet(`/tournaments/${tournamentId}/poules/`);

            const list = document.getElementById("poule-list");
            if (!list) {
                console.error("Poule list not found");
                return;
            }
            list.innerHTML = "";

            // Check if mobile view (card-based)
            const isMobile = window.innerWidth <= 768;
            const poulesTable = document.querySelector("#poule-list").closest("table");
            let cardContainer = document.getElementById("poules-card-container");

            if (isMobile && poulesTable) {
                if (!cardContainer) {
                    cardContainer = document.createElement("div");
                    cardContainer.id = "poules-card-container";
                    cardContainer.className = "table-card-view";
                    poulesTable.parentNode.insertBefore(cardContainer, poulesTable);
                }
                cardContainer.innerHTML = "";
                cardContainer.style.display = "block";
                poulesTable.style.display = "none";
            } else {
                if (cardContainer) {
                    cardContainer.style.display = "none";
                }
                if (poulesTable) {
                    poulesTable.style.display = "table";
                }
            }

            poules.forEach(p => {
                if (isMobile && cardContainer) {
                    const card = document.createElement("div");
                    card.className = "table-card";
                    card.innerHTML = `
                        <div class="table-card-row">
                            <div>
                                <div class="table-card-label">Poule</div>
                                <div class="table-card-value">${p.name}</div>
                            </div>
                        </div>
                        <div class="table-card-actions">
                            <button class="edit-poule">Bewerk</button>
                            <button class="delete-poule danger">Verwijder</button>
                        </div>
                    `;
                    cardContainer.appendChild(card);

                    card.querySelector(".edit-poule").addEventListener("click", async () => {
                        const newName = prompt("Nieuwe poule naam:", p.name);
                        if (!newName) return;
                        try {
                            await apiPut(`/poules/${p.id}`, { name: newName });
                            await loadPoules();
                            await loadTeams();
                        } catch (err) {
                            alert("Fout bij bewerken poule: " + err.message);
                        }
                    });

                    card.querySelector(".delete-poule").addEventListener("click", async () => {
                        if (!confirm(`Weet je zeker dat je "${p.name}" wilt verwijderen?`)) return;
                        try {
                            await apiDelete(`/poules/${p.id}`);
                            await loadPoules();
                            await loadTeams();
                        } catch (err) {
                            alert("Fout bij verwijderen poule: " + err.message);
                        }
                    });
                } else {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${p.name}</td>
                        <td>
                            <button class="edit-poule">Bewerk</button>
                            <button class="delete-poule">Verwijder</button>
                        </td>
                    `;
                    list.appendChild(tr);

                    tr.querySelector(".edit-poule").addEventListener("click", async () => {
                        const newName = prompt("Nieuwe poule naam:", p.name);
                        if (!newName) return;
                        try {
                            await apiPut(`/poules/${p.id}`, { name: newName });
                            await loadPoules();
                            await loadTeams();
                        } catch (err) {
                            alert("Fout bij bewerken poule: " + err.message);
                        }
                    });

                    tr.querySelector(".delete-poule").addEventListener("click", async () => {
                        if (!confirm(`Weet je zeker dat je "${p.name}" wilt verwijderen?`)) return;
                        try {
                            await apiDelete(`/poules/${p.id}`);
                            await loadPoules();
                            await loadTeams();
                        } catch (err) {
                            alert("Fout bij verwijderen poule: " + err.message);
                        }
                    });
                }
            });
        } catch (err) {
            console.error("Error loading poules:", err);
            const list = document.getElementById("poule-list");
            if (list) {
                list.innerHTML = `<tr><td colspan="2" style="color: red;">Fout bij laden poules: ${err.message}</td></tr>`;
            }
        }
    }


    // ----------------- Teams -----------------
    async function loadTeams() {
        try {
            const tbody = document.getElementById("teams");
            if (!tbody) {
                console.error("Teams tbody not found");
                return;
            }
            tbody.innerHTML = "";

            const teams = await apiGet(`/tournaments/${tournamentId}/teams/`);
            const poules = await apiGet(`/tournaments/${tournamentId}/poules/`);

            const isMobile = window.innerWidth <= 768;
            const teamsTable = document.querySelector("#teams").closest("table");
            let cardContainer = document.getElementById("teams-card-container");

            if (isMobile && teamsTable) {
                if (!cardContainer) {
                    cardContainer = document.createElement("div");
                    cardContainer.id = "teams-card-container";
                    cardContainer.className = "table-card-view";
                    teamsTable.parentNode.insertBefore(cardContainer, teamsTable);
                }
                cardContainer.innerHTML = "";
                cardContainer.style.display = "block";
                teamsTable.style.display = "none";
            } else {
                if (cardContainer) {
                    cardContainer.style.display = "none";
                }
                if (teamsTable) {
                    teamsTable.style.display = "table";
                }
            }

            teams.forEach(team => {
                const poule = poules.find(p => p.id === team.poule_id);

                if (isMobile && cardContainer) {
                    const card = document.createElement("div");
                    card.className = "table-card";
                    card.innerHTML = `
                        <div class="table-card-row">
                            <div>
                                <div class="table-card-label">Team</div>
                                <div class="table-card-value">${team.name}</div>
                            </div>
                            <div>
                                <div class="table-card-label">Poule</div>
                                <div class="table-card-value">${poule?.name ?? "—"}</div>
                            </div>
                        </div>
                        <div class="table-card-actions">
                            <button class="edit-team">Bewerk</button>
                            <button class="delete-team danger">Verwijder</button>
                        </div>
                    `;
                    cardContainer.appendChild(card);

                    card.querySelector(".edit-team").addEventListener("click", async () => {
                        const newName = prompt("Nieuwe teamnaam:", team.name);
                        if (!newName) return;
                        try {
                            await apiPut(`/teams/${team.id}`, { name: newName });
                            await loadTeams();
                        } catch (err) {
                            alert("Fout bij bewerken team: " + err.message);
                        }
                    });

                    card.querySelector(".delete-team").addEventListener("click", async () => {
                        if (!confirm(`Weet je zeker dat je "${team.name}" wilt verwijderen?`)) return;
                        try {
                            await apiDelete(`/teams/${team.id}`);
                            await loadTeams();
                            await loadSetupSuggestions();
                        } catch (err) {
                            alert("Fout bij verwijderen team: " + err.message);
                        }
                    });
                } else {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${team.name}</td>
                        <td>${poule?.name ?? "—"}</td>
                        <td>
                            <button class="edit-team">Bewerk</button>
                            <button class="delete-team">Verwijder</button>
                        </td>
                    `;
                    tbody.appendChild(tr);

                    tr.querySelector(".edit-team").addEventListener("click", async () => {
                        const newName = prompt("Nieuwe teamnaam:", team.name);
                        if (!newName) return;
                        try {
                            await apiPut(`/teams/${team.id}`, { name: newName });
                            await loadTeams();
                        } catch (err) {
                            alert("Fout bij bewerken team: " + err.message);
                        }
                    });

                    tr.querySelector(".delete-team").addEventListener("click", async () => {
                        if (!confirm(`Weet je zeker dat je "${team.name}" wilt verwijderen?`)) return;
                        try {
                            await apiDelete(`/teams/${team.id}`);
                            await loadTeams();
                            await loadSetupSuggestions();
                        } catch (err) {
                            alert("Fout bij verwijderen team: " + err.message);
                        }
                    });
                }
            });
        } catch (err) {
            console.error("Error loading teams:", err);
            const tbody = document.getElementById("teams");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="3" style="color: red;">Fout bij laden teams: ${err.message}</td></tr>`;
            }
        }
    }

    // Handle window resize to toggle between table/card views
    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            loadPoules();
            loadTeams();
        }, 250);
    });

    // Add new team (no poule assignment — handled by auto-distribute)
    document.getElementById("add-team").onclick = async () => {
        const name = document.getElementById("team-name").value.trim();
        if (!name) {
            alert("Team naam is verplicht");
            return;
        }

        try {
            await apiPost(`/tournaments/${tournamentId}/teams/`, { name });
            document.getElementById("team-name").value = "";
            await loadTeams();
            await loadSetupSuggestions();
        } catch (err) {
            alert("Fout bij toevoegen team: " + err.message);
        }
    };

    // ----------------- Phase Status Check -----------------
    async function updatePhaseButtons() {
        try {
            const status = await apiGet(`/tournaments/${tournamentId}/phase-status`);
            const generateScheduleBtn = document.getElementById("generate-schedule-btn");
            const generateKnockoutBtn = document.getElementById("generate-knockout-btn");
            const generateFinalBtn = document.getElementById("generate-final-btn");

            if (generateScheduleBtn) {
                generateScheduleBtn.style.display = status.group_matches_total > 0 ? "none" : "inline-block";
            }

            if (generateKnockoutBtn) {
                if (status.group_phase_complete) {
                    generateKnockoutBtn.style.display = "inline-block";
                    generateKnockoutBtn.disabled = false;
                } else {
                    generateKnockoutBtn.style.display = "none";
                    generateKnockoutBtn.disabled = true;
                }
            }

            if (generateFinalBtn) {
                if (status.knockout_phase_complete) {
                    generateFinalBtn.style.display = "inline-block";
                    generateFinalBtn.disabled = false;
                } else {
                    generateFinalBtn.style.display = "none";
                    generateFinalBtn.disabled = true;
                }
            }
        } catch (err) {
            console.error("Error checking phase status:", err);
            const generateKnockoutBtn = document.getElementById("generate-knockout-btn");
            const generateFinalBtn = document.getElementById("generate-final-btn");
            if (generateKnockoutBtn) generateKnockoutBtn.style.display = "none";
            if (generateFinalBtn) generateFinalBtn.style.display = "none";
        }
    }

    // ----------------- Sponsors -----------------
    async function loadSponsors() {
        try {
            const sponsors = await apiGet(`/tournaments/${tournamentId}/sponsors`);
            const list = document.getElementById("sponsor-list");
            list.innerHTML = "";

            if (sponsors.length === 0) {
                list.textContent = "Nog geen sponsors toegevoegd.";
                return;
            }

            sponsors.forEach(s => {
                const row = document.createElement("div");
                row.className = "sponsor-manage-row";
                row.innerHTML = `
                    <img src="${s.logo_url}" alt="${s.name || ''}" class="sponsor-thumb" />
                    <span class="sponsor-manage-name">${s.name || "—"}</span>
                    <span class="sponsor-manage-url">${s.url ? `<a href="${s.url}" target="_blank">${s.url}</a>` : "—"}</span>
                    <button class="delete-sponsor danger">Verwijder</button>
                `;
                row.querySelector(".delete-sponsor").addEventListener("click", async () => {
                    if (!confirm(`Weet je zeker dat je deze sponsor wilt verwijderen?`)) return;
                    try {
                        await apiDelete(`/sponsors/${s.id}`);
                        await loadSponsors();
                    } catch (err) {
                        alert("Fout bij verwijderen sponsor: " + err.message);
                    }
                });
                list.appendChild(row);
            });
        } catch (err) {
            console.error("Error loading sponsors:", err);
        }
    }

    document.getElementById("add-sponsor").onclick = async () => {
        const fileInput = document.getElementById("sponsor-logo");
        const file = fileInput.files[0];
        if (!file) {
            alert("Selecteer een afbeelding.");
            return;
        }

        const formData = new FormData();
        formData.append("logo", file);
        formData.append("name", document.getElementById("sponsor-name").value.trim());
        formData.append("url", document.getElementById("sponsor-url").value.trim());

        const token = localStorage.getItem("auth_token");
        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        try {
            const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/sponsors`, {
                method: "POST",
                headers,
                body: formData,
            });
            if (res.status === 401) { handleUnauthorized(); return; }
            if (!res.ok) {
                const text = await res.text();
                let msg;
                try { msg = JSON.parse(text).detail || text; } catch { msg = text; }
                throw new Error(msg);
            }
            fileInput.value = "";
            document.getElementById("sponsor-name").value = "";
            document.getElementById("sponsor-url").value = "";
            await loadSponsors();
        } catch (err) {
            alert("Fout bij uploaden sponsor: " + err.message);
        }
    };

    // ----------------- Init -----------------
    loadTournament();
    loadPoules();
    loadTeams();
    loadSetupSuggestions();
    updatePhaseButtons();
    loadSponsors();

    // Refresh phase status every 5 seconds to update buttons
    setInterval(updatePhaseButtons, 5000);
});
