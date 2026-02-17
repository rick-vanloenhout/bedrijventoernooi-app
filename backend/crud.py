from fastapi import HTTPException
from sqlalchemy.orm import Session
from . import models, schemas

def create_team(db: Session, tournament_id: int, team: schemas.TeamCreate):
    # If a poule_id is provided, check it belongs to the tournament
    if hasattr(team, "poule_id") and team.poule_id is not None:
        poule = db.query(models.Poule).filter(
            models.Poule.id == team.poule_id,
            models.Poule.tournament_id == tournament_id
        ).first()

        if not poule:
            raise HTTPException(
                status_code=400,
                detail="Poule does not belong to this tournament"
            )
        poule_id = team.poule_id
    else:
        poule_id = None

    # Create the team
    db_team = models.Team(
        name=team.name,
        tournament_id=tournament_id,
        poule_id=poule_id
    )
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


def get_teams_for_tournament(db: Session, tournament_id: int):
    return (
        db.query(models.Team)
        .filter(models.Team.tournament_id == tournament_id)
        .all()
    )
