# Tournament Web Application

A reusable web application for organizing volleyball (and similar) tournaments. The system supports group stages (poules), automatic scheduling across multiple fields, score tracking, standings calculation, and knockout phases.

This project is designed to be generic, configurable, and reusable for future tournaments.

---

##  Features

### Core functionality

* Create and manage tournaments
* Add teams and assign them to poules
* Automatically generate match schedules
* Support multiple fields playing simultaneously
* Enter and update match scores
* Automatically calculate poule standings
* Generate knockout phases (quarterfinals, semifinals, finals)

### Views

* Admin view

  * Create tournaments
  * Manage teams
  * Generate schedules
  * Enter scores

* Public view

  * View match schedule
  * Live / finished scores
  * Poule standings

---

## Tournament assumptions (v1)

These are the assumptions for the first version. Most of them are configurable.

* Team-based sport (volleyball-focused)
* One-day tournament
* Group stage (poules) followed by knockout phase
* Fixed number of fields
* Scores entered manually by an admin

---

## Configuration goals

The system is designed so the following are not hardcoded:

* Number of teams
* Poule size (e.g. 4 teams per poule)
* Number of poules
* Number of available fields
* Match duration and break time
* Points system (win/loss)
* Number of teams advancing from each poule

---

## Technical stack

### Backend

* Python 3.8+
* FastAPI (REST API)
* SQLite (easy local development, replaceable later)
* SQLAlchemy (ORM)
* JWT authentication (python-jose)
* Password hashing (passlib[bcrypt])

### Frontend

* HTML / CSS / JavaScript (vanilla)
* LocalStorage for auth token management

---

## 📁 Project structure

```text
tournament-app/
│
├── backend/
│   ├── main.py          # FastAPI entry point
│   ├── database.py      # DB connection & session
│   ├── models.py        # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   ├── services/        # Business logic (scheduling, standings)
│   └── api/             # API routes
│
└── frontend/
    ├── index.html       # Public view
    ├── admin.html       # Admin interface
    ├── styles.css
    └── app.js
```

---

## Core data models (conceptual)

### Tournament

* id
* name
* date
* number_of_fields
* match_duration
* break_duration

### Team

* id
* name
* tournament_id
* poule

### Match

* id
* tournament_id
* team1_id
* team2_id
* field
* start_time
* score_team1
* score_team2
* status (scheduled / playing / finished)
* phase (poule / quarterfinal / semifinal / final)

> Standings are calculated dynamically and not stored.

---

## Scheduling logic (high level)

### Poule phase

* Round-robin scheduling per poule
* Example for 4 teams:

  * 6 matches per poule
* Matches are distributed across time slots and fields
* Constraints:

  * A team cannot play two matches at the same time
  * A field cannot host two matches at the same time

### Knockout phase

* Based on final poule standings
* Matchups configurable (e.g. A1 vs D2)

---

## Standings calculation

Standings are calculated from finished matches:

* Matches played
* Wins / losses
* Points
* (Optional) set ratio or point ratio

Sorting order:

1. Points
2. Set ratio (optional)
3. Head-to-head (future extension)

---

## Installation & Running

### Prerequisites

* Python 3.8 or higher
* pip (Python package manager)

### Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the backend server:
   ```bash
   python -m uvicorn backend.main:app --reload
   ```
   Or use the provided `run.bat` (Windows) script.

3. Open your browser and navigate to:
   ```
   http://127.0.0.1:8000/frontend/index.html
   ```

### Creating Admin Users

**⚠️ SECURITY:** For production, do NOT use default credentials. Use one of these secure methods:

#### Method 1: CLI Command (Recommended)
Create an admin user using the CLI script:
```bash
python -m backend.create_admin <username> <password>
# Example:
python -m backend.create_admin admin mySecurePassword123
```

#### Method 2: Environment Variables (Development Only)
For development, you can set environment variables to auto-create a default admin:
```bash
# Windows
set DEFAULT_ADMIN_USERNAME=admin
set DEFAULT_ADMIN_PASSWORD=yourpassword
set CREATE_DEFAULT_ADMIN=true

# Linux/Mac
export DEFAULT_ADMIN_USERNAME=admin
export DEFAULT_ADMIN_PASSWORD=yourpassword
export CREATE_DEFAULT_ADMIN=true
```

**Note:** By default, the system will NOT create a default admin user unless:
- `DEBUG=True` (development mode) AND `DEFAULT_ADMIN_PASSWORD` is set, OR
- `CREATE_DEFAULT_ADMIN=true` AND `DEFAULT_ADMIN_PASSWORD` is set

This prevents accidental exposure of default credentials in production.

### Authentication

- **Public users:** Can view tournaments, schedules, and standings
- **Organizers (logged in):** Can create tournaments, manage teams, generate schedules, and enter scores

Login page: `http://127.0.0.1:8000/frontend/login.html`

---

## Development roadmap

### Phase 1 – Foundation ✅

* Project setup
* Database models
* Basic CRUD API

### Phase 2 – Tournament logic ✅

* Poule scheduling
* Standings calculation
* Knockout generator
* Set-based scoring (2 sets per match)

### Phase 3 – UI ✅

* Admin interface
* Public tournament view
* Authentication system

### Phase 4 – Reusability & polish

* Tournament templates
* Configuration system
* Mobile-friendly UI

---

## Possible future extensions

* Referee login / scoring on mobile
* Live scoreboard view (big screen)
* QR code linking to public view
* PDF or CSV export
* Multiple user roles

---

## Design principles

* Keep logic reusable and stateless
* Separate scheduling, standings, and UI concerns
* Avoid hardcoding tournament formats
* Favor clarity over premature optimization

---

##  Author notes

This project is intended as a practical, reusable tournament system, suitable for sports clubs and small to medium tournaments.

Start simple, ship something usable, and iterate.

This Readme was generated using ChatGPT. 

---


