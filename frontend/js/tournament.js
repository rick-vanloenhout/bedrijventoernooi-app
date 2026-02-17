// -------------------- Load Tournaments --------------------
async function loadTournaments() {
    const grid = document.getElementById("tournament-grid");
    grid.innerHTML = "";

    const tournaments = await apiGet("/tournaments/");
    const loggedIn = isLoggedIn();

    tournaments.forEach(t => {
        const card = document.createElement("div");
        card.className = "tournament-card";

        let actionsHtml = "";
        if (loggedIn) {
            actionsHtml = `
                <div class="card-actions">
                    <button class="edit-btn">Bewerk</button>
                    <button class="delete-btn">Verwijder</button>
                </div>
            `;
        }

        card.innerHTML = `
            <h3>${t.name}</h3>
            <div class="meta">
                Velden: ${t.num_fields}<br>
                Starttijd: ${t.start_time}<br>
                Wedstrijd: ${t.match_duration_minutes} min<br>
                Pauze: ${t.break_duration_minutes} min
            </div>
            ${actionsHtml}
        `;

        // Click card → open schedule (public) or manage (admin)
        card.addEventListener("click", () => {
            if (loggedIn) {
                window.location.href = `manage.html?tournament=${t.id}`;
            } else {
                window.location.href = `schedule.html?tournament=${t.id}`;
            }
        });

        // Edit button (only if logged in)
        if (loggedIn) {
            card.querySelector(".edit-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                openEditTournament(t);
            });

            // Delete button
            card.querySelector(".delete-btn").addEventListener("click", async (e) => {
                e.stopPropagation();
                if (!confirm(`Weet je zeker dat je "${t.name}" wilt verwijderen?`)) return;

                try {
                    await apiDelete(`/tournaments/${t.id}`);
                    loadTournaments();
                } catch (err) {
                    alert("Fout bij verwijderen: " + err.message);
                }
            });
        }

        grid.appendChild(card);
    });

    // + New tournament card (only if logged in)
    if (loggedIn) {
        const newCard = document.createElement("div");
        newCard.className = "tournament-card new-tournament";
        newCard.innerHTML = `
            <span>+</span>
            <p>Nieuw toernooi</p>
        `;

        newCard.onclick = () => {
            const wrapper = document.getElementById("new-tournament-form");
            wrapper.classList.remove("hidden");
            editingTournamentId = null;
            document.getElementById("tournament-form").reset();
            document.getElementById("name").focus();
        };

        grid.appendChild(newCard);
    }
}

// -------------------- Edit Tournament --------------------
let editingTournamentId = null;

function openEditTournament(t) {
    editingTournamentId = t.id;

    document.getElementById("name").value = t.name;
    // slice to remove seconds for datetime-local input
    document.getElementById("start_time").value = t.start_time ? t.start_time.slice(0,16) : "";
    document.getElementById("fields").value = t.num_fields;
    document.getElementById("match").value = t.match_duration_minutes;
    document.getElementById("breaktime").value = t.break_duration_minutes;

    document.getElementById("new-tournament-form").classList.remove("hidden");
    document.getElementById("name").focus();
}

// -------------------- Auth UI --------------------
function updateAuthUI() {
    const loggedIn = isLoggedIn();
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const authStatus = document.getElementById("auth-status");
    const newTournamentForm = document.getElementById("new-tournament-form");

    if (loggedIn) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        authStatus.textContent = "Hallo, organisator!";
    } else {
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        authStatus.textContent = "";
        newTournamentForm.classList.add("hidden");
    }
}

// -------------------- Form Submit --------------------
document.addEventListener("DOMContentLoaded", () => {
    // Setup auth UI
    updateAuthUI();
    document.getElementById("login-btn").addEventListener("click", () => {
        window.location.href = "login.html";
    });
    document.getElementById("logout-btn").addEventListener("click", () => {
        if (confirm("Uitloggen?")) {
            logout();
        }
    });

    loadTournaments();

    document.getElementById("tournament-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!isLoggedIn()) {
            alert("Je moet ingelogd zijn om toernooien aan te maken.");
            return;
        }

        // Get values from form
        let startTime = document.getElementById("start_time").value;
        // add seconds if not included
        if (startTime && !startTime.endsWith(":00")) startTime += ":00";

        const payload = {
            name: document.getElementById("name").value.trim(),
            start_time: document.getElementById("start_time").value,
            num_fields: parseInt(document.getElementById("fields").value),
            match_duration_minutes: parseInt(document.getElementById("match").value),
            break_duration_minutes: parseInt(document.getElementById("breaktime").value)
        };

        if (!payload.name) {
            alert("Tournament name is required");
            return;
        }

        try {
            if (editingTournamentId) {
                await apiPut(`/tournaments/${editingTournamentId}`, payload);
                editingTournamentId = null;
            } else {
                await apiPost("/tournaments/", payload);
            }

            // Clear form and hide
            e.target.reset();
            document.getElementById("new-tournament-form").classList.add("hidden");

            loadTournaments();
        } catch (err) {
            alert("Fout bij opslaan: " + err.message);
        }
    });
});
