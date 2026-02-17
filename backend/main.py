# python -m uvicorn backend.main:app --reload

from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.database import engine, SessionLocal
from backend import models, crud, schemas, schedule
from backend.settings import CORS_ORIGINS, CREATE_DEFAULT_ADMIN, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD
from backend.schemas import (
    TournamentCreate, TournamentRead, TournamentUpdate,
    PouleCreate, PouleRead,
    TeamCreate, TeamRead, TeamUpdate
)
from backend.schedule import generate_group_phase, generate_knockout_phase, generate_final, get_team_by_rank
from backend.models import Tournament, Round, Match, Poule, User
from backend.auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_active_user
)

from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# -------------------- CORS & Frontend --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

# Redirect root to frontend
@app.get("/")
def root():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/frontend/index.html")

# -------------------- DB Init --------------------
models.Base.metadata.create_all(bind=engine)

# Create default admin user if configured (only in development/DEBUG mode)
def init_admin_user():
    # Only create default admin if explicitly enabled (default: only in DEBUG mode)
    if not CREATE_DEFAULT_ADMIN:
        return
    
    # Require password to be set via environment variable for security
    if not DEFAULT_ADMIN_PASSWORD:
        print("INFO: Default admin user creation skipped. Set DEFAULT_ADMIN_PASSWORD env var to enable.")
        return
    
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == DEFAULT_ADMIN_USERNAME).first()
        if not admin:
            try:
                admin = User(
                    username=DEFAULT_ADMIN_USERNAME,
                    hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
                    is_active=1
                )
                db.add(admin)
                db.commit()
                print(f"INFO: Default admin user '{DEFAULT_ADMIN_USERNAME}' created.")
            except Exception as e:
                print(f"Warning: Could not create default admin user: {e}")
                db.rollback()
    except Exception as e:
        print(f"Warning: Error during admin user initialization: {e}")
    finally:
        db.close()

# Initialize admin user (non-blocking, only if configured)
try:
    init_admin_user()
except Exception as e:
    print(f"Warning: Admin user initialization failed: {e}. Use 'python -m backend.create_admin' to create admin users.")

# -------------------- Dependency --------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------- Auth Schemas --------------------
class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    username: str
    password: str

# -------------------- Auth Endpoints --------------------
@app.post("/auth/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.hashed_password) or user.is_active != 1:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me")
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    return {"username": current_user.username, "is_active": current_user.is_active == 1}


# -------------------- Tournament --------------------
@app.post("/tournaments/", response_model=TournamentRead)
def create_tournament(
    tournament: TournamentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_tournament = models.Tournament(
        name=tournament.name,
        start_time=tournament.start_time,
        num_fields=tournament.num_fields,
        match_duration_minutes=tournament.match_duration_minutes,
        break_duration_minutes=tournament.break_duration_minutes
    )
    db.add(db_tournament)
    db.commit()
    db.refresh(db_tournament)
    return db_tournament


@app.get("/tournaments/", response_model=List[TournamentRead])
def list_tournaments(db: Session = Depends(get_db)):
    return db.query(models.Tournament).all()


@app.put("/tournaments/{tournament_id}", response_model=TournamentRead)
def update_tournament(
    tournament_id: int,
    tournament: TournamentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if not db_tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    db_tournament.name = tournament.name
    db_tournament.start_time = tournament.start_time
    db_tournament.num_fields = tournament.num_fields
    db_tournament.match_duration_minutes = tournament.match_duration_minutes
    db_tournament.break_duration_minutes = tournament.break_duration_minutes

    db.commit()
    db.refresh(db_tournament)
    return db_tournament


@app.delete("/tournaments/{tournament_id}", status_code=204)
def delete_tournament(
    tournament_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    db.delete(tournament)
    db.commit()
    return {"status": "deleted"}


# -------------------- Poule --------------------
@app.post("/tournaments/{tournament_id}/poules/", response_model=PouleRead)
def create_poule(
    tournament_id: int,
    poule: PouleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    db_poule = models.Poule(name=poule.name, tournament_id=tournament_id)
    db.add(db_poule)
    db.commit()
    db.refresh(db_poule)
    return db_poule


@app.get("/tournaments/{tournament_id}/poules/", response_model=List[PouleRead])
def get_poules_for_tournament(tournament_id: int, db: Session = Depends(get_db)):
    return db.query(models.Poule).filter(
        models.Poule.tournament_id == tournament_id
    ).all()


@app.put("/poules/{poule_id}", response_model=PouleRead)
def update_poule(
    poule_id: int,
    poule: PouleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_poule = db.query(models.Poule).filter(models.Poule.id == poule_id).first()
    if not db_poule:
        raise HTTPException(status_code=404, detail="Poule not found")

    db_poule.name = poule.name
    db.commit()
    db.refresh(db_poule)
    return db_poule


@app.delete("/poules/{poule_id}", status_code=204)
def delete_poule(
    poule_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_poule = db.query(models.Poule).filter(models.Poule.id == poule_id).first()
    if not db_poule:
        raise HTTPException(status_code=404, detail="Poule not found")

    db.delete(db_poule)
    db.commit()
    return {"status": "deleted"}


# -------------------- Team --------------------
@app.post("/tournaments/{tournament_id}/teams/", response_model=TeamRead)
def create_team(
    tournament_id: int,
    team: TeamCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if team name already exists in this tournament
    existing_team = db.query(models.Team).filter(
        models.Team.tournament_id == tournament_id,
        models.Team.name == team.name.strip()
    ).first()
    
    if existing_team:
        raise HTTPException(
            status_code=400,
            detail=f"Team naam '{team.name}' bestaat al in dit toernooi. Team namen moeten uniek zijn."
        )
    
    return crud.create_team(db, tournament_id, team)


@app.get("/tournaments/{tournament_id}/teams/", response_model=List[TeamRead])
def list_team(tournament_id: int, db: Session = Depends(get_db)):
    return crud.get_teams_for_tournament(db, tournament_id)


@app.put("/teams/{team_id}", response_model=TeamRead)
def update_team(
    team_id: int,
    team: TeamUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check if new team name already exists in this tournament (excluding current team)
    if team.name and team.name.strip() != db_team.name:
        existing_team = db.query(models.Team).filter(
            models.Team.tournament_id == db_team.tournament_id,
            models.Team.name == team.name.strip(),
            models.Team.id != team_id
        ).first()
        
        if existing_team:
            raise HTTPException(
                status_code=400,
                detail=f"Team naam '{team.name}' bestaat al in dit toernooi. Team namen moeten uniek zijn."
            )

    db_team.name = team.name
    if team.poule_id is not None:
        db_team.poule_id = team.poule_id

    db.commit()
    db.refresh(db_team)
    return db_team


@app.put("/teams/{team_id}/assign-poule/{poule_id}", response_model=TeamRead)
def assign_team_to_poule(
    team_id: int,
    poule_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    poule = db.query(models.Poule).filter(models.Poule.id == poule_id).first()
    if not poule:
        raise HTTPException(status_code=404, detail="Poule not found")

    if team.tournament_id != poule.tournament_id:
        raise HTTPException(
            status_code=400,
            detail="Team and poule belong to different tournaments"
        )

    team.poule_id = poule_id
    db.commit()
    db.refresh(team)
    return team


@app.delete("/teams/{team_id}", status_code=204)
def delete_team(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db.delete(team)
    db.commit()
    return {"status": "deleted"}


# -------------------- Generate group phase --------------------
@app.post("/tournaments/{tournament_id}/generate-group-phase")
def generate_group_phase_endpoint(
    tournament_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Validation: check tournament exists
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Validation: check all poules have at least 2 teams
    poules = db.query(Poule).filter(Poule.tournament_id == tournament_id).all()
    if not poules:
        raise HTTPException(status_code=400, detail="Geen poules gevonden. Voeg eerst poules toe.")
    
    for poule in poules:
        team_count = len(poule.teams)
        if team_count < 2:
            raise HTTPException(
                status_code=400,
                detail=f"Poule '{poule.name}' heeft {team_count} team(s). Minimaal 2 teams per poule vereist."
            )

    # Prevent overwriting an existing group phase
    existing_group = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type == "group"
    ).first()
    if existing_group:
        raise HTTPException(
            status_code=400,
            detail="Groepsfase bestaat al en wordt niet overschreven."
        )

    return schedule.generate_group_phase(db, tournament_id)


# -------------------- Generate knockout phase --------------------
@app.post("/tournaments/{tournament_id}/generate-knockout-phase")
def generate_knockout_phase_endpoint(
    tournament_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Require that knockout structure exists (created during group generation)
    knockout_rounds = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type == "knockout"
    ).first()
    if not knockout_rounds:
        raise HTTPException(
            status_code=400,
            detail="Knockout-structuur ontbreekt. Genereer eerst het volledige schema (groepsfase)."
        )

    try:
        return schedule.generate_knockout_phase(db, tournament_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------- Generate final --------------------
@app.post("/tournaments/{tournament_id}/generate-final")
def generate_final_endpoint(
    tournament_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Require that final structure exists (created during group generation)
    final_round = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type == "final"
    ).first()
    if not final_round:
        raise HTTPException(
            status_code=400,
            detail="Finale-structuur ontbreekt. Genereer eerst het volledige schema (groepsfase)."
        )

    try:
        return schedule.generate_final(db, tournament_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _points_for_against_played(matches, team_ids):
    """Compute points, points_for, points_against from matches (set-based). Only counts sets with scores."""
    points = {tid: 0 for tid in team_ids}
    points_for = {tid: 0 for tid in team_ids}
    points_against = {tid: 0 for tid in team_ids}

    for m in matches:
        if not m.home_team_id or not m.away_team_id:
            continue
        for (h, a) in [(m.home_set1_score, m.away_set1_score), (m.home_set2_score, m.away_set2_score)]:
            if h is not None and a is not None:
                points_for[m.home_team_id] += h
                points_against[m.home_team_id] += a
                points_for[m.away_team_id] += a
                points_against[m.away_team_id] += h
                if h > a:
                    points[m.home_team_id] += 2
                elif a > h:
                    points[m.away_team_id] += 2
                else:
                    points[m.home_team_id] += 1
                    points[m.away_team_id] += 1

    return points, points_for, points_against


# -------------------- Standings --------------------
@app.get("/tournaments/{tournament_id}/standings")
def get_standings(tournament_id: int, db: Session = Depends(get_db)):
    poules = db.query(Poule).filter(Poule.tournament_id == tournament_id).all()
    result = []

    for poule in poules:
        matches = db.query(Match).filter(Match.poule_id == poule.id).all()
        played_matches = [
            m for m in matches
            if m.home_set1_score is not None and m.away_set1_score is not None
            and m.home_set2_score is not None and m.away_set2_score is not None
            and not (m.home_set1_score == 0 and m.away_set1_score == 0)
            and not (m.home_set2_score == 0 and m.away_set2_score == 0)
        ]

        team_ids = [t.id for t in poule.teams]
        points, points_for, points_against = _points_for_against_played(played_matches, team_ids)
        balance = {tid: points_for[tid] - points_against[tid] for tid in team_ids}

        teams_sorted = sorted(
            poule.teams,
            key=lambda t: (points[t.id], balance[t.id]),
            reverse=True
        )

        result.append({
            "id": poule.id,
            "name": poule.name,
            "teams": [
                {
                    "id": team.id,
                    "name": team.name,
                    "points": points[team.id],
                    "points_for": points_for[team.id],
                    "points_against": points_against[team.id],
                    "balance": balance[team.id],
                    "played": len([m for m in played_matches if m.home_team_id == team.id or m.away_team_id == team.id]),
                }
                for team in teams_sorted
            ],
        })

    return result


def _get_tournament_progression_level(db: Session, tournament_id: int, team_id: int):
    """
    Determine tournament progression level for a team based on their poule rank.
    Returns: (level, final_position)
    - level: 1=positions 1-4 (#1 teams), 2=positions 5-8 (#2 teams), 3=positions 9-12 (#3 teams), 4=positions 13-16 (#4 teams), 5=group only
    - final_position: 1=winner, 2=runner-up (only for final participants), None=not in final
    """
    # Check if team was in final (only #1 teams can reach final)
    final_round = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type == "final"
    ).first()
    
    if final_round:
        final_match = db.query(Match).filter(Match.round_id == final_round.id).first()
        if final_match and final_match.home_team_id and final_match.away_team_id:
            # Check if match is complete
            if (final_match.home_set1_score is not None and final_match.away_set1_score is not None
                and final_match.home_set2_score is not None and final_match.away_set2_score is not None
                and not (final_match.home_set1_score == 0 and final_match.away_set1_score == 0)
                and not (final_match.home_set2_score == 0 and final_match.away_set2_score == 0)):
                
                if final_match.home_team_id == team_id or final_match.away_team_id == team_id:
                    # Determine winner
                    h1, a1 = final_match.home_set1_score or 0, final_match.away_set1_score or 0
                    h2, a2 = final_match.home_set2_score or 0, final_match.away_set2_score or 0
                    home_sets = (1 if h1 > a1 else 0) + (1 if h2 > a2 else 0)
                    away_sets = (1 if a1 > h1 else 0) + (1 if a2 > h2 else 0)
                    
                    if home_sets > away_sets:
                        return (1, 1 if final_match.home_team_id == team_id else 2)
                    elif away_sets > home_sets:
                        return (1, 1 if final_match.away_team_id == team_id else 2)
                    # Tie: use total points
                    if (h1 + h2) > (a1 + a2):
                        return (1, 1 if final_match.home_team_id == team_id else 2)
                    elif (a1 + a2) > (h1 + h2):
                        return (1, 1 if final_match.away_team_id == team_id else 2)
                    # Still tied: both get position 1.5 (shouldn't happen, but handle gracefully)
                    return (1, 1.5)
    
    # Determine level based on poule rank position
    # Find which poule rank this team achieved
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team or not team.poule_id:
        return (5, None)  # Team not in a poule - group only
    
    poule = db.query(Poule).filter(Poule.id == team.poule_id).first()
    if not poule:
        return (5, None)  # Poule not found - group only
    
    # Calculate poule standings to find team's rank
    poule_matches = db.query(Match).filter(Match.poule_id == poule.id).all()
    played_matches = [
        m for m in poule_matches
        if m.home_set1_score is not None and m.away_set1_score is not None
        and m.home_set2_score is not None and m.away_set2_score is not None
        and not (m.home_set1_score == 0 and m.away_set1_score == 0)
        and not (m.home_set2_score == 0 and m.away_set2_score == 0)
    ]
    
    team_ids = [t.id for t in poule.teams]
    points, points_for, points_against = _points_for_against_played(played_matches, team_ids)
    balance = {tid: points_for[tid] - points_against[tid] for tid in team_ids}
    
    teams_sorted = sorted(
        poule.teams,
        key=lambda t: (points[t.id], balance[t.id]),
        reverse=True
    )
    
    # Find team's rank (1-indexed)
    team_rank_position = None
    for idx, t in enumerate(teams_sorted):
        if t.id == team_id:
            team_rank_position = idx + 1
            break
    
    if not team_rank_position:
        return (5, None)  # Team not found in poule standings
    
    # Map poule rank to progression level:
    # Rank 1 → level 1 (positions 1-4)
    # Rank 2 → level 2 (positions 5-8)
    # Rank 3 → level 3 (positions 9-12)
    # Rank 4 → level 4 (positions 13-16)
    # Rank 5+ → level 5 (group only, ranked by group points)
    
    if team_rank_position == 1:
        # Check if team reached final (already checked above)
        # If not in final, they're still level 1 (positions 1-4)
        return (1, None)
    elif team_rank_position == 2:
        return (2, None)  # Positions 5-8
    elif team_rank_position == 3:
        return (3, None)  # Positions 9-12
    elif team_rank_position == 4:
        return (4, None)  # Positions 13-16
    else:
        return (5, None)  # Group only, ranked by group phase points


@app.get("/tournaments/{tournament_id}/overall-standings")
def get_overall_standings(tournament_id: int, db: Session = Depends(get_db)):
    """
    Overall ranking of all teams.
    Ranking prioritizes tournament progression:
    1. Final participants (winner #1, runner-up #2)
    2. Semi-final participants (ranked by group phase points)
    3. Quarter-final participants (ranked by group phase points)
    4. Group phase only teams (ranked by group phase points)
    Within each level, teams are sorted by group phase points, then balance.
    """
    group_matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.poule_id.isnot(None),
    ).all()

    played = [
        m for m in group_matches
        if m.home_set1_score is not None and m.away_set1_score is not None
        and m.home_set2_score is not None and m.away_set2_score is not None
        and not (m.home_set1_score == 0 and m.away_set1_score == 0)
        and not (m.home_set2_score == 0 and m.away_set2_score == 0)
    ]

    # Also get knockout and final matches for "played" count
    knockout_rounds = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type.in_(["knockout", "final"])
    ).all()
    knockout_match_ids = [r.id for r in knockout_rounds]
    knockout_matches = db.query(Match).filter(Match.round_id.in_(knockout_match_ids)).all() if knockout_match_ids else []
    
    played_knockout = [
        m for m in knockout_matches
        if m.home_set1_score is not None and m.away_set1_score is not None
        and m.home_set2_score is not None and m.away_set2_score is not None
        and not (m.home_set1_score == 0 and m.away_set1_score == 0)
        and not (m.home_set2_score == 0 and m.away_set2_score == 0)
    ]

    teams = db.query(models.Team).filter(models.Team.tournament_id == tournament_id).all()
    team_ids = [t.id for t in teams]
    points, points_for, points_against = _points_for_against_played(played, team_ids)
    balance = {tid: points_for[tid] - points_against[tid] for tid in team_ids}
    
    # Get progression level for each team
    progression_data = {}
    for team in teams:
        level, final_pos = _get_tournament_progression_level(db, tournament_id, team.id)
        progression_data[team.id] = {
            "level": level,  # 1=positions 1-4 (#1), 2=positions 5-8 (#2), 3=positions 9-12 (#3), 4=positions 13-16 (#4), 5=group only
            "final_position": final_pos  # 1=winner, 2=runner-up (only for final participants), None=not in final
        }
    
    # Calculate knockout points for ranking (separate from group phase points)
    # Knockout points: 2 for win per set, 1 for draw per set, 0 for loss per set
    knockout_points = {tid: 0 for tid in team_ids}
    knockout_balance = {tid: 0 for tid in team_ids}  # Set point difference in knockout matches
    
    for m in played_knockout:
        if not m.home_team_id or not m.away_team_id:
            continue
        
        # Calculate points from sets
        h1, a1 = m.home_set1_score or 0, m.away_set1_score or 0
        h2, a2 = m.home_set2_score or 0, m.away_set2_score or 0
        
        # Points per set: 2 for win, 1 for draw, 0 for loss
        if h1 > a1:
            knockout_points[m.home_team_id] += 2
        elif a1 > h1:
            knockout_points[m.away_team_id] += 2
        else:
            knockout_points[m.home_team_id] += 1
            knockout_points[m.away_team_id] += 1
        
        if h2 > a2:
            knockout_points[m.home_team_id] += 2
        elif a2 > h2:
            knockout_points[m.away_team_id] += 2
        else:
            knockout_points[m.home_team_id] += 1
            knockout_points[m.away_team_id] += 1
        
        # Balance: total points scored minus conceded in knockout
        knockout_balance[m.home_team_id] += (h1 + h2) - (a1 + a2)
        knockout_balance[m.away_team_id] += (a1 + a2) - (h1 + h2)
    
    # Debug: Print progression levels to help diagnose issues
    # (Remove this in production if needed)
    import sys
    print(f"DEBUG: Progression levels for tournament {tournament_id}:", file=sys.stderr)
    for team in sorted(teams, key=lambda t: progression_data[t.id]["level"]):
        kp = knockout_points[team.id] if progression_data[team.id]["level"] in [1, 2, 3, 4] else 0
        print(f"  {team.name}: level={progression_data[team.id]['level']}, final_pos={progression_data[team.id]['final_position']}, knockout_pts={kp}, group_pts={points[team.id]}", file=sys.stderr)
    
    # Sort teams:
    # 1. By progression level (lower = better: 1 < 2 < 3 < 4 < 5)
    #    Level 1 = positions 1-4 (#1 teams), Level 2 = positions 5-8 (#2 teams)
    #    Level 3 = positions 9-12 (#3 teams), Level 4 = positions 13-16 (#4 teams)
    #    Level 5 = group only (ranked by group phase points)
    # 2. Within final (level 1): by final_position (1 < 2), then knockout points
    # 3. Within knockout levels (1, 2, 3, 4): by knockout points (desc), then knockout balance (desc)
    # 4. Within group only (level 5): by group phase points (desc), then balance (desc)
    teams_sorted = sorted(
        teams,
        key=lambda t: (
            progression_data[t.id]["level"],  # Lower level = better progression
            progression_data[t.id]["final_position"] if progression_data[t.id]["final_position"] is not None else 999,  # Final position (1=winner, 2=runner-up)
            # For knockout levels (1, 2, 3, 4): use knockout points for ranking
            # For group only (5): use group phase points for ranking
            -knockout_points[t.id] if progression_data[t.id]["level"] in [1, 2, 3, 4] else -points[t.id],  # Negative for descending order
            -knockout_balance[t.id] if progression_data[t.id]["level"] in [1, 2, 3, 4] else -balance[t.id]  # Negative for descending order
        )
    )

    # Calculate total played matches (group + knockout)
    def count_played_matches(team_id):
        group_count = len([m for m in played if m.home_team_id == team_id or m.away_team_id == team_id])
        knockout_count = len([m for m in played_knockout if m.home_team_id == team_id or m.away_team_id == team_id])
        return group_count + knockout_count

    return [
        {
            "rank": i + 1,
            "id": t.id,
            "name": t.name,
            "points": points[t.id],
            "points_for": points_for[t.id],
            "points_against": points_against[t.id],
            "balance": balance[t.id],
            "played": count_played_matches(t.id),
            "progression_level": progression_data[t.id]["level"],
            "final_position": progression_data[t.id]["final_position"],
        }
        for i, t in enumerate(teams_sorted)
    ]


@app.get("/tournaments/{tournament_id}/rounds")
def get_rounds(tournament_id: int, db: Session = Depends(get_db)):
    rounds = (
        db.query(Round)
        .filter(Round.tournament_id == tournament_id)
        .order_by(Round.round_number)
        .all()
    )

    result = []

    for rnd in rounds:
        matches = (
            db.query(Match)
            .filter(Match.round_id == rnd.id)
            .all()
        )

        result.append({
            "id": rnd.id,
            "round_number": rnd.round_number,
            "type": rnd.type,
            "start_time": rnd.start_time.strftime("%H:%M"),
            "end_time": rnd.end_time.strftime("%H:%M"),  # optional, useful for frontend
            "matches": [
                {
                    "id": m.id,
                    "field_number": m.field_number,
                    "home_team": {"name": m.home_team.name} if m.home_team else None,
                    "away_team": {"name": m.away_team.name} if m.away_team else None,
                    "referee_team": {"name": m.referee_team.name} if m.referee_team else None,
                    "home_rank_position": m.home_rank_position,
                    "away_rank_position": m.away_rank_position,
                    "home_rank_poule": (
                        {"name": m.home_rank_poule.name} 
                        if m.home_rank_poule else None
                    ),
                    "away_rank_poule":(
                        {"name": m.away_rank_poule.name}
                        if m.away_rank_poule else None
                    ),
                    "home_set1_score": m.home_set1_score,
                    "away_set1_score": m.away_set1_score,
                    "home_set2_score": m.home_set2_score,
                    "away_set2_score": m.away_set2_score,
                }
                for m in matches
            ]
        })

    return result

@app.get("/tournaments/{tournament_id}/phase-status")
def get_phase_status(tournament_id: int, db: Session = Depends(get_db)):
    """Check if phases are complete (all matches have scores filled in)."""
    def is_match_complete(m):
        """Check if a match has all scores filled in."""
        return (
            m.home_set1_score is not None and m.away_set1_score is not None
            and m.home_set2_score is not None and m.away_set2_score is not None
            and not (m.home_set1_score == 0 and m.away_set1_score == 0)
            and not (m.home_set2_score == 0 and m.away_set2_score == 0)
        )
    
    # Check group phase completion
    group_matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.poule_id.isnot(None)
    ).all()
    
    group_complete = len(group_matches) > 0 and all(is_match_complete(m) for m in group_matches)
    
    # Check knockout phase completion
    knockout_rounds = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type == "knockout"
    ).all()
    
    knockout_complete = False
    knockout_matches_total = 0
    knockout_matches_completed = 0
    
    if knockout_rounds:
        knockout_round_ids = [r.id for r in knockout_rounds]
        knockout_matches = db.query(Match).filter(
            Match.round_id.in_(knockout_round_ids)
        ).all()
        knockout_matches_total = len(knockout_matches)
        knockout_matches_completed = len([m for m in knockout_matches if is_match_complete(m)])
        knockout_complete = knockout_matches_total > 0 and all(is_match_complete(m) for m in knockout_matches)
    
    return {
        "group_phase_complete": group_complete,
        "knockout_phase_complete": knockout_complete,
        "group_matches_total": len(group_matches),
        "group_matches_completed": len([m for m in group_matches if is_match_complete(m)]),
        "knockout_matches_total": knockout_matches_total,
        "knockout_matches_completed": knockout_matches_completed
    }


@app.post("/matches/{match_id}/score")
def submit_score(
    match_id: int,
    score_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    match.home_set1_score = score_data.get("home_set1_score")
    match.away_set1_score = score_data.get("away_set1_score")
    match.home_set2_score = score_data.get("home_set2_score")
    match.away_set2_score = score_data.get("away_set2_score")

    db.commit()

    return {"message": "Score opgeslagen"}














