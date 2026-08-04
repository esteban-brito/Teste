"""Extrai uma demo declarada no corpus IFCS sem alterar o manifesto."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import uuid
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "1.0"
EXPECTED_AWPY_VERSION = "2.0.2"
DEFAULT_OPTIONS: dict[str, Any] = {
    "tickrate": 128,
    "infernoDuration": 7.03125,
    "smokeDuration": 20.0,
    "events": [
        "round_freeze_end",
        "round_officially_ended",
        "player_spawn",
        "player_given_c4",
        "bomb_pickup",
        "item_pickup",
        "player_hurt",
        "player_death",
        "bomb_dropped",
        "bomb_planted",
        "bomb_defused",
        "bomb_exploded",
        "flashbang_detonate",
        "hegrenade_detonate",
        "smokegrenade_detonate",
        "smokegrenade_expired",
        "inferno_startburn",
        "inferno_expire",
    ],
    "playerProps": ["team_clan_name"],
    "otherProps": [],
}
REQUIRED_EVENTS = {
    "round_freeze_end",
    "round_officially_ended",
    "player_hurt",
    "player_death",
    "bomb_planted",
}


def normalize_canonical_numbers(value: Any) -> Any:
    """Alinha floats integrais ao JSON.stringify usado pelo verificador Node."""
    if isinstance(value, dict):
        return {key: normalize_canonical_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize_canonical_numbers(item) for item in value]
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def canonical_json(value: Any) -> str:
    return json.dumps(
        normalize_canonical_numbers(value),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def script_sha256() -> str:
    return sha256_file(Path(__file__).resolve())


def options_sha256(options: dict[str, Any]) -> str:
    return sha256_bytes(canonical_json(options).encode("utf-8"))


def manifest_sha256(manifest: dict[str, Any]) -> str:
    payload = dict(manifest)
    payload.pop("declaredSha256", None)
    return sha256_bytes(canonical_json(payload).encode("utf-8"))


def load_environment() -> tuple[Any, Any, str]:
    try:
        import awpy
        import polars
        from awpy import Demo
    except ImportError as error:
        raise RuntimeError(
            "Awpy ausente; crie .venv-fidelity e instale tools/requirements-fidelity.lock"
        ) from error
    version = getattr(awpy, "__version__", "")
    if version != EXPECTED_AWPY_VERSION:
        raise RuntimeError(f"Awpy {version or 'desconhecido'}; esperado {EXPECTED_AWPY_VERSION}")
    return Demo, polars, version


def safe_child(root: Path, relative: str, label: str) -> Path:
    if not relative or "\\" in relative:
        raise ValueError(f"{label} precisa usar caminho relativo POSIX")
    candidate = (root / Path(*relative.split("/"))).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as error:
        raise ValueError(f"{label} saiu da raiz do manifesto") from error
    return candidate


def load_manifest(file: Path) -> dict[str, Any]:
    manifest = json.loads(file.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"schemaVersion deve ser {SCHEMA_VERSION}")
    computed = manifest_sha256(manifest)
    if manifest.get("declaredSha256") != computed:
        raise ValueError("conteúdo do manifesto diverge de declaredSha256")
    parser = manifest.get("parser", {})
    if parser.get("name") != "awpy" or parser.get("version") != EXPECTED_AWPY_VERSION:
        raise ValueError("manifesto não está congelado em awpy 2.0.2")
    if parser.get("scriptSha256") != script_sha256():
        raise ValueError("scriptSha256 diverge deste extrator")
    options = parser.get("options")
    if not isinstance(options, dict) or parser.get("optionsSha256") != options_sha256(options):
        raise ValueError("optionsSha256 diverge das opções do parser")
    missing = REQUIRED_EVENTS.difference(options.get("events", []))
    if missing:
        raise ValueError(f"eventos obrigatórios ausentes: {', '.join(sorted(missing))}")
    return manifest


def find_map(manifest: dict[str, Any], map_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    found: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for match in manifest.get("matches", []):
        for map_entry in match.get("maps", []):
            if map_entry.get("id") == map_id:
                found.append((match, map_entry))
    if len(found) != 1:
        raise ValueError(f"mapId deve aparecer exatamente uma vez; encontrado {len(found)}")
    match, map_entry = found[0]
    if map_entry.get("status") != "valid":
        raise ValueError("mapa excluído não pode ser extraído")
    return match, map_entry


def verify_demo(root: Path, map_entry: dict[str, Any]) -> Path:
    demo = map_entry.get("demo", {})
    if demo.get("format") != "dem":
        raise ValueError("artefato local precisa ser .dem extraída")
    file = safe_child(root, demo.get("localPath", ""), "demo.localPath")
    if not file.is_file():
        raise FileNotFoundError(f"demo não encontrada: {file}")
    if file.stat().st_size != demo.get("bytes"):
        raise ValueError("tamanho da demo diverge do manifesto")
    if sha256_file(file) != demo.get("sha256"):
        raise ValueError("SHA-256 da demo diverge do manifesto")
    return file


def winner_scores(demo: Any, teams: list[dict[str, str]]) -> dict[str, int]:
    aliases = {team.get("demoTeamName", team["name"]): team["name"] for team in teams}
    if len(aliases) != len(teams):
        raise ValueError("demoTeamName precisa identificar os dois times sem ambiguidade")
    counts_by_round_side: dict[tuple[int, str], dict[str, int]] = {}
    rows = demo.ticks.select(["round_num", "side", "team_clan_name"]).drop_nulls().to_dicts()
    for row in rows:
        team = aliases.get(row.get("team_clan_name"))
        if team:
            key = (row["round_num"], row["side"])
            counts = counts_by_round_side.setdefault(key, {})
            counts[team] = counts.get(team, 0) + 1

    side_by_round: dict[tuple[int, str], str] = {}
    for key, counts in counts_by_round_side.items():
        ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        if not ranked or (len(ranked) > 1 and ranked[0][1] == ranked[1][1]):
            raise ValueError(f"round {key[0]}: lado {key[1]} não possui time dominante")
        if ranked[0][1] * 2 <= sum(counts.values()):
            raise ValueError(f"round {key[0]}: lado {key[1]} não possui maioria de time")
        side_by_round[key] = ranked[0][0]

    scores = {team["name"]: 0 for team in teams}
    for round_row in demo.rounds.select(["round_num", "winner"]).to_dicts():
        round_num = round_row["round_num"]
        winner_side = round_row["winner"]
        winner_team = side_by_round.get((round_num, winner_side))
        ct_team = side_by_round.get((round_num, "ct"))
        t_team = side_by_round.get((round_num, "t"))
        if not winner_team or not ct_team or not t_team or ct_team == t_team:
            raise ValueError(
                f"round {round_num}: lados não resolvem para dois times distintos"
            )
        scores[winner_team] += 1
    return scores


def table_record(file: Path, rows: int, columns: list[str], root: Path) -> dict[str, Any]:
    return {
        "path": file.relative_to(root).as_posix(),
        "sha256": sha256_file(file),
        "bytes": file.stat().st_size,
        "rows": rows,
        "columns": columns,
    }


def extract(manifest_file: Path, map_id: str, output_relative: str) -> dict[str, Any]:
    Demo, _, awpy_version = load_environment()
    manifest_file = manifest_file.resolve()
    root = manifest_file.parent
    manifest = load_manifest(manifest_file)
    match, map_entry = find_map(manifest, map_id)
    demo_file = verify_demo(root, map_entry)
    output = safe_child(root, output_relative, "output")
    if output.exists():
        raise FileExistsError(f"saída já existe e não será sobrescrita: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.parent / f".{output.name}.tmp-{uuid.uuid4().hex}"
    temporary.mkdir()
    try:
        options = manifest["parser"]["options"]
        demo = Demo(
            demo_file,
            tickrate=options["tickrate"],
            inferno_duration=options["infernoDuration"],
            smoke_duration=options["smokeDuration"],
            verbose=False,
        )
        demo.parse(
            events=options["events"],
            player_props=options["playerProps"],
            other_props=options["otherProps"],
        )

        tables: dict[str, dict[str, Any]] = {}
        rounds_file = temporary / "rounds.parquet"
        demo.rounds.write_parquet(rounds_file)
        tables["rounds"] = table_record(rounds_file, demo.rounds.height, demo.rounds.columns, temporary)

        # A agregação do Awpy não promete ordem de linhas; ordená-la torna o
        # Parquet reproduzível por hash sem alterar nenhum valor observado.
        player_rounds = demo.player_round_totals.sort(["steamid", "side", "name", "n_rounds"])
        player_rounds_file = temporary / "player-round-totals.parquet"
        player_rounds.write_parquet(player_rounds_file)
        tables["playerRoundTotals"] = table_record(
            player_rounds_file, player_rounds.height, player_rounds.columns, temporary
        )

        events_dir = temporary / "events"
        events_dir.mkdir()
        for event_name in sorted(demo.events):
            frame = demo.events[event_name]
            event_file = events_dir / f"{event_name}.parquet"
            frame.write_parquet(event_file)
            tables[f"event:{event_name}"] = table_record(
                event_file, frame.height, frame.columns, temporary
            )

        expected_teams = [team["name"] for team in match["teams"]]
        scores = winner_scores(demo, match["teams"])
        steam_ids = {
            value
            for value in demo.ticks.get_column("steamid").drop_nulls().unique().to_list()
            if str(value) not in {"0", ""}
        }
        map_name = demo.header.get("map_name")
        parsed = {
            "demoSha256": map_entry["demo"]["sha256"],
            "parserVersion": awpy_version,
            "mapName": map_name,
            "teamA": expected_teams[0],
            "teamB": expected_teams[1],
            "teamAScore": scores[expected_teams[0]],
            "teamBScore": scores[expected_teams[1]],
            "roundCount": demo.rounds.height,
            "playerCount": len(steam_ids),
        }
        expected_parsed = map_entry.get("parsed", {})
        differences = {} if not expected_parsed else {
            key: {"manifest": expected_parsed.get(key), "extracted": value}
            for key, value in parsed.items()
            if expected_parsed.get(key) != value
        }
        if differences:
            raise ValueError(f"resumo extraído diverge do manifesto: {canonical_json(differences)}")

        summary = {
            "schemaVersion": SCHEMA_VERSION,
            "manifestSha256": manifest["declaredSha256"],
            "mapId": map_id,
            "parsed": parsed,
            "header": demo.header,
            "tables": tables,
        }
        summary_file = temporary / "summary.json"
        summary_file.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(output)
        return {**summary, "output": output.relative_to(root).as_posix()}
    except Exception:
        if temporary.exists():
            shutil.rmtree(temporary)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extrator auditável de uma demo IFCS")
    parser.add_argument("--check-environment", action="store_true")
    parser.add_argument("--fingerprint", action="store_true")
    parser.add_argument("--options-template", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--map-id")
    parser.add_argument("--output")
    return parser.parse_args()


def self_test() -> dict[str, Any]:
    _, polars, version = load_environment()
    expected_options_hash = "1f67eae99d2ad0d9c8527d1dc34d381d07367b7f805710a839085a2a2a709570"
    if options_sha256(DEFAULT_OPTIONS) != expected_options_hash:
        raise AssertionError("hash canônico das opções divergiu do contrato Node/Python")
    if canonical_json({"duration": 20.0}) != '{"duration":20}':
        raise AssertionError("float integral não foi normalizado")

    class SyntheticDemo:
        ticks = polars.DataFrame(
            {
                "round_num": [1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
                "side": ["ct", "ct", "t", "t", "ct", "ct", "ct", "t", "t", "t"],
                "team_clan_name": [
                    "Alpha", "Alpha", "Beta Internal", "Beta Internal",
                    "Beta Internal", "Beta Internal", "Alpha", "Alpha", "Alpha", "Beta Internal",
                ],
            }
        )
        rounds = polars.DataFrame({"round_num": [1, 2], "winner": ["ct", "ct"]})

    scores = winner_scores(
        SyntheticDemo(),
        [{"name": "Alpha"}, {"name": "Beta", "demoTeamName": "Beta Internal"}],
    )
    if scores != {"Alpha": 1, "Beta": 1}:
        raise AssertionError(f"resolução lado→time incorreta: {scores}")
    return {"ok": True, "awpy": version, "polars": polars.__version__, "scores": scores}


def main() -> int:
    args = parse_args()
    if args.fingerprint:
        print(json.dumps({"scriptSha256": script_sha256()}))
        return 0
    if args.options_template:
        print(json.dumps({"options": DEFAULT_OPTIONS, "optionsSha256": options_sha256(DEFAULT_OPTIONS)}, ensure_ascii=False, indent=2))
        return 0
    if args.check_environment:
        _, polars, version = load_environment()
        print(json.dumps({"python": sys.version.split()[0], "awpy": version, "polars": polars.__version__}))
        return 0
    if args.self_test:
        print(json.dumps(self_test(), ensure_ascii=False))
        return 0
    if not args.manifest or not args.map_id or not args.output:
        raise ValueError("--manifest, --map-id e --output são obrigatórios para extrair")
    print(json.dumps(extract(args.manifest, args.map_id, args.output), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Demo IFCS não extraída: {error}", file=sys.stderr)
        raise SystemExit(1) from error
