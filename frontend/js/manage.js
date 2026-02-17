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
            updatePhaseButtons(); // Refresh button visibility
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
                updatePhaseButtons(); // Refresh button visibility
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
                updatePhaseButtons(); // Refresh button visibility
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

            const select = document.getElementById("poule-select");
            select.innerHTML = "";
            select.appendChild(new Option("Geen poule", ""));

            // Check if mobile view (card-based)
            const isMobile = window.innerWidth <= 768;
            const poulesTable = document.querySelector("#poule-list").closest("table");
            let cardContainer = document.getElementById("poules-card-container");

            if (isMobile && poulesTable) {
                // Create card container if it doesn't exist
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
                // Desktop view - show table, hide cards
                if (cardContainer) {
                    cardContainer.style.display = "none";
                }
                if (poulesTable) {
                    poulesTable.style.display = "table";
                }
            }

            poules.forEach(p => {
                if (isMobile && cardContainer) {
                    // Card view for mobile
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

                    // Edit poule
                    card.querySelector(".edit-poule").addEventListener("click", async () => {
                        const newName = prompt("Nieuwe poule naam:", p.name);
                        if (!newName) return;
                        try {
                            await apiPut(`/poules/${p.id}`, { name: newName });
                            await loadPoules();
                            await loadTeams(); // update team dropdowns
                        } catch (err) {
                            alert("Fout bij bewerken poule: " + err.message);
                        }
                    });

                    // Delete poule
                    card.querySelector(".delete-poule").addEventListener("click", async () => {
                        if (!confirm(`Weet je zeker dat je "${p.name}" wilt verwijderen?`)) return;
                        try {
                            await apiDelete(`/poules/${p.id}`);
                            await loadPoules();
                            await loadTeams(); // remove deleted poule from team list
                        } catch (err) {
                            alert("Fout bij verwijderen poule: " + err.message);
                        }
                    });
                } else {
                    // Table view for desktop
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${p.name}</td>
                        <td>
                            <button class="edit-poule">Bewerk</button>
                            <button class="delete-poule">Verwijder</button>
                        </td>
                    `;
                    list.appendChild(tr);

                    // Edit poule
                    tr.querySelector(".edit-poule").addEventListener("click", async () => {
                        const newName = prompt("Nieuwe poule naam:", p.name);
                        if (!newName) return;
                        try {
                            await apiPut(`/poules/${p.id}`, { name: newName });
                            await loadPoules();
                            await loadTeams(); // update team dropdowns
                        } catch (err) {
                            alert("Fout bij bewerken poule: " + err.message);
                        }
                    });

                    // Delete poule
                    tr.querySelector(".delete-poule").addEventListener("click", async () => {
                        if (!confirm(`Weet je zeker dat je "${p.name}" wilt verwijderen?`)) return;
                        try {
                            await apiDelete(`/poules/${p.id}`);
                            await loadPoules();
                            await loadTeams(); // remove deleted poule from team list
                        } catch (err) {
                            alert("Fout bij verwijderen poule: " + err.message);
                        }
                    });
                }

                // Add to team dropdown
                const option = document.createElement("option");
                option.value = p.id;
                option.text = p.name;
                select.appendChild(option);
            });
        } catch (err) {
            console.error("Error loading poules:", err);
            const list = document.getElementById("poule-list");
            if (list) {
                list.innerHTML = `<tr><td colspan="2" style="color: red;">Fout bij laden poules: ${err.message}</td></tr>`;
            }
        }
    }

    // Add new poule
    document.getElementById("add-poule").onclick = async () => {
        const name = document.getElementById("new-poule-name").value.trim();
        if (!name) return alert("Poule name required");

        try {
            await apiPost(`/tournaments/${tournamentId}/poules/`, { name });
            document.getElementById("new-poule-name").value = "";
            await loadPoules();
        } catch (err) {
            alert("Fout bij toevoegen poule: " + err.message);
        }
    };

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

        // Check if mobile view (card-based)
        const isMobile = window.innerWidth <= 768;
        const teamsTable = document.querySelector("#teams").closest("table");
        let cardContainer = document.getElementById("teams-card-container");
        
        if (isMobile && teamsTable) {
            // Create card container if it doesn't exist
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
            // Desktop view - show table, hide cards
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
                // Card view for mobile
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
                
                // Attach event listeners
                card.querySelector(".edit-team").addEventListener("click", async () => {
                    const newName = prompt("Nieuwe teamnaam:", team.name);
                    if (!newName) return;

                    try {
                        const pouleOptions = poules.map(p => `${p.id}:${p.name}`).join("\n");
                        const pouleInput = prompt(`Selecteer poule (id:name):\n${pouleOptions}`, `${team.poule_id ?? ""}`);
                        const newPouleId = pouleInput ? Number(pouleInput.split(":")[0]) : null;

                        await apiPut(`/teams/${team.id}`, { name: newName });

                        if (newPouleId !== team.poule_id) {
                            await apiPut(`/teams/${team.id}/assign-poule/${newPouleId}`);
                        }

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
                    } catch (err) {
                        alert("Fout bij verwijderen team: " + err.message);
                    }
                });
            } else {
                // Table view for desktop
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

                // Edit team
                tr.querySelector(".edit-team").addEventListener("click", async () => {
                    const newName = prompt("Nieuwe teamnaam:", team.name);
                    if (!newName) return;

                    try {
                        // Optional: select new poule
                        const pouleOptions = poules.map(p => `${p.id}:${p.name}`).join("\n");
                        const pouleInput = prompt(`Selecteer poule (id:name):\n${pouleOptions}`, `${team.poule_id ?? ""}`);
                        const newPouleId = pouleInput ? Number(pouleInput.split(":")[0]) : null;

                        // Update name
                        await apiPut(`/teams/${team.id}`, { name: newName });

                        // Update poule if changed
                        if (newPouleId !== team.poule_id) {
                            await apiPut(`/teams/${team.id}/assign-poule/${newPouleId}`);
                        }

                        await loadTeams();
                    } catch (err) {
                        alert("Fout bij bewerken team: " + err.message);
                    }
                });

                // Delete team
                tr.querySelector(".delete-team").addEventListener("click", async () => {
                    if (!confirm(`Weet je zeker dat je "${team.name}" wilt verwijderen?`)) return;
                    try {
                        await apiDelete(`/teams/${team.id}`);
                        await loadTeams();
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

    // Add new team
    document.getElementById("add-team").onclick = async () => {
        const name = document.getElementById("team-name").value.trim();
        const pouleId = Number(document.getElementById("poule-select").value) || null;
        if (!name) {
            alert("Team naam is verplicht");
            return;
        }

        try {
            await apiPost(`/tournaments/${tournamentId}/teams/`, {
                name,
                poule_id: pouleId
            });

            document.getElementById("team-name").value = "";
            await loadTeams();
        } catch (err) {
            alert("Fout bij toevoegen team: " + err.message);
        }
    };

    // ----------------- Phase Status Check -----------------
    async function updatePhaseButtons() {
        try {
            const status = await apiGet(`/tournaments/${tournamentId}/phase-status`);
            const generateKnockoutBtn = document.getElementById("generate-knockout-btn");
            const generateFinalBtn = document.getElementById("generate-final-btn");

            // Show knockout button only if group phase is complete
            if (generateKnockoutBtn) {
                if (status.group_phase_complete) {
                    generateKnockoutBtn.style.display = "inline-block";
                    generateKnockoutBtn.disabled = false;
                } else {
                    generateKnockoutBtn.style.display = "none";
                    generateKnockoutBtn.disabled = true;
                }
            }

            // Show final button only if knockout phase is complete
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
            // On error, hide buttons to be safe
            const generateKnockoutBtn = document.getElementById("generate-knockout-btn");
            const generateFinalBtn = document.getElementById("generate-final-btn");
            if (generateKnockoutBtn) generateKnockoutBtn.style.display = "none";
            if (generateFinalBtn) generateFinalBtn.style.display = "none";
        }
    }

    // ----------------- Init -----------------
    loadTournament();
    loadPoules();
    loadTeams();
    updatePhaseButtons();
    
    // Refresh phase status every 5 seconds to update buttons
    setInterval(updatePhaseButtons, 5000);
    });