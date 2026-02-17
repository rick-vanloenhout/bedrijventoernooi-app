from datetime import timedelta, datetime
from sqlalchemy.orm import Session
from backend.models import Tournament, Poule, Team, Round, Match


def _set_points_for_against(matches, team_ids):
    """From a list of matches (with home/away team and set scores), compute points_for and points_against per team."""
    points_for = {tid: 0 for tid in team_ids}
    points_against = {tid: 0 for tid in team_ids}
    for m in matches:
        if not m.home_team_id or not m.away_team_id:
            continue
        for (home_s, away_s) in [(m.home_set1_score, m.away_set1_score), (m.home_set2_score, m.away_set2_score)]:
            if home_s is not None and away_s is not None:
                points_for[m.home_team_id] = points_for.get(m.home_team_id, 0) + home_s
                points_against[m.home_team_id] = points_against.get(m.home_team_id, 0) + away_s
                points_for[m.away_team_id] = points_for.get(m.away_team_id, 0) + away_s
                points_against[m.away_team_id] = points_against.get(m.away_team_id, 0) + home_s
    return points_for, points_against


def get_team_by_rank(db: Session, poule: Poule, rank: int):
    """
    Get the team by its rank in the poule based on group phase results.
    Points: 2 per set win, 1 per set draw. Tie-breaker: point balance (points scored minus conceded in sets).
    """
    points = {team.id: 0 for team in poule.teams}
    matches = db.query(Match).filter(Match.poule_id == poule.id).all()

    def add_set_points(home_id, away_id, home_score, away_score):
        if home_score is None or away_score is None:
            return
        if home_score > away_score:
            points[home_id] += 2
        elif home_score < away_score:
            points[away_id] += 2
        else:
            points[home_id] += 1
            points[away_id] += 1

    for match in matches:
        if match.home_team_id and match.away_team_id:
            add_set_points(match.home_team_id, match.away_team_id, match.home_set1_score, match.away_set1_score)
            add_set_points(match.home_team_id, match.away_team_id, match.home_set2_score, match.away_set2_score)

    points_for, points_against = _set_points_for_against(matches, [t.id for t in poule.teams])
    balance = {tid: points_for.get(tid, 0) - points_against.get(tid, 0) for tid in points}

    # Sort by points desc, then by point balance desc
    teams_sorted = sorted(
        poule.teams,
        key=lambda t: (points[t.id], balance.get(t.id, 0)),
        reverse=True
    )

    if rank <= len(teams_sorted):
        return teams_sorted[rank - 1]
    return None


from datetime import timedelta, datetime
from sqlalchemy.orm import Session
from backend.models import Tournament, Poule, Team, Round, Match


# -------------------- GROUP PHASE --------------------
def generate_group_phase(db: Session, tournament_id: int):
    tournament = db.query(Tournament).get(tournament_id)
    if not tournament:
        raise ValueError("Tournament not found")

    fields = tournament.num_fields
    match_duration = tournament.match_duration_minutes
    current_time = datetime.strptime(tournament.start_time, "%H:%M")

    poules = db.query(Poule).filter(Poule.tournament_id == tournament_id).all()

    # Prepare round-robin matches for each poule
    poule_matches = {}
    for poule in poules:
        teams = db.query(Team).filter(Team.poule_id == poule.id).all()
        team_list = teams[:]

        if len(team_list) < 2:
            continue

        # Round robin (circle method)
        if len(team_list) % 2 == 1:
            team_list.append(None)

        n = len(team_list)
        rounds_count = n - 1
        matches = []

        for r in range(rounds_count):
            for i in range(n // 2):
                t1 = team_list[i]
                t2 = team_list[n - 1 - i]

                if t1 and t2:
                    matches.append((poule, t1, t2))

            # rotate
            team_list = [team_list[0]] + [team_list[-1]] + team_list[1:-1]

        poule_matches[poule.id] = matches

    # Schedule rounds respecting field limits
    active = True
    round_number = 1
    score_count = {
        team.id: 0
        for poule in poules
        for team in db.query(Team).filter(Team.poule_id == poule.id).all()
    }

    while active:
        active = False
        round_matches = []

        for poule in poules:
            if poule_matches[poule.id]:
                active = True
                round_matches.append(poule_matches[poule.id].pop(0))

        if not round_matches:
            break

        # Split into chunks if more matches than fields
        for i in range(0, len(round_matches), fields):
            chunk = round_matches[i:i + fields]

            new_round = Round(
                tournament_id=tournament_id,
                round_number=round_number,
                type="group",
                start_time=current_time,
                end_time=current_time + timedelta(minutes=match_duration)
            )
            db.add(new_round)
            db.commit()

            for field_index, (poule, home, away) in enumerate(chunk):
                # Choose scorekeeper fairly
                teams_in_poule = db.query(Team).filter(Team.poule_id == poule.id).all()
                possible = [t for t in teams_in_poule if t.id not in [home.id, away.id]]
                score_team = min(possible, key=lambda t: score_count[t.id])
                score_count[score_team.id] += 1

                match = Match(
                    tournament_id=tournament_id,
                    round_id=new_round.id,
                    poule_id=poule.id,
                    home_team_id=home.id,
                    away_team_id=away.id,
                    referee_team_id=score_team.id,
                    field_number=field_index + 1
                )
                db.add(match)

            db.commit()
            current_time += timedelta(minutes=match_duration)
            round_number += 1

    # --------------------
    # KNOCKOUT STRUCTURE (PLACEHOLDERS)
    # --------------------
    # After the group phase, create all knockout rounds with rank-based
    # placeholders (no concrete teams yet). This way the full day schedule
    # is visible immediately; later we resolve teams based on standings.

    poule_pairs = [poules[i:i + 2] for i in range(0, len(poules), 2)]
    knockout_placeholders = []

    if poule_pairs:
        max_rank_overall = 0
        for pair in poule_pairs:
            if len(pair) < 2:
                continue
            poule1, poule2 = pair
            max_rank_overall = max(
                max_rank_overall, len(poule1.teams), len(poule2.teams)
            )

        # Iterate by rank first so #1/#2 matches are scheduled earlier
        for rank in range(1, max_rank_overall + 1):
            for pair in poule_pairs:
                if len(pair) < 2:
                    continue
                poule1, poule2 = pair

                # Only create placeholders if both poules have at least this many teams
                if len(poule1.teams) < rank or len(poule2.teams) < rank:
                    continue

                knockout_placeholders.append({
                    "home_rank_poule_id": poule1.id,
                    "home_rank_position": rank,
                    "away_rank_poule_id": poule2.id,
                    "away_rank_position": rank,
                })

    # Schedule knockout placeholders into rounds, respecting number of fields
    idx = 0
    while idx < len(knockout_placeholders):
        chunk = knockout_placeholders[idx: idx + fields]

        new_round = Round(
            tournament_id=tournament_id,
            round_number=round_number,
            type="knockout",
            start_time=current_time,
            end_time=current_time + timedelta(minutes=match_duration)
        )
        db.add(new_round)
        db.commit()

        for field_index, km in enumerate(chunk):
            match = Match(
                tournament_id=tournament_id,
                round_id=new_round.id,
                home_team_id=None,
                away_team_id=None,
                home_rank_poule_id=km["home_rank_poule_id"],
                home_rank_position=km["home_rank_position"],
                away_rank_poule_id=km["away_rank_poule_id"],
                away_rank_position=km["away_rank_position"],
                field_number=field_index + 1,
                referee_team_id=None,
            )
            db.add(match)

        db.commit()
        idx += fields
        current_time += timedelta(minutes=match_duration)
        round_number += 1

    # --------------------
    # FINAL STRUCTURE (PLACEHOLDER)
    # --------------------
    # Single final match after all knockout rounds; teams filled later
    if knockout_placeholders:
        final_round = Round(
            tournament_id=tournament_id,
            round_number=round_number,
            type="final",
            start_time=current_time,
            end_time=current_time + timedelta(minutes=match_duration)
        )
        db.add(final_round)
        db.commit()

        final_match = Match(
            tournament_id=tournament_id,
            round_id=final_round.id,
            home_team_id=None,
            away_team_id=None,
            field_number=1,
            referee_team_id=None,
        )
        db.add(final_match)
        db.commit()

    return {"message": "Volledig schema succesvol aangemaakt"}


# -------------------- KNOCKOUT PHASE --------------------
def generate_knockout_phase(db: Session, tournament_id: int):
    """
    Resolve knockout placeholders into concrete teams based on current
    poule standings. Does NOT change the structure (rounds/fields).
    """
    # Find all knockout matches for this tournament (order by round for referee assignment)
    knockout_rounds = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type == "knockout"
    ).order_by(Round.round_number).all()
    if not knockout_rounds:
        raise ValueError("Geen knockout rondes gevonden om te vullen.")

    round_ids = [r.id for r in knockout_rounds]
    matches = db.query(Match).filter(Match.round_id.in_(round_ids)).all()

    if not matches:
        return {"message": "Geen knockout-wedstrijden om in te vullen."}

    # Resolve each match's rank placeholders to concrete teams
    for m in matches:
        if m.home_rank_poule_id and m.home_rank_position:
            poule = db.query(Poule).filter(Poule.id == m.home_rank_poule_id).first()
            if poule:
                team = get_team_by_rank(db, poule, m.home_rank_position)
                if team:
                    m.home_team_id = team.id

        if m.away_rank_poule_id and m.away_rank_position:
            poule = db.query(Poule).filter(Poule.id == m.away_rank_poule_id).first()
            if poule:
                team = get_team_by_rank(db, poule, m.away_rank_position)
                if team:
                    m.away_team_id = team.id

    db.commit()

    # Assign scorekeepers: team that does not play in that round and has kept score least so far
    all_teams = db.query(Team).filter(Team.tournament_id == tournament_id).all()
    referee_count = {t.id: 0 for t in all_teams}
    for m in db.query(Match).filter(Match.tournament_id == tournament_id).all():
        if m.referee_team_id:
            referee_count[m.referee_team_id] = referee_count.get(m.referee_team_id, 0) + 1

    for rnd in knockout_rounds:
        round_matches = [m for m in matches if m.round_id == rnd.id]
        playing_ids = set()
        for m in round_matches:
            if m.home_team_id:
                playing_ids.add(m.home_team_id)
            if m.away_team_id:
                playing_ids.add(m.away_team_id)

        for m in round_matches:
            if not m.home_team_id or not m.away_team_id:
                continue
            candidates = [t for t in all_teams if t.id not in playing_ids and t.id not in (m.home_team_id, m.away_team_id)]
            if not candidates:
                continue
            ref = min(candidates, key=lambda t: referee_count[t.id])
            m.referee_team_id = ref.id
            referee_count[ref.id] += 1

    db.commit()
    return {"message": "Knockout-wedstrijden succesvol ingevuld op basis van standen (incl. tellers)"}


def generate_final(db: Session, tournament_id: int):
    """
    Generate a single final match between the winners of the
    #1 vs #1 knockout matches (for tournaments where such matches exist).
    """
    # Find existing final round and match
    final_round = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type == "final"
    ).first()
    if not final_round:
        raise ValueError("Geen finale-ronde gevonden om te vullen.")

    final_match = db.query(Match).filter(Match.round_id == final_round.id).first()
    if not final_match:
        raise ValueError("Geen finalewedstrijd gevonden om te vullen.")

    # Find all knockout matches where #1 vs #1 was played
    knockout_rounds = db.query(Round).filter(
        Round.tournament_id == tournament_id,
        Round.type == "knockout"
    ).all()
    if not knockout_rounds:
        raise ValueError("Geen knockout rondes gevonden voor deze finale.")

    knockout_round_ids = [r.id for r in knockout_rounds]

    first_place_matches = db.query(Match).filter(
        Match.round_id.in_(knockout_round_ids),
        Match.home_rank_position == 1,
        Match.away_rank_position == 1
    ).all()

    if len(first_place_matches) < 2:
        raise ValueError("Niet genoeg #1 vs #1 wedstrijden om een finale te maken.")

    def winner_of(m):
        """Winner from set scores: more sets won; if 1-1, higher total set points."""
        h1, a1 = m.home_set1_score or 0, m.away_set1_score or 0
        h2, a2 = m.home_set2_score or 0, m.away_set2_score or 0
        home_sets = (1 if h1 > a1 else 0) + (1 if h2 > a2 else 0)
        away_sets = (1 if a1 > h1 else 0) + (1 if a2 > h2 else 0)
        if home_sets > away_sets:
            return m.home_team
        if away_sets > home_sets:
            return m.away_team
        # 1-1 sets: tie-break by total points scored in sets
        if (h1 + h2) > (a1 + a2):
            return m.home_team
        if (a1 + a2) > (h1 + h2):
            return m.away_team
        return None

    winners = []
    for m in first_place_matches:
        w = winner_of(m)
        if not w:
            raise ValueError("Gelijkspel in een #1 vs #1 wedstrijd; kan geen finale genereren.")
        winners.append(w)

    if len(winners) < 2:
        raise ValueError("Niet genoeg winnaars gevonden voor de finale.")

    # Fill existing final match with the two winners
    final_match.home_team_id = winners[0].id
    final_match.away_team_id = winners[1].id
    db.commit()

    return {"message": "Finale succesvol ingevuld op basis van knockout winnaars"}

