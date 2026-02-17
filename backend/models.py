from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Integer, default=1)  # 1 = active, 0 = inactive


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    num_fields = Column(Integer, nullable=False)
    match_duration_minutes = Column(Integer, nullable=False)
    break_duration_minutes = Column(Integer, nullable=False)

    poules = relationship("Poule", back_populates="tournament", cascade="all, delete-orphan")
    teams = relationship("Team", back_populates="tournament", cascade="all, delete-orphan")
    rounds = relationship("Round", back_populates="tournament", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="tournament", cascade="all, delete-orphan")


class Poule(Base):
    __tablename__ = "poules"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)

    tournament = relationship("Tournament", back_populates="poules")
    teams = relationship("Team", back_populates="poule", cascade="all, delete-orphan")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)

    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    poule_id = Column(Integer, ForeignKey("poules.id", ondelete="SET NULL"))

    tournament = relationship("Tournament", back_populates="teams")
    poule = relationship("Poule", back_populates="teams")


class Round(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)

    round_number = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # group | knockout | final
    start_time = Column(DateTime)
    end_time = Column(DateTime)

    tournament = relationship("Tournament", back_populates="rounds")
    matches = relationship("Match", back_populates="round", cascade="all, delete-orphan")


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"))
    poule_id = Column(Integer, ForeignKey("poules.id"), nullable=True)

    field_number = Column(Integer)

    start_time = Column(DateTime)
    end_time = Column(DateTime)

    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    referee_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)

    # ✅ NEW – for knockout rounds
    home_rank_poule_id = Column(Integer, ForeignKey("poules.id"), nullable=True)
    home_rank_position = Column(Integer, nullable=True)
    away_rank_poule_id = Column(Integer, ForeignKey("poules.id"), nullable=True)
    away_rank_position = Column(Integer, nullable=True)

    # Set 1 scores
    home_set1_score = Column(Integer, nullable=True)
    away_set1_score = Column(Integer, nullable=True)
    
    # Set 2 scores
    home_set2_score = Column(Integer, nullable=True)
    away_set2_score = Column(Integer, nullable=True)


    tournament = relationship("Tournament", back_populates="matches")
    round = relationship("Round", back_populates="matches")
    poule = relationship("Poule", foreign_keys=[poule_id])

    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    referee_team = relationship("Team", foreign_keys=[referee_team_id])

    home_rank_poule = relationship("Poule", foreign_keys=[home_rank_poule_id])
    away_rank_poule = relationship("Poule", foreign_keys=[away_rank_poule_id])

