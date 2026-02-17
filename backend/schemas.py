from pydantic import BaseModel
from typing import Optional

# Tournament
class TournamentBase(BaseModel):
    name: str
    num_fields: int
    match_duration_minutes: int
    break_duration_minutes: int
    start_time: str  # format HH:MM

class TournamentCreate(BaseModel):
    name: str
    num_fields: int
    match_duration_minutes: int
    break_duration_minutes: int
    start_time: str

class TournamentRead(BaseModel):
    id: int
    name: str
    num_fields: int
    match_duration_minutes: int
    break_duration_minutes: int
    start_time: str

    model_config = {
        "from_attributes": True
    }

class TournamentUpdate(BaseModel):
    name: str
    num_fields: int
    match_duration_minutes: int
    break_duration_minutes: int
    start_time: str

# Team
class TeamCreate(BaseModel):
    name: str
    poule_id: int


class TeamRead(BaseModel):
    id: int
    name: str
    tournament_id: int
    poule_id: int

    model_config = {
        "from_attributes": True
    }

class TeamUpdate(BaseModel):
    name: str
    poule_id: Optional[int] = None

# Poule
class PouleCreate(BaseModel):
    name: str
#     tournament_id: int

class PouleRead(BaseModel):
    id: int
    name: str
    tournament_id: int

    model_config = {
        "from_attributes": True
    }

